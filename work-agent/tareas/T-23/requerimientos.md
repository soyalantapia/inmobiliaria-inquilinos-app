# T-23 · Requerimientos — Portal del propietario

## 1. El problema, en una frase

El propietario no tiene dónde ver lo que la inmobiliaria le rinde: hoy se lo mandan por
WhatsApp o se lo cuentan por teléfono, y no hay forma de que él controle qué se cobró, qué se
gastó y cuándo pagó su inquilino.

## 2. Las citas que lo respaldan

- Alan `[1:01:16]`: *"No tenemos un lugar para el propietario."*
- Camila `[1:02:00]`: **"No podemos vender la aplicación a solamente una persona que tenga
  [propiedades] y que no sea inmobiliaria."**
- Camila `[1:05:10]`: *"Lo que se gastó, lo que se hizo, el cobro de la administración mía por
  mes, el 10% de descuento que tiene, más lo que se le pagó; que se le rinda todo y él lo vea
  mediante la aplicación."*
- Camila `[1:05:30]`: *"Y vos también me estás auditando a mí mediante esa aplicación, que ves
  el día que pagó esa persona."*

## 3. Estado verificado — el dato ya existía; faltaba la puerta

| Lo que Camila enumeró | Dónde vivía ya |
|---|---|
| Lo que se cobró | `Rendicion.montoBruto` + `AlquilerRendido` por liquidación |
| Lo que se gastó | `GastoRendido` |
| La comisión | `Rendicion.comisionPct` + `comisionMonto` (snapshot congelado) |
| Lo que se le pagó | `Rendicion.montoNeto` |
| Cuándo pagó el inquilino | `Pago.fechaTransferencia` con `estado: CONCILIADO` |
| Sus reclamos | `Reclamo` con FK a `Propiedad` |
| Su vínculo con la propiedad | `ParticipacionPropietario` (con `porcentaje`) |

Lo que **no** existía: un tipo de sesión para el propietario, y endpoints scopeados a él.
`Propietario` no tenía forma de autenticarse — no tiene contraseña ni cuenta de panel.

## 4. Comportamiento esperado

Un propietario pone su email, recibe un código de 6 dígitos, entra, y ve: sus propiedades con
el estado de pago de cada inquilino (**incluida la fecha real en que entró la plata**), sus
rendiciones con el desglose completo, y los reclamos de sus propiedades con su costo.

## 5. Alcance

**Entra (esta tanda):**
- Auth: kind `propietario`, OTP por email, y el cambio de cartera para quien administra con
  más de una inmobiliaria.
- Endpoints de lectura scopeados.
- La migración de la tabla de OTP (escrita, **sin aplicar**).

**NO entra:**
- **La superficie** (punto 3 de la tarea): si es una sección de la PWA o un front nuevo. Es una
  decisión de producto **del dueño** y no la invento. El backend no depende de ella.
- **La monetización** (punto 4): Camila la planteó como parte del precio
  (`[1:05:51]` *"hay un porcentaje que lo va a tener que pagar el propietario"*). Decisión
  comercial, del dueño.
- Cualquier escritura. El portal es de lectura pura en esta tanda.

## 6. Criterios de aceptación

- **AC-1** · Un propietario entra con su email + código y obtiene un token propio.
- **AC-2** · Ve sus rendiciones con los cinco números que ella enumeró: cobrado, comisión (% y
  monto), gastos, otros ingresos y lo que se le depositó.
- **AC-3** · Ve, por propiedad, el estado de los últimos 6 períodos de su inquilino y **la
  fecha en que efectivamente pagó**.
- **AC-4** · **No puede ver nada de otro propietario ni de otro tenant.** Toda query filtra por
  `propietarioId` **e** `inmobiliariaId`, los dos del token revalidado contra la DB.
- **AC-5** · El token de propietario **no abre** ningún endpoint del panel ni de la PWA, y
  ningún token de panel/inquilino abre el portal.
- **AC-6** · Pedir el código no revela si un email pertenece a la cartera.
- **AC-7** · `tsc` 0 en `apps/api` y `packages/shared`.

## 7. Impacto en plata / permisos / multi-tenant

**Plata: ninguno.** No hay una sola escritura. No se toca devengo, conciliación ni rendición: se
leen los registros ya calculados y congelados.

**Permisos: superficie nueva**, con su propio guard. No toca `permisos.ts` ni los roles del
panel.

**Multi-tenant: es el riesgo principal**, y por eso el doble scoping es la regla de todas las
queries y hay un test puro que fija la separación entre kinds de token.

## 8. Qué NO se puede romper

- Los otros 5 kinds de JWT y sus guards. En particular `JwtPayloadSchema` **no** debe aceptar
  el kind nuevo: si lo aceptara, un token de propietario entraría a los endpoints del panel.
- `POST/GET /uploads`, que acepta dos schemas distintos — verificado: ninguno matchea al
  propietario, así que cae en 403.
- El login del panel y el del inquilino, que comparten el helper `enviarOtp`.
- El deploy: **la migración va ANTES que el código.** Al revés, el login del propietario tira
  500.
