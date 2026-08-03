# SPEC — Paso Documentación + paso Servicios en el alta de contrato

**Rama:** `fix/deuda-historica-cobrable` · **Worktree:** `/Users/alannaimtapia/dev/myalq-deudavieja` · **Modo:** solo lectura (nada editado)

**Titular del spec en una línea:** de las dos cosas que pidió el dueño, **una está construida entera** (servicios: modelo, API, panel, permisos, loop con el inquilino) y la otra **está construida en un 80%** (documentación: modelo, CRUD, upload, checklist, y el alta YA sube DNI de verdad). Esto no es una feature nueva: son **dos montajes y una constante**. Backend: **cero migraciones, cero endpoints nuevos**.

---

## 1. Lo que YA existe

### 1.A — Servicios públicos: **NO SE CONSTRUYE NADA**

| Pieza | Estado | Dónde | Qué se hace |
|---|---|---|---|
| `model ServicioPublico` (por propiedad, unique `(propiedadId, tipo)`) | ✅ vivo | `apps/api/prisma/schema.prisma:2623-2645` | **no se toca** |
| `enum TipoServicio` (LUZ/GAS/AGUA/INTERNET/ABL/CABLE) + `PagadorServicio` | ✅ vivo | `schema.prisma:577-584` y `:2647-2652` | **no se toca** (no hace falta tipo nuevo) |
| `GET /propiedades/:id/servicios` | ✅ cableado | `apps/api/src/routes/servicios-publicos.ts:77-87` | **no se toca** |
| `PUT /propiedades/:id/servicios/:tipo` (upsert por tipo, validado) | ✅ cableado | `servicios-publicos.ts:90-118` (upsert `:112-116`) | **no se toca** |
| `DELETE .../:tipo` | ✅ existe, **huérfano** (ningún front lo llama) | `servicios-publicos.ts:121-130` | **no se toca** (fuera de alcance) |
| Scope multi-tenant `propiedadDelTenant()` | ✅ vivo | `servicios-publicos.ts:60-74` | **no se toca** |
| `ServiciosPublicosPanel` — grilla de 6 tarjetas + dialog completo | ✅ cableado a la API | `apps/inmobiliaria/src/components/servicios-publicos-panel.tsx:56` (`Props = { propiedadId }`, verificado en `:52-56`) | **se monta tal cual en el wizard** |
| `useServiciosPublicos(propiedadId)` (GET/PUT reales, fallback demo) | ✅ cableado | `apps/inmobiliaria/src/lib/api/use-servicios-publicos.ts:60-106` | **no se toca** |
| El inquilino ve lo que carga la inmo (`GET /servicios`) | ✅ el loop cierra | `apps/api/src/routes/inquilino-mundo.ts:1066-1082` | **no se toca** |
| Presets de distribuidora | ⚠️ constante hardcodeada, **sin La Rioja** | `apps/inmobiliaria/src/lib/servicios-publicos-storage.ts:100-107` (verificado literal) | **única edición de contenido: 3 strings** |

> **Decir fuerte:** "cargar servicios con distribuidora y número de cuenta, opcional" **ya funciona hoy en producción** desde el tab Servicios del detalle de propiedad (`propiedades/[id]/page-client.tsx:881-885`). El pedido del dueño se reduce a **hacerlo visible durante el alta** + **sumar La Rioja**.

### 1.B — Documentación: existe el motor, falta la vitrina

