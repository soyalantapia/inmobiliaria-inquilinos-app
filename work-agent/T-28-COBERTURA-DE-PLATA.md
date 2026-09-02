# T-28 · Los caminos de plata sin red — relevamiento del 01/09/2026

> **Por qué se hizo.** El ticket T-28 decía "terminar los endpoints que faltan", pero lo escribió
> alguien mirando una suite de 458 tests. Hoy son **1.311** (748 sin base + 563 con base) y la
> tercera auditoría le agregó una docena más. La primera pregunta no era qué escribir: era
> **qué quedó realmente sin cubrir**.
>
> **Cómo.** Seis agentes mapearon en paralelo las seis áreas donde vive la plata (pagos,
> rendiciones, liquidaciones, mora y depósito, caja y consorcio, importaciones). **72 caminos
> mapeados.** Los que quedaron marcados sin red pasaron por un escéptico cuyo único trabajo era
> encontrarles un test y tumbarlos. **12 sobrevivieron**, y un sintetizador los volvió a
> verificar a mano uno por uno: quedaron **7**.
>
> **Lo que hay que leer aunque no se escriba un test.** El hallazgo 1 **no es un hueco de
> cobertura: es un bug de plata**, y ya está arreglado — ver más abajo.

---

## 🔴 El hallazgo 1 ya está arreglado

`pagadoAlVencimientoPorLiquidacion` cortaba el "pagó en fecha" al final del día **UTC** mientras
el resto de la mora corta por día civil argentino. Cualquier pago hecho entre las 21:00 y las
23:59 del día del vencimiento se contaba como tardío, y la mora volvía a correr sobre el total:
**$27.000 en vez de $45** sobre una cuota de $600.000 pagada en $599.000. Es T-57 reintroducido
por la puerta de atrás, en el corte gemelo del que T-56 arregló.

Va con su arreglo y sus diez casos en **#115**.

---

## ✅ Los siete quedaron cubiertos

Escritos y verificados el mismo día. Cada uno con **control negativo corrido a mano**: se
neutraliza la línea que protege y se comprueba que el test se pone rojo *con el número que
importa*, no sólo con un status code.

| # | camino | dónde |
|---|---|---|
| 1 | 🔴 el corte de "pagó en fecha" en UTC — **era un bug** | **#115** |
| 2 | la rendición excluye condonados y migrados del bruto | **#118** |
| 3 | los dos guards del crédito bancario (moneda, modoCobranza) | **#117** |
| 4 | finalizar con NETEAR / EJECUTAR | **#119** |
| 5 | `POST /contratos/:id/renovar` | **#120** |
| 6 | el tope global del `INGRESO_EXTRA` | **#121** |
| 7 | anular un pago: qué queda en la liquidación | **#119** |

Los números que reproducen los controles negativos, que son el argumento de todo esto:

- **$27.000 de mora en vez de $45** (×600) — #115
- **$150 acreditados sobre $100 que entraron** — #121
- un crédito de **$500.000 cancelando US$ 500.000 a 1:1** — #117
- el bruto de la rendición de **$500.000 a $600.000**, y la comisión de $35.000 a $42.000 — #118
- el depósito **marcado consumido sin saldar una sola cuota** — #119
- una cuota re-preciada a **$520.000 en vez de $577.000** por usar las expensas equivocadas — #120

**Nada de lo de arriba tocó una línea de producción, salvo #115**, que era el defecto.

**Y hay un séptimo hallazgo que no es un test:** el descarte #4 de la lista final
(`cerrarCargosContraDeposito` cerrando el excedente) tiene una **decisión de producto** atrás —
si el depósito es $100.000 y los arreglos $250.000, ¿los $150.000 que sobran se marcan saldados
o se siguen reclamando? Hoy se marcan saldados sin que entrara un peso, contradiciendo al propio
`componerDeposito`, que expone ese `excedente` justamente para reclamarlo. Conviene confirmarlo
antes de escribir el test que lo fije.

---

# Caminos de plata sin red — informe final

Repo: `C:/Users/alann/dev/soyalantapia/inmobiliaria-inquilinos-app` (main, 3377d748). Todas las rutas de abajo son relativas a esa raíz. Verifiqué cada hallazgo abriendo el handler y grepeando `apps/api/test/` (139 archivos) más los `*.test.ts(x)` de los tres fronts.

