# Alta de contrato — Fase 1: que no se pierda y que las fechas no muerdan

**Fecha:** 2026-07-30
**Rama:** `feat/alta-contrato-pasos` (worktree `~/dev/myalq-altapasos`, base `origin/main` cbf00a6)
**Origen:** rediseño del alta de contrato pedido por Alan a partir de la reunión con Camila (23/07).

## Alcance

Esta es la **Fase 1 de 3** del rediseño. Se eligió así porque **no depende de ninguna decisión de negocio que Camila todavía no tomó**, y resuelve el dolor más caro. Las fases 2 (documentación obligatoria) y 3 (garantía, servicios, rescisión) están bloqueadas esperando respuestas suyas y tienen su propio spec.

**Entra en Fase 1:**
1. Borrador con guardado automático del wizard.
2. Separar el paso "Términos" en dos: **Plazo y salida** / **Dinero**, con preview en vivo de las consecuencias de las fechas.
3. Exponer el arranque de cuenta: **"empezar a cobrar desde este mes"** (`devengarDesde`).
4. Stepper clickeable hacia atrás y errores de validación visibles.
5. **Cargar la cuenta del propietario sin salir del alta** cuando se elige cobranza directa.

**No entra:** documentación obligatoria, paso de garantía, paso de servicios, cláusula de rescisión por contrato, scoring/veraz.

## Diagnóstico

### Lo que NO está roto (verificado, contra lo que se creía)

Camila reportó que al fallar el alta *"tenía que cargar todo de vuelta"*. **Eso no se reproduce en el código actual.** El `catch` de `dar_de_alta` (`apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx:1263-1277`) solo hace `setErrorServidor`, `setEnviando(false)` y `setConfirmando(false)`: no resetea ningún campo ni cambia de paso. El wizard queda en Confirmar con todos los datos y un banner rojo, y se puede reintentar.

Tampoco es cierto que no se pueda volver atrás: `avanzar()`/`retroceder()` (`:1068-1077`) solo cambian `paso`, y como los 34 `useState` viven en el componente padre (que no se desmonta), navegar entre pasos **no pierde nada**.

⚠️ **Queda una pregunta abierta para Camila**: en qué contexto exacto perdió los datos. La hipótesis de este spec es que fue una **sesión vencida o un refresh** (que sí destruye todo), no un 400. El borrador resuelve las dos, así que la Fase 1 avanza igual — pero conviene confirmarlo antes de dar el problema por cerrado.

### Lo que sí está roto

1. **No existe ningún borrador.** 34 `useState` en un componente, sin `localStorage`, sin persistencia, sin `beforeunload`. Cerrar la pestaña, tocar atrás en el navegador o que venza la sesión **borra todo sin aviso**. El único guard es el botón "Cancelar carga", que no cubre ninguno de esos casos.

2. **El paso "Términos" mezcla dos decisiones distintas** (`:1582-1901`): cuánto dura el contrato (fechas, día de pago, índice, frecuencia) y cuánta plata mueve (monto, expensas, depósito, comisión, mora, cobranza). Y las fechas son las que **determinan todo lo que sigue**: si aparece el paso de períodos anteriores, cuántos son, y si el contrato nace con deuda. Hoy esa consecuencia recién se ve dos pantallas después.

3. **Elegir cobranza directa puede dejar al usuario en un callejón sin salida.** Si el propietario no
   tiene cargada la cuenta de cobranza directa, el alta falla y el mensaje **manda a irse de la
   pantalla**: *"Entrá a la ficha del propietario → Cuenta de cobranza directa y cargá banco + CBU
   (22 dígitos) + alias"* (`core.ts:974` y `core.ts:2883`, **el mismo texto duplicado en dos lugares**).
   Como hoy no hay borrador, irse a la ficha del propietario **destruye el alta entera**. Es el peor
   cruce posible entre los dos problemas.

4. **La cartera en curso se carga a mano, mes por mes.** El caso mayoritario de A&B son contratos que arrancaron hace meses. Hoy el alta obliga a declarar cada período vencido uno por uno. **`Contrato.devengarDesde` ya existe y la importación masiva ya lo usa** (`importaciones-cartera.ts:432`), pero `POST /contratos` **no lo acepta** (cero menciones en `core.ts`).

### Contexto que conviene saber

- El wizard de **escanear PDF con OCR** (`CargarContratoWizard`, `:132-661`) es **código muerto en producción**: `CargarContratoPage` (`:118-130`) devuelve siempre el wizard de API cuando `apiEnabled` es true, y en prod lo es. Camila nunca lo vio, y el parser de PDF nunca existió. No diseñar sobre eso ni mostrarlo en una demo.
- `ContratoDraft` **ya existe** (`schema.prisma:1348`) con `datos Json`, `creadoPor`, `contratoId`. Fue creado para ese flujo de OCR muerto (su comentario documenta `{campo:{valor,confianza}}`). Se reusa para el borrador, pero el shape de `datos` pasa a ser el estado del wizard.

