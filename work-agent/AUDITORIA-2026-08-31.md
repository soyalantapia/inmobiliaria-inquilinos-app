# Auditoría del 31/08/2026 — seis clases de defecto, barridas y refutadas

**Cómo se hizo, para que se pueda juzgar el resultado.** Las seis clases no se eligieron a dedo:
son las que aparecieron una por una durante el trabajo de hoy (T-11, T-19, T-20, T-13, T-22). La
hipótesis fue que si cada una apareció una vez, hay más.

1. **Seis buscadores**, uno por clase, barrieron el repo en paralelo → **28 candidatos**.
2. **Tres refutadores por candidato**, con lentes distintas —¿la evidencia existe y dice eso?;
   ¿el escenario es alcanzable de verdad?; ¿ya está cubierto, arreglado o es deliberado?—, con la
   instrucción de refutar ante la duda → **15 sobrevivieron, 13 cayeron**.
3. Un sintetizador verificó a mano los sobrevivientes, dedupó y priorizó → **13 hallazgos**.

85 agentes, 1.465 lecturas de archivo. Todo sobre `main @ 3377d748` y en sólo-lectura.

**Qué NO cuenta como hallazgo acá:** estilo, nombres, refactors, TODOs, tests faltantes genéricos,
y nada que ya esté arreglado en los PRs abiertos de hoy. La sección final —"Lo que NO es un
problema"— vale tanto como el resto: dice qué se miró y por qué se descartó.

---

# Revisión de `inmobiliaria-inquilinos-app` — main @ `3377d748`

13 hallazgos verificados uno por uno contra el código. Ordenados por gravedad y, dentro de cada gravedad, por qué tan fácil es que pase de verdad.

---

## PLATA

## Un moroso que pagó una parte no entra en NINGUNA audiencia de anuncios: no recibe ni el aviso de mora ni el recordatorio
**Dónde:** `apps/api/src/routes/anuncios.ts:53-57` (y el filtro de `:186-190`)
**Qué pasa:** `derivarEstadoPago` compara el enum persistido de la liquidación (`l.estado === 'VENCIDO'`). El resto del sistema no usa el enum crudo: usa `liqVencida` (`apps/api/src/routes/core.ts:50-54`), que también cuenta como vencida una PENDIENTE o PARCIAL cuyo vencimiento ya pasó. El comentario de `anuncios.ts:53` dice literal *"Mismo derivado que GET /contratos"* y es falso.
**El escenario:** el inquilino debe $572.000 de mayo, paga $200.000 → `plata.ts` pisa la liquidación a PARCIAL. El barrido `marcarLiquidacionesVencidas` (`apps/api/src/lib/liquidaciones.ts:225`) **no toca PARCIAL a propósito**, así que nunca vira a VENCIDO. Resultado: el panel lo muestra moroso, pero `INQUILINOS_MOROSOS` lo descarta (no es VENCIDO) e `INQUILINOS_PENDIENTES` también (no es PENDIENTE). El que más necesita el aviso es el único que no lo recibe. Bonus del mismo bug: `?? liqs[0]` toma la cuota devengada del mes que viene, así que un inquilino al día cae en `INQUILINOS_PENDIENTES`.
**Por qué existe:** la regla de "vencida" se derivó on-read en `core.ts` para tapar el hueco del PARCIAL (lo dice su propio docblock, "auditoría A2"), pero `anuncios.ts` mantiene una tercera copia de la regla, escrita antes y nunca migrada.
**Qué costaría arreglarlo:** mediano-chico. Hay que agregar `fechaVencimiento` a los dos `select` (`anuncios.ts:68` y `:182`) y subir `liqVencida`/`liqQueDefineEstado` de `core.ts` a un módulo compartido en vez de mantener una tercera copia. Es el arreglo correcto; el parche de una línea reintroduce la divergencia.

---