---

## 1. La mora de TODA la cartera se corta en UTC mientras el resto del sistema corta en hora argentina

**Dónde:** `apps/api/src/lib/saldos.ts:107` (dentro de `pagadoAlVencimientoPorLiquidacion`, definida en :91)

**Qué plata mueve:** es la base sobre la que corre la mora de cada cuota. Tiene 21 call sites: la PWA del inquilino (`plata.ts:132`), el tope de `/pagos/informar`, `/pagos/manual` (`plata.ts:1465`), el guard de la conciliación bancaria (`resumenes-bancarios.ts:360`), `anular` (`plata.ts:738`), `saldar-deuda` (`plata.ts:861`), la aplicación del depósito (`aplicar-deposito.ts:162`), `deudaTotal` del panel y el KPI de morosidad (`metricas.ts:122`).

**Qué se rompe en silencio:** el corte es `fechaTransferencia > venc + 86.400.000 − 1`, o sea el final del día **UTC**. El resto de la mora corta por día civil argentino: `diasAtraso` usa `diaCivilAR` (`punitorios.ts:132`) y `vencimiento-huso-horario.test.ts:29` fija textualmente que "a las 21:00 del PROPIO día 10 tampoco vence". Los dos criterios no coinciden entre las 21:00 y las 23:59 hora AR del día del vencimiento — y ése no es un borde raro: la PWA manda `new Date().toISOString()` (`apps/inquilino/src/app/(full)/pago/[liqId]/checkout/page-client.tsx:1280`), un instante, no una fecha civil.

El caso concreto: cuota de $600.000 que vence el 10/07, el inquilino paga $599.000 a las 21:30 del 10 (AR). Ese pago tiene `fechaTransferencia = 2026-07-11T00:30Z`, cae fuera del corte, y `pagadoAlVencimiento` devuelve 0 en vez de 599.000. La liq queda PARCIAL, `fechaPago` null, y a 30 días con 0,15% diario la mora corre sobre los $600.000 completos: **$27.000 en vez de $450**. Es el número textual del ticket T-57 (`punitorios.ts:112`), reintroducido por la puerta de atrás. Nadie lo ve: sale un número más grande y listo.

**Qué test habría que escribir:** uno con base, mínimo: una liq con `fechaVencimiento: 2026-07-10T00:00:00.000Z` y un `Pago` CONCILIADO de $599.000 con `fechaTransferencia: 2026-07-11T00:30:00.000Z`; llamar `pagadoAlVencimientoPorLiquidacion([liq])` y esperar `599_000`. Se compara contra la regla que la función de al lado ya tiene fijada en `vencimiento-huso-horario.test.ts:29`. Hoy devuelve un Map vacío. (Si se quiere puro: extraer el predicado del corte a una función y testearlo con los tres instantes — 20:59, 21:30 y 00:30 del día siguiente AR.)

---

## 2. La rendición excluye condonados y migrados del bruto con una query propia que nadie ejercita

**Dónde:** `apps/api/src/routes/plata.ts:2274` (`condonado: false`) y `apps/api/src/routes/plata.ts:2284` (`migradoDeCartera: false`), dentro del `tx.pago.groupBy` inline de `POST /rendiciones`

**Qué plata mueve:** define `montoBruto`, y de ahí `comisionMonto` y `montoNeto` — lo que la inmobiliaria efectivamente le transfiere al propietario.

**Qué se rompe en silencio:** los tres tests que hablan de estos filtros miran **otro código**. `saldos.test.ts:164-183` lee el TEXTO FUENTE de `src/lib/saldos.ts` con `readFileSync` y afirma sobre ese string. `rendicion-pendiente-solo-rendible.test.ts:118-132` espía el `where` de `src/lib/rendicion-pendiente.ts`. `cierre-caja-filtros.test.ts:81/110` afirma sobre `whereCierreDelDia` de `src/lib/cierre-caja.ts`. Ninguno de los tres alcanza `routes/plata.ts`, que tiene su propia copia duplicada de la cuenta. Los tres tests que sí leen el fuente de `routes/plata.ts` (`guards-dentro-de-la-tx`, `metricas-moneda`, `rendicion-participacion-guard`) no afirman nada sobre estos dos campos.

