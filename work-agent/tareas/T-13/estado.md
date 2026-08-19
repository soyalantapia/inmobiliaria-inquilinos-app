# T-13 · Cuentas de caja — HECHA

rama: `feat/reunion-camila-0308` · fase: 8

## La causa raíz no era la que decía la tarea

La tarea decía "construido, mal ubicado". Cierto, pero lo que probablemente vio Camila el 03/08
(*"lo de la caja no está hecho nada"*) fue otra cosa, y estaba a la vista en el código:

> `caja/page.tsx` · el selector de cuenta estaba gateado por
> `{apiEnabled && cuentasCompatibles.length > 0 && (…)}` **sin rama `else`**.

Con **cero cuentas creadas** —el estado inicial de cualquier inmobiliaria— el campo desaparecía
en silencio. Ni empty state, ni "creá una cuenta primero", ni link. No es que estuviera
escondido: la pantalla se quedaba callada.

## Qué cambió

**Navegación — integrar, no enlazar.** `/cuentas` pasa a ser una **pestaña dentro de `/caja`**
(`/caja?tab=cuentas`), con el mismo patrón de Tabs que ya usa `/pagos`. Eran dos pantallas
hermanas con **cero links entre ellas**: la única frase que las relacionaba estaba del lado
equivocado (en `/cuentas`, explicándole caja a quien ya había llegado a cuentas).

Se sacó el ítem duplicado del menú y "Caja de gastos" pasó a **"Caja y cuentas"**. Verificado
que nadie pierde acceso: `caja.ver` y `cuentas.ver` tienen exactamente los mismos roles
(`permisos.ts:122-123`). `/cuentas` sigue existiendo como ruta para no romper un favorito.

**El saldo, donde se carga el gasto.** El criterio pedía "carga un gasto en una cuenta y ve el
saldo de esa cuenta". El saldo vivía **sólo** en `/cuentas` — en las 909 líneas de `/caja` no
aparecía la palabra "saldo" ni una vez. Ahora se muestra debajo del selector, al elegir la cuenta.

**Empty state.** Sin cuentas cargadas, el formulario ahora lo dice y explica que se puede cargar
igual (queda sin cuenta asignada).

**El bug de monedas: era real.** `cuentas.ts` agrupaba por `['cuentaId','tipo']` **sin
`moneda`**, así que un gasto de US$800 y uno de $80.000 se restaban como si fueran la misma
unidad — y el front lo rotulaba en pesos, porque `formatMonto` sin segundo argumento asume ARS.
`CuentaCaja` **no** tiene moneda propia, así que el modelo no lo neutralizaba.

Ahora `GET /cuentas` devuelve `porMoneda: [{moneda, entradas, salidas, saldo}]`, con el mismo
patrón que ya usaban el cierre de caja y la rendición. El front lo muestra con
`formatTotalPorMoneda`, que ya existía: con una sola moneda se ve **igual que antes**.

### El detalle que hacía urgente arreglarlo

Hoy el bug **no era alcanzable**: el formulario tiene selector $ / US$ y lo emitía, pero el
handler de la página arma el payload campo por campo y **se comía `moneda`**, así que el zod del
back caía al default ARS y todo se guardaba en pesos.

Y el comentario que está ahí mismo dice: *"Antes NO se reenviaba el **tipo** → una Entrada se
guardaba como GASTO/salida"*. **El mismo bug ya había pasado en ese mismo payload, con otro
campo.** Es decir: el arreglo obvio de una línea (mandar `moneda`) estaba a un commit de
distancia de volver observable el saldo mezclado.

Por eso se hizo **en este orden**: primero el agregado por moneda, después mandar la moneda.
Al revés se corrompen los saldos mostrados.

## Transferencia entre cajas: NO existe

Camila la nombró (*"para mover las cajas"*). Verificado que no existe: `TipoMovimientoCaja` tiene
sólo `{GASTO, INGRESO_EXTRA}` y `MovimientoCaja` tiene un único `cuentaId`, sin par
origen/destino. Se puede **simular** con dos movimientos sueltos (gasto en la cuenta origen,
ingreso en la destino) y los saldos quedan bien, pero **no quedan vinculados**: se puede borrar
una sola pata y descuadrar. **No entra en T-13** — es una tarea nueva.

## Verificación

- `tsc --noEmit` limpio en `apps/api` y `apps/inmobiliaria`.
- **`next build` completo**: compila, typecheckea y genera las 74 páginas. Atajó un error que
  `tsc` no ve —un `page.tsx` de App Router sólo puede exportar el default, y yo había puesto
  ahí el `CuentasPanel` reusable—; por eso el panel terminó en `components/cuentas-panel.tsx`,
  que además es donde va.
- `next lint` sin hallazgos nuevos.
- El build sigue fallando en `/(landing)/inicio/opengraph-image` (`Invalid URL` en `@vercel/og`).
  **Preexistente y ya documentado en T-27**; no toqué la landing.

### Lo que NO se pudo verificar

**No se probó en el navegador.** El clasificador de seguridad bloqueó las herramientas de preview
en esta sesión (mismo problema documentado antes). O sea: las pestañas, el empty state y el saldo
bajo el selector están verificados por compilación y lectura, **no vistos funcionando**.

**Los tests de `apps/api` no se corrieron.**

> ⚠️ **Corrección.** Acá decía *"pegan a la Postgres de producción"* citando `docs/TESTING.md`, y
> esa fuente dice **lo contrario**: *"Esta NO es la DB de prod. Prod corre dentro de Railway con
> el host interno, inalcanzable desde tu máquina. El proxy público es la instancia de test/dev."*
> Fue una lectura al revés de la fuente que citaba.
>
> **La conclusión no cambia** —siguen sin correrse— pero por el motivo verdadero: es una
> instancia **compartida** que el seed borra de forma destructiva, y en esta máquina no existe
> `apps/api/.env`, así que `DATABASE_URL` ni siquiera está seteada.
`cuentas.test.ts` quedó **actualizado** al contrato nuevo —incluye un caso multi-moneda que antes
no existía, que es la razón por la que nadie había visto el bug— pero **sin ejecutar**.

## Bloqueado por T-04 (no se tocó)

- La card **"Cierre de caja del día"** y su `GET /caja/cierre`: es la única superficie de caja que
  lee la tabla `Pago`. No se movió ni de pestaña.
- El bug **gemelo** de moneda en `POST /cargos/:id/saldar` (`plata.ts:822-834`): crea un
  `MovimientoCaja` sin pasar moneda aunque `CargoContrato` tiene la suya. Está dentro del radio de
  T-04 (pide `pago.conciliar` y emite `PAGO_CONCILIADO`). **No afecta a T-13**: ese movimiento se
  crea sin `cuentaId`, y el agregado exige `cuentaId: { not: null }`.
