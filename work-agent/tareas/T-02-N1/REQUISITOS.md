# T-02-N1 · T-02 parte de dos premisas falsas, y la que queda en pie es codeable

**Prioridad:** 🟠 · **Experto:** OPS + FE
**Origen:** T-02, al verificarla contra Railway y contra el deploy real del 20/08.

---

## Lo que T-02 afirma, y lo que pasa de verdad

> *"Los servicios de Railway **no están conectados a GitHub** (`02-DEPLOY.md:31`): pushear a
> `main` **no** deploya. Hay que correr `railway up` a mano, por servicio."*

**Falso.** Verificado contra la API de Railway el 20/08:

- `get_service_config` de `myalquiler-back` dice `Source repo: soyalantapia/inmobiliaria-inquilinos-app`.
- El push del merge a `main` (`94d4000`, 01:09 UTC) disparó **los tres** servicios, solos:

| servicio | deployment | estado | commit |
|---|---|---|---|
| `myalquiler-back` | `1d6f9d4b` | SUCCESS | `94d4000` |
| `myalquiler-front` | `7b75cfb7` | SUCCESS | `94d4000` |
| `myalquiler-inquilino` | `8873507e` | SUCCESS | `94d4000` |

Los tres a la misma hora que el push. Es el mismo tipo de error que tenía T-01 ("aplicá las
migraciones a mano"): el documento describía una infraestructura que ya no es la que hay, y
mandaba a hacer a mano algo que pasa solo.

**Con eso, los puntos 1 y 2 de T-02 ya están hechos:**

1. ~~Deployar los tres servicios~~ → salieron con el push.
2. ~~Verificar que `/health` devuelva el SHA~~ → devuelve
   `{"ok":true,"db":"up","version":"94d4000"}`, y las 13 migraciones se aplicaron en ese mismo
   deploy (`prisma migrate deploy` corre en el `CMD` del Dockerfile — ver T-01).

## Lo que SÍ sigue siendo cierto, y es lo que se arregla acá

> *"**ningún front expone un build-id cruzable con git**, así que hoy no hay forma de saber en
> qué commit están el panel y la PWA."*

**Cierto.** Verificado: `grep -rn "NEXT_PUBLIC_COMMIT\|generateBuildId\|RAILWAY_GIT_COMMIT" apps/*/next.config.mjs`
no devuelve nada, y las tres URLs de producción (`admin.myalquiler.com`, `app.myalquiler.com`,
`myalquiler.com`) responden 200 sin decir qué están corriendo.

Es el agujero que hace imposible cerrar T-02: podés deployar, pero no podés **verificar** que lo
que se subió es lo que creías. Con la API sí se puede desde que existe `/health`; con los fronts
no.

## Lo que se hace

Un `<meta name="build-commit">` en el `<head>` de los tres fronts, con el SHA horneado en build.

**Por qué un meta y no un endpoint:** los tres fronts se buildean también como **static export**
para GitHub Pages, donde no hay servidor que responda un `/version`. Un meta viaja en el HTML y
se lee igual en los dos modos, con un `curl | grep`, sin autenticación y sin abrir el navegador.

**De dónde sale el SHA:**
- En Railway, `RAILWAY_GIT_COMMIT_SHA`, declarado como `ARG` en cada Dockerfile — igual que ya
  se hace con `NEXT_PUBLIC_API_URL` y las de PostHog.
- En GitHub Pages, `GITHUB_SHA`, que Actions ya expone.
- Sin ninguna de las dos: **`desconocido`**. Mismo criterio que `/health`, y por la misma razón
  que está escrita ahí: *"el fallback deja el endpoint honesto en vez de mentir con un valor
  fijo"*.

## Lo que NO se hace

- **No se deploya nada.** Es del dueño, y además ya no hace falta hacerlo a mano.
- **No se hace el smoke test** (punto 3 de T-02): necesita credenciales reales sobre el tenant
  real, y la regla es no tocarlo.
- **No se agrega ninguna dependencia.**

## Cómo se verifica

- Build de los tres fronts con la variable seteada → el meta sale con el SHA.
- Build sin la variable → sale `desconocido`, no vacío ni `undefined`.
- `tsc` 0 y la compuerta en verde.
