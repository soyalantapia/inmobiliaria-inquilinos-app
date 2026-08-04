# Corregir un contrato rechazado y reenviarlo a aprobación

**Fecha:** 2026-08-03
**Rama:** `feat/corregir-contrato-rechazado` (worktree `~/dev/myalq-fase2`)
**Base:** `feat/revision-contrato-aprobacion` (**PR #41, sin mergear**) — esta fase depende de que el
rechazo conserve `periodosAnterioresPendientes`, que es lo que hizo ese PR.
**Origen:** la fase 2 que quedó explícitamente fuera del PR #41.

## El problema

Hoy, cuando la administración rechaza un contrato cargado:

1. **Se borra el inquilino** y todos sus hijos (`CodigoOtp`, `AnuncioAcuse`, `Documento`,
   `CertificadoInquilino`), y `inquilinoTitular` queda en null (`plata.ts:2304-2325`).
2. **El cartel de "rechazado" es estado local** del componente (`page-client.tsx:1215`,
   `useState<'APROBADO'|'RECHAZADO'|null>`): lo ve solo quien rechazó, en esa sesión. Al recargar
   desaparece.
3. **El detalle del contrato no muestra nada** del rechazo: la tarjeta está gateada por
   `pendienteAprobacion`, que pasa a `false`.
4. **A quien lo cargó no se le avisa.** El único mail del handler de decisión es el onboarding al
   inquilino cuando se **aprueba**. El copy *"{cargadoPor} ya recibió la notificación"* es falso.
5. **No hay edición**: el botón "Editar" está `disabled` con `title="Próximamente"`.

Resultado: el contrato queda como un cascarón en Borradores, sin inquilino, sin decir por qué murió,
y la empleada se entera de casualidad. Hay que cargar todo de nuevo, incluida la deuda histórica
período por período.

## 🔴 El hallazgo que simplifica la fase entera

**El borrado del inquilino ya no hace falta.** Su justificación está desactualizada.

El comentario dice (`plata.ts:2304-2306`):

> *"borramos el inquilino que se creó para él. Si no, su email queda tomado
> (`@@unique [inmobiliariaId,email]`) y bloquea para siempre volver a cargar un contrato con ese
> inquilino."*

Ese bloque es del **21/06/2026** (`0d886ac`). Después de eso:

- **`Inquilino` ya no tiene unique de email.** El schema lo documenta explícitamente: *"El email NO es
  único a nivel Inquilino (fila-por-contrato): un mismo inquilino puede tener varios contratos…"*.
  El unique se mudó a **`Persona`** (`@@unique([inmobiliariaId, email])`), por el trabajo de
  multi-alquiler.
- **El rechazo no toca `Persona`** — cero menciones en el bloque de borrado.
- **`Persona` se resuelve con find-or-create** (`buscarOCrearPersona`, `lib/persona.ts:27`): busca por
  DNI, después por email, y solo crea si no encuentra. Una `Persona` existente con el mismo email se
  **reusa**; nunca choca.

O sea: es código defendiendo un problema que ya no existe, y de paso es lo que hace difícil la
corrección. **Se saca.**

## Diseño

### 1. El rechazo deja de vaciar el contrato

Se elimina el bloque `plata.ts:2304-2325`. El contrato rechazado conserva su inquilino, sus documentos
y su deuda declarada.

🔴 **Con una consecuencia que hay que resolver en el mismo cambio:** `GET /inquilinos` y el listado
deduplicado por persona **no filtran por estado del contrato** (`core.ts:1976` y el de abajo). Sin el
borrado, el inquilino de un contrato rechazado **aparecería en el listado de inquilinos** — como
"Inactivo", porque `activo` se deriva de tener ≥1 contrato `ACTIVO`. Sería mentir: esa persona nunca
fue inquilina.

**Se excluyen de los dos listados las filas cuyo contrato está en `BORRADOR`.** Un inquilino de
borrador no es inquilino todavía: lo es cuando el contrato se aprueba.

⚠️ El motivo original del borrado hay que reemplazarlo por un comentario que explique **por qué ya no
hace falta**, con la referencia al unique en `Persona`. Si no, alguien lo vuelve a agregar.

### 2. El contrato rechazado dice que lo rechazaron, y por qué

`GET /contratos/:id` pasa a devolver la **última decisión** de aprobación de ese contrato, no solo
cuando está pendiente:

```ts
decisionAprobacion?: {
  estado: 'APROBADA' | 'RECHAZADA';
  comentario: string | null;
  decididoPor: string;      // nombre, no el user id
  decididoAt: string;       // ISO
};
```

Se resuelve con el mismo `findFirst` sobre `Aprobacion` que ya se hace para `revisionAprobacion`
(`core.ts:239`), cambiando el filtro de `estado: 'PENDIENTE'` a la última por `aprobadoAt desc`.
**Una sola query, no dos.**

El detalle muestra una tarjeta con el motivo — persistente, no estado local — y el botón
**"Corregir y reenviar"**. La tarjeta de rechazo reemplaza al `useState` local, que se saca.

### 3. El editor, solo para borradores

**Endpoint nuevo: `PUT /contratos/:id/borrador`.**

🔴 **No un `PUT /contratos/:id` genérico.** El repo ya tiene endpoints granulares con lógica propia
(`PATCH /contratos/:id/monto` recalcula liquidaciones, `PATCH /modo-cobranza` valida la cuenta del
propietario, `PUT /contratos/:id/mora`, `PATCH /inquilino-contacto`). Un PUT general los pisaría y
tendría que replicar esa lógica. El endpoint nuevo es honesto sobre su alcance: **edita un borrador**,
donde no hay liquidaciones ni pagos que recalcular.

- Gateado por `contratos.crear` (el mismo permiso que crea) **y** por `estado === 'BORRADOR'`. Si el
  contrato no está en borrador → **409**, con el mensaje explicando que un contrato activo se modifica
  con las acciones puntuales del detalle.
- Acepta **el mismo body que `POST /contratos`**, reusando su schema de Zod. Lo que se puede corregir
  es lo mismo que se puede cargar; no hay dos verdades sobre qué campos tiene un contrato.

  ⚠️ Ese schema hoy está **inline** dentro del handler (`core.ts:847-941`, un
  `z.object({...}).safeParse(request.body)`). Hay que **extraerlo a una constante del módulo** para
  que los dos lo usen. Es una extracción mecánica: **el schema no cambia**, ni un campo ni una regla.
  Si al extraerlo se afloja algo, se rompió el alta, que es el flujo más crítico del panel.
- Actualiza el contrato, el inquilino y `periodosAnterioresPendientes`.
- **No** activa nada, **no** genera liquidaciones, **no** reclama la propiedad. Sigue siendo borrador.

En el front, "Editar" deja de decir "Próximamente" **solo cuando el contrato está en `BORRADOR`**. En
los demás estados queda como está hoy.

### 4. Reenviar a aprobación

`POST /contratos/:id/reenviar-aprobacion`: crea una **nueva `Aprobacion` PENDIENTE** y pone
`pendienteAprobacion: true`.

🔴 **Candado que hoy no existe:** no hay constraint que impida dos `Aprobacion` PENDIENTE del mismo
contrato. Hoy es inalcanzable porque el único `create` vive dentro de `POST /contratos`; este endpoint
**abre esa puerta**. Se agrega un **índice único parcial** en Postgres:

```sql
CREATE UNIQUE INDEX aprobaciones_una_pendiente_por_entidad
  ON aprobaciones ("entidadId") WHERE estado = 'PENDIENTE';
```

Sin eso, dos reenvíos seguidos dejan dos pendientes y aprobar una no cierra la otra: la bandeja
mostraría un fantasma que al aprobarse intentaría activar un contrato ya activo.

⚠️ Prisma no expresa índices parciales en el schema: va como **SQL crudo en la migración**, con el
comentario de por qué.

### 5. Que la empleada se entere

Un aviso en el panel para **quien cargó el contrato**: *"Tenés 1 contrato rechazado para corregir"*,
que lleva al contrato.

- **No hace falta modelo nuevo.** Sale de `GET /aprobaciones` filtrando: `cargadoPorId` = el usuario
  actual, `estado: 'RECHAZADA'`, y el contrato todavía en `BORRADOR` (si ya se reenvió o se aprobó, no
  va más).
- Se muestra donde la empleada entra todos los días, no en una pantalla aparte.
- **Nada de mail**: el SMTP no está configurado y el mail se perdería. El aviso en el panel no depende
  de infraestructura que no existe.

### 6. El copy que miente

*"{cargadoPor} ya recibió la notificación"* (`page-client.tsx:1250`) se cambia por lo que realmente
pasa: que el contrato queda para corregir y que quien lo cargó lo va a ver en su panel.

## Testing

- **Integración — el ciclo completo**: cargar como CARGA → rechazar como ADMIN con motivo → verificar
  que **el inquilino sigue existiendo** y la deuda declarada también → corregir con
  `PUT /contratos/:id/borrador` → reenviar → aparece una nueva `Aprobacion` PENDIENTE → aprobar → el
  contrato queda ACTIVO **con los datos corregidos**, no con los viejos.
- **Integración — el candado**: reenviar dos veces seguidas → la segunda falla (el índice único). Y con
  una PENDIENTE viva, `POST /contratos` sobre esa misma propiedad no puede crear otra.
- **Integración — el gate del editor**: `PUT /contratos/:id/borrador` sobre un contrato `ACTIVO` → 409,
  y el contrato no se toca.
- **Integración — los listados**: un inquilino cuyo único contrato está en `BORRADOR` **no** aparece en
  `GET /inquilinos` ni en el deduplicado. Cuando el contrato se aprueba, **sí** aparece.
- **No regresión**: rechazar sin comentario sigue dando 400. Aprobar produce exactamente lo mismo que
  hoy. La suite de `core` y `plata` sigue verde.
- **Navegador**: rechazar un contrato → entrar como la empleada que lo cargó → ver el aviso en el panel
  → entrar al contrato → leer el motivo → corregir lo que le marcaron → reenviar → verlo aparecer de
  nuevo en la bandeja del admin → aprobarlo → **el contrato activo tiene el dato corregido**.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| 🔴 Se toca el rechazo, que corre **en producción** con el flag prendido para AyV | El cambio es una eliminación de código muerto por obsolescencia, con la razón verificada contra el schema. El test de no regresión compara el resto del rechazo contra el comportamiento actual |
| Dejar de borrar el inquilino lo hace aparecer donde no corresponde | Se filtran los dos listados en el mismo cambio, con test |
| Dos aprobaciones pendientes del mismo contrato | Índice único parcial en la base, no solo un `if` en el código |
| El editor se usa sobre un contrato activo y pisa plata ya emitida | El endpoint está gateado por estado a nivel servidor (409), no solo escondiendo el botón |
| Esta rama **depende del PR #41 sin mergear** | Si #41 mergea primero, rebasar. Si se decide no mergearlo, esta fase no aplica tal cual |
| El aviso del panel se vuelve ruido si nadie corrige | Desaparece solo: el filtro exige que el contrato siga en BORRADOR |

## Fuera de alcance

- **Editar contratos activos.** Toca liquidaciones y pagos ya emitidos; para eso están las acciones
  puntuales que ya existen (`PATCH /monto`, `/modo-cobranza`, `PUT /mora`).
- **Mail.** El SMTP no está configurado.
- El PIN: sigue eliminado (`verificarPinUsuario` devuelve `{ok:true}` incondicional).
- Los otros tres tipos de aprobación: no se tocan.