Del lado del comportamiento: ningún test crea un `Pago` con `condonado: true` en toda la suite, y el único con `migradoDeCartera: true` (`portal-propietario-e2e.test.ts:513`) lo lee por el portal del propietario, nunca rinde. **Borrar cualquiera de las dos líneas deja la suite entera en verde.** Con un condonado de $100.000 colado en una liq de $600.000, el bruto pasa a 700.000, la comisión cobra 7% sobre plata que no entró, y al dueño se le transfiere el neto de un cobro imaginario. Con un migrado, se le vuelve a pagar algo que ya cobró por fuera del sistema.

**Qué test habría que escribir:** rendir un período a un dueño con dos pagos CONCILIADO sobre la misma liquidación — $500.000 real y $100.000 con `condonado: true` — y esperar `montoBruto` = la porción de alquiler de los $500.000, con `comisionMonto` = 7% de eso. Repetir con `migradoDeCartera: true`. Se compara contra `plata.test.ts:247-259`, que ya hace la aritmética exacta (1.340.000 − 93.800 − 90.500 = 1.155.700) pero sólo con pagos limpios.

---

## 3. Conciliar un crédito del extracto: los dos guards que deciden si esa plata puede saldar esa cuota

**Dónde:** `apps/api/src/routes/resumenes-bancarios.ts:338` (modoCobranza) y `apps/api/src/routes/resumenes-bancarios.ts:348` (moneda)

**Qué plata mueve:** ambos custodian el mismo `Pago` CONCILIADO que crea el endpoint por el monto del crédito bancario, y que después entra al cierre de caja con comisión y arma rendición pendiente al propietario.

**Qué se rompe en silencio:**

- **Moneda.** El extracto no declara en qué moneda está. Sin el guard, un crédito de $500.000 cancela una liquidación de **USD 500.000 a 1:1**: el inquilino queda al día habiendo pagado ~1/1000 de lo que debe, la liq va a PAGADO, y esa diferencia se le rinde al dueño como si hubiera entrado. Las dos pantallas dicen PAGADO.
- **modoCobranza.** En cobranza directa el inquilino le transfiere al dueño; la inmobiliaria no recibió nada. Sin el guard, un crédito cualquiera del extracto salda esa cuota, entra al arqueo con comisión y genera rendición: la inmo le transfiere al propietario plata que nunca tuvo, y el dueño ya la había cobrado él.

El único test que pega al endpoint es `apps/api/test/conciliar-informado-huerfano.test.ts:141`, y su fixture arma la liquidación con `moneda: 'ARS'` (línea 96) sobre `cnt_001`, que en `apps/api/prisma/seed.ts:171` no declara `modoCobranza` y cae en el default INMOBILIARIA. Los dos guards se ejercitan sólo en su rama "pasa": **borrarlos enteros deja la suite verde.** Ninguno de los dos mensajes de 409 aparece en un test. El filtro hermano de candidatos (`resumenes-bancarios.ts:54` y `:62`) tampoco tiene tests, porque nadie pega a `GET /resumenes-bancarios/:id`.

**Qué test habría que escribir:** dos casos sobre el fixture que ya existe en `conciliar-informado-huerfano.test.ts`. (a) misma liq pero con `moneda: 'USD'` → 409 con `/no declara moneda/i`, y verificar que **no se creó ningún Pago** sobre esa liq y que sigue PENDIENTE. (b) la liq colgada de `cnt_005` (el único PROPIETARIO_DIRECTO del seed, `seed.ts:175`) → 409 con `/cobra directo al propietario/i`, mismos asserts de "no se movió nada". Se compara contra el happy path ARS/INMOBILIARIA que ese mismo archivo ya cubre.

---

## 4. Finalizar un contrato con NETEAR o EJECUTAR — el camino que el panel manda por defecto

**Dónde:** `apps/api/src/routes/core.ts:2237` (el `if (estadoDep === 'NETEADO' || estadoDep === 'EJECUTADO')` que llama a `aplicarDepositoADeuda`)

**Qué plata mueve:** el depósito de garantía entero imputado contra las cuotas exigibles del ex-inquilino, creando Pagos CONCILIADOS y marcando liquidaciones PAGADO/PARCIAL. En el test hermano son $100.000 contra $70.000 de deuda.