## El dueño que cobró en pesos Y dólares no se puede rendir desde el panel, y el que no cobró nada ve un aviso de mezcla de monedas
**Dónde:** `apps/inmobiliaria/src/lib/api/hooks.ts:1268-1270`, consumido en `apps/inmobiliaria/src/app/(app)/propietarios/page.tsx:340`, `:466` y `:534`
**Qué pasa:** `monedaMensual === null` significa DOS cosas distintas — cero monedas y más de una — y la mezcla se codifica poniendo los montos en **0** (`const cobrado = mezcladas ? 0 : …`). La pantalla lee ese cero defensivo como "no hay nada que rendir".
**El escenario (cara A, la que traba plata):** un dueño con un contrato en ARS y otro en USD → `totalRecibirMes = 0` → `necesitaRendir = false` (`page.tsx:340`) → badge **"Al día"** (`:433`) y el botón **Rendir deshabilitado** (`:534`), en la misma tarjeta que le dice al operador *"Cobros en pesos y dólares · rendí cada moneda por separado"* (`:466`). El diálogo donde se elige la moneda no se puede abrir. Además queda fuera del filtro `?filtro=sin-rendir` y del contador `porRendir` (`:161-164`, `:193-195`): no está trabado, está invisible. Una vez que se rindió una moneda por otra vía, `rendido` es truthy y el botón se habilita — o sea, lo único imposible es *empezar*.
**El escenario (cara B, la que grita al pedo):** un dueño **sin ningún cobro del período** también tiene `monedaMensual === null` → ve "—" donde correspondería $0 y el mismo cartel de mezcla de monedas. Con el rol CARGA (403 en `/liquidaciones` → `errorLiqs`) el cartel sale en **todas** las tarjetas, siempre. Semáforo siempre rojo.
**Por qué existe:** el cero es deliberado y está comentado ("*la UI muestra '—' en vez de un total falso*"); lo que nadie revisó es que el mismo número se usa como señal booleana de "hay algo que rendir".
**Qué costaría arreglarlo:** chico. El dato bueno ya existe y ya se usa bien un archivo más allá: `rendir-propietario-dialog.tsx:139-140` decide con `monedasMes.length > 1`. Usar ese mismo criterio para la habilitación y para el cartel, y dejar `$0` cuando no hubo cobros.

---

## La comisión que cargás por contrato se imprime en el contrato firmado y no la cobra ninguna rendición
**Dónde:** se escribe en `apps/api/src/routes/core.ts:1561`; el único lector real es `apps/inmobiliaria/src/lib/contrato-generator.ts:194`
**Qué pasa:** `Contrato.comisionInmobiliaria` no lo lee ningún cálculo de plata. La rendición (`apps/api/src/routes/plata.ts:2397`), el cierre de caja (`lib/cierre-caja.ts`) y la ganancia por contrato (`lib/ganancia-contrato.ts`) descuentan **`Propietario.comisionPct`** (default 8, `core.ts:936`). El campo sí tiene un consumidor, y es el peor posible: el generador lo estampa en la Cláusula Sexta — Honorarios de intermediación del Word que firman las partes.
**El escenario:** en el alta se pacta 3%. El contrato que se firma dice *"el LOCATARIO abonará … el equivalente al **3%** mensual del canon"*. Toda rendición posterior descuenta el 8% del propietario, y ese 8 queda congelado en `Rendicion.comisionPct`, visible en el portal del dueño. El papel firmado y la plata efectivamente tomada no coinciden. Y el copy del formulario lo promete explícitamente: *"Es la comisión que cobrás por ESTE contrato. Si la dejás vacía, se usa la comisión general en las rendiciones"* (`contratos/nuevo/page.tsx:2108-2110`) — el "si la dejás vacía" implica que si la llenás, se usa. Nunca se usa.
**Por qué existe:** son dos comisiones conceptualmente distintas (honorarios contra el LOCATARIO vs. descuento contra el PROPIETARIO) que quedaron con el mismo rótulo y sin cablear entre sí. Agravante: no existe ningún PATCH/PUT para este campo, así que si se cargó mal en el alta, desde el panel no se corrige nunca.
**Qué costaría arreglarlo:** grande si se quiere honrar la tasa por contrato — la rendición es por propietario+período y agrega varios contratos en un solo `montoBruto`, así que habría que comisionar por liquidación y repensar el `comisionPct` congelado. **Chico** si la decisión es la otra: sacar el campo del alta o cambiarle el copy y el rótulo para que diga que es sólo la cláusula del contrato. Lo que no se puede es dejar la promesa escrita.

