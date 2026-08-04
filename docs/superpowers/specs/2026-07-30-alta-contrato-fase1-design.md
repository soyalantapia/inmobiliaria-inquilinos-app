# Alta de contrato — Fase 1: que no se pierda y que las fechas no muerdan

**Fecha:** 2026-07-30
**Rama:** `feat/alta-contrato-pasos` (worktree `~/dev/myalq-altapasos`, base `origin/main` cbf00a6)
**Origen:** rediseño del alta de contrato pedido por Alan a partir de la reunión con Camila (23/07).

## Alcance

Esta es la **Fase 1 de 3** del rediseño. Se eligió así porque **no depende de ninguna decisión de negocio que Camila todavía no tomó**, y resuelve el dolor más caro. Las fases 2 (documentación obligatoria) y 3 (garantía, servicios, rescisión) están bloqueadas esperando respuestas suyas y tienen su propio spec.

> 🔴 **Corregido el 03/08.** La primera versión de este spec daba por inexistente el borrador y
> planificaba construirlo, más un refactor a `useReducer` para habilitarlo. **Las dos cosas se
> cayeron al verificar contra el código**: el borrador ya está en main desde el 30/07. Se sacaron las
> dos tareas más grandes de la fase. Lo que queda abajo es lo que de verdad falta.

**Entra en Fase 1:**
1. Completar el borrador que ya existe (`beforeunload` + aviso de adjuntos).
2. Separar el paso "Términos" en dos: **Plazo y salida** / **Dinero**, con preview en vivo de las consecuencias de las fechas.
3. Stepper clickeable hacia atrás y errores de validación visibles.
4. **Cargar la cuenta del propietario sin salir del alta** cuando se elige cobranza directa.

**No entra:** documentación obligatoria, paso de garantía, paso de servicios, cláusula de rescisión por contrato, scoring/veraz.

## Diagnóstico

### Lo que NO está roto (verificado, contra lo que se creía)

Camila reportó que al fallar el alta *"tenía que cargar todo de vuelta"*. **Eso no se reproduce en el código actual.** El `catch` de `dar_de_alta` (`apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx:1263-1277`) solo hace `setErrorServidor`, `setEnviando(false)` y `setConfirmando(false)`: no resetea ningún campo ni cambia de paso. El wizard queda en Confirmar con todos los datos y un banner rojo, y se puede reintentar.

Tampoco es cierto que no se pueda volver atrás: `avanzar()`/`retroceder()` (`:1068-1077`) solo cambian `paso`, y como los 34 `useState` viven en el componente padre (que no se desmonta), navegar entre pasos **no pierde nada**.

⚠️ **Queda una pregunta abierta para Camila**: en qué contexto exacto perdió los datos. La hipótesis de este spec es que fue una **sesión vencida o un refresh** (que sí destruye todo), no un 400. El borrador resuelve las dos, así que la Fase 1 avanza igual — pero conviene confirmarlo antes de dar el problema por cerrado.

### Lo que sí está roto

1. ~~**No existe ningún borrador.**~~ 🔴 **CORREGIDO EL 03/08: el borrador YA EXISTE y funciona.**
   Entró el 30/07 en `df23fab` y **ya estaba en `cbf00a6`**, la misma base contra la que se escribió
   este spec. Esta sección afirmaba lo contrario sin verificarlo.

   Lo que hay hoy (`apps/inmobiliaria/src/lib/contrato-borrador-storage.ts` + el wizard):
   autosave a `localStorage` namespaceado por `userId:inmobiliariaId` sacado del JWT; guarda **los 27
   campos serializables**, incluido `periodosForm`; diálogo al entrar con *"Retomar" / "Empezar de
   cero"*; se borra al dar de alta con éxito (`:1487`) y al descartar (`:1136`); y al restaurar
   corrige el paso 4 cuando ya no hay períodos vencidos.

   **Lo que sí falta del borrador** (esto es lo único que queda de este punto):
   - No hay `beforeunload`: cerrar la pestaña con cambios recientes puede perder lo posterior al último guardado.
   - El diálogo de retomar **no avisa que las fotos del DNI hay que volver a adjuntarlas**. Los `File`
     no se guardan (correcto), pero el copy no lo dice.

2. **El paso "Términos" mezcla dos decisiones distintas** (`:1582-1901`): cuánto dura el contrato (fechas, día de pago, índice, frecuencia) y cuánta plata mueve (monto, expensas, depósito, comisión, mora, cobranza). Y las fechas son las que **determinan todo lo que sigue**: si aparece el paso de períodos anteriores, cuántos son, y si el contrato nace con deuda. Hoy esa consecuencia recién se ve dos pantallas después.

3. **Elegir cobranza directa puede dejar al usuario en un callejón sin salida.** Si el propietario no
   tiene cargada la cuenta de cobranza directa, el alta falla y el mensaje **manda a irse de la
   pantalla**: *"Entrá a la ficha del propietario → Cuenta de cobranza directa y cargá banco + CBU
   (22 dígitos) + alias"* (`core.ts:974` y `core.ts:2883`, **el mismo texto duplicado en dos lugares**).
   Como hoy no hay borrador, irse a la ficha del propietario **destruye el alta entera**. Es el peor
   cruce posible entre los dos problemas.

4. ~~**La cartera en curso se carga a mano, mes por mes.**~~ **NO es un problema** (Alan, 03/08):
   declarar cada período vencido es lo que se quiere, porque esa deuda tiene que quedar trackeada y
   cobrable. Se registra acá porque este spec lo trataba como un dolor a resolver y no lo es.

### Contexto que conviene saber

- El wizard de **escanear PDF con OCR** (`CargarContratoWizard`, `:132-661`) es **código muerto en producción**: `CargarContratoPage` (`:118-130`) devuelve siempre el wizard de API cuando `apiEnabled` es true, y en prod lo es. Camila nunca lo vio, y el parser de PDF nunca existió. No diseñar sobre eso ni mostrarlo en una demo.
- `ContratoDraft` **ya existe** (`schema.prisma:1348`) con `datos Json`, `creadoPor`, `contratoId`. Fue creado para ese flujo de OCR muerto (su comentario documenta `{campo:{valor,confianza}}`). Se reusa para el borrador, pero el shape de `datos` pasa a ser el estado del wizard.

## Diseño

### 1. ~~Estado único serializable~~ — **DADO DE BAJA (03/08)**

Este spec proponía refactorizar los 34 `useState` a un `useReducer`, con esta justificación: *"no se
pueden serializar"*. **Es falso**: el autosave que ya está en main los serializa en cada tecleo
(`page.tsx:1178`). La otra mitad del argumento — *"ni escalar a más pasos"* — no se sostiene sola:
partir un paso en dos no requiere cambiar el manejo de estado.

Era la tarea más grande y más riesgosa de la fase, sobre el flujo más crítico del panel, **y existía
solo para habilitar un borrador que ya existe**. Se saca. El wizard sigue con `useState`.

### 2. Borrador — **CASI TODO YA ESTÁ HECHO**

No se construye nada nuevo: no hay migración, no hay endpoints, no se toca `ContratoDraft` (que sigue
siendo del flujo de OCR muerto). Solo se completan las dos puntas que faltan:

- **`beforeunload`** mientras haya datos cargados y el alta no se haya confirmado.
- **El diálogo de retomar avisa por los adjuntos**: agregar al copy que las fotos del DNI hay que
  volver a adjuntarlas. Prometer que guarda todo y perder los adjuntos es peor que avisar.

🔴 **Regla permanente:** todo campo nuevo del wizard **tiene que sumarse a `BorradorContrato`**. Si se
agrega al wizard y no a la interfaz del borrador, se pierde en silencio al retomar — y nadie se entera
hasta que un contrato nace con los datos equivocados.

### 3. Separar Plazo y Dinero

El paso 3 actual se parte en dos:

**Plazo y salida** — `fechaInicio`, `fechaFin`, `diaPago`, `indiceAjuste`, `frecuenciaAjusteMeses`.
Con **preview en vivo** debajo de las fechas:
- *"Este contrato arrancó hace 7 meses"* → adelanta que va a haber que declarar 7 períodos vencidos, dos pantallas antes de encontrárselos.
- *"Primer ajuste: 14/01/2027"*.
- Si `fechaFin <= fechaInicio`, el error se explica **ahí**, no al confirmar.

**Dinero** — `tipoContrato`, `monto`, `moneda`, `montoExpensas`, `depositoGarantia`, `comisionInmobiliaria`, `moraSel`/`moraValor`, `modoCobranza`. Sin campos nuevos.

Va Plazo **antes** que Dinero porque determina el resto del wizard.

### 4. ~~Arranque de cuenta~~ — **DADO DE BAJA (03/08, respuesta de Alan)**

Este spec proponía un camino de un click — *"empezar a cobrar desde este mes"* — que seteaba
`devengarDesde` y **no devengaba nada anterior**, más el `devengarDesde` en `POST /contratos` para
habilitarlo.

**Alan lo descartó explícitamente** (`2026-08-03-preguntas-camila.md`, pregunta 1):

> *"Debería tener el trackeo de todo el pasado para poder ir a cobrarle."*

La deuda anterior al alta tiene que quedar **declarada, trackeada y cobrable**. Saltearla es
exactamente lo que no se quiere. El camino de **declarar mes por mes — que ya existe y funciona — es
el correcto**, no el atajo.

Se saca la sección entera: no se toca `POST /contratos` y no se agrega `devengarDesde` al alta manual.
(El campo sigue existiendo en el modelo y lo sigue usando la importación masiva, que es otro caso.)

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

- ⚠️ **`apps/inmobiliaria` no tiene runner de tests** (no hay vitest ni jest ni un solo `.test.tsx`).
  Montar uno para esta fase sería scope que nadie pidió, así que **el front se verifica en el navegador**
  más `tsc --noEmit` (baseline 0). Vale la pena montarlo en algún momento; no acá.
- **El riesgo de "agregué un campo al wizard y me olvidé del borrador"** se cubre sin test: el borrador
  lleva `version`, y al cambiar de versión los viejos se descartan en vez de restaurarse mal.
- **E2E en navegador**: cargar medio contrato → cerrar la pestaña → volver a entrar → el borrador se
  ofrece y se recupera **con el aviso de los adjuntos** (no regresión de lo que ya funciona, más el
  copy nuevo). Y: contrato que arrancó hace 6 meses → se declaran los 6 períodos mes por mes → el
  contrato nace con esa deuda trackeada (no regresión del camino que Alan confirmó como el correcto).
- **E2E de la cuenta del propietario**: propiedad cuyo propietario **no** tiene cuenta → elegir
  cobranza directa → cargar la cuenta desde el aviso → **el alta se completa sin recargar la página
  y sin perder ningún campo ya tipeado**. Y el caso negativo: propiedad **sin propietarios** → sigue
  apareciendo el mensaje de ir a la ficha de la propiedad, no el botón.
- **No regresión**: el suite de `core` sigue verde; un alta simple (contrato que arranca hoy) sigue tomando los mismos pasos.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Diseñar sobre lo que ya existe sin verificarlo** — pasó en este mismo spec: dos tareas completas para construir un borrador que ya estaba en main | Cada tarea del plan arranca leyendo el código que va a tocar. La regla vale para las fases 2 y 3 |
| Partir el paso 3 rompe el alta, que es el flujo más crítico del panel | El E2E del alta simple corre antes y después; el estado sigue en el padre, así que partir el render no mueve datos |
| El borrador promete guardar todo y pierde los adjuntos | La UI lo dice explícitamente al recuperar; los archivos nunca entran en `datos` |
| Se agrega un campo al wizard y no al borrador → se pierde al retomar | El borrador lleva `version`: al cambiarla, los viejos se descartan en vez de restaurarse mal |
| `devengarDesde` + `periodosAnteriores` juntos corrompen la deuda | Excluyentes, validado en el servidor con 400 y su test |
| Más pasos hacen el alta más lenta contra el mostrador | Plazo y Dinero son cortos; el simple pasa de 4 a 5 pantallas. Si se siente pesado, se revisa antes de la Fase 2 |
| El dialog dentro del wizard desmonta el alta o pierde el estado | El dialog es un overlay, no una navegación; el E2E verifica explícitamente que ningún campo tipeado se pierda |
| El cálculo de períodos está sincronizado con el back (bug i36 de períodos huérfanos) | No se toca `enumerarPeriodosContrato`: sigue siendo la fuente única compartida |

## Fuera de alcance (explícito)

- Documentación obligatoria, paso de garantía, paso de servicios, cláusula de rescisión por contrato, scoring/veraz → Fases 2 y 3, bloqueadas esperando decisiones de Camila.
- El wizard de OCR muerto: no se toca ni se revive en esta fase.
- Borradores compartidos entre usuarios del equipo (hoy: uno por usuario). Está en la lista de preguntas para Camila.