**Qué se rompe en silencio:** **ningún test manda NETEAR ni EJECUTAR a `/finalizar`.** Grepeé `decisionDeposito` en todo el repo: los únicos envíos desde un test son `bugs-de-plata.test.ts:132` (DEVOLVER), `:151` (MANTENER), `:168` (DEVOLVER) y `finalizar-cierra-cargos-deposito.test.ts:100/116` (DEVOLVER). Las otras cinco llamadas a `/finalizar` (`bugs-de-plata.test.ts:184`, `finalizar-cuota-rechazada.test.ts:70`, `plata.test.ts:639`, `baja-contrato.test.ts:208`, las cuatro de `rescindir-contrato.test.ts`) van sin depósito. Toda la cobertura del depósito aplicado a deuda vive en `/contratos/:id/deposito/resolver`, que es OTRO handler con OTRA copia de la cuenta.

Agravante: el default del diálogo del panel es **NETEAR** (`apps/inmobiliaria/src/components/finalizar-contrato-button.tsx:46`). O sea, el camino sin un solo test es el que el operador manda si no toca nada. Si se rompe, el contrato queda NETEADO, la garantía figura consumida, y las cuotas siguen VENCIDAS sumando punitorios — exactamente el CAZABUG P1 que `deposito-aplica-deuda.test.ts` blindó del otro lado. El diálogo de baja ya le mostró al operador un saldo neto con el depósito restado. Ningún `*.test.ts` de los fronts toca ese componente.

**Qué test habría que escribir:** copiar el escenario de `deposito-aplica-deuda.test.ts` (depósito $100.000, dos cuotas exigibles de $35.000 y una futura) y pegarle a `POST /contratos/:id/finalizar` con `{ tipo: 'FINALIZADO', decisionDeposito: 'NETEAR', montoDepositoDevuelto: 0 }`. Esperar `depositoAplicadoADeuda: 70000`, `depositoSobrante: 30000`, `cuotasSaldadas: 2`, las dos liqs en PAGADO con un Pago CONCILIADO trazable y `condonado: false`, y la futura intacta. Se compara literalmente contra `deposito-aplica-deuda.test.ts:104-127` — mismos asserts, otra ruta.

---

## 5. `saldar-deuda` con `condonar: true` — la marca que separa "perdoné la deuda" de "entró plata"

**Dónde:** `apps/api/src/routes/plata.ts:906` (`condonado: !!b.condonar` en el `tx.pago.create`)

**Qué plata mueve:** ese flag es lo único que distingue una condonación de un cobro. Lo leen `cierre-caja.ts:79`, `rendicion-pendiente.ts:248` y `metricas.ts:106`.

**Qué se rompe en silencio:** el único test que manda `condonar` (`saldar-deuda-registra-cargos.test.ts:124`) corre sobre un contrato creado con `fechaInicio` 2027-01-01 **a propósito** — el comentario de la línea 68 dice "sin cuotas exigibles" —, así que el loop de liquidaciones nunca entra y no se crea ningún `Pago`: ese archivo mide sólo `CargoContrato` y `MovimientoCaja`. El único test con cuota exigible que llama al endpoint, `saldar-deuda-concurrencia.test.ts:55`, manda payload vacío y sólo cuenta pagos CONCILIADO y el estado PAGADO. **Nadie lee el campo `condonado` que este handler escribe.**

Si sale en `false`, una condonación se convierte en cobro: entra al arqueo del día con comisión, y se le rinde al propietario plata que nadie pagó. La liquidación dice PAGADO en las dos ramas, así que no hay diferencia visible en ninguna pantalla.

**Qué test habría que escribir:** sobre el fixture de `saldar-deuda-concurrencia.test.ts` (liq VENCIDA de $90.000 en `cnt_003`), pegarle a `POST /contratos/:id/saldar-deuda` con `{ condonar: true }` y esperar que el `Pago` creado tenga `condonado === true`, y que `GET /caja/cierre` de ese día NO lo cuente. El caso espejo (`{}` sin condonar) debe dar `condonado === false` y sí contarlo. Se compara contra `deposito-aplica-deuda.test.ts:123`, que ya afirma `condonado: false` para el otro camino de escritura.

---

## 6. Los dos topes de la rendición de ingresos extra: la aritmética está cubierta, el cableado no

