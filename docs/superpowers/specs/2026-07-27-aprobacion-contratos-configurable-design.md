# Aprobación de contratos configurable por inmobiliaria

**Fecha:** 2026-07-27
**Rama:** `feat/aprobacion-contratos-configurable` (worktree `~/dev/myalq-aprobacion`, base `origin/main` 867a607)
**Origen:** pedido de Camila Vargas (A&B / "AyV alquileres y ventas") en la reunión del 23/07 — causa `c3` del re-análisis.

## El pedido

Que cuando un empleado carga un contrato, quede **pendiente hasta que la administradora lo revise y apruebe**, en vez de activarse solo. Motivo real de Camila: un contrato figuraba autorizado sin que ella lo autorizara, y hay casos donde el titular o el garante nunca firmaron y ella se entera tarde — cuando ya no le puede cobrar al garante.

## Diagnóstico: el flujo ya existe, está mal disparado

Verificado en código y en la base de producción (solo lectura).

### Lo que YA está construido y funciona

| Pieza | Dónde |
|---|---|
| Contrato nace `BORRADOR` + `pendienteAprobacion` | `apps/api/src/routes/core.ts:990-991` |
| El borrador NO devenga, NO reclama la propiedad, NO manda mail al inquilino | `core.ts:1050-1067`, `core.ts:1089` |
| Se registra quién cargó y con qué rol | `core.ts:1015-1016` (`cargadoPor`, `cargadoRol`) |
| Entrada en la bandeja de Aprobaciones | `core.ts:1057` (`tipo: 'CONTRATO_CARGADO'`) |
| `GET /aprobaciones` y `POST /aprobaciones/:id/aprobar\|rechazar` | `apps/api/src/routes/plata.ts:1982`, `:1993` |
| Aprobar → `ACTIVO` + claim **atómico** de la propiedad (lock anti doble-activación) + devengar | `plata.ts:2028-2060` |
| Rechazar → borra el inquilino creado para que su email no quede tomado para siempre | `plata.ts:2060+` |
| Capacidad `contrato.aprobar` (ADMIN, con PIN) | `packages/shared/src/permisos.ts` |

**No hay que construir el flujo de aprobación. Está completo y ya tiene bugs corregidos adentro.**

### Por qué nunca se disparó

`core.ts:912` hardcodea el disparador:

```ts
const esCarga = u.rol === 'CARGA';
```

Y en producción (consulta read-only del 27/07):

- **Cero usuarios con rol `CARGA`** en toda la plataforma.
- Contratos por rol que los cargó: **ADMIN 8 · OPERADOR 1 · null 2**.
- **La tabla `aprobaciones` está vacía**: la bandeja nunca se usó.
- El contrato que Camila reportó — `humberto primo 555 pb`, de "AyV alquileres y ventas" — tiene `cargadoRol: OPERADOR`, `estado: ACTIVO`, `pendienteAprobacion: false`.

**Su empleada es `OPERADOR`, y OPERADOR activa contratos directo.** Esa es la causa raíz.

### Por qué no alcanza con cambiarle el rol a CARGA

`CARGA` pierde capacidades que la empleada usa a diario: `pagos.ver`, `caja.ver`, `reclamos.ver`, `gasto.caja.cargar`, `pago.manual.cargar`, `reclamos.gestionar`, `comunicaciones.enviar`. Bajarla de rol le arreglaría el control a Camila rompiéndole la operación.

### Deriva adicional que este trabajo corrige

`permisos.ts` ya declara el mecanismo:

```ts
{ key: 'contratos.crear',    roles: [...], rolesAprobacion: ['CARGA'] }
{ key: 'pago.manual.cargar', roles: [...], rolesAprobacion: ['OPERADOR'] }
```

Y hasta tiene su helper listo: `requiereAprobacion(rol, capacidad)` en `packages/shared/src/permisos.ts:142`.

Pero ese helper **no lo llama ningún endpoint**, y `rolesAprobacion` solo lo lee la UI de la matriz (`apps/inmobiliaria/src/components/matriz-permisos-card.tsx:142`). El backend hardcodea el rol por separado. Resultado: **la pantalla de permisos le muestra a Camila una regla que el servidor no aplica.**

## Diseño

### 1. Modelo de datos

Dos columnas nuevas, sin tablas nuevas:

```prisma
model Inmobiliaria {
  // ...
  /** Si los contratos cargados por quien no puede aprobar quedan pendientes de aprobación. */
  contratosRequierenAprobacion Boolean @default(false)
}

model Contrato {
  // ...
  /** Estado inicial declarado en el alta, guardado hasta que se apruebe el borrador. */
  periodosAnterioresPendientes Json?
}
```

`contratosRequierenAprobacion` arranca **apagado**: ninguna inmobiliaria existente cambia de comportamiento al deployar.

### 2. La regla del disparador

Reemplaza el `const esCarga = u.rol === 'CARGA'` de `core.ts:912`:

```ts
import { requiereAprobacion, rolTienePermiso } from '@llave/shared';

const contratoPendiente =
  // baseline global del catálogo (hoy: CARGA) — el backend por fin LEE la matriz
  requiereAprobacion(u.rol, 'contratos.crear')
  // switch del tenant: quien no puede aprobar, necesita aprobación
  || (inmo.contratosRequierenAprobacion && !rolTienePermiso(u.rol, 'contrato.aprobar'));
```