---

## Un rol CARGA puede redirigir a su propia cuenta la plata de una propiedad entera
**Dónde:** `apps/api/src/routes/core.ts:632-633` (`PUT /propiedades/:id/participaciones`) + `core.ts:908-909` (`POST /propietarios`)
**Qué pasa:** el PUT de participaciones gatea con `propiedades.crear`, que en `packages/shared/src/permisos.ts:154` incluye a CARGA, y —a diferencia de todos sus hermanos destructivos: `DELETE /propiedades` (`core.ts:1339`), `DELETE /propietarios` (`:1126`), `PUT /propietarios` (`:970`)— no agrega el corte `if (u.rol === 'CARGA')`. Y no cambia porcentajes: hace `deleteMany` + `createMany` del set completo dentro de la transacción, o sea **reemplaza a los dueños**.
**El escenario:** un usuario CARGA (1) crea un propietario nuevo con el CBU que quiera — `POST /propietarios` también es `propietarios.crear`, tampoco tiene corte de rol y su zod acepta `cbuAlias` (`core.ts:918`, escrito tal cual en `:933`); (2) abre la ficha de la propiedad, aprieta **"Editar reparto"** (`propiedades/[id]/page-client.tsx:597`, sin ningún filtro de rol) y deja al propietario nuevo al 100%; (3) la próxima rendición transfiere ahí. El agravante: CARGA no tiene `pagos.ver`, así que mueve plata que su propio rol le niega mirar.
**Por qué existe:** el corte de rol se agregó endpoint por endpoint. El comentario de `core.ts:960` razona largo por qué el PUT de propietarios corta ancho ("*`cbuAlias` es el DESTINO de la rendición*"), y esa misma lógica nunca llegó ni al PUT de participaciones ni al alta de propietario.
**Qué acota el daño:** los 409 `COBRADO_SIN_RENDIR` y `PAGOS_EN_VUELO` (`core.ts:679-780`, revalidados dentro de la `$transaction`) impiden desviar plata que ya está en el tubo — el daño es sobre el alquiler **futuro**. Y el cambio de reparto deja rastro en `CambioParticipacion` con `autorId`. El alta del propietario con CBU, en cambio, no emite ningún evento.
**Qué costaría arreglarlo:** chico. Una línea igual a la de `core.ts:1339` después del `if (!u) return` del PUT, más el test en `carga-no-toca-plata.test.ts`. En el mismo pase hay que decidir si `POST /propietarios` debería aceptar `cbuAlias` de un CARGA.

---

