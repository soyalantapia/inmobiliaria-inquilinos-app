# T-35 — Los usuarios extra heredan la contraseña Y el PIN del admin

- tomada: 2026-08-19
- worktree: `../myalquiler-T-35`
- rama: `feat/T-35-credenciales-heredadas` (base: `feat/reunion-camila-0308`)
- estado: **código terminado** · **merge pendiente** · **acción del owner pendiente**
- commit: `310645c`

## Lo que se verificó a mano (no inferido)

| Afirmación de la tarea | ¿Cierta? |
|---|---|
| `onboarding-real.mjs:98` heredaba password y PIN del admin | ✅ literal |
| El formato del PIN se validaba sólo sobre `A.pin` | ✅ |
| `POST /auth/login` compara contra `passwordHash` → el escalamiento es real, no latente | ✅ `auth.ts:113` |
| `verificarPinUsuario` siempre aprueba → el `pinHash` compartido hoy es inerte | ✅ `pin.ts` |
| El seed le pone el mismo PIN a sus 3 usuarios | ✅ |
| Existe login por OTP para usuarios del panel (así que `passwordHash: null` no deja a nadie afuera) | ✅ `/auth/usuario/otp/{request,verify}` |

**Además, dos cosas que la tarea no decía:**

- **Las invitaciones de equipo YA estaban bien.** `core.ts:2810` y `:2832` sólo escriben
  `passwordHash` si viene una contraseña. El agujero era exclusivo del script de alta.
- **La SQL que proponía la tarea estaba mal.** Usaba `pin_hash`, y la columna real es `"pinHash"`
  (camelCase citado — el modelo no tiene `@map`). Habría fallado al correrla.

## Qué se cambió

1. **`scripts/lib/credenciales-alta.mjs` (nuevo).** `passwordDeUsuarioExtra(usuario)` **no recibe
   al admin**: heredarle es imposible por la forma de la función, no por acordarse. Sin
   contraseña propia devuelve `null` → la cuenta entra por OTP. Con contraseña propia exige 8
   caracteres. Vive separado del script porque `onboarding-real.mjs` lee disco y abre una
   conexión a la base al importarse: así se puede testear sin tocar ninguna DB.
2. **`scripts/onboarding-real.mjs`.** Usa la lib. Ya no escribe `pinHash` para nadie, ni para el
   admin. `admin.pin` se ignora **con aviso** en vez de callado.
3. **`onboarding-real.input.example.json`.** Sin `pin`, y con una nota sobre `usuariosExtra`.
4. **`apps/api/prisma/seed.ts`.** Sin `pinHash`. La contraseña compartida **se deja** y se
   documenta como decisión de fixture: ~64 tests loguean con ella como los tres roles, y esos
   tests **no se pueden correr** desde acá (pegan a la Postgres de producción). Cambiarla a ciegas
   era el riesgo mayor.
5. **Migración `20260819140000_limpiar_pines_heredados`** — escrita, **NO aplicada**.

## Verificación

- `tsc` api: **0**
- `node --check` sobre el script y la lib: OK
- tests puros: **112/112** en 15 archivos (8 nuevos)
- el test de la firma verificado **en rojo** reintroduciendo el `?? admin.password`
- NO se corrieron los tests de DB · NO se aplicó la migración · NO se tocó producción

## Pendiente del owner — esto NO lo cierra el código

1. **Averiguar si hay alguien afectado en el tenant real.** Consulta de sólo lectura:

   ```sql
   SELECT id, email, rol, activo,
          ("passwordHash" IS NOT NULL) AS tiene_pass,
          ("pinHash"      IS NOT NULL) AS tiene_pin
   FROM usuarios
   WHERE "inmobiliariaId" = '<tenant>'
   ORDER BY rol;
   ```

   Comparar los hashes entre sí **no sirve** (bcrypt saltea cada uno). Para confirmarlo hay que
   probar la contraseña del admin contra el `passwordHash` de un extra — o directamente asumir lo
   peor y rotar.

2. **Rotar** lo que haya quedado compartido. Si el tenant real se dio de alta con este script y
   tenía `usuariosExtra` sin contraseña propia, **esas cuentas tienen acceso ADMIN hoy**.

3. **Aplicar la migración de limpieza de PIN**, antes o junto con la de T-25. Si T-25 entra
   primero, hay una ventana en la que los PIN heredados autentican de verdad.

## Merge

Sigue bloqueado por lo mismo que T-24 y T-24-N1: el repo principal tiene cambios sin commitear de
otra tarea. Esta rama no comparte archivos con las otras dos, así que puede mergearse
independientemente.

## Desbloquea

**T-25** (cambio rápido de usuario), que está tomada por otro chat. Conviene avisarle: la
migración de limpieza tiene que entrar antes o junto con la suya.