**No hay helper nuevo que escribir:** `requiereAprobacion(rol, capacidad)` ya existe (`packages/shared/src/permisos.ts:142`) y lee `rolesAprobacion` del catálogo — simplemente **nadie del backend lo estaba usando**. La fuente de verdad es la constante `CAPACIDADES` de `@llave/shared` (la tabla `capacidades` de la base es un espejo que ningún endpoint consulta; queda como está).

Se llama `contratoPendiente` en `core.ts` para no sombrear al helper importado.

Dos propiedades que sostienen el diseño:

- **Quien puede aprobar, no necesita aprobación.** El disparador se deriva del permiso, no de un rol suelto: no puede quedar incoherente con la matriz.
- **No hay lockout posible.** Si Camila prende el switch siendo la única ADMIN, ella sigue cargando directo.

El resto de `core.ts` no cambia: donde hoy dice `esCarga` pasa a decir `requiereAprobacion`.

### 3. Períodos anteriores (lo que evita romperle el trabajo)

Hoy existe este candado en `core.ts:916`:

```ts
if (esCarga && d.periodosAnteriores?.length) return 400  // "pedile a un Admin que lo cargue"
```

La cartera de Camila es casi toda de **contratos ya en curso** (cita textual: *"cada inmobiliaria va a cargar un contrato ya vigente con cinco meses"*). Extender ese candado tal cual dejaría a su empleada sin poder cargar la mayoría de los contratos.

**Decisión:** el borrador **persiste** los períodos anteriores en `periodosAnterioresPendientes` y la transacción de aprobación los aplica llamando a `aplicarEstadoInicial` — la misma función que hoy usa `POST /contratos` (`core.ts:1083`). Se mueve *cuándo* se ejecuta, no *qué* hace.

- Si se **aprueba**: se aplican los períodos después de devengar, dentro de la misma transacción que ya activa el contrato.
- Si se **rechaza**: se descartan con el borrador (no hay liquidaciones sobre las que aplicarlos).
- El candado del 400 **desaparece**: ya no hace falta.

### 4. UI

- **Configuración → Mi Inmobiliaria**: switch *"Los contratos que carga el equipo requieren mi aprobación"*. La pantalla y su endpoint `/mi-inmobiliaria/reglas` (`apps/api/src/routes/operacion.ts`) ya existen y ya son ADMIN-only: el flag se suma al `select` del GET y al PUT. **No hay pantalla nueva.**
- **Alta de contrato**: cuando el contrato queda pendiente, el mensaje de éxito lo dice — *"Contrato cargado. Queda pendiente de aprobación."* Hoy diría que se activó, que sería mentira.
- **Bandeja**: ya existe, con badge de pendientes (PR #26 la movió dentro de Pagos).

## Testing

- **Unit de la regla** (puro, sin DB): ADMIN con flag on → no requiere; OPERADOR con flag on → requiere; OPERADOR con flag off → no requiere (comportamiento de hoy); CARGA con flag off → requiere igual (baseline del catálogo).
- **Integración `POST /contratos`**: con flag on y usuario OPERADOR → responde borrador, no reclama la propiedad, no devenga, crea la `Aprobacion`. Con flag off → activa directo (no regresión).
- **Integración de aprobación**: contrato pendiente **con** períodos anteriores → al aprobar quedan aplicados (pagos sintéticos y estados correctos) y la propiedad reclamada.
- **No regresión**: el suite de `core` y `plata` sigue verde.
- Tests contra **Postgres local efímero**, nunca la DB compartida.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Prender el flag deja a la empleada sin poder trabajar si algo falla | El flag arranca apagado; se prende recién con la feature verificada, y se puede apagar al instante |
| Los períodos anteriores se pierden entre el borrador y la aprobación | Es lo que cubre el test de integración de aprobación; es el punto más delicado del cambio |
| Migración sobre la tabla `contratos` en prod | Dos columnas aditivas y nullable/con default — no reescriben filas existentes |

## Fuera de alcance (explícito)

- **Aviso a la administradora.** Hoy Camila se entera de que hay algo pendiente **solo si mira el panel**: no hay mail ni WhatsApp para `CONTRATO_CARGADO` (verificado: no existe ningún envío atado a ese tipo). Ella dijo que quiere aprobar *"estando en cualquier lado"*. Es el gap más probable de que la feature no se use, y merece su propio trabajo.
- **Corregir el contrato de Humberto Primo**, que ya está ACTIVO y mal autorizado.
- **Prender el flag en la cuenta de Camila**: es un write en producción y requiere confirmación explícita de Alan.
- **Matriz de permisos editable por inmobiliaria** (la opción estructural que se descartó): hoy sería construir un motor de permisos por tenant para un solo caso de uso. Cuando aparezca la segunda o tercera capacidad que lo necesite, se rediscute.
- **Documentación obligatoria en el alta** (causa `c9`) y **verificación de firmas del PDF** (causa `c8`): son la otra mitad del miedo de Camila (que el garante no firmó), pero tienen su propio spec y su propia pregunta pendiente.