| Pieza | Estado | Dónde | Qué se hace |
|---|---|---|---|
| `model DocumentoContrato` (expediente del CONTRATO) | ✅ vivo | `schema.prisma:2466`, relación en `:1340` | **no se toca** |
| `POST /contratos/:id/documentos` — y **ya acepta `garanteIndex`** | ✅ cableado | `apps/api/src/routes/documentos.ts:41-50` (schema; `garanteIndex` en `:44`) y `:88-120` | **no se toca — cero cambios de API** |
| `GET` / `DELETE` del expediente | ✅ cableado | `documentos.ts:73` / `:124` | **no se toca** |
| 18 tipos `TipoDocContrato` (enum Prisma + zod + union TS) | ✅ vivo, incluye CONSTANCIA_LABORAL, PAGARE, SEGURO_CAUCION, INVENTARIO_INGRESO, SERVICIOS_A_NOMBRE, COMPROBANTE_DEPOSITO | `contrato-documentos-storage.ts:21-38` (verificado), `documentos.ts:21-39`, `schema.prisma:528-548` | **no se agrega ningún tipo → cero migración** |
| El alta **YA sube DNI frente/dorso de verdad** post-alta, best-effort | ✅ cableado, es **el precedente exacto** | `contratos/nuevo/page.tsx:1769-1794` (loop verificado) y toast `:1800-1814` | **se generaliza el loop, no se reescribe** |
| `DniFileInput` (input compacto, `image/*,application/pdf`, limpia `e.target.value`) | ✅ vivo | `contratos/nuevo/page.tsx:718-765` (verificado) | **se reusa tal cual** |
| Checklist del expediente (barra + %) en el detalle | ✅ vivo pero **fórmula hardcodeada en el front** | `contrato-documentos-panel.tsx:163-166` → `totalReq = 4 + garantesCount * 2` (verificado literal) | **se extrae a módulo compartido** (ver §3) |
| Tab Documentos del detalle de contrato | ✅ montado | `contratos/[id]/page-client.tsx:310` (trigger) y `:545-553` (verificado) | **se le suma el badge de faltantes** |
| `Documento` + `SlotDocumento` (checklist del INQUILINO) | ✅ vivo pero **escritura exclusiva del inquilino** (`requireInquilino`) | `schema.prisma:2672` / `:2688`; `mi-perfil.ts:101` | **no se toca** (ver §2) |
| `DocumentoAdjuntoInvitado` | ☠️ **tabla muerta**, cero escrituras | `schema.prisma:2536`; única mención en `uploads.ts:219` | **no se toca, no se resucita** |
| `cargar-inquilino-wizard.tsx` paso 3 "Documentos" | 🎭 **MAQUETA** — en prod corta con "Próximamente" | `cargar-inquilino-wizard.tsx:136-144`, UI `:636-740` | **no es base de nada. No copiar de ahí.** |
| `contrato-documentos-storage.ts` | ⚠️ localStorage **pero dueño de tipos/labels/`TAMANIO_MAX` que usa PROD** | `:19` key, `:21-38` tipos, `:116-135` labels, `:137` `TAMANIO_MAX = 2MB` (verificado) | **no borrar. Se importa desde el paso nuevo.** |

### 1.C — Wizard: estructura verificada

`pasosApi` tiene exactamente 5 entradas (`contratos/nuevo/page.tsx:672-678`, verificado), `type PasoApi = 1|2|3|4|5` (`:670`), navegación con `Math.min(5, p+1)` y salto `sig === 4 && !hayPeriodos ? 5 : sig` (`:1519-1528`, verificado), filtro `p.id !== 4 || hayPeriodos` (`:1434-1437`), restore `pasoRestaurado >= 1 && <= 5` (`:1213-1215`). El header `StepsApi` numera con `i + 1` sobre `pasosVisibles` (`:3077-3113`) → **no hay que tocarlo**.

---

## 2. La decisión estructural de documentos

### Los dos sistemas, sin eufemismos

| | `DocumentoContrato` | `SlotDocumento` + `Documento` |
|---|---|---|
| Cuelga de | Contrato | Inquilino |
| Quién escribe | La inmobiliaria (`POST /contratos/:id/documentos`, cap `contratos.crear`, `documentos.ts:91`) | **Solo el inquilino** desde su PWA (`requireInquilino`, `mi-perfil.ts:101`) |
| "Requerido" configurable | No (constante de front) | Sí, booleano `requerido` en DB |
| Existe cuando arranca el alta | Sí, apenas hay `contratoId` | **No.** Los slots nacen recién cuando un inquilino abre su app (`asegurarSlots()` corre dentro de `GET /mis-documentos`, `mi-perfil.ts:67-74`) |

### **Decisión: el paso del alta usa `DocumentoContrato`. Punto.**

Tres razones, en orden de peso:

