# T-27 · Arreglar la CI y descongelar la demo — PARCIAL

- rama: feat/reunion-camila-0308 · commits: db30d53 (rename, barrido por otro chat) + 3a9db72
- fase: 8

## Hecho
El bloqueante documentado: `(app)/inquilinos/[id]` ahora tiene wrapper de servidor con
generateStaticParams. Verificado corriendo scripts/build-static.sh real: antes moría
recolectando page data, ahora genera las 74 páginas.

## Bloqueado por regla dura — NECESITA AL DUEÑO
La otra mitad de T-27 (que la CI corra typecheck, lint y tests) exige editar
.github/workflows/deploy.yml, y 05-DECISIONES §5 dice que el gh token NO tiene workflow
scope: un push que incluya ese archivo falla. Propuesta para aplicar a mano — job nuevo,
antes de `build`:

```yaml
  verificar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v6
        with: { version: 10.28.2 }
      - uses: actions/setup-node@v6
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter api exec prisma generate
      - run: pnpm typecheck
      - run: pnpm lint
```
Y en el job `build`, agregar `needs: verificar`.
⚠️ NO agregar `pnpm --filter api test`: esos tests pegan a la Postgres de producción y
hacen reset/seed. Correrlos en CI sería resetear la base del cliente en cada push.
Habilitarlos exige antes una DB de test separada (tarea aparte).

## Hallazgo nuevo: un SEGUNDO bloqueante, tapado detrás del primero
La ruta opengraph-image de la landing falla al prerenderizar:
`TypeError: Invalid URL` en el fileURLToPath de @vercel/og.
Es el síntoma típico de una ruta Windows (C:\... no es file URL válida) y la CI corre en
ubuntu-latest, así que probablemente allá no pase. NO verificable desde Windows.
👉 Si el próximo run de la CI sigue rojo, mirar ACÁ, no generateStaticParams.

## Colisión entre chats (importante)
Otro chat corriendo en paralelo commiteó sobre ESTE mismo working tree (db30d53) y su
`git add` amplio se llevó mi rename. Además hay cambios en vuelo suyos en
apps/api/src/mailer.ts y core.ts (T-17) que NO toqué. Los chats no están creando el git
worktree que el prompt indica en la Fase 0.3.
