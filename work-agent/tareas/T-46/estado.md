# T-46 — El portal del propietario existe, compila… y no se despliega en ningún lado

- tomada: 2026-08-19
- worktree: `../myalquiler-T-46`
- rama: `feat/T-46-propietario-demo` (base: `feat/propietario-detalle-rendicion`, que ya
  contiene entera a `feat/reunion-camila-0308` y va 58 commits adelante)
- estado: **código terminado y verificado en el sitio buildeado** · **queda el deploy real,
  que es del dueño**
- commits: `da2a708` (demo + pipeline), `75ad907` (fechas corridas), `010d2fc` (moneda y copy)

## Lo que se verificó a mano (no inferido)

| Afirmación de la tarea | ¿Cierta? |
|---|---|
| `build-static.sh` compilaba sólo inmobiliaria e inquilino | ✅ literal |
| El picker no nombraba al portal | ✅ — y encima llamaba "App del Propietario" al panel de la inmo |
| `apps/propietario` no aparece en `.github/workflows/` | ✅, pero **no hacía falta tocarlos**: `deploy.yml` sólo corre `bash scripts/build-static.sh` |
| El portal no tiene modo demo | ✅, y era **deliberado** — estaba argumentado en `api.ts:5-8` |
| Hace falta decidir entre demo o host propio | ✅ parcialmente — ver abajo, no son excluyentes |

**Tres cosas que la tarea no decía:**

- **`next.config.mjs` de propietario YA tenía el bloque de static export**, con
  `basePath: '/inmobiliaria-inquilinos-app/propietario'`. La app estaba preparada para GitHub
  Pages desde el día uno; lo único que faltaba era enchufarla. Eso inclina la decisión: no era
  un camino nuevo, era uno empezado y sin terminar.
- **El guard de build de la app miraba el puerto equivocado.** `check-dev-port.js 3002`
  mientras su `dev` corre en `-p 3003`. 3002 es el del API: falso positivo que abortaba el
  build con el API vivo —justo lo que había que enchufar al pipeline— y falso negativo que no
  detectaba su propio dev server, que es el bug entero que el guard existe para prevenir. Los
  otros dos coinciden (3001/3001, 3000/3000).
- **Las fechas del portal se mostraban un día antes.** Ver más abajo; salió de recorrer la app,
  no de leerla.

## La decisión que la tarea pedía, y por qué se resolvió así

La tarea planteaba dos caminos y decía que no eran intercambiables:

1. va al sitio estático → hace falta un modo demo que no tiene;
2. va a un host propio con el API real → es infraestructura.

**Se hizo el 1, y no cierra la puerta del 2.** El 2 es un deploy, y en este chat el deploy está
fuera de alcance por regla. El 1 es código, y es aditivo: si mañana el portal se despliega
contra un API vivo, `apiEnabled` es `true` y los mocks no aparecen nunca.

**El comentario de `api.ts` que desaconsejaba la demo no se descartó: se acotó.** Decía que el
portal muestra plata rendida de personas reales y que una versión de mentira sólo serviría para
confundir. Es cierto — para una app desplegada a la que le falta el servidor. No para el sitio
estático, que es una demo entera donde el panel ya muestra caja falsa y la PWA alquiler falso.

Por eso la demo **no** se prende con `!apiEnabled`, que es exactamente el caso que ese
comentario protegía, sino con `NEXT_PUBLIC_DEMO=1`, que escribe únicamente `build-static.sh`:

| bandera | API | resultado |
|---|---|---|
| no | no | "El portal no está conectado" — el camino honesto de siempre |
| **sí** | no | datos de `demo-data.ts` |
| sí | sí | gana el API real |

Las tres combinaciones están fijadas en `demo-data.test.ts`, y se comprobaron **buildeando dos
veces**: sin la bandera, el mensaje honesto vuelve al HTML; con ella, desaparece.

## Qué se cambió

1. **`src/lib/demo-data.ts` (nuevo).** La demo es Silvana Morales, que es `own_002` del mock del
   panel, con sus tres unidades, sus inquilinos y sus montos reales. El depto de Gorriti lo
   alquila Mariela Sosa, la identidad demo de la PWA: quien mira las puertas del sitio ve **un
   solo alquiler contado desde los tres lados**, no tres invenciones sueltas. La lista de
   rendiciones se **deriva** del detalle (`resumenDeRendicion`) para que el total de la lista y
   el del detalle no puedan divergir.
2. **`src/lib/api.ts`.** `demoEnabled` y una rama en `apiFetch`. Todo el acceso a datos del
   portal pasa por esa función, así que la demo entró en **un solo lugar** y las cuatro
   pantallas no se tocaron. `resolverDemo` **tira** ante una ruta que nadie mockeó, en vez de
   devolver `[]`: en esta app una lista vacía se lee como "no tenés nada rendido".
3. **`src/app/login/page.tsx`.** En demo se recorren los dos pasos reales (email → código) en
   vez de saltearlos, con el atajo de cuenta demo que ya usa la PWA. El copy dice que no se
   mandó ningún mail, porque no se mandó.
4. **`scripts/build-static.sh`.** Build de propietario con la bandera, copia a `out/propietario`,
   y `3003` en la lista de dev servers a apagar — **no** 3002, que es el del API y matarlo sería
   sabotear a quien esté laburando al lado.
5. **`scripts/picker.html`.** Tarjeta nueva, grilla a 2×2 / 1×4 (con tres columnas la cuarta
   caía sola y quedaba coja), y el panel de la inmo pasó a llamarse **"Panel de la
   Inmobiliaria"**: con las dos tarjetas juntas, "App del Propietario" era directamente ambiguo.
6. **`package.json`.** El guard de build, a 3003.
7. **`src/lib/format.ts`.** El arreglo de las fechas (abajo).

## El bug que apareció al verificar

Recorriendo el portal ya buildeado —no leyendo el código— el dato y la pantalla no coincidían:
un vencimiento del `2026-08-05` se veía **"vence el 4 de ago"**, y un pago del `2026-08-11`,
**"pagó el 10"**.

No era la demo. `new Date("2026-08-05")` se parsea como medianoche **UTC**, y
`toLocaleDateString` la muestra en hora local: en Argentina (UTC−3) cae a las 21:00 del día
anterior. Como `portal-propietario.ts` manda `vence`, `pagoAt`, `desde`, `hasta` y las fechas de
gastos e ingresos con `.toISOString().slice(0, 10)`, **a un propietario real le pasaba lo
mismo**. Los casos feos son el día 1, que corrido se va al mes anterior, y el 1 de enero, que se
va al año anterior.

Se arregló en `fecha()`, que es por donde pasan todas: date-only se arma con el constructor
local; los timestamps completos (`rendidoAt`, `creadoAt`) se dejan como estaban, porque ahí el
paso al huso sí corresponde. Confirmado en pantalla: ahora dice "vence el 5" y "pagó el 11".

## Verificación

- **`tsc` en 0** en los seis paquetes (api, inmobiliaria, inquilino, propietario, shared, ui).
- **360/360 tests** de la suite sin base, 37 archivos. Ojo: en un worktree limpio fallan 3 por
  falta de `apps/api/.env`; corriendo con las variables de mentira que usa `revision.yml`
  (`DATABASE_URL` a `127.0.0.1:1`, `JWT_SECRET` cualquiera) pasan todos.
- **La aritmética de la demo, ejecutada**: 47 aserciones. Neto = cobrado − comisión − gastos +
  otros ingresos; la comisión es el 7% de la ficha; cada detalle suma su total; cada alquiler
  entra por la participación (Gorriti al 40%, no al 100%); y el costo del reclamo que paga el
  propietario aparece **una sola vez**, como gasto de la rendición (`05-DECISIONES.md`).
- **El sitio estático, recorrido entero**: se buildeó, se sirvió con la misma estructura de
  rutas que GitHub Pages y se navegó login → pagos (con el detalle de una rendición abierto) →
  unidades → reclamos → perfil. Los números cierran en pantalla: $1.532.000 − $107.240 −
  $109.000 + $45.000 = **$1.360.760**, y el resumen anual da $4.184.240, que es la suma de las
  tres rendiciones.
  - Un 404 en un chunk resultó ser el límite `MAX_PATH` de Windows (260) por lo larga que es la
    ruta del scratchpad: 252 chars → 200, 261 chars → 404. Servido desde una ruta corta, todo
    200. **No es un defecto del build.**

## Fase 7 — el veredicto de Camila

**Lo que le sirve.** Ahora puede mostrarle a un dueño qué va a ver, que antes era imposible: la
app existía y no tenía URL. El portal encabeza por **complejo** y deja la calle de dato
secundario, que es como ella nombra las propiedades ("cuando decimos Lourdes no le decimos nunca
Artigas"). La rendición muestra los cinco números con los que ella los piensa. Y la unidad de
Cabildo con agosto **vencido** es justo el caso que un propietario entra a mirar cuando no le
llegó la plata.

**Lo que habría roto la confianza, y por eso se arregló.** Ella mide todo contra el sistema que
ya usa. Si el portal decía "vence el 4" y su sistema dice el 5, no desconfía de la fecha:
desconfía de la pantalla entera, que es de plata. Ese era el estado antes de `75ad907`.

**Lo que sigue sin poder hacer, con todas las letras.** *"A mis propietarios de verdad todavía
no les puedo pasar un link."* Es cierto. Esto lo hace **mostrable**, no **usable** por un
propietario real: para eso falta el camino 2 (host con el API vivo), que es deploy. El criterio
de aceptación de la tarea contempla exactamente esto — "o está escrito por qué todavía no y qué
falta" — y es lo que queda escrito acá y en T-46-N1.

## Lo que necesita la mano del dueño

- **T-46-N1 — desplegar el portal de verdad.** Vercel/Railway como el resto, con
  `NEXT_PUBLIC_API_URL` apuntando al API y **sin** `NEXT_PUBLIC_DEMO`. Hasta que eso pase, el
  portal sólo vive en la demo.
- Nada de migraciones: **esta tarea no escribió ninguna**.

## Tareas nuevas detectadas

- **T-46-N1** · Desplegar el portal del propietario a un host con el API real. 🔴, del dueño.
- **T-46-N2** · Los dos tests que dejé (`demo-data.test.ts`, `format.test.ts`) **no corren en
  CI**, igual que el de inquilino: los fronts no tienen runner. Eso es **T-32**, ya tomada. Los
  `*.test.ts` quedaron excluidos del `tsconfig` de propietario con el mismo aviso que puso
  inquilino ("borrar esta línea al cerrar T-32"). Al cerrarla hay que sacar **las dos**.
- **T-46-N3** · `demo-data.ts` copia montos de `apps/inmobiliaria/src/lib/mock-data.ts` a mano y
  nada lo ata: si alguien cambia el alquiler de Gorriti en el panel, la demo del portal queda
  contando otra historia. Es barato de sostener hoy y no vale un paquete compartido todavía,
  pero conviene saberlo. 🟢