1. **El falso verde que mata el caso real.** El cliente es de La Rioja con cartera vieja: inquilinos que **nunca se van a loguear**. Para ese tenant la tabla `slots_documento` está **vacía** (y el seed `inquilinoMundo.ts:86` **no corre en prod** — el `Dockerfile:30` hace `pnpm db:deploy && node dist/index.js`, sin seed). Un paso de "papeles que faltan" que lea `SlotDocumento` mostraría **cero faltantes** = "está todo bien". Es exactamente el escenario que el dueño quiere evitar.
2. **Permisos:** la inmobiliaria **no puede** escribir en `Documento` ni con permisos de admin: `POST /mis-documentos` tiene guard `requireInquilino`. Usar ese sistema exigiría inventar un endpoint nuevo.
3. **Ciclo de vida:** no existe `inquilinoId` hasta que corre el `$transaction` de `POST /contratos` (`apps/api/src/routes/core.ts:1029-1040`). `propiedadId` sí existe desde el paso 1, `contratoId` recién al confirmar. `DocumentoContrato` cuelga del contrato, que es exactamente lo que el alta produce.

### Uno para cada cosa (esta es la respuesta completa)

- **`DocumentoContrato` → expediente que carga la INMOBILIARIA.** Es lo que alimenta el paso nuevo del alta, el checklist y el aviso de faltantes. **Es el único sistema que el paso nuevo toca.**
- **`SlotDocumento`/`Documento` → lo que sube el INQUILINO desde su PWA.** Se sigue leyendo de solo lectura en `DocumentosInquilinoPanel` (`page-client.tsx:552`). **No se toca, no se extiende, no se le agrega pantalla de configuración.** Fuera de alcance (§8).
- **`DocumentoAdjuntoInvitado`** queda muerta. No se resucita.

### Corolario obligatorio: la lista de requeridos se extrae, no se duplica

Hoy vive incrustada en `contrato-documentos-panel.tsx:163-181`. Si el paso del alta la reescribe, hay dos listas que se desincronizan al primer cambio. **Se extrae a un módulo nuevo de front, sin DB y sin API:**

`apps/inmobiliaria/src/lib/documentos-requeridos.ts` (nuevo, ~40 líneas)
```
export const DOCS_REQUERIDOS_TITULAR: TipoDocContrato[]   // CONTRATO_FIRMADO, DNI_TITULAR_FRENTE, DNI_TITULAR_DORSO, RECIBO_SUELDO
export const DOCS_REQUERIDOS_POR_GARANTE: TipoDocContrato[] // DNI_GARANTE_FRENTE, DNI_GARANTE_DORSO
export function faltantesDeExpediente(docs, garantes): { tipo, garanteIndex?, label }[]
```
Consumidores: el paso nuevo del alta **y** `contrato-documentos-panel.tsx` (que reemplaza su `totalReq`/`completados` por la función). **Un solo lugar. No se crea modelo ni tabla.**

---

## 3. Diseño del paso Documentación

### Ubicación: **paso 5 de 7** (después de Períodos anteriores, antes de Confirmar)

```
1 Propiedad · 2 Inquilino · 3 Términos · 4 Períodos anteriores (condicional)
· 5 Documentación (NUEVO) · 6 Servicios (NUEVO) · 7 Confirmar
```

**Por qué después del 4 y no antes:** insertarlos antes desplaza "Períodos anteriores" y el salto condicional `sig === 4 && !hayPeriodos ? 5 : sig` (`page.tsx:1521`) pasaría a saltear **el paso equivocado, en silencio**. Poniéndolos después, el `4` condicional queda intacto y solo se mueve "Confirmar" de 5 a 7.

### Los 5 lugares con números hardcodeados (todos verificados, ninguno opcional)

| # | Archivo:línea | Hoy | Queda |
|---|---|---|---|
| 1 | `page.tsx:670` | `type PasoApi = 1\|2\|3\|4\|5` | `…\|6\|7` |
| 2 | `page.tsx:672-678` | 5 entradas | 7 entradas |
| 3 | `page.tsx:1521` | `Math.min(5, p + 1)` | `Math.min(7, p + 1)` |
| 4 | `page.tsx:1521,1527` | `sig === 4 && !hayPeriodos ? 5 : sig` / `ant === 4 && !hayPeriodos ? 3 : ant` | **sin cambio** (esa es la ventaja de insertar después) |
| 5 | `page.tsx:1215` | `pasoRestaurado >= 1 && <= 5` | `<= 7` |

Más: el render actual es `{paso === 5 && …}` en `:2864` → pasa a `{paso === 7 && …}`, y se agregan los bloques `{paso === 5 && …}` y `{paso === 6 && …}`. **`pasosVisibles` (`:1435`) y `StepsApi` (`:3077`) no se tocan** — filtra por `id !== 4` y numera con `i + 1`.

> ⚠️ Sin bloque de render el paso queda **en blanco** con el header avanzando igual (el paso 4 se renderiza con doble guarda `{paso === 4 && hayPeriodos && …}`, `page.tsx:2612`).

### Qué muestra el paso 5

Tres bloques, todos con `DniFileInput` (`page.tsx:718-765`) reusado tal cual:

1. **Titular** — Contrato firmado · DNI frente · DNI dorso · Recibo de sueldo. *(Los DNI se **mueven** acá desde el paso 2 `:2117-2129`, o se dejan en los dos lados leyendo el mismo estado. Preferido: mover, para que "documentación" sea un solo lugar.)*
2. **Garantes** — selector local de cantidad (0–3, default **0**). Por garante: DNI frente + dorso + recibo. **No crea ningún `Garante`** — el wizard no tiene paso de garantes y `POST /contratos` no los recibe. Solo determina cuántos pares de inputs se muestran y qué `garanteIndex` viaja en el POST.
3. **Otros papeles (opcional)** — un `<Select>` de `TipoDocContrato` + input, para adjuntar cualquiera de los 18 tipos restantes. Labels desde `TIPO_DOC_LABEL` (`contrato-documentos-storage.ts:116-135`), **no reescritos**.

### El aviso de faltantes (no bloquea, nunca)

- **Botón Continuar pelado:** `<Button onClick={avanzar}>Continuar</Button>`, **sin `disabled`, sin gate**. No aplica ninguno de los dos patrones del wizard (ni `disabled={!pasoXValido}` de los pasos 1/2/3, ni el `faltantesMarcados` del paso 4).
- **Copy informativo** con el molde del motivo del paso 4 (`page.tsx:2836-2845`) pero **en `text-muted-foreground`, jamás `destructive`**:
  > *"Te faltan 3 de 6 papeles: contrato firmado, recibo de sueldo y DNI del garante 1. Podés dar de alta igual y cargarlos después desde el detalle del contrato."*
- El texto sale de `faltantesDeExpediente()` (§2), calculado sobre los `File` en estado + `garantesCount` local. **No se consulta la API** en este paso (todavía no hay `contratoId`).

### Cuándo suben los archivos: **DESPUÉS del alta, igual que hoy**

No hay `contratoId` hasta que responde `POST /contratos`. El loop de `page.tsx:1769-1794` se **generaliza**: en vez del array de 2 DNI, un array de N `{ file, tipo, etiqueta, garanteIndex? }`. Sin cambios de API — `garanteIndex` ya está en `crearSchema` (`documentos.ts:44`, verificado).

Tres ajustes obligatorios al generalizar:

1. **Validar tamaño en el input, no en el server.** `DniFileInput` hoy **no valida** y muere en 413 con toast genérico. Se le agrega el chequeo contra el límite del panel. → ver el conflicto de límites en §7.
2. **Progreso visible.** Con 8 papeles son **16 requests secuenciales** después de confirmar. Hace falta un `Subiendo documentación… 3 de 8` en el botón, o la pantalla parece colgada.
3. **Generalizar el toast.** Hoy dice literal *"no pudimos subir alguna foto del DNI"* (`:1808`, verificado). Con 8 tipos ese copy **miente**. Pasa a: *"Se creó el contrato, pero quedaron N documentos sin subir. Cargalos desde el detalle."* — sigue siendo **best-effort: el contrato NO se revierte.**

### Dónde quedan visibles los faltantes en el detalle del contrato

Dos lugares, ambos alimentados por la misma `faltantesDeExpediente()`:

1. **Badge en el `TabsTrigger` "Documentos"** (`contratos/[id]/page-client.tsx:310`) — mismo patrón que los badges de Liquidaciones/Comunicaciones que ya están ahí (`:296-308`): `<Badge variant="secondary">3 pendientes</Badge>`. Hoy ese trigger es texto pelado.
2. **Lista explícita dentro del checklist** de `ContratoDocumentosPanel` (`:319-360`), que hoy solo muestra "X de Y" y una barra: se le suma **qué** falta, nombrado.

**Fix acoplado y obligatorio:** `garantesCount` es `useState` local (`contrato-documentos-panel.tsx:142`), arranca en 1 y se resetea en cada recarga → el mismo contrato muestra distintos "requeridos" según lo que toquen. Un badge alimentado por eso miente. **La cantidad de garantes tiene que salir de `useGarantes` (`GET /contratos/:id/garantes`, `core.ts:1965`)**, y el `<Select>` local pasa a ser un override visual, no la fuente.

---

## 4. Diseño del paso Servicios

### Lo que se cablea: **una línea de JSX**

```tsx
{paso === 6 && (
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">…</p>
    <ServiciosPublicosPanel propiedadId={propiedadId} />
    <Button onClick={avanzar}>Continuar</Button>   {/* sin disabled */}
  </div>
)}
```

`ServiciosPublicosPanel` recibe exactamente `{ propiedadId }` (verificado, `servicios-publicos-panel.tsx:52-56`) y `propiedadId` existe desde el paso 1 (`page.tsx:948`, seteado en `:1907` o por `?propiedad=` en `:1113-1135`, con gate `pasoPropiedadValido = !!propiedadId` en `:1457`). **El panel escribe solo cuando el usuario aprieta Guardar en el dialog.** No hay estado nuevo en el wizard, no hay `useState` nuevo, no hay entrada nueva en el borrador.

### Lo que se agrega: **La Rioja**

Única edición de contenido, en `apps/inmobiliaria/src/lib/servicios-publicos-storage.ts:100-107` (contenido actual verificado literal):

```
LUZ:  [… , 'EDELAR']
AGUA: [… , 'Aguas Riojanas']
ABL:  [… , 'DGR La Rioja']
GAS:  sin cambios — 'Ecogas' ya es la de La Rioja
```

**No tocar nada más.** `distribuidora` es texto libre con `max 120` en el zod (`servicios-publicos.ts:23-33`) → **no hay enum, no hay migración**. Y **no duplicar la constante en otro archivo** aunque viva en un `*-storage.ts`: la importa el panel que **sí** escribe por API (`servicios-publicos-panel.tsx:36,238`). Duplicarla crea dos listas que se desincronizan.

> Sin este agregado, todo lo que cargue el cliente riojano cae en el bug conocido: el `<Select>` tiene value libre (`panel:271-287`) y si el valor guardado no está en las sugerencias **el trigger se ve vacío** y el dato solo aparece en el input de abajo.

### Copy que tiene que estar en el paso (no es cosmético)

Los servicios quedan pegados a la **PROPIEDAD**, no al contrato, y el `PUT` **persiste aunque después se cancele el alta**. El paso lo dice: *"Estos datos quedan guardados en la propiedad y los va a ver el inquilino en su app. Si mañana entra otro inquilino, se mantienen."*

### Lo que NO se hace acá

- No se agrega un tilde "esta propiedad tiene/no tiene este servicio". Hoy "tiene" = "hay fila". Inventar el booleano requiere migración por cero valor.
- No se agrega el botón "Quitar servicio" (el `DELETE` existe pero está huérfano).
- No se toca `alertas-servicios.ts` (100% demo, oculto en prod por `pagos/page.tsx:690-698`).
- No se toca boletas.

---

## 5. Impacto en el borrador

`BorradorContrato` verificado en `contrato-borrador-storage.ts:5-39`; autosave `JSON.stringify` en `:89`; key `…:v1:${namespace}` sin migración (`:76`); deps del autosave verificadas en `page.tsx:1290-1321` (**31 elementos**).

### Regla explícita: **los `File` NO se prometen**

`localStorage.setItem(key, JSON.stringify(datos))` serializa un `File` como `{}`. Si un `File` entra al borrador, al restaurar la pantalla **muestra archivos que ya no existen** y el alta sube nada sin avisar. Es peor que perderlos.

**Decisión — ya es la del repo** (`dniFrente`/`dniDorso` están deliberadamente fuera del borrador, `page.tsx:960-961`):

> Los archivos del paso Documentación **NO se guardan en el borrador**. Si el usuario recarga, los vuelve a elegir. **El paso lo dice en pantalla**, en muted: *"Los archivos no se guardan en el borrador. Si cerrás la página los vas a tener que volver a elegir."* Sin esa línea, el usuario cree que quedaron.

### Lo que SÍ entra al borrador: **un solo campo**

`garantesCount: number` (o `docsMeta?: { garantes: number }`). Con 42 `useState` planos ya en el componente, **agrupar** es preferible a replicar el patrón plano.

### Las 5 ediciones — ninguna es opcional

| # | Archivo:línea | Qué |
|---|---|---|
| 1 | `contrato-borrador-storage.ts:5-39` | campo **OPCIONAL** (`garantesCount?: number`). Obligatorio → TS compila igual y el restore rompe en runtime. Precedente correcto en `:31-38`. |
| 2 | `page.tsx:1251-1280` | sumarlo al objeto `datos` |
| 3 | `page.tsx:1290-1321` | **sumarlo al array de deps** ← el fallo silencioso: sin esto el campo se guarda **solo cuando cambia otro**, se ve andando en la prueba manual y pierde datos en uso real |
| 4 | `page.tsx:1166-1198` (`aplicarBorrador`) | leerlo con default conservador (`?? 0`) |
| 5 | `page.tsx:906-926` (`borradorTieneContenido`) | **la quinta, la que se olvida**: hoy no mira ningún campo nuevo (verificado). Si alguien solo cargó documentación o servicios, el diálogo "retomar" **no aparece** y el borrador se pisa en silencio. |

Servicios: **cero ediciones** (escribe directo contra la API, no tiene estado en el wizard).

---

## 6. Testing

**Punto de partida honesto:** `apps/api/test/` no tiene **ningún** archivo para documentos, mi-perfil ni servicios. `ServicioPublico` tiene **cero filas en producción** → el CRUD **nunca corrió contra datos reales**. "El código está" no prueba nada acá.

### Falsos verdes específicos de este repo — probar contra cada uno

| # | Falso verde | Cómo se cae encima | Prueba que lo mata |
|---|---|---|---|
| **F1** | Probar el wizard **en demo** | El `export default` elige por `apiEnabled` (`page.tsx:129-140`). Un paso agregado al componente equivocado **no se ve nunca en prod**. | Probar con `NEXT_PUBLIC_API_URL` **seteado**. Verificar en la Network tab que salen `POST /uploads` + `POST /contratos/:id/documentos` reales. |
| **F2** | "Muestra los faltantes" leyendo `SlotDocumento` | Tabla vacía para el tenant riojano (los slots nacen con `GET /mis-documentos`, `mi-perfil.ts:67-74`) → **dice cero faltantes** = todo bien. | Test explícito: tenant **sin ningún inquilino logueado**, contrato sin papeles → el paso tiene que listar **6 faltantes**, no 0. |
| **F3** | El badge del detalle "anda" | `garantesCount` local arranca en 1 (`contrato-documentos-panel.tsx:142`) → parece correcto con 1 garante y miente con 0 o 2. | Contrato con **0** garantes reales y contrato con **2** (vía `GET /contratos/:id/garantes`): el badge tiene que cambiar sin tocar el `<Select>`. Recargar y verificar que **no se resetea**. |
| **F4** | "El borrador guarda" | Sin el campo en el array de deps (`page.tsx:1290`) el autosave dispara igual al cambiar otro campo → **la prueba manual da verde**. | Cambiar **solo** `garantesCount`, esperar el debounce, **no tocar nada más**, recargar. Si no volvió, falta la dep. |
| **F5** | "Los archivos se restauran" | Un `File` serializa como `{}`: el borrador restaura el nombre y **sube nada**. | Elegir archivos → recargar → confirmar → verificar en el **detalle** que los documentos existen de verdad. Si el paso los muestra pero el expediente está vacío, el `File` se coló al borrador. |
| **F6** | "Servicios se guardó" mirando el panel | El panel recarga de su propio estado. | Verificar en el **detalle de propiedad** (otra pantalla) **y** en la **app del inquilino** (`GET /servicios`, `inquilino-mundo.ts:1066`). El loop tiene que cerrar de punta a punta. |
| **F7** | "El PUT de servicios mergea" | **No mergea: reemplaza.** `numeroMedidor`, `titular`, `observaciones`, `consumoPromedioMensual` se escriben `null` explícito si no vienen (`servicios-publicos.ts:103-108`, verificado). | Cargar LUZ completa desde el detalle → entrar al alta y editar **solo la distribuidora** → verificar que **medidor y titular siguen ahí**. Si desaparecieron, el paso está mandando el body incompleto. |
| **F8** | "El renumerado anda" porque el paso 5 se ve | El salto condicional y el restore son otros números. | Matriz: **con** períodos vencidos y **sin** (1→2→3→**5**→6→7 y vuelta), + restaurar un borrador viejo con `paso: 5` (que en el shape viejo era Confirmar y ahora es Documentación). |
| **F9** | Probar con admin | El alta pide `contratos.crear`; el PUT de servicios pide `propiedades.crear` **sin aprobación** (`servicios-publicos.ts:91`). | Probar con rol **CARGA**: su contrato queda pendiente de aprobación pero **los servicios ya se escribieron**. Y un usuario sin `propiedades.crear` come **403 en medio del wizard** — verificar que el error se muestra y **no traba** el paso. |

### Tests automatizados mínimos (los primeros del área)

- `apps/api/test/servicios-publicos.test.ts` — upsert por tipo, **el reemplazo a null**, `pagador` conservado con `undefined`, 404 cross-tenant, 400 con tipo inválido.
- `apps/api/test/documentos.test.ts` — POST con `garanteIndex`, rechazo de `archivoUrl` de otro tenant (`documentos.ts:102`), `contratos.ver` puede leer pero **no** adjuntar.
- Front: unit de `faltantesDeExpediente()` — 0 garantes, 2 garantes, expediente completo, expediente vacío.

### Manual obligatorio, con el caso real

Alta completa de un contrato de cartera vieja: sin ningún papel → confirmar → verificar que **el contrato se creó igual** (documentación no bloquea), que el toast no miente, y que el detalle muestra los faltantes.

---

## 7. Riesgos

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| **R1** | **Tres límites de tamaño contradictorios.** Backend 10 MB (`uploads.ts:30`), panel corta en **2 MB** (`TAMANIO_MAX`, `contrato-documentos-storage.ts:137`, verificado), alta **no valida nada**. El 2 MB es herencia de la cuota de localStorage, que ya no aplica. Documentación de cartera vieja escaneada pasa 2 MB fácil. | **Alta** | **Decidir antes de escribir código.** Recomendado: subir `TAMANIO_MAX` a 10 MB para alinear con el backend, y hacer que `DniFileInput` **valide** contra esa constante. Cambia el panel del detalle también — pero hoy ese límite ya rechaza archivos que el servidor aceptaría. |
| **R2** | **Tipos de archivo:** solo JPG/PNG/WEBP/GIF/HEIC/HEIF/PDF (`uploads.ts:37-64`). Un **DOCX/Word escaneado rebota con 415**. | **Alta** para el caso real | No se amplía el backend en este alcance. **El copy del paso lo dice explícitamente:** "fotos o PDF". El `accept` del input ya es `image/*,application/pdf` (`page.tsx:756`) — la mitad del trabajo está. Si el cliente insiste en Word, es un ítem aparte que toca `uploads.ts`. |
| **R3** | **Subida post-alta best-effort, no reversible.** Con 8 papeles son 16 requests secuenciales; si se cae la red a mitad, el contrato queda creado con documentación parcial. | Media | Ya es el comportamiento aceptado del repo (`page.tsx:1776-1794`). Se **conserva** — revertir un contrato por una foto sería peor. Se agrega progreso visible + toast honesto con el conteo. |
| **R4** | **Servicios escritos antes de confirmar el alta.** El `PUT` persiste aunque el usuario cancele en el paso 7. | Baja | **Aceptado a propósito**: los servicios son de la propiedad, el dato sirve igual. Se declara en el copy del paso. |
| **R5** | **Renumerar en silencio.** Si se toca `Math.min(5,…)` y se olvida el guard del restore (`:1215`), un borrador con `paso: 6` cae a 1 sin aviso. | Media | Los 5 lugares están tabulados en §3. No hay tests de numeración → **matriz manual F8 obligatoria**. |
| **R6** | **Extraer `faltantesDeExpediente()` toca el panel de prod.** El checklist del detalle es la única métrica de completitud que existe hoy. | Media | Cambio de comportamiento **buscado**: el % actual miente hacia arriba (cuenta `RECIBO_SUELDO` pero ignora los 8 tipos legales; 6 de 6 = 100% con todo lo legal faltando). Igual: los legales **siguen fuera de los requeridos** en esta entrega — cambiar qué es requerido es una decisión de producto, no técnica. |
| **R7** | **Normalización de distribuidoras.** Sin enum van a convivir `EDELAR`, `Edelar`, `edelar`. | Baja | Se acepta. Los presets del `<Select>` reducen la dispersión. Normalizar es otro trabajo. |
| **R8** | **`page.tsx` ya tiene ~2148 líneas y 42 `useState`.** Dos pasos más lo empeoran. | Media | Los pasos nuevos van como **componentes hijos** (`<PasoDocumentacion />`, `<ServiciosPublicosPanel />`), no como JSX inline. Estado nuevo **agrupado en un objeto**, no plano. |

---

## 8. Fuera de alcance

**Explícitamente NO se hace en esta entrega:**

1. **Pantalla de configuración de `SlotDocumento`.** No hay ninguna ruta (`GET/POST/PUT/DELETE /slots` no existe en `apps/api/src/routes/`) ni página bajo `configuracion/`. Fuera.
2. **Mostrar los slots vacíos del inquilino en el panel.** `GET /contratos/:id/documentos-inquilino` (`documentos.ts:148`) devuelve solo `Documento[]`. Fuera.
3. **Endpoint de "qué falta" calculado en el back.** El cálculo queda en el browser, en un módulo único.
4. **Tipos nuevos de `TipoDocContrato`.** Los 18 alcanzan. Agregar uno toca **5 lugares** + migración. Fuera.
5. **Consolidar el catálogo de 7 slots triplicado** (`mi-perfil.ts:13-21`, `inquilinoMundo.ts:86-94`, `documentos-storage.ts:37-90`) + el cuarto de 4 slots en `cargar-inquilino-wizard.tsx:51-56`. Deuda conocida, no de esta feature.
6. **Resucitar `DocumentoAdjuntoInvitado`** ni habilitar el wizard de invitar inquilino (`cargar-inquilino-trigger.tsx:40-52`, "Próximamente").
7. **FK real entre `DocumentoContrato.garanteIndex` y `Garante`.** Hoy es un `Int?` suelto (`schema.prisma:2474` vs `:1448`). Se sigue usando como está.
8. **Documentos en la ficha del inquilino** (`inquilinos/[id]/page.tsx`).
9. **Boletas para la inmobiliaria.** `BoletasInquilinoPanel` se auto-oculta en prod (`boletas-inquilino-panel.tsx:64`) y **no existe** `PATCH /boletas`. Si el cliente espera seguimiento de boletas desde el panel, **eso no existe y no se construye acá** — hay que decírselo.
10. **`alertas-servicios.ts` contra la API.** Hoy corre sobre `contratosMock` + localStorage y está oculto en prod.
11. **Botón "Quitar servicio"** (el `DELETE` sigue huérfano) y **tipos de servicio nuevos** (enum cerrado, migración + 4 archivos de front).
12. **Migrar la key del borrador a `:v2`.** Se resuelve con campos opcionales, como ya hizo `vigenciasPrevias` (`contrato-borrador-storage.ts:31-38`).
13. **Borrar `contrato-documentos-storage.ts`.** Parece maqueta y **no lo es**: `TipoDocContrato`, `TIPO_DOC_LABEL` y `TAMANIO_MAX` los importa el panel de prod (`contrato-documentos-panel.tsx:34-40`). Borrarlo rompe producción.

---

## Resumen de superficie de cambio

| Capa | Cambios |
|---|---|
| **Prisma / migraciones** | **CERO** |
| **API** | **CERO** endpoints nuevos. Solo tests nuevos en `apps/api/test/`. |
| **Front — archivo nuevo** | `apps/inmobiliaria/src/lib/documentos-requeridos.ts` (~40 líneas) + `components/paso-documentacion-alta.tsx` |
| **Front — editados** | `contratos/nuevo/page.tsx` (renumerado en 5 puntos + 2 bloques de render + loop de subida generalizado), `contrato-borrador-storage.ts` (1 campo opcional), `servicios-publicos-storage.ts` (**3 strings**), `contrato-documentos-panel.tsx` (usa el módulo compartido + garantes reales), `contratos/[id]/page-client.tsx` (badge) |
| **Servicios** | **Un `<ServiciosPublicosPanel propiedadId={propiedadId} />`.** Nada más. |