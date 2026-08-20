# T-28-N3 · Las limpiezas de los tests se rompen solas

**Prioridad:** 🟡 (subió de hecho: desde T-01-N1-N1-N1 la compuerta **bloquea**, así que esta
fragilidad ya no es una molestia — traba el merge de cualquiera)

---

## El problema

De las 23 FK que apuntan a `contratos`, **16 son RESTRICT y 7 son SET NULL** — ninguna cascadea. Cada teardown borra a mano los pocos hijos
que su propio flujo llega a crear, y **funciona por casualidad**: el día que T-29 hizo que el
alta escribiera `EventoContrato`, `multi-alquiler.test.ts` se cayó entero por su `afterAll`. El
fallo aparece lejos de su causa — en la limpieza de un archivo que nadie tocó, no en la feature
que agregó el hijo.

Y el árbol es más grande de lo que la tarea decía. Medido leyendo el schema:

- **22 hijos**, más la FK inversa `propiedades.contratoActualId` (que es SET NULL y **no** bloquea:
  leyendo sólo `schema.prisma` yo había concluido lo contrario, porque ahí no se declara el
  `onDelete` y hay que ir al SQL de las migraciones).
- **10 nietos** que cuelgan de un hijo y bloquean igual: `CodigoOtp`, `AnuncioAcuse` y `Documento`
  de `Inquilino`; `CreditoDetectado` de `Pago`; `ReclamoEvento`, `VisitaProfesional`,
  `ConfirmacionReclamo` y `RatingReclamo` de `Reclamo`; `CoInquilinoInvitado` y
  `DocumentoAdjuntoInvitado` de `InquilinoInvitado`.
- **5 FK entre hijos** que fijan el orden: `CargoContrato`→`Reclamo`, `CargoPagado`→`Reclamo`,
  `Pago`→`Liquidacion`, `Comprobante`→`Liquidacion`, `CertificadoInquilino`→`Inquilino`.

33 modelos. Nadie va a mantener eso a mano en cincuenta `afterAll`.

## La decisión: NO se cascadea

La tarea ofrecía dos caminos y hay que descartar el primero por una razón que no estaba a la
vista cuando se escribió: **las migraciones se aplican solas en el deploy** (el `CMD` del
Dockerfile corre `prisma migrate deploy`). Poner `CASCADE` no sería un cambio de tests —
cambiaría el comportamiento de **producción**, donde hoy el `RESTRICT` es justamente lo que
impide que borrar un contrato se lleve pagos, comprobantes y certificados en silencio. Eso es
una red, no un estorbo. La molestia es de los tests y se paga en los tests.

El segundo camino de la tarea —envolver cada test en una transacción que revierta— **no es
viable acá**: los tests pegan por `app.inject`, y la app tiene su propio cliente de Prisma en
otra conexión. Una transacción abierta en el cliente del test no envuelve lo que escribe la app.

**Tercer camino, el elegido:** un helper compartido que borre el árbol completo en orden seguro,
más un test que lea el schema y se ponga rojo si aparece un modelo nuevo que el helper no
contempla. Centralizar no alcanza por sí solo —una lista a mano se desactualiza igual, sólo que
en un lugar en vez de cincuenta—; lo que la mantiene honesta es el test.

## Lo que se hizo

- `prisma/borrar-contratos-de-test.ts`: nietos → cortar el lazo `propiedad.contratoActualId` →
  los 22 hijos en orden → el contrato. Con el mismo guard `exigirDbDeTest` que `seedBase`.
- `test/hijos-de-contrato-sincronizados.test.ts`: 4 tests que leen `schema.prisma` y verifican
  que no falte ningún hijo, ningún nieto, y que **el orden respete las FK entre hijos** — esa
  última comparación también se deriva del schema, así que una relación nueva entre hijos queda
  cubierta sin tocar el test.
- `multi-alquiler.test.ts` migrado al helper: su teardown pasó de 8 líneas frágiles a una.

## Lo que NO se hizo

- **No se migraron los otros teardowns.** El helper existe y el que rompa, se migra. Migrar
  cincuenta `afterAll` de una sin necesidad es tocar cincuenta archivos que hoy están en verde,
  y cada uno limpia además cosas que NO cuelgan de un contrato (propiedades, personas,
  propietarios) que el helper no toca ni debe tocar.
- **No se tocó el schema.** Ver arriba.

## Cómo se verificó

- **3 corridas completas** de la suite de integración contra Postgres creada desde cero.
- Dos verdes (52/52 · 387 tests). La tercera falló **una vez** y tardó 503s en vez de ~230s: fue
  contención de la máquina local (Docker + los dev servers de otros chats), no del código — un
  `beforeAll` se pasó del `hookTimeout`. Se subió de 120s a 180s por eso: en CI el job tarda
  ~1m50s y no hace falta, pero desde que la compuerta bloquea un timeout espurio traba a
  cualquiera.
- `tsc` 0 y **479 verdes** en la compuerta sin base.

---

## Tres bugs que tenía la primera versión de este helper

Los encontró un pase adversarial sobre el código ya escrito, leyendo **el SQL de las
migraciones** en vez de `schema.prisma`. Los tres estaban verificados y los tres eran reales:

1. **La columna FK de los nietos se derivaba del nombre del modelo.** `InquilinoInvitado` + `Id`
   da `inquilinoInvitadoId`, y la columna real se llama **`invitadoId`**. Tres de los cuatro
   grupos coincidían por casualidad; el cuarto borraba nada y nadie se enteraba, porque un
   `deleteMany` que no matchea no falla. Ahora la columna va **declarada**, y hay un test que la
   compara contra el schema — se comprobó reintroduciendo el bug: sale en rojo diciendo
   *"CoInquilinoInvitado apunta a InquilinoInvitado por invitadoId, no por inquilinoInvitadoId"*.

2. **`cargoPagado` se filtraba sólo por `contratoId`, que es nullable.** El que bloquea es
   `reclamoId`, que es NOT NULL y RESTRICT. Una fila con `contratoId = null` sobrevivía y hacía
   fallar el borrado del reclamo, el paso siguiente. Ahora filtra por
   `OR: [contratoId, reclamo.contratoId]`.

3. **El comentario del lazo estaba invertido.** `propiedades_contratoActualId_fkey` es **SET
   NULL**: nunca bloqueó borrar el contrato. El que bloquea es `contratos.propiedadId`, en la
   otra dirección. El `updateMany` sirve para poder borrar **la propiedad**, no el contrato — y
   por eso ahora va después. (El mismo comentario está invertido en `limpiar-test-db.ts:93-94`.)

Y una cuarta corrección, al test: usaba `@relation\(fields:` y **no matchea relaciones con
nombre**, así que un hijo declarado `@relation("x", fields: [...])` habría sido invisible — el
agujero exacto que el test viene a tapar.

**Lo que esto dice del método:** escribí el helper leyendo `schema.prisma`, que no declara los
`onDelete`, y di por sentado el default. El dato real estaba en el SQL de las migraciones. Vale
para la próxima: para saber qué hace la base, hay que leer la base.