**Dónde:** `apps/api/src/routes/plata.ts:2591` (bloque de `INGRESO_EXTRA`), con los dos `groupBy` que lo alimentan en `apps/api/src/routes/plata.ts:2610` (`yaRendidoPorMi`) y `apps/api/src/routes/plata.ts:2627` (`yaRendidoGlobal`)

**Qué plata mueve:** suma al `montoNeto` que la inmobiliaria le transfiere al propietario. Es plata que **sale de la caja de la inmobiliaria**, no del inquilino. Escribe `IngresoRendido` y marca `MovimientoCaja.descontadoEnRendicion`.

**Qué se rompe en silencio:** crucé los 8 archivos que hacen `POST /rendiciones` (`plata.test.ts:247/272/282/300`, `rendicion-multiowner` ×9, `rendicion-pre-ledger:171`, `rendicion-reclamo-multiduenio:26`) contra los 4 que crean un `INGRESO_EXTRA` (`cuentas.test.ts:96-101`, `plata.test.ts:443-477`, `descobrar-cargo.test.ts:93`, `saldar-deuda-registra-cargos.test.ts:94`). **La intersección es vacía**: ningún test deja un ingreso pendiente sobre una propiedad del dueño y después rinde — en `plata.test.ts` el ingreso se crea en la línea 443, cien líneas después de la última rendición. Las tres apariciones de `ingresoRendido` en tests son `deleteMany` de limpieza. Los únicos dos `totalIngresos` del repo son fixtures: `portal-propietario-e2e.test.ts:685` (en 0) y `apps/inmobiliaria/src/components/mensaje-rendicion.test.ts:80` (formateo de WhatsApp).

El assert numérico de `plata.test.ts:259` sólo cierra porque `totalIngresos` vale 0: **el bloque entero 2586-2670 puede borrarse y la suite queda verde.**

Matiz que hay que decir: la **aritmética** de los dos caps sí está cubierta, y bien, por `apps/api/test/parte-rendible.test.ts` — incluido "el tope GLOBAL frena el doble pago cuando cambian las participaciones" (línea 36), que es exactamente el caso $150-sobre-$100 que documenta el comentario de `plata.ts:2620`. Lo que no está cubierto es el **cableado**: si alguien pasa `yaRendidoGlobal: 0`, `parte-rendible.test.ts` sigue verde y el bug vuelve intacto. Y el movimiento queda marcado como cubierto (50+100 ≥ 100), así que el caso se cierra solo y nadie lo audita.

**Qué test habría que escribir:** integración sobre `POST /rendiciones`, no aritmética. `INGRESO_EXTRA` de $100 en una propiedad A(50%)/B(50%): rendir a A → `totalIngresos` 50 y un `IngresoRendido`; cambiar la participación a B(100%); rendir a B → esperar **50, no 100**, y que la suma de `IngresoRendido` sobre ese `refId` nunca pase $100. Se compara contra `rendicion-multiowner.test.ts:373-415`, que hace exactamente esta secuencia para los **gastos**; el espejo de ingresos no existe.

---

## 7. Anular un pago: nadie mira cómo queda la liquidación después

**Dónde:** `apps/api/src/routes/plata.ts:760` (el recompute de estado) y `apps/api/src/routes/plata.ts:702` (la liberación del `CreditoDetectado`)

**Qué plata mueve:** devuelve un `Pago` CONCILIADO a RECHAZADO y recalcula la liquidación a PAGADO/PARCIAL/PENDIENTE/VENCIDO contra `base + mora`, limpiando `fechaPago` y `metodoPago`. Y libera el crédito del extracto para poder reasignarlo.

**Qué se rompe en silencio:** los dos únicos tests que ejecutan el handler, `plata.test.ts:312` (409 por rendido) y `plata.test.ts:360` (200), **sólo assertean `statusCode`**. Ninguno relee la liquidación después. `guards-dentro-de-la-tx.test.ts:64` es estructural: hace `readFileSync` del fuente (línea 34) y sus tres asserts miran `tx.alquilerRendido.findFirst`, `pg_advisory_xact_lock` y los textos de los 409 — no ejecuta nada y no menciona `creditoDetectado`.