## Un usuario CAJA deshace un cobro y borra el ingreso de caja — dos cosas que la matriz reserva a ADMIN
**Dónde:** `apps/api/src/routes/plata.ts:1139` (`POST /cargos/:id/descobrar`)
**Qué pasa:** el endpoint exige `pago.conciliar` (ADMIN + CAJA, `permisos.ts:182`) y hace de una sola vez las dos operaciones que la matriz sí reserva a ADMIN: revierte un cobro —registra el evento `PAGO_REVERTIDO` (`plata.ts:1243`)— y borra un `MovimientoCaja`. `pago.revertir` y `caja.eliminar` son ambas `roles: ['ADMIN']` (`permisos.ts:184` y `:188`), y esta última encima pide PIN.
**El escenario:** un usuario CAJA entra a un contrato, ve un cargo marcado Cobrado y aprieta **"Deshacer"** (`apps/inmobiliaria/src/components/cargos-contrato-card.tsx:110`, sin ningún gate de rol, a diferencia del "Anular" de `pagos-por-validar.tsx`). El cargo vuelve a ser deuda del inquilino y desaparece el `INGRESO_EXTRA` que había dejado `saldar`.
**Por qué existe:** el hermano `POST /pagos/:id/anular` (`plata.ts:633-637`) tiene el razonamiento escrito y correcto: *"`pago.revertir` (ADMIN) — NO `pago.conciliar` … el propio handler registra el evento PAGO_REVERTIDO, que la matriz declara ADMIN"*. `descobrar` nació después, por otro camino (destrabar el 409 de `imputarCostoReclamo`), y heredó el gate de su acción directa (`saldar`, también `pago.conciliar`) en vez del de su inversa.
**Qué lo acota:** no es un borrado libre de caja. El `deleteMany` está acotado a descripción+contrato+monto+moneda del cargo y frena con 409 si ese ingreso ya se rindió al propietario.
**Qué costaría arreglarlo:** chico. Cambiar el `requireUsuario` de `:1139` a `pago.revertir` y agregarle al botón "Deshacer" el `rolTienePermiso` que hoy no tiene (hoy además se le muestra a OPERADOR, CARGA y LECTURA sólo para darles 403).

---

## PRIVACIDAD

## Un alta de contrato con `personaId` escribe el email del inquilino sin verificar de quién es — y el comentario que lo justifica cita un guard que ya no existe
**Dónde:** `apps/api/src/routes/core.ts:1577-1579`, justificado por el comentario de `core.ts:1474-1475`
**Qué pasa:** `POST /contratos` tiene dos ramas. Sin `personaId`, va a `buscarOCrearPersona` y después corre `esOtraPersona(dniPedido, p.dni)` → 409 si ese email pertenece a otro DNI (`core.ts:1597`). Con `personaId`, hace un `findFirstOrThrow` de **solo lectura** sobre Persona: nunca la escribe, así que no ejerce el `@@unique([inmobiliariaId, email])` y no corre ningún chequeo de titularidad. El `emailInq` se escribe igual en `Inquilino.email` (`core.ts:1529`).
**El escenario:** el operador elige del autocomplete la Persona de Juan Pérez y en el campo email tipea (por error o no) `mariela.sosa@gmail.com`. Se crea un `Inquilino` con el email de Mariela colgado del contrato de Juan. `POST /auth/inquilino/otp/request` busca por email **sin scope de tenant** (`auth.ts:393`, `findMany({ where: { email: emailLc } })`) y le manda el código a la casilla de Mariela: entra al contrato ajeno y ve monto, deuda y documentos.
**Por qué existe:** el comentario de `:1474-1475` dice *"(El guard de email de arriba sigue aplicando: un 2º contrato reusado no puede repetir el email de otra fila…)"*. Tres líneas más arriba, el comentario `:1466-1472` explica que ese guard **se sacó** (multi-alquiler) y que lo único que queda es el unique de Persona. El archivo se contradice a sí mismo en un bloque de diez líneas: uno documenta la remoción y el otro justifica la ausencia de validación invocando lo removido.
**Qué costaría arreglarlo:** chico. Correr el chequeo de titularidad también en la rama `personaId` — comparar `emailInq` contra la Persona reusada y contra cualquier otra Persona del tenant que ya lo tenga —, y borrar el comentario mentiroso. Ojo: restituir el viejo unique de `Inquilino` NO es el arreglo, rompería el multi-alquiler.

---

## CONFUSIÓN