## Diseño

### 1. Estado único serializable (habilitante)

Los 34 `useState` no se pueden serializar ni escalar a más pasos. Se refactorizan a **un solo `useReducer`** con la forma:

```ts
type EstadoAlta = {
  paso: number;
  datos: DatosAlta;      // TODO lo que va al body del POST — serializable
  ui: EstadoUI;          // busqueda, resultados, dialogs — NO se persiste
  archivos: ArchivosUI;  // File objects — NO serializables, NO se persisten
};
```

La separación `datos` / `ui` / `archivos` es la que hace posible el autosave sin mentir.

**Esto es trabajo de ingeniería real, no cosmético.** Es la parte más riesgosa de la fase y va primero, con el wizard funcionando igual que hoy antes de tocar nada más.

### 2. Borrador con guardado automático

- **Modelo**: `ContratoDraft` + tres campos nuevos — `actualizadoAt DateTime @updatedAt`, `paso Int @default(1)`, y `@@unique([inmobiliariaId, creadoPor])` (un borrador activo por usuario).
- **Endpoints nuevos** en `apps/api/src/routes/core.ts`, gateados por `contratos.crear`:
  - `PUT /contratos/borrador` — upsert del borrador del usuario actual.
  - `GET /contratos/borrador` — devuelve el borrador si existe.
  - `DELETE /contratos/borrador` — al confirmar el alta o al descartar.
- **Front**: se guarda con debounce (2 s) desde el primer campo. Al entrar al alta, si hay borrador, se ofrece retomarlo o descartarlo. Al dar de alta con éxito, se borra.
- 🔴 **Los archivos NO se guardan.** Los `File` no son serializables. Si el borrador se recupera con adjuntos pendientes, **la pantalla tiene que decirlo explícitamente** (*"las fotos que habías cargado hay que volver a adjuntarlas"*). Prometer que guarda todo y perder los adjuntos es peor que no tener borrador.
- Además: `beforeunload` cuando hay cambios sin guardar.

### 3. Separar Plazo y Dinero

El paso 3 actual se parte en dos:

**Plazo y salida** — `fechaInicio`, `fechaFin`, `diaPago`, `indiceAjuste`, `frecuenciaAjusteMeses`.
Con **preview en vivo** debajo de las fechas:
- *"Este contrato arrancó hace 7 meses"* → adelanta que va a haber que definir el arranque de cuenta.
- *"Primer ajuste: 14/01/2027"*.
- Si `fechaFin <= fechaInicio`, el error se explica **ahí**, no al confirmar.

**Dinero** — `tipoContrato`, `monto`, `moneda`, `montoExpensas`, `depositoGarantia`, `comisionInmobiliaria`, `moraSel`/`moraValor`, `modoCobranza`. Sin campos nuevos.

Va Plazo **antes** que Dinero porque determina el resto del wizard.

### 4. Arranque de cuenta

El paso de períodos anteriores (hoy el 4) pasa a ofrecer **dos caminos** cuando el contrato ya arrancó:

- **"Empezar a cobrar desde este mes"** (un click) → setea `devengarDesde` al 1º del mes en curso. Lo anterior no se devenga: se salda por afuera. Es el camino que la importación masiva ya usa.
- **"Declarar mes por mes"** → el flujo actual, sin cambios.

**Backend**: `POST /contratos` acepta `devengarDesde` (`z.coerce.date().optional()`).

🔴 **`devengarDesde` y `periodosAnteriores` son EXCLUYENTES.** Expresan lo mismo de dos formas: si llegan los dos, el contrato pierde deuda real o la duplica. **Se valida en el servidor con un 400 explícito**, no solo en la UI.

### 5. Stepper y errores

- El stepper pasa a ser **clickeable hacia atrás** (a cualquier paso ya visitado). Hacia adelante sigue requiriendo validación.
- Los botones "Continuar" deshabilitados sin explicación se reemplazan por **el motivo escrito** de por qué no se puede avanzar.

### 6. Cuenta del propietario, sin salir del alta

Cuando en el paso **Dinero** se elige `modoCobranza = PROPIETARIO_DIRECTO`, la pantalla resuelve el
problema **ahí mismo** en vez de mandar al usuario a otra sección:

- Si el propietario **ya tiene** cuenta cargada → se muestra en modo lectura (banco, titular, CBU
  enmascarado, alias) con un link "Editar".
- Si **no tiene** → un aviso con el botón **"Cargar la cuenta del propietario"** que abre el dialog
  encima del wizard. Al guardar, el aviso se reemplaza por los datos y el alta sigue.

**No hay componente nuevo ni endpoint nuevo.** Se reusa lo que ya existe:

- `CuentaCobranzaDialog` (`apps/inmobiliaria/src/components/cuenta-cobranza-dialog.tsx`), props
  `{ open, onOpenChange, propietario, onSaved? }`. Hoy lo usa un solo lugar
  (`editar-propietario-trigger.tsx:83`). Ya ramifica bien: con `apiEnabled` pega a
  `setCuentaCobranzaDirecta`, y solo en demo escribe `guardarOverride` en localStorage.
- `PUT /propietarios/:id/cuenta-cobranza-directa` (`core.ts:668`), que hace upsert.
- `onSaved` se cablea a invalidar la query del propietario, para que el wizard vea la cuenta nueva.

**Detalles que hay que respetar:**

- 🔴 **La propiedad puede no tener propietarios cargados.** Ese caso ya está contemplado aparte
  (`core.ts:2881`) y **el dialog no lo resuelve**: no hay a quién cargarle la cuenta. Ahí el mensaje
  sigue siendo el de ir a la ficha de la propiedad, no el botón.
- 🔴 **El CBU/alias del alta del propietario NO es la cuenta de cobranza directa.** Son campos
  distintos y el copy actual ya lo aclara. No prellenar uno con el otro ni dar a entender que
  "ya lo cargó" cuando lo que cargó fue el otro.
- `CuentaCobranzaDirecta` exige **5 campos** (banco, titular, CBU, alias, CUIT), pero el dialog
  **ya prellena titular y CUIT desde el propietario**, así que en la práctica se tipean tres.
  ⚠️ Igual conviene preguntarle a Camila si los cinco son realmente obligatorios: si alguno frena
  el alta sin necesidad, es el mismo callejón con otra puerta.
- **El mensaje de error duplicado** (`core.ts:974` y `:2883`) se unifica en una constante compartida.
  El servidor **sigue validando**: esto es una mejora de UI, no se afloja la regla.

## Testing

- **Unit (sin DB)**: el reducer — cada acción produce el estado esperado; `datos` es serializable (round-trip `JSON.parse(JSON.stringify(...))` sin pérdida); `archivos` nunca entra en lo que se persiste.
- **Integración del borrador**: `PUT` crea y luego actualiza el mismo (no duplica, por el unique); `GET` de otro usuario **no** devuelve el borrador ajeno; `DELETE` lo borra; el borrador es tenant-scopeado.
- **Integración de `devengarDesde`**: alta con `devengarDesde` del mes en curso → cero liquidaciones anteriores; alta con `devengarDesde` **y** `periodosAnteriores` → **400**; alta sin `devengarDesde` → comportamiento idéntico al de hoy (no regresión).
- **E2E en navegador**: cargar medio contrato → cerrar la pestaña → volver a entrar → el borrador se ofrece y se recupera, con el aviso de los adjuntos. Y: contrato que arrancó hace 6 meses → "cobrar desde este mes" → se crea con 1 cuota, no 7.
- **E2E de la cuenta del propietario**: propiedad cuyo propietario **no** tiene cuenta → elegir
  cobranza directa → cargar la cuenta desde el aviso → **el alta se completa sin recargar la página
  y sin perder ningún campo ya tipeado**. Y el caso negativo: propiedad **sin propietarios** → sigue
  apareciendo el mensaje de ir a la ficha de la propiedad, no el botón.
- **No regresión**: el suite de `core` sigue verde; un alta simple (contrato que arranca hoy) sigue tomando los mismos pasos.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El refactor a reducer rompe el alta, que es el flujo más crítico del panel | Va primero y solo, sin cambios de comportamiento, con el E2E del alta pasando antes de seguir |
| El borrador promete guardar todo y pierde los adjuntos | La UI lo dice explícitamente al recuperar; los archivos nunca entran en `datos` |
| `devengarDesde` + `periodosAnteriores` juntos corrompen la deuda | Excluyentes, validado en el servidor con 400 y su test |
| Más pasos hacen el alta más lenta contra el mostrador | Plazo y Dinero son cortos; el simple pasa de 4 a 5 pantallas. Si se siente pesado, se revisa antes de la Fase 2 |
| El dialog dentro del wizard desmonta el alta o pierde el estado | El dialog es un overlay, no una navegación; el E2E verifica explícitamente que ningún campo tipeado se pierda |
| El cálculo de períodos está sincronizado con el back (bug i36 de períodos huérfanos) | No se toca `enumerarPeriodosContrato`: sigue siendo la fuente única compartida |

## Fuera de alcance (explícito)

- Documentación obligatoria, paso de garantía, paso de servicios, cláusula de rescisión por contrato, scoring/veraz → Fases 2 y 3, bloqueadas esperando decisiones de Camila.
- El wizard de OCR muerto: no se toca ni se revive en esta fase.
- Borradores compartidos entre usuarios del equipo (hoy: uno por usuario). Está en la lista de preguntas para Camila.