Si el recompute se rompe, la liq queda PAGADO con su único pago en RECHAZADO: deuda real que ninguna pantalla muestra, que la rendición pendiente saltea y sobre la que la mora nunca vuelve a devengar. Y el `CreditoDetectado` queda `conciliado: true` apuntando a un pago anulado: plata bancaria huérfana que no se puede reasignar a la liquidación correcta — el `creditoDetectado` de los tests aparece sólo en `conciliar-informado-huerfano.test.ts:41` y `:123`, como limpieza y fixture.

**Qué test habría que escribir:** liq de $100.000 con **dos** pagos CONCILIADO ($60.000 + $40.000), anular uno → releer la liq y esperar `estado: 'PARCIAL'`, `fechaPago: null`, `metodoPago: null`, y `montoPagado` 60.000. Segundo caso: anular el pago que nació de una conciliación bancaria → esperar que su `CreditoDetectado` vuelva a `conciliado: false, pagoId: null`. Se compara contra `plata.test.ts:360`, que hoy sólo dice 200.

---

## Lo que YA tiene red

Vale tanto como la lista de arriba: acá no hay que escribir nada.

- **Aritmética de la mora** — `mora-sobre-el-saldo.test.ts` (9 casos, incluye el T-57 de $27.000 vs $450), `mora-cascada.test.ts` (la herencia contrato → inmobiliaria, incluido el `MONTO_FIJO` que no cruza monedas), `mora-congelada-al-informar.test.ts` (`asOfMora`: INFORMADO congela, RECHAZADO no), `mora-fecha-civil.test.ts` (T-56, `instanteEnDiaCivilAR`), `vencimiento-huso-horario.test.ts` (el corte del día en hora AR), `plata-no-acepta-infinito.test.ts`.
- **El cuerpo de `POST /pagos/manual`** — `plata.test.ts:525-590`: parcial → PARCIAL, cierre → PAGADO con `metodoPago`, tope de saldo → 400, rol CARGA → 403, liq ya paga → 409. Más `pago-monto-centavos.test.ts` para el redondeo.
- **`POST /pagos/informar`** — los dos guards de entrada sí están: fecha futura en `informar-backdate.test.ts:68-73`, contrato no activo en `plata.test.ts:645-650`.
- **`saldar-deuda` bajo concurrencia y con cargos** — `saldar-deuda-concurrencia.test.ts` (5 requests simultáneos → exactamente 1 pago) y `saldar-deuda-registra-cargos.test.ts` (el cargo entra a caja, respeta la moneda, no duplica).
- **El depósito aplicado a deuda por `/deposito/resolver`** — `deposito-aplica-deuda.test.ts` (EJECUTAR imputa 70.000, sobra 30.000, la futura no se toca), `deposito-cap-disponible.test.ts`, `aplicar-deposito-plan.test.ts`, `deposito.test.ts` (`componerDeposito` puro, incluido el excedente).
- **Los topes de la rendición, del lado de los gastos** — `rendicion-multiowner.test.ts` end-to-end (cap por dueño, cap global, anular reabre, conservación del total, separación por moneda) y `parte-rendible.test.ts` para la aritmética pura.
- **La rendición como cuenta** — `plata.test.ts:247-259` fija bruto/comisión/gastos/neto con números exactos; `rendicion-pre-ledger.test.ts`, `rendicion-participacion-guard.test.ts`, `rendicion-pendiente-solo-rendible.test.ts` cubren los guards de entrada.
- **Anular una rendición** — `plata.test.ts:321`: 200, libera los gastos, sin `AlquilerRendido` huérfanos, la cabecera sobrevive marcada y el listado la esconde por default.
- **Conciliar el happy path** — `conciliar-informado-huerfano.test.ts`: cubre, no cubre, y que el INFORMADO huérfano se cierre como RECHAZADO con trazabilidad y sin contar dos veces.
- **Los filtros de lectura de plata** — `cierre-caja-filtros.test.ts`, `saldos.test.ts`, `rendicion-pendiente-solo-rendible.test.ts` blindan `condonado`/`migradoDeCartera`/`modoCobranza` en los helpers de `src/lib/`. (Ojo: blindan los helpers, **no** la copia inline de `routes/plata.ts` — ver hallazgo 2.)
- **Que los guards se decidan dentro de la tx** — `guards-dentro-de-la-tx.test.ts` cubre estructuralmente los cuatro handlers, incluido `anular`.

---

## Lo que se cayó

Ninguno de los que llegaron tenía un test que lo cubriera — el escéptico ya había hecho ese filtro y lo re-verifiqué. Estos se caen por **ranking**, no por cobertura: los saqué de la lista principal porque mueven menos plata, o porque el error tarda menos en verse, o porque el código en riesgo es demasiado chico para romperse en silencio. Si sobra presupuesto de tests, van en este orden.

1. **`PUT /cobranza/mora` (`core.ts:3244`)** — el más ruidoso de los descartes y el que más me costó bajar. Es cierto que no lo toca **ningún** test (grepeé `cobranza` en `apps/api/test/`: 25 hits, todos `modo-cobranza` o prosa; el más cercano, `carga-no-toca-plata.test.ts:56`, pega a `PUT /contratos/:id/mora`, que es otro handler). Pero el handler son cinco líneas: un `z.enum`, un guard de `valor` y un `update` de dos columnas. El riesgo real que describía el hallazgo —la interacción `MONTO_FIJO` × `monedaDefault`— no vive acá sino en `resolverEsquemaMora`, y **eso sí está cubierto**, en `mora-cascada.test.ts:131` y `:189`. Baja probabilidad de romperse en silencio.
2. **Los dos guards de entrada de `/pagos/manual` (`plata.ts:1432` fecha futura, `plata.ts:1452` contrato no ACTIVO)** — confirmé que no tienen un solo test: grepeé los dos mensajes exactos en `apps/api/test/` y en los tres fronts, cero hits; los tres archivos que pegan al endpoint usan `FECHA = '2026-06-02'` sobre `cnt_003` ACTIVO, y `pago-monto-centavos.test.ts:39` **fuerza** `cnt_001` a ACTIVO en su `beforeAll` justamente para que el guard no corte. Lo bajo porque el guard de fecha futura tiene 24 h de tolerancia (el daño máximo es un día de punitorios auto-condonados, no un mes), porque el guard gemelo de `/pagos/informar` sí está probado y comparte forma, y porque el cuerpo del endpoint —que es donde está la plata— está bien cubierto. Sub-hallazgo cierto y anotado igual: en las dos corridas `asOf ≤ fechaVencimiento`, así que `calcularMora` dentro de este handler devuelve 0 en el 100% de las veces.
3. **`POST /pagos/:id/rechazar`, el `updateMany` que escribe RECHAZADO (`plata.ts:598`)** — el único test de la ruta es `plata.test.ts:145` ("rechazar sin observación → 400") y corta en el `safeParse` de zod: nunca llega al `updateMany`. Todo lo demás que menciona RECHAZADO es fixture (`plata.test.ts:63`, `baja-contrato.test.ts:184`, `finalizar-cuota-rechazada.test.ts:31-55`) u otro handler (`conciliar-informado-huerfano.test.ts:164`, `operacion.test.ts:220`, `bugs-de-plata.test.ts:237`). Lo bajo porque si falla, el pago queda INFORMADO — y un INFORMADO **no** suma al cobrado, así que no hay plata mal transferida: el daño es un comprobante trabado en la bandeja para siempre, con la mora congelada en su `fechaTransferencia` (`asOfMora`) y el inquilino bloqueado para re-informar por el índice parcial único de `schema.prisma:1867`. Grave y molesto, pero se ve.
4. **`cerrarCargosContraDeposito` cerrando el excedente (`deposito.ts:100`)** — real y verificado: el `updateMany` no tiene tope y cierra TODOS los `CargoContrato contraDeposito` con `saldadoAt: null`, así que con depósito $100.000 y $250.000 en arreglos quedan $150.000 marcados como saldados sin que entrara un peso — contradiciendo al propio `componerDeposito`, que expone ese `excedente` (`deposito.ts:37`) para que se reclame por otra vía. Los 6 tests de `cerrar-cargos-contra-deposito.test.ts` usan un `tx` espía (línea 22) y sólo miran el `where` del `updateMany`: ninguna base, ningún monto. El único test con base que cierra cargos de verdad, `finalizar-cierra-cargos-deposito.test.ts`, arma el caso **inverso** (depósito 500.000 vs reparación 120.000, líneas 31-32). Lo bajo porque el escenario pide deducciones > depósito, que es menos frecuente que los siete de arriba, y porque hay una decisión de producto atrás (¿cerrar o no el excedente?) que conviene confirmar con Alan antes de escribir el test que la fije.