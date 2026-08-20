# T-23 · Portal del propietario

- **fase:** 8 (cerrada)
- **commits:** `f6bb43c` (backend) · `c6d61cb` (front) · `7d489da` (los arreglos de SEC)
- **rama:** `feat/T-23-portal-propietario`

## Hecho

**Backend.** Kind de JWT `propietario` con login por OTP al email, guard `requirePropietario`
que revalida contra la DB, y 5 endpoints de lectura scopeados: `/portal/mi-cartera`,
`/portal/propiedades`, `/portal/rendiciones`, `/portal/rendiciones/:id`, `/portal/reclamos`.
Todo lo que muestran ya existía calculado (`Rendicion` con su `comisionMonto` congelado,
`GastoRendido`, `AlquilerRendido`); lo que faltaba era la puerta.

**Front.** `apps/propietario`, un Next propio en el puerto 3002. Dos pantallas: login por
código y home con las rendiciones desglosadas, las unidades con el estado de los últimos 6
períodos de cada inquilino y **la fecha real en que pagó**, y los reclamos con su costo.

## Decisiones que tomó el dueño

- **Superficie:** front nuevo (`apps/propietario`), no una sección de la PWA. Camila
  `[1:02:00]` lo planteó como algo vendible aparte, y mezclarlo con una app que se presenta
  como *"la app de tu alquiler"* chocaba con eso.
- **Monetización:** incluida en el plan de la inmobiliaria. No se construyó nada de
  facturación al propietario.

## La revisión de seguridad encontró tres cosas mías

La tarea decía *"tiene que pasar por SEC antes de salir"*. Tres revisores atacaron con lentes
distintos (fuga de datos, auth, superficie). **El aislamiento de los 5 endpoints de lectura
resultó correcto** y confirmaron que ningún endpoint existente acepta el token nuevo por
accidente —incluido `/uploads`, que prueba dos schemas y cae al 401—. Pero:

1. **🔴 Pivote CROSS-TENANT en `/auth/propietario/elegir`.** Releía el email *desde la base*
   para autorizar el salto de cartera, y ese campo lo edita a mano cualquier ADMIN de cualquier
   inmobiliaria. El ataque: darse de alta a uno mismo como propietario, sacar un token
   legítimo, editarle el email al de la víctima, y pedir la cartera de otro tenant. Rompía la
   regla de oro del proyecto. **Arreglado:** el email va congelado en el token, que es lo que
   ya hacía el flujo del inquilino con `JwtPersona`.
2. **🟠 Un propietario nuevo leía los reclamos de inquilinos anteriores**, con el texto libre
   que esa persona escribió. **Arreglado:** se recorta al contrato vigente de cada unidad.
3. **🟠 `Rendicion.notas` se publicaba.** En el panel el campo dice sólo "Notas (opcional)" y
   el equipo lo escribió durante meses creyendo que era interno. **Arreglado:** no se expone.

Y tres de higiene: el OTP ahora se consume en todas las carteras del mismo email (quedaban
N−1 vivas con el mismo hash), el bcrypt corre exista o no el email (si no, el tiempo de
respuesta era un oráculo de enumeración — justo lo que el encabezado decía evitar), y
`DELETE /propietarios` limpia los códigos, que con la FK nueva dejaban al propietario
imborrable.

## ⚠️ NECESITA TU MANO

1. **Aplicar la migración `20260819120000_otp_propietario`, ANTES de deployar el código.**
   Al revés, el login del propietario tira 500. Es un `CREATE TABLE` puro: no toca ninguna fila
   existente y es reversible con un `DROP TABLE`.
2. **Decidir si aceptás el riesgo residual del email.** `Propietario.email` lo tipea el staff y
   nadie lo verifica; si el mismo string aparece en dos inmobiliarias —un typo, un
   `info@…` placeholder, el mail del contador usado para varios dueños— quien controle esa
   casilla ve las dos carteras. Es inherente a que el email sea la credencial. Lo dejé
   **detectable** (un `log.warn` cuando pasa) y visible para la persona (el selector muestra el
   nombre de cada inmobiliaria). Cerrarlo del todo pide verificar el email o hacerlo único por
   tenant, y eso es una tanda aparte.
3. **Deployar el tercer front.** `apps/propietario` no está en ningún pipeline todavía.

## Lo que NO pude verificar

**No lo probé en el navegador.** El clasificador de seguridad de la sesión bloqueó el preview
(no por el contenido de la tarea: es de sesión y sigue firme). Lo que sí: `tsc` 0 en los
paquetes tocados, lint limpio, `next build` con las dos rutas prerenderizadas, y 9 tests puros
de separación de kinds verificados **en rojo** metiendo el kind en la unión discriminada.

**Tampoco corrí los tests de `apps/api`** que pegan a la DB: es la regla 3 del protocolo.
El portal no tiene test de integración de aislamiento — eso pide una base de prueba y queda
como tarea nueva.

## Veredicto de la Fase 7 (Camila)

> "Esto es lo que yo pedí. El dueño entra y ve lo que se cobró, lo que le saqué de comisión, lo
> que se gastó y lo que le deposité, y ve el día que le pagó el inquilino — que es lo que me
> saca los llamados de encima.
>
> Ahora, dos cosas. Una: si el tipo entra y ve la cartera de otro porque alguien escribió mal
> un mail, yo pierdo el cliente. ¿Cómo me entero de que eso pasó?
>
> Y dos: las notas de la rendición. Menos mal que las sacaron, porque yo ahí escribo cosas del
> inquilino que el dueño no tiene por qué leer."

## Tareas nuevas

- **T-23-N1 · 🟠 Sin test de integración del aislamiento del portal.** Los 5 endpoints están
  scopeados por lectura y por revisión, pero no hay una prueba que falle si alguien saca un
  `inmobiliariaId` de un `where`. Pide base de prueba.
- **T-23-N2 · 🟠 `Propietario.email` es ahora una credencial pero sigue sin verificarse ni ser
  único.** Sin `@@unique([inmobiliariaId, email])`, sin verificación, y el `PUT` lo pisa en cada
  edición (incluso a `''`). Decidir: verificarlo, hacerlo único, o ambas.
- **T-23-N3 · 🟢 `ParticipacionPropietario` no tiene vigencia.** Sin `desde`/`hasta` no se sabe
  desde cuándo alguien es dueño, y por eso los reclamos se recortan al contrato vigente en vez
  de a "desde que sos dueño".
- **T-23-N4 · 🟢 No hay revocación de sesión en ningún kind.** El token de propietario dura 7
  días y no hay logout server-side, ni `jti`, ni denylist. Es una deuda de todo el sistema, no
  sólo del portal, pero el portal la hereda sobre datos financieros de terceros.