## El dashboard dice "3 propietarios por rendir", hacés click y la lista viene vacía
**Dónde:** `apps/inmobiliaria/src/lib/api/hooks.ts:1674`
**Qué pasa:** `const porRendir = propietarios.filter((p) => p.totalRecibirMes > 0).length`. `useDashboard` (`hooks.ts:1559-1564`) no consulta rendiciones en absoluto. Ese número no mide "cuántos faltan rendir": mide "cuántos propietarios tienen alquiler cobrado este mes", y **nunca baja dentro del período**, hagas las rendiciones que hagas.
**El escenario:** la inmobiliaria le rinde a los tres dueños. El home sigue mostrando "Propietarios por rendir: 3" en dos lugares (la card de "Para resolver hoy", `page.tsx:460-473`, y el KPI operacional, `:535-540`). La card linkea a `/propietarios?filtro=sin-rendir`, y esa pantalla **sí** aplica `!rendicionesMap[p.id]` (`propietarios/page.tsx:161-165`): el operador cae en una lista vacía. Dos pantallas del mismo panel contradiciéndose sobre plata. Efecto colateral: el empty state *"Todo al día — no tenés acciones urgentes"* exige `porRendir === 0` (`page.tsx:411`), así que en cualquier cuenta que haya cobrado algo ese cartel es inalcanzable para siempre.
**Qué costaría arreglarlo:** chico. `useRendicionesList()` ya existe (`apps/inmobiliaria/src/lib/api/use-rendiciones.ts:130`) y es el que usa la otra pantalla: armar el mapa por `propietarioId` del período y filtrar igual que `propietarios/page.tsx:193-195`. Acordate de sumar esa query al `cargando`, si no el contador parpadea alto antes de asentarse.

---

## "Ingresos del mes" del consorcio miente en las dos pantallas, de dos maneras distintas
**Dónde:** `apps/inmobiliaria/src/lib/consorcios-storage.ts:420-431` y `apps/api/src/routes/operacion.ts:1461`
**Qué pasa:** `balanceConsorcio` recorre **todos** los movimientos sin filtrar por período, y el rótulo dice "del mes". Eso solo ya sería un defecto; pero además `GET /consorcios` incluye únicamente `unidades`, nunca `movimientos`, y `mapConsorcio` los normaliza con `?? []` (`use-consorcios.ts:141`), borrando la diferencia entre "no hay" y "no me los mandaron".
**El escenario:** un edificio administrado hace tres años. En el **detalle** (`consorcios/[id]/page-client.tsx:134`, stats en `:229`/`:234`/`:239`) "Ingresos del mes", "Egresos del mes" y "Saldo del mes" muestran el acumulado histórico. En el **listado** (`consorcios/page.tsx:165`, cards en `:212-221`, y el KPI de cabecera de todo el módulo en `:46-48` y `:102-107`) los mismos tres rótulos muestran **$ 0 siempre**, para cualquier tenant, aunque el edificio haya movido plata todo el mes — porque `formatMonto(0)` devuelve "$ 0", no un guion. La lista dice 0, el detalle del mismo edificio dice 2.840.000.
**Por qué existe:** el payload reducido del listado es una decisión declarada (docblock de `use-consorcios.ts:8-9`: *"sin movimientos/asambleas, que sólo viajan en el detalle"*). El defecto es de consumo: la lista computa un balance a partir de un campo que el endpoint nunca manda. Ninguna de las dos caras se ve en la build demo (`!apiEnabled`), donde el seed hace que todo cierre.
**Qué costaría arreglarlo:** mediano. Son dos cambios: (a) que `balanceConsorcio` reciba el período y filtre por `m.fecha.slice(0,7) === c.periodoActual`; (b) que el listado devuelva un agregado del período (no la colección entera de movimientos de cada edificio) o que directamente deje de mostrar ese KPI, porque hoy no tiene con qué calcularlo. Arreglar sólo (a) deja la lista en cero igual.

---

## El estado de una unidad funcional no se puede escribir desde el panel: la fila muestra $50.000 en ámbar y un badge verde "Al día" al lado
**Dónde:** `apps/inmobiliaria/src/components/consorcio-crud.tsx:262-271`
**Qué pasa:** el objeto `input` de `UnidadDialog` —el mismo para `crearUnidad` y `editarUnidad`— no incluye `estado`, y el diálogo no tiene ningún control para elegirlo. No es una limitación del backend: el zod ya lo acepta (`apps/api/src/routes/operacion.ts:1585`, enum de cuatro valores) y tanto el POST como el PUT lo persisten. Toda UF creada en producción nace y queda con el default `AL_DIA` de Prisma (`schema.prisma:2542`), y tampoco hay forma de corregirla después.
**El escenario:** se carga la UF "3°B" con `saldoDeudor: 50000`. La columna de saldo la pinta en ámbar (`consorcios/[id]/page-client.tsx:393-398`) y la tarjeta de morosidad de arriba la cuenta bien como morosa (`morosidadConsorcio` usa `saldoDeudor > 0`, no `estado`). El badge de al lado, único consumidor de `u.estado` en todo el repo (`page-client.tsx:401-402`), dice **"Al día"** en verde. `PENDIENTE`, `VENCIDO` y `CON_PLAN_PAGO` son inalcanzables en producción: sólo aparecen en los datos sembrados de la demo (`consorcios-storage.ts:137/146/155`), que es lo que hace que el defecto sea invisible mostrando el producto.
**Qué costaría arreglarlo:** chico. Un `Select` de cuatro opciones en el diálogo y una línea en el payload. El arreglo de fondo (derivar `estado` de `saldoDeudor` del lado del server) es otra conversación, atada a la Fase 2 de expensas.

---

## La auditoría de una rendición en dólares la registra con signo de pesos — y contradice al evento de anulación de la misma rendición
**Dónde:** `apps/api/src/routes/plata.ts:2852`
**Qué pasa:** el evento `PROPIETARIO_RENDIDO` arma el texto con `` `… · neto $${Number(rendicion.montoNeto)}` `` — pesos fijos. `rendicion.moneda` está en scope y se persiste correcto.
**El escenario:** se rinden US$1.200. El libro de auditoría dice "neto $1200". Si después se anula, el evento `PROPIETARIO_RENDICION_ANULADA` (`plata.ts:3028`) sí usa `${r.moneda === 'USD' ? 'US$' : '$'}` y dice "neto US$1200". El mismo hecho queda con dos asientos que se contradicen, en la fuente que se consulta ante un reclamo de plata de un propietario.
**Por qué existe:** el docblock de `moneda` en `schema.prisma` dice que el campo se agregó justamente porque *"el portal del propietario mostraba los dólares con signo de pesos"*. Esta línea es un sobreviviente de esa limpieza.
**Qué costaría arreglarlo:** chico — una línea, con el patrón que el propio archivo ya usa cuatro veces. Vale barrer en el mismo pase los otros `$` hardcodeados de `plata.ts` (572, 619, 793, 990, 1127, 1381, 1561), y de paso ese evento imprime `propietario ${body.data.propietarioId}` —un cuid crudo— donde el resto de la auditoría escribe nombre y apellido.

---

## El preaviso de rescisión se guarda, no lo lee nadie, y el código dice que sí
**Dónde:** `apps/api/src/routes/operacion.ts:2224` (escritura) — sin ningún lector
**Qué pasa:** `Inmobiliaria.preavisoRescisionMesesDefault` (`schema.prisma:681`) se escribe por `PUT /mi-inmobiliaria/rescision` y sólo se relee en `GET /mi-inmobiliaria/reglas` (`operacion.ts:2192`) para repintar el mismo input. Cero consumidores. Su gemelo de la misma tarjeta, `penalidadRescisionMesesDefault`, **sí** se consume (`core.ts:2372`, la penalidad sugerida al finalizar, que termina emitida como `CargoContrato`).
**El escenario:** el admin entra a /mi-inmobiliaria, pone preaviso 3 y penalidad 2, aprieta Guardar, ve el toast de éxito. La penalidad cambia de verdad el diálogo de finalizar contrato. El preaviso queda escrito en una columna que nadie consulta: ninguna pantalla lo muestra, ninguna alerta lo usa, ningún cálculo de fecha lo lee. Como el compañero de tarjeta funciona, el admin queda convencido de que configuró la política de preaviso.
**Por qué existe:** dos textos afirman lo contrario y van a hacer que el próximo que los lea asuma que está cableado: el comentario de `operacion.ts:2206-2207` (*"La heredan los contratos sin valor propio (core.ts la lee al finalizar)"*, falso para preaviso) y el copy de `mi-inmobiliaria/page.tsx:207-208` (*"podés pisarlo contrato por contrato"*, imposible: `Contrato` sólo tiene `penalidadRescisionMeses`, `schema.prisma:1441`).
**Qué costaría arreglarlo:** chico si la decisión es sacar el campo o rotularlo como informativo; mediano si hay que darle un consumidor real (alerta de vencimiento del plazo de preaviso). Nada que ver con el preaviso de **egreso** (`Renovacion.fechaEgreso`), que sí funciona.

---

## El test que dice probar que "las ganancias ya no mezclan monedas" no puede fallar nunca
**Dónde:** `apps/api/test/expediente-permisos.test.ts:72-79`
**Qué pasa:** dos problemas encimados. (1) Corre sobre `prp_001`, que en el seed tiene un solo contrato, `cnt_001`, en ARS (`seed.ts:171`): el escenario de mezcla no se ejercita. (2) La aserción se compara contra sí misma: `body.moneda` y `body.total` salen los dos de `totales[0]` (`apps/api/src/routes/propiedad-ganancias.ts:118-122`), así que `principal` es siempre `totales[0]` y `expect(body.total.ganado).toBe(principal.ganado)` es una tautología de la forma de la respuesta. Y está envuelta en `if (principal)`, así que ante un `undefined` se saltea en vez de fallar. Lo único que verifica de verdad es que `totalesPorMoneda` sea un array.
**El escenario:** alguien vuelve a sumar las monedas en el total de cabecera. El test pasa en verde. El endpoint hoy se ve correcto — no hay plata mal calculada; lo que no existe es la guarda que impida la regresión.
**Qué costaría arreglarlo:** mediano-chico, y **cambiar `prp_001` por `prp_006` no alcanza**: `prp_006` sí tiene dos monedas (`cnt_006` USD y `cnt_008` ARS) pero los dos son BORRADOR y sin liquidaciones, así que `armarGanancia` devolvería 0 en ambas y el test seguiría sin distinguir suma de principal. Hace falta un fixture propio: dos contratos INMOBILIARIA en monedas distintas, con liquidaciones y con participaciones que tengan `comisionPct`. Y afirmar contra valores esperados (`toHaveLength(2)`, que existan ARS y USD, que `body.total.ganado` **no** sea la suma), sin el `if`.

---

## MENOR

## Un rol CARGA borra o reescribe el garante de cualquier contrato, sin rastro
**Dónde:** `apps/api/src/routes/core.ts:2946` (DELETE) y `core.ts:2929` (PUT)
**Qué pasa:** los dos handlers gatean con `contratos.crear` —que incluye a CARGA— y ninguno agrega el corte de rol que sí tienen todos sus hermanos destructivos. No miran `estado` en ningún momento: opera igual sobre BORRADOR, ACTIVO o FINALIZADO. El botón "Eliminar garante" del panel (`apps/inmobiliaria/src/components/contrato-garantes-panel.tsx:251`) tampoco filtra por rol, así que un CARGA ve el tacho y le funciona.
**El escenario:** el PUT es peor que el DELETE. Borrar deja el hueco visible ("Sin garante registrado"); reescribirle el DNI, el teléfono o el número de póliza al garante de un contrato vigente no lo nota nadie. El `deleteMany` es borrado duro y ninguno de los dos endpoints escribe en `EventoAuditoria`: desaparecido el garante, no queda rastro de quién lo sacó ni de qué decía antes.
**Qué costaría arreglarlo:** chico. Una línea por handler, igual a `core.ts:1126`. En el mismo pase vale mirar `apps/api/src/routes/documentos.ts:125`, que repite el patrón y además borra el archivo del Volume — ahí caen `DNI_GARANTE_FRENTE/DORSO`, `SEGURO_CAUCION` y `GARANTIA_PROPIETARIA`, o sea el respaldo documental de la misma garantía.

---

# Lo que NO es un problema

**Ya arreglado, vive en un PR abierto**
- **CARGA cambiaba el email del inquilino (su login OTP):** real en main, pero el PR **#78** ya trae el corte de rol y dos tests (`carga-no-cambia-la-credencial.test.ts` y el guardián estructural `edicion-de-contrato-corta-carga.test.ts`).

**Decisiones deliberadas, documentadas en el propio código**
- **"Cargar gasto de caja" también registra entradas:** el endpoint lo declara dos líneas antes (`plata.ts:1922-1928`), sale de un pedido de la clienta, tiene test (`cuentas.test.ts:88-105`) y no agrega escalada — esos roles ya podían mover la plata del dueño en el otro sentido.
- **El WhatsApp de Configuración no alimenta ningún `wa.me` del panel:** ninguno iba a usarlo — los ~30 links apuntan al teléfono de la contraparte. Los de la PWA sí salen del "Teléfono" de esa misma tarjeta.
- **La cobranza por Movimientos no baja el `saldoDeudor` de la UF:** `MovimientoConsorcio` no tiene `ufId` — es un asiento del edificio, no de una unidad; el campo es manual por decisión escrita hasta la Fase 2 de expensas.
- **El anuncio a morosos desaparece cuando el inquilino se pone al día:** declarado como limitación conocida en `anuncios.ts:26-29` y en `docs/API.md`, y el contador congelado está declarado en el seed. Recalcular el denominador daría "Leído 5/3".
- **Rechazar un borrador borra documentos "para liberar el email":** el comentario quedó viejo (el unique vive en Persona), pero la Persona que sobrevive se **reusa**, no bloquea nada, y borrar la fila Inquilino sigue teniendo un objetivo vivo: revocar el acceso al contrato rechazado desde "Mis alquileres".

**La descripción no sobrevive al código**
- **"Cargá el CBU para poder rendirle" sería falso:** el cartel es impreciso, pero el botón no se deshabilita por CBU, el diálogo ofrece Efectivo y el 409 del server termina con *"…o rendile en efectivo"*. No hay estado inalcanzable.
- **El 409 de email duplicado del PATCH de contacto es inalcanzable:** cierto, pero dos `Inquilino` con el mismo email en un tenant es el comportamiento **especificado** (multi-alquiler). Queda código muerto y un comentario viejo, no un agujero de privacidad.

**Controles que sí miden**
- **El test de aislamiento de tenant sería tautológico:** compara el JSON del endpoint contra un `prisma.contrato.count` independiente con el `where` de tenant escrito a mano, tiene piso `toBeGreaterThanOrEqual(8)` y corre **primero** en el job `integracion`.
- **La bandeja de pagos sólo se verifica con `toBeDefined()`:** es un test de **forma** bien rotulado; los valores están cubiertos con números exactos en `saldos.test.ts`, `mora-sobre-el-saldo.test.ts` y `mora-congelada-al-informar.test.ts`.
- **El guard de aislamiento no ve las queries dentro de una transacción:** no existe ningún middleware de Prisma en el repo — el guard es análisis estático, y de las 199 queries `tx.` ninguna trae un id del request.
- **El test del tablero termina en `expect(true).toBe(true)`:** es una línea muerta al final de un `it` que ejecuta ~49 aserciones reales sobre 7 meses.
- **El test del backfill se saltea siempre:** el puerto es configurable por env, el salteo imprime el motivo y está relevado; y arreglarlo no lo destrabaría — en CI faltan igual el usuario y la contraseña.

*Ya relevado y no repetido acá: `expensasPeriodoActual` que no llega a las cuotas, la cobranza que no entra al libro del consorcio, `UnidadFuncional` sin FK a `Propiedad`, y `saldoDeudor`/estado de la UF cargados a mano.*