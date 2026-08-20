# T-53-N1 · El OTP delataba si el email existe, por el tiempo de respuesta

**Experto:** SEC + BE · **Prioridad:** 🟢

---

## Por qué se pudo hacer ahora

La tarea decía, textual: *"sus tests (`auth.test.ts` y compañía) tocan la base y desde esta
sesión no se pueden correr. Si alguno verifica que el mail salió antes de responder, sacar el
`await` lo pondría en rojo y no habría forma de enterarse."*

**Ese bloqueo ya no existe.** Desde T-01-N1-N1 la suite de integración corre —contra un service
container en CI y contra una Postgres en Docker en local— y desde T-01-N1-N1-N1 la compuerta
bloquea. O sea: la duda que dejó esta tarea abierta se contesta corriendo los tests, que es lo
que se hizo.

## Lo que se arregló: el OTP del inquilino (`POST /auth/otp/request`)

Su propio comentario decía *"Respuesta idéntica exista o no (no enumerar emails)"* — la
intención estaba escrita y la implementación la traicionaba:

```ts
if (inquilinos.length === 0) return { ok: true };   // ← unos pocos ms
const codeHash = bcrypt.hashSync(code, 8);          // ← decenas de ms
await enviarOtp(destino, code);                     // ← CIENTOS de ms
```

El cuerpo de la respuesta era idéntico; el **tiempo** no. Con ese margen se enumera quién es
inquilino de una inmobiliaria, que es justo lo que el comentario decía evitar.

**Arreglado igual que el portal** (mismo patrón, mismas palabras): el `bcrypt` se calcula
siempre —exista o no— y el envío SMTP se dispara sin esperarlo. La respuesta sigue siendo
`{ ok: true }` en los dos casos, y el error del envío se sigue logueando, sólo que fuera del
camino del request.

## Lo que NO se arregló, y no es un olvido: el OTP del panel

La tarea daba por sentado que los dos endpoints restantes necesitaban el mismo fix. **El del
panel no**, y no por costo: porque **ya revela la existencia a propósito, en el cuerpo de la
respuesta**.

`POST /auth/usuario/otp/request` devuelve `{ ok: true, existe: false }` o `{ existe: true }`, con
este comentario en el código:

> *"UX self-service: devolvemos `existe` para que el panel mande a /registro (…) Trade-off
> consciente: permite saber si un email es cliente."*

Emparejar los tiempos ahí sería teatro: la respuesta lo dice en la primera línea. Cerrar ese
canal es una **decisión de producto**, no un fix de seguridad — significa que alguien que
escribe su email en el login del panel deje de ser mandado a `/registro`, que es la razón por la
que se hizo así.

Queda anotado para que se decida, no resuelto por iniciativa propia. Y si se decide cerrarlo,
el fix de tiempos hay que hacerlo **junto** con sacar el `existe`, no antes: hacerlo antes no
cambia nada y da la sensación de que el problema se atendió.

## Cómo se verificó

- `apps/api/test/auth.test.ts` contra una Postgres creada desde cero: **12/12**, incluidos los
  cuatro casos del OTP del inquilino (request+verify, elegir, id ajeno → 404, código inválido).
  Ninguno dependía de que el mail se enviara antes de responder — que era exactamente la duda
  que dejó abierta la tarea.
- Suite de integración completa en verde.
- `tsc` 0.

## No verificado

**No se midieron los tiempos.** El argumento es estructural —el trabajo caro ahora ocurre en las
dos ramas— y no se hizo una medición estadística de la diferencia residual.
