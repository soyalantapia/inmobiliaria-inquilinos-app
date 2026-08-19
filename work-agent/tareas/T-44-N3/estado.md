# T-44-N3 — Nada avisa cuando una rama terminada se queda afuera

- tomada: 2026-08-19
- worktree: `../myalquiler-T-44-N3`
- rama: `chore/T-44-N3-ramas-sin-integrar` (base: `feat/propietario-detalle-rendicion`)
- estado: **terminada y verificada**
- commit: `121ce0c`

## Lo que cambió el diseño a mitad de camino

La tarea pedía "un job de CI que liste las ramas con commits fuera de la de integración". Lo
primero que se chequeó fue si eso era posible, y no lo era:

```
ramas locales:  72
ramas remotas:  48
ramas de tarea (T-*) pusheadas:  0
```

**Ninguna rama de tarea está en el remoto.** Un job de GitHub Actions no puede ver lo que no se
pusheó, así que el CI que pedía la tarea habría dado verde sobre un repo con diez ramas sueltas.

Y al tirar de ese hilo apareció algo más grande: la rama de integración **no existe en origin**
(`git ls-remote` no devuelve nada), no tiene upstream, y `origin/main` está **263 commits atrás**.
Todo el trabajo de estas tandas vive en un solo disco.

Por eso el script mira **dos** cosas y no una. Un aviso que dijera sólo "todo consolidado" sobre
trabajo que no está respaldado en ningún lado sería exactamente la tranquilidad falsa que esta
tarea vino a sacar.

## Qué se hizo

1. **`scripts/ramas-sin-integrar.mjs`.** Lista las ramas con commits fuera de la integración
   (nombre, cuántos commits, cuántos días), y avisa si la integración no está pusheada o le
   faltan commits al remoto. Modos: `--remotas` (CI), `--base`, `--dias`, `--fallar`,
   `--solo-base`.
2. **`pnpm ramas`** para correrlo en local, que es donde hoy sirve de verdad.
3. **Un job aparte en `revision.yml`**, con `fetch-depth: 0` —sin eso el checkout no trae más
   rama que la actual y no habría nada que comparar—. Va separado del job de calidad a propósito:
   que una rama olvidada ponga en rojo el CI de alguien que está laburando en otra cosa es la
   forma más rápida de que el aviso se ignore.
4. **El PROMPT de tareas dejó de repetir la heurística** y llama a `--solo-base`.

## La decisión que importa: la base se deduce, no se nombra

El PROMPT buscaba la base con `grep -E '^feat/reunion-'`. La integración pasó a llamarse
`feat/propietario-detalle-rendicion` y ese patrón empezó a devolver una rama **58 commits
atrasada**, sin avisar. Me pasó a mí arrancando T-46: tuve que darme cuenta a mano y comparar.

O sea que el mecanismo que existía para evitar la divergencia **la estaba fabricando**.

Poner otra lista de nombres adentro del script sería el mismo error con más pasos. El criterio es
estructural: **la rama con más commits por encima de `main`**. La integración es la que acumula
el trabajo de todas las demás, así que es la más adelantada por definición, y eso sobrevive a
cualquier renombre. Es "más commits" y no "más reciente" a propósito: una rama de tarea recién
creada es más reciente que la integración y la ganaría siempre.

## Verificación

- Los cinco modos corridos a mano: por defecto, `--base main`, `--dias 30` (filtra bien), `--fallar`
  (exit 1) y `--solo-base` (devuelve `feat/propietario-detalle-rendicion`).
- La detección devuelve la rama correcta **sin ningún nombre hardcodeado**.
- El YAML no tiene tabs y los dos jobs quedan al mismo nivel (`revision`, `ramas-sin-integrar`).
- El script se probó contra el repo real y encontró, además de lo esperado, **dos ramas nuevas que
  habían aparecido mientras se lo escribía** — que es justamente el goteo que viene a mostrar.

## Lo que NO resuelve, con todas las letras

**El job de CI no va a ver nada hasta que las ramas se pusheen.** Hoy sirve el modo local. Esto no
es una limitación del script: es el estado del repo, y es el punto siguiente.

## Lo que necesita la mano del dueño

**Pushear.** No es una tarea de prolijidad:

- 263 commits en un solo disco, sin backup.
- El CI nunca corrió sobre este trabajo: `revision.yml` se dispara con el push, así que todo lo
  que se verificó en estas tandas se verificó **a mano, acá**.
- Y no hay forma de deployar desde otra máquina.

No se pusheó desde acá a propósito: mandar 263 commits a un remoto compartido es una decisión
tuya, no de un chat.
