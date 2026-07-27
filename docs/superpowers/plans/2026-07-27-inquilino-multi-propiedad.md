# Inquilino multi-propiedad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un inquilino con el mismo email y dos alquileres (en distintas inmobiliarias o en la misma) pueda ver sus propiedades y entrar a cada una a ver todo, sin que se le mezclen los datos entre propiedades.

**Architecture:** El backend ya resuelve el caso (login OTP cross-inmobiliaria + `/auth/inquilino/elegir` + `/auth/inquilino/alquileres`) y la pantalla `/mis-alquileres` ya existe. Este plan solo corrige el front del inquilino: mata el bug de caché que muestra la plata de la propiedad equivocada, hace visible la lista de propiedades, y muestra el estado del contrato. El único cambio de backend es mergear el PR #27 ya escrito, que habilita dos contratos con el mismo email en la misma inmobiliaria.

**Tech Stack:** pnpm monorepo · Next 14 (App Router) + React 18 + TanStack Query v5 (PWA `apps/inquilino`) · Fastify + Prisma + Postgres (`apps/api`) · Tailwind + `@llave/ui`.

## Global Constraints

- Worktree: `~/dev/myalq-multiprop`, rama `feat/inquilino-multi-propiedad`, base `origin/main` (afb9efe). Trabajar SOLO acá.
- La PWA `apps/inquilino` **no tiene test runner**. Las únicas verificaciones automáticas son `pnpm typecheck` (tsc --noEmit) y `pnpm build`. La verificación real de comportamiento es **E2E en navegador** con el escenario de la Task 1.
- `apps/api` typechea con `pnpm lint` y tiene **~259 errores PREEXISTENTES** en archivos no relacionados. NO son regresión: comparar siempre contra baseline con `git stash`.
- Tests del back: `pnpm vitest run <archivo>` desde `apps/api`, contra **Postgres local efímero**. NUNCA contra la DB compartida/remota.
- Binarios de Postgres NO están en el PATH: usar `/opt/homebrew/opt/postgresql@18/bin/<cmd>`.
- Prod es **solo lectura** (regla del usuario): en prod solo `SELECT`, jamás writes.
- Deploy a Railway (`MYALQ`/production, servicios `myalquiler-back` y `myalquiler-front`) **requiere confirmación explícita del usuario**. `railway up` adelanta prod respecto de main → hay que mergear el PR después.
- NO refactorizar las ~12 queryKeys en esta entrega (deuda anotada en el spec).
- Enum de estado de contrato: `BORRADOR | ACTIVO | FINALIZADO | RESCINDIDO` (`apps/api/prisma/schema.prisma:45-50`).

**Gotchas de entorno descubiertos al ejecutar la Task 1 (aplican a todas las tareas que levanten la PWA):**
- El puerto **3000 suele estar ocupado** por otro proyecto del usuario (`palta-app-admin-onb`). NO matar ese proceso: levantar la PWA en otro puerto (ej. 3050).
- Si la PWA no corre en 3000/3001, el API la bloquea por CORS (`CORS_ORIGINS` en `apps/api/src/env.ts` tiene esos dos por default) y los POST fallan con `net::ERR_FAILED` sin log del lado server. Solución sin tocar código: levantar el API con `CORS_ORIGINS="http://localhost:3000,http://localhost:3001,http://localhost:3050,https://soyalantapia.github.io"`.
- El escenario local ya está armado en la DB `myalq_multiprop` y el script es idempotente: re-correrlo no duplica nada.
- Commits en español, imperativo, con el prefijo `fix(inquilino):` / `feat(inquilino):`. Terminar el mensaje con `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## Task 1: Escenario local de 2 alquileres (harness de verificación)

Sin esto no se puede verificar nada del resto. Crea una 2ª inmobiliaria con un contrato para el MISMO email que ya usa el seed (`mariela.sosa@gmail.com`), con un monto deliberadamente distinto para que el bug de caché sea imposible de confundir.

**Files:**
- Create: `apps/api/prisma/escenario-multi-alquiler.ts`

**Interfaces:**
- Consumes: `seedBase` de `apps/api/prisma/seed.ts`; `generarLiquidacionesContrato` de `apps/api/src/lib/liquidaciones.ts`.
- Produces: una DB local con 2 alquileres para `mariela.sosa@gmail.com` — uno en "Inmobiliaria del Sol" (monto 480000, del seed) y otro en "Alquileres del Norte" (monto **999999**).

- [ ] **Step 1: Crear el script del escenario**

Crear `apps/api/prisma/escenario-multi-alquiler.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import { seedBase } from './seed.js';
import { generarLiquidacionesContrato } from '../src/lib/liquidaciones.js';

/**
 * Escenario de verificación del multi-alquiler: el MISMO email con dos
 * contratos en DOS inmobiliarias distintas. El 2º contrato usa un monto
 * absurdo (999999) para que, si la app muestra la plata de la propiedad
 * equivocada, se vea de una. Idempotente: se puede correr varias veces.
 *
 * Uso (contra una DB local efímera, NUNCA la remota):
 *   DATABASE_URL=... JWT_SECRET=... npx tsx prisma/escenario-multi-alquiler.ts
 */
const EMAIL = 'mariela.sosa@gmail.com';
const MONTO_2 = 999_999;

(async () => {
  const prisma = new PrismaClient();
  await seedBase(prisma);

  const yaExiste = await prisma.inmobiliaria.findFirst({ where: { nombre: 'Alquileres del Norte' } });
  const inmo =
    yaExiste ??
    (await prisma.inmobiliaria.create({
      data: {
        nombre: 'Alquileres del Norte',
        cuit: '30-70000000-9',
        email: 'hola@delnorte.com.ar',
        telefono: '+54 11 4000 0000',
        matricula: 'CUCICBA 9999',
        direccionCalle: 'Av. Cabildo',
        direccionAltura: '1200',
        direccionCiudad: 'CABA',
        direccionProvincia: 'Buenos Aires',
        direccionCp: '1426',
      },
    }));

  const propietario =
    (await prisma.propietario.findFirst({ where: { inmobiliariaId: inmo.id } })) ??
    (await prisma.propietario.create({
      data: {
        inmobiliariaId: inmo.id,
        nombre: 'Marta',
        apellido: 'Duarte',
        cuit: '27-99999999-9',
        email: 'marta.duarte@gmail.com',
        telefono: '+54 11 4111 2222',
        comisionPct: 8,
      },
    }));

  const propiedad =
    (await prisma.propiedad.findFirst({ where: { inmobiliariaId: inmo.id } })) ??
    (await prisma.propiedad.create({
      data: {
        inmobiliariaId: inmo.id,
        direccion: 'Mendoza 3344, 2°A',
        ciudad: 'Belgrano, CABA',
        provincia: 'Buenos Aires',
        tipo: 'DEPARTAMENTO',
        estado: 'ALQUILADA',
      },
    }));

  await prisma.participacionPropietario.createMany({
    data: [{ propiedadId: propiedad.id, propietarioId: propietario.id, porcentaje: 100 }],
    skipDuplicates: true,
  });

  const inqExistente = await prisma.inquilino.findFirst({
    where: { inmobiliariaId: inmo.id, email: EMAIL },
  });
  if (inqExistente) {
    console.log('El escenario ya estaba armado. Nada que hacer.');
    await prisma.$disconnect();
    return;
  }

  const hoy = new Date();
  const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 3, 1));
  const fin = new Date(Date.UTC(hoy.getUTCFullYear() + 2, hoy.getUTCMonth(), 1));
  const contrato = await prisma.contrato.create({
    data: {
      inmobiliariaId: inmo.id,
      propiedadId: propiedad.id,
      estado: 'ACTIVO',
      monto: MONTO_2,
      moneda: 'ARS',
      fechaInicio: inicio,
      fechaFin: fin,
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
      tipoContrato: 'ALQUILER',
      modoCobranza: 'INMOBILIARIA',
    },
  });
  await prisma.propiedad.update({
    where: { id: propiedad.id },
    data: { contratoActualId: contrato.id },
  });
  await prisma.inquilino.create({
    data: {
      inmobiliariaId: inmo.id,
      nombre: 'Mariela',
      apellido: 'Sosa',
      email: EMAIL,
      contratoId: contrato.id,
      esInvitado: false,
    },
  });
  await generarLiquidacionesContrato(prisma, contrato);

  const total = await prisma.inquilino.count({ where: { email: EMAIL } });
  console.log(`OK — ${EMAIL} tiene ahora ${total} alquileres. El 2º es "${propiedad.direccion}" por $${MONTO_2}.`);
  await prisma.$disconnect();
})();
```

Nota: el cuerpo va envuelto en `(async () => { ... })()` a propósito — un `.ts` suelto con top-level await falla en tsx con "not supported with cjs output format".

- [ ] **Step 2: Crear la DB local y correr el escenario**

```bash
cd ~/dev/myalq-multiprop/apps/api
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
export DATABASE_URL="postgresql://alannaimtapia@localhost:5432/myalq_multiprop"
export JWT_SECRET="secreto-local-de-16-o-mas-chars"
export NODE_ENV=development
dropdb --if-exists myalq_multiprop && createdb myalq_multiprop
npx prisma migrate deploy && npx prisma generate
npx tsx prisma/escenario-multi-alquiler.ts
```

Expected: la última línea imprime `OK — mariela.sosa@gmail.com tiene ahora 2 alquileres. El 2º es "Mendoza 3344, 2°A" por $999999.`

- [ ] **Step 3: Verificar que el API lista los 2 alquileres**

Levantar el API y pedir el OTP + verify (el código de demo `000000` funciona con `DEMO_MODE=true` fuera de producción):

```bash
cd ~/dev/myalq-multiprop/apps/api
DEMO_MODE=true PORT=3006 npx tsx src/index.ts &
sleep 4
/usr/bin/curl -s -X POST localhost:3006/auth/otp/request -H 'content-type: application/json' -d '{"email":"mariela.sosa@gmail.com"}'
/usr/bin/curl -s -X POST localhost:3006/auth/otp/verify -H 'content-type: application/json' -d '{"email":"mariela.sosa@gmail.com","code":"000000"}'
```

Expected: el `verify` devuelve un `personaToken` y un array `alquileres` con **2 elementos**, uno con `inmobiliaria: "Inmobiliaria del Sol"` y otro con `inmobiliaria: "Alquileres del Norte"`, y ambos con el campo `estado`.

- [ ] **Step 4: Reproducir el bug P0 en el navegador (ANTES del fix)**

Levantar la PWA apuntando al API local y recorrer el flujo:

```bash
cd ~/dev/myalq-multiprop/apps/inquilino
NEXT_PUBLIC_API_URL=http://localhost:3006 npx next dev -p 3000
```

En el navegador: entrar a `http://localhost:3000/login` → email `mariela.sosa@gmail.com` → código `000000` → aparece el selector con 2 propiedades → entrar a **Mendoza 3344** (la de $999999) → anotar el monto que muestra la home → ir a `/mis-alquileres` → cambiar a **Gorriti 4521** → observar la home.

Expected (el bug): la home muestra la dirección NUEVA (Gorriti) pero el **monto/deuda de Mendoza ($999999)**. Dejar registrado con screenshot: es la prueba de que el bug existe.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/myalq-multiprop
git add apps/api/prisma/escenario-multi-alquiler.ts
git commit -m "test(inquilino): escenario local de 2 alquileres del mismo email en 2 inmobiliarias

Harness para verificar el multi-alquiler. El 2º contrato usa monto 999999
para que el bug de caché entre propiedades sea imposible de confundir.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: P0 — Matar el bug de la plata (hard nav al cambiar de alquiler)

El `QueryClient` se crea una sola vez en el layout raíz y sobrevive a la navegación client-side; ninguna queryKey lleva el contrato; y nadie limpia la caché al cambiar de alquiler. Una hard nav destruye el `QueryClient` en memoria y además mata el race de un refetch disparado con el token viejo.

**Files:**
- Modify: `apps/inquilino/src/app/(app)/mis-alquileres/page.tsx:56`
- Modify: `apps/inquilino/src/app/(full)/login/page.tsx:197` y `:210`
- Modify: `apps/inquilino/src/app/(app)/cuenta/page.tsx:313-314`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: nada nuevo (cambio de comportamiento de navegación).

- [ ] **Step 1: Hard nav al cambiar de alquiler desde el switcher**

En `apps/inquilino/src/app/(app)/mis-alquileres/page.tsx`, dentro de `onCambiar`, reemplazar:

```tsx
      const sesion = await elegirAlquiler(a.inquilinoId, alquileres?.length ?? 1);
      toast({ title: 'Cambiaste de alquiler', description: sesion.direccion || a.direccion });
      router.replace('/');
```

por:

```tsx
      const sesion = await elegirAlquiler(a.inquilinoId, alquileres?.length ?? 1);
      toast({ title: 'Cambiaste de alquiler', description: sesion.direccion || a.direccion });
      // HARD nav a propósito (no router.replace): el QueryClient vive en el layout
      // raíz y sobrevive a la navegación client-side, así que con soft nav la home
      // se pintaba con la caché del alquiler ANTERIOR (deuda de la otra propiedad).
      // Recargar la app entera la destruye, y de paso mata el race de un refetch
      // disparado con el token viejo que resuelve después del setToken.
      window.location.assign('/');
```

- [ ] **Step 2: Hard nav en las dos salidas del login**

En `apps/inquilino/src/app/(full)/login/page.tsx`, en el handler del OTP (caso "entrar" directo), reemplazar:

```tsx
    toast({
      title: `¡Hola ${r.sesion.nombre}!`,
      description: 'Ingresaste con éxito.',
    });
    router.replace('/');
```

por:

```tsx
    toast({
      title: `¡Hola ${r.sesion.nombre}!`,
      description: 'Ingresaste con éxito.',
    });
    // HARD nav: arranca la app con el QueryClient limpio (si en el mismo browser
    // hubo antes otra sesión, su caché no debe sobrevivir al login).
    window.location.assign('/');
```

Y en `onElegir`, reemplazar:

```tsx
      const sesion = await elegirAlquiler(inquilinoId, alquileres.length);
      toast({ title: `¡Hola ${sesion.nombre}!`, description: 'Entraste a tu alquiler.' });
      router.replace('/');
```

por:

```tsx
      const sesion = await elegirAlquiler(inquilinoId, alquileres.length);
      toast({ title: `¡Hola ${sesion.nombre}!`, description: 'Entraste a tu alquiler.' });
      // HARD nav: ver el comentario del switcher (/mis-alquileres).
      window.location.assign('/');
```

- [ ] **Step 3: Hard nav al cerrar sesión**

En `apps/inquilino/src/app/(app)/cuenta/page.tsx`, en el `onConfirm` del diálogo de logout, reemplazar:

```tsx
        onConfirm={() => {
          cerrarSesion();
          router.push('/login');
        }}
```

por:

```tsx
        onConfirm={() => {
          cerrarSesion();
          // HARD nav: cerrarSesion() borra los tokens de localStorage pero NO la
          // caché en memoria de react-query. Con soft nav, el próximo que entre en
          // este dispositivo podía ver datos del anterior.
          window.location.assign('/login');
        }}
```

- [ ] **Step 4: Typecheck**

```bash
cd ~/dev/myalq-multiprop/apps/inquilino && pnpm typecheck
```

Expected: sin output de error (exit 0).

Ojo con `router`: en `mis-alquileres/page.tsx` se sigue usando (`router.replace('/cuenta')` del guard de demo y `router.push('/login?force=1')`), pero en `cuenta/page.tsx` el `router` de `CuentaReal` podía existir solo para el logout — si queda sin uso, borrar `const router = useRouter();` y el import de `useRouter` **solo si** un `grep -n "router\." "apps/inquilino/src/app/(app)/cuenta/page.tsx"` confirma que no queda ninguna otra referencia dentro de ese componente. Lo mismo para `login/page.tsx`. Un binding sin usar no rompe el build, así que no inventar cambios: verificar antes de borrar.

- [ ] **Step 5: Verificar E2E que el bug murió**

⚠️ **CORREGIDO con lo observado en la Task 1.** El síntoma NO es el que predecía este plan. Verificado en el navegador: al cambiar de propiedad **el monto SÍ se actualiza** (`/mis-liquidaciones` y `/mis-cargos` se re-piden), pero **`/mi-contrato` NO se re-pide** (`queryKey: ['mi-contrato']` global + `staleTime: 60_000` + observer montado permanentemente en el SideNav) → los datos del contrato quedan con los de la propiedad ANTERIOR.

**La señal confiable es el nombre de la inmobiliaria** en el panel "Administra {inmobiliaria}" de la home (`apps/inquilino/src/app/(app)/page.tsx`, alimentado por `useMiContrato`). Medir el monto NO sirve como test: da verde aun sin el fix.

Recorrido (con el escenario de la Task 1 y la PWA levantada según los gotchas de las Global Constraints):

1. Login `mariela.sosa@gmail.com` / código `000000` → entrar a **Mendoza 3344** (Alquileres del Norte).
2. La home debe decir "Administra **Alquileres del Norte**".
3. Ir a `/mis-alquileres` → cambiar a **Gorriti 4521** (Inmobiliaria del Sol).
4. **Expected CON el fix:** la home dice "Administra **Inmobiliaria del Sol**". (Sin el fix decía "Alquileres del Norte" hasta pasados 60s o un reload duro.)
5. Repetir en sentido inverso (Gorriti → Mendoza) y confirmar "Administra **Alquileres del Norte**".
6. Chequeo secundario: el monto acompaña ($481.560 en Gorriti, $999.999 en Mendoza).

Transcribir en el reporte los textos EXACTOS vistos en cada paso.

Nota: el hard nav arregla de una **toda la familia** de este bug (cualquier hook con `queryKey` global y `staleTime` largo), no solo `useMiContrato` — por eso no hace falta auditar hook por hook en esta entrega.

- [ ] **Step 6: Commit**

```bash
cd ~/dev/myalq-multiprop
git add "apps/inquilino/src/app/(app)/mis-alquileres/page.tsx" "apps/inquilino/src/app/(full)/login/page.tsx" "apps/inquilino/src/app/(app)/cuenta/page.tsx"
git commit -m "fix(inquilino): al cambiar de alquiler ya no se ve la plata de la otra propiedad

El QueryClient se crea una vez en el layout raíz y sobrevive a la navegación
client-side; ninguna queryKey lleva el contrato y nadie limpiaba la caché al
elegir otro alquiler. Resultado: la home mostraba la dirección nueva con la
deuda y el contrato de la propiedad anterior, sin error ni aviso.

Hard nav (window.location.assign) al cambiar de alquiler, al entrar desde el
login y al cerrar sesión: destruye el QueryClient en memoria y mata el race de
un refetch disparado con el token viejo.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Mostrar el estado del contrato en las dos listas

El API ya manda `estado` (`apps/api/src/routes/auth.ts:100-102`) y el front lo descarta porque la interface no lo declara. Un alquiler finalizado se ve idéntico a uno vigente.

**Files:**
- Modify: `apps/inquilino/src/lib/auth-otp-api.ts:31-37`
- Modify: `apps/inquilino/src/app/(app)/mis-alquileres/page.tsx`
- Modify: `apps/inquilino/src/app/(full)/login/page.tsx` (`PasoElegir`)

**Interfaces:**
- Consumes: el campo `estado` que ya viaja en la respuesta de `/auth/inquilino/alquileres` y `/auth/otp/verify`.
- Produces: `Alquiler.estado?: EstadoContratoAlquiler | null` y el helper `esAlquilerTerminado(estado)`, exportados desde `apps/inquilino/src/lib/auth-otp-api.ts`.

- [ ] **Step 1: Declarar el estado en la interface y el helper**

En `apps/inquilino/src/lib/auth-otp-api.ts`, reemplazar:

```ts
/** Un alquiler (contrato) de la persona, tal como lo lista el API. */
export interface Alquiler {
  inquilinoId: string;
  nombre: string;
  inmobiliaria: string;
  direccion: string;
  ciudad: string;
}
```

por:

```ts
/** Estados posibles del contrato de un alquiler (enum EstadoContrato del API). */
export type EstadoContratoAlquiler = 'BORRADOR' | 'ACTIVO' | 'FINALIZADO' | 'RESCINDIDO';

/** Un alquiler (contrato) de la persona, tal como lo lista el API. */
export interface Alquiler {
  inquilinoId: string;
  nombre: string;
  inmobiliaria: string;
  direccion: string;
  ciudad: string;
  /** El API ya lo manda; puede faltar en respuestas viejas cacheadas. */
  estado?: EstadoContratoAlquiler | null;
}

/**
 * ¿Este alquiler ya terminó? Solo FINALIZADO y RESCINDIDO llevan el cartel:
 * un BORRADOR es un contrato cargado para revisión que todavía no arrancó, y
 * marcarlo como "Finalizado" sería mentirle al inquilino.
 */
export function esAlquilerTerminado(estado: Alquiler['estado']): boolean {
  return estado === 'FINALIZADO' || estado === 'RESCINDIDO';
}
```

- [ ] **Step 2: Pintar el badge en /mis-alquileres**

En `apps/inquilino/src/app/(app)/mis-alquileres/page.tsx`, cambiar el import:

```tsx
import { elegirAlquiler, listarAlquileres, type Alquiler } from '@/lib/auth-otp-api';
```

por:

```tsx
import { elegirAlquiler, esAlquilerTerminado, listarAlquileres, type Alquiler } from '@/lib/auth-otp-api';
```

Y dentro del `.map`, reemplazar el bloque del nombre/dirección:

```tsx
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{a.direccion || 'Tu alquiler'}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {a.inmobiliaria}
                          {a.ciudad ? ` · ${a.ciudad}` : ''}
                        </span>
                      </p>
                    </div>
```

por:

```tsx
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate font-semibold">
                        <span className="truncate">{a.direccion || 'Tu alquiler'}</span>
                        {esAlquilerTerminado(a.estado) && (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Finalizado
                          </span>
                        )}
                      </p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {a.inmobiliaria}
                          {a.ciudad ? ` · ${a.ciudad}` : ''}
                        </span>
                      </p>
                    </div>
```

- [ ] **Step 3: Pintar el badge en el selector del login**

En `apps/inquilino/src/app/(full)/login/page.tsx`, agregar `esAlquilerTerminado` al import que ya trae `elegirAlquiler` desde `@/lib/auth-otp-api`, y dentro de `PasoElegir` reemplazar:

```tsx
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.direccion || 'Tu alquiler'}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {a.inmobiliaria}
                      {a.ciudad ? ` · ${a.ciudad}` : ''}
                    </span>
                  </p>
                </div>
```

por:

```tsx
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-semibold">
                    <span className="truncate">{a.direccion || 'Tu alquiler'}</span>
                    {esAlquilerTerminado(a.estado) && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Finalizado
                      </span>
                    )}
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {a.inmobiliaria}
                      {a.ciudad ? ` · ${a.ciudad}` : ''}
                    </span>
                  </p>
                </div>
```

- [ ] **Step 4: Typecheck**

```bash
cd ~/dev/myalq-multiprop/apps/inquilino && pnpm typecheck
```

Expected: exit 0, sin errores.

- [ ] **Step 5: Verificar E2E con un contrato finalizado**

Marcar el 2º contrato como finalizado y recargar `/mis-alquileres`:

```bash
cd ~/dev/myalq-multiprop/apps/api
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
psql "postgresql://alannaimtapia@localhost:5432/myalq_multiprop" -c "UPDATE contratos SET estado='FINALIZADO' WHERE monto=999999;"
```

Expected: en `/mis-alquileres`, la tarjeta de **Mendoza 3344** muestra el badge "Finalizado" y la de Gorriti no. Después devolverlo a `ACTIVO` con el mismo comando cambiando el valor, para no ensuciar el resto de la verificación.

- [ ] **Step 6: Commit**

```bash
cd ~/dev/myalq-multiprop
git add apps/inquilino/src/lib/auth-otp-api.ts "apps/inquilino/src/app/(app)/mis-alquileres/page.tsx" "apps/inquilino/src/app/(full)/login/page.tsx"
git commit -m "feat(inquilino): distinguir alquileres finalizados en las listas

El API ya mandaba el estado del contrato (auth.ts:100-102) pero el front lo
descartaba porque la interface Alquiler no lo declaraba: un alquiler terminado
se veía idéntico a uno vigente. Badge 'Finalizado' solo para FINALIZADO y
RESCINDIDO — un BORRADOR todavía no arrancó y marcarlo sería mentir.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Hacer visible "Mis propiedades"

Hoy hay **un solo link** en todo el repo a `/mis-alquileres` (`cuenta/page.tsx:185`), escondido a varios toques. El usuario pidió textualmente "ver mis propiedades".

**Files:**
- Modify: `apps/inquilino/src/components/nav-bar.tsx:152-158`
- Modify: `apps/inquilino/src/components/mobile-greeting-header.tsx`

**Interfaces:**
- Consumes: `useMiContrato()` de `@/lib/api/hooks` (ya devuelve `contrato.direccion` y `contrato.inmobiliaria`).
- Produces: nada nuevo.

- [ ] **Step 1: Hacer clickeable el "Tu hogar" del sidenav desktop**

En `apps/inquilino/src/components/nav-bar.tsx`, agregar `ArrowLeftRight` al import de `lucide-react` (la lista ya importa `BadgeCheck, CircleHelp, FileText, ...`), y reemplazar el bloque final del `SideNav`:

```tsx
      {contrato && (
        <div className="border-t p-3 text-xs">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tu hogar</p>
          <p className="mt-0.5 font-medium leading-tight">{contrato.direccion}</p>
          <p className="text-[10px] text-muted-foreground">{contrato.inmobiliaria}</p>
        </div>
      )}
```

por:

```tsx
      {contrato && (
        <Link
          href="/mis-alquileres"
          className="group flex items-start gap-2 border-t p-3 text-xs transition-colors hover:bg-muted"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tu hogar</p>
            <p className="mt-0.5 truncate font-medium leading-tight">{contrato.direccion}</p>
            <p className="truncate text-[10px] text-muted-foreground">{contrato.inmobiliaria}</p>
          </div>
          <ArrowLeftRight
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
            aria-hidden="true"
          />
          <span className="sr-only">Ver mis propiedades</span>
        </Link>
      )}
```

- [ ] **Step 2: Mostrar la propiedad actual (linkeada) en el header mobile**

Reemplazar el contenido completo de `apps/inquilino/src/components/mobile-greeting-header.tsx` por:

```tsx
'use client';

import Link from 'next/link';
import { ArrowLeftRight } from 'lucide-react';
import { UserMenu } from './user-menu';
import { useCurrentUser } from '@/lib/use-current-user';
import { useMiContrato } from '@/lib/api/hooks';

/**
 * Header mobile consistente para las pestañas principales del inquilino
 * (Inicio, Pagos, Contrato, Reclamos): saludo "Hola, {nombre} 👋" a la
 * izquierda + UserMenu compacto (avatar + campana) a la derecha.
 *
 * Debajo del saludo va la dirección de la propiedad ACTUAL, linkeada a
 * /mis-alquileres: con dos alquileres, en un teléfono las dos sesiones se veían
 * idénticas (no había forma de saber en cuál estabas parado), y la lista de
 * propiedades estaba escondida detrás de Mi cuenta.
 *
 * `md:hidden` — en desktop lo cubre la topbar del layout. Es el ÚNICO origen
 * de verdad del header mobile para que todas las pantallas se vean iguales.
 */
export function MobileGreetingHeader() {
  const user = useCurrentUser();
  const { contrato } = useMiContrato();
  const tieneNombre = user.firstName.length > 0;
  return (
    <header className="flex items-start justify-between px-5 pt-5 md:hidden">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Hola,</p>
        <p className="truncate text-lg font-semibold leading-tight">
          {tieneNombre ? (
            <>
              {user.firstName} <span aria-hidden="true">👋</span>
            </>
          ) : (
            <span aria-hidden="true">👋</span>
          )}
        </p>
        {contrato?.direccion && (
          <Link
            href="/mis-alquileres"
            className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="truncate">{contrato.direccion}</span>
            <ArrowLeftRight className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="sr-only">Ver mis propiedades</span>
          </Link>
        )}
      </div>
      <UserMenu compact />
    </header>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd ~/dev/myalq-multiprop/apps/inquilino && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 4: Verificar E2E en los dos tamaños**

Con el escenario corriendo: en desktop (ancho ≥ 768px) el pie del sidenav "Tu hogar" es clickeable y lleva a `/mis-alquileres`. En mobile (375px) debajo del "Hola, Mariela 👋" aparece la dirección actual, y al tocarla lleva a `/mis-alquileres`. Verificar que la dirección mostrada **coincide** con el alquiler en el que estás.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/myalq-multiprop
git add apps/inquilino/src/components/nav-bar.tsx apps/inquilino/src/components/mobile-greeting-header.tsx
git commit -m "feat(inquilino): 'ver mis propiedades' accesible y saber en cuál estás

Había un solo link a /mis-alquileres en todo el repo, escondido dentro de Mi
cuenta. Además, con dos alquileres no se veía en cuál estabas parado: en mobile
el header solo decía 'Hola, {nombre}'.

El 'Tu hogar' del sidenav desktop pasa a ser un link a la lista, y el header
mobile suma la dirección actual, también linkeada. Resuelve las dos cosas con
el mismo cambio.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Destapar el link de Cuenta, estado vacío y back estable

El link de Cuenta está gateado por `alquileresCount`, que se congela en el login: si el inquilino firma su 2ª propiedad DESPUÉS de loguearse, el link no aparece nunca (el token dura 15 días).

**Files:**
- Modify: `apps/inquilino/src/app/(app)/cuenta/page.tsx:65-71` y `:180-187`
- Modify: `apps/inquilino/src/app/(app)/mis-alquileres/page.tsx`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: nada nuevo.

- [ ] **Step 1: Sacar el gate del contador congelado**

En `apps/inquilino/src/app/(app)/cuenta/page.tsx`, borrar el estado y su efecto:

```tsx
  // Mostramos el switcher "Cambiar de alquiler" sólo si la persona tiene más de
  // un alquiler (lo setea el login por API en la sesión). Una sola fila → la
  // entrada no aporta y la ocultamos.
  const [variosAlquileres, setVariosAlquileres] = useState(false);
  useEffect(() => {
    setVariosAlquileres((leerSesion()?.alquileresCount ?? 1) > 1);
  }, []);
```

Y reemplazar el bloque gateado:

```tsx
            {variosAlquileres && (
              <LinkRow
                icon={<ArrowLeftRight className="h-4 w-4" />}
                label="Cambiar de alquiler"
                descripcion="Tenés más de un alquiler con este email"
                href="/mis-alquileres"
              />
            )}
```

por (siempre visible, y con copy que ya no promete que hay varios):

```tsx
            {/* Siempre visible: el contador de alquileres se congelaba en el login,
                así que si el inquilino firmaba su 2ª propiedad DESPUÉS de entrar,
                esta fila no aparecía nunca (el token dura 15 días). La pantalla
                destino maneja bien el caso de un solo alquiler. */}
            <LinkRow
              icon={<ArrowLeftRight className="h-4 w-4" />}
              label="Mis propiedades"
              descripcion="Ver tus alquileres y cambiar de propiedad"
              href="/mis-alquileres"
            />
```

Después de borrar el estado, verificar si `leerSesion` y `useState`/`useEffect` siguen usándose en el archivo; si `leerSesion` quedó sin uso, quitarlo del import de la línea 34 (`import { cerrarSesion, leerSesion } from '@/lib/auth-otp';` → `import { cerrarSesion } from '@/lib/auth-otp';`). El typecheck del Step 4 lo confirma.

- [ ] **Step 2: Estado vacío en /mis-alquileres**

En `apps/inquilino/src/app/(app)/mis-alquileres/page.tsx`, reemplazar la apertura del bloque de la lista:

```tsx
        {estado === 'ok' && alquileres && (
          <ul role="list" className="space-y-2.5">
```

por:

```tsx
        {estado === 'ok' && alquileres && alquileres.length === 0 && (
          <Card className="space-y-2 p-5 text-center">
            <p className="text-sm font-medium">No encontramos alquileres con tu email</p>
            <p className="text-xs text-muted-foreground">
              Si acabás de firmar, puede que tu inmobiliaria todavía no lo haya cargado.
            </p>
          </Card>
        )}

        {estado === 'ok' && alquileres && alquileres.length > 0 && (
          <ul role="list" className="space-y-2.5">
```

- [ ] **Step 3: Back estable (no `router.back()`)**

En el mismo archivo, reemplazar el botón de volver del header:

```tsx
        <button
          type="button"
          onClick={() => router.back()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
```

por:

```tsx
        {/* href fijo, no router.back(): a esta pantalla se puede llegar desde el
            sidenav, el header mobile o Mi cuenta, y con back el destino era
            impredecible (o salía de la app si fue la primera pantalla). */}
        <Link
          href="/"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Volver al inicio"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
```

Y agregar el import de `Link` al tope del archivo, debajo de `import { useRouter } from 'next/navigation';`:

```tsx
import Link from 'next/link';
```

- [ ] **Step 4: Typecheck**

```bash
cd ~/dev/myalq-multiprop/apps/inquilino && pnpm typecheck
```

Expected: exit 0. Si marca `leerSesion` / `useState` / `useEffect` sin uso en `cuenta/page.tsx`, limpiar esos imports.

- [ ] **Step 5: Verificar E2E**

- En `/cuenta`, la fila "Mis propiedades" aparece **siempre**, incluso simulando un solo alquiler (`localStorage`: setear `alquileresCount` en 1 y recargar).
- En `/mis-alquileres`, la flecha de volver lleva a la home.
- Para el estado vacío: no es reproducible con este escenario (el email siempre tiene 2); alcanza con verificar que la lista de 2 sigue renderizando bien y que el bloque vacío no aparece.

- [ ] **Step 6: Commit**

```bash
cd ~/dev/myalq-multiprop
git add "apps/inquilino/src/app/(app)/cuenta/page.tsx" "apps/inquilino/src/app/(app)/mis-alquileres/page.tsx"
git commit -m "fix(inquilino): 'Mis propiedades' siempre visible en Cuenta, y pantalla más sólida

El link estaba gateado por alquileresCount, que se escribe una sola vez en el
login y nunca se refresca: si el inquilino firmaba su 2ª propiedad después de
entrar, la fila no aparecía hasta cerrar sesión (token de 15 días).

Además: estado vacío explícito en /mis-alquileres (antes renderizaba una lista
muda) y volver con href fijo a la home en vez de router.back(), que era
impredecible según de dónde se llegara.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Chequeo READ-ONLY en prod (gate del PR #27)

La migración del PR #27 crea un `UNIQUE` sobre `personas(inmobiliariaId, email)`. Si en prod ya hay dos `Persona` con el mismo email no-null en un mismo tenant, **la migración falla y el deploy queda roto**. Este chequeo es el gate. **Solo SELECT.**

**Files:**
- Ninguno (operación de verificación).

**Interfaces:**
- Consumes: nada.
- Produces: un veredicto GO / NO-GO para la Task 7.

- [ ] **Step 1: Correr las consultas de solo lectura contra prod**

`prisma db execute` NO imprime el resultado de un SELECT, así que no sirve acá. El patrón que funciona es mandar un script ESM por **pipe a stdin** (escribirlo a `/tmp` del contenedor no resuelve `@prisma/client`) y correrlo desde el cwd del contenedor:

```bash
cd ~/dev/myalq-multiprop/apps/api
railway link --project MYALQ --environment production --service myalquiler-back
cat <<'EOF' | railway ssh --service myalquiler-back --environment production "node --input-type=module"
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
// (a) GATE: ¿hay dos Persona con el mismo email no-null en un mismo tenant?
const dup = await p.$queryRaw`
  SELECT "inmobiliariaId", lower(email) AS email, count(*)::int AS cuantas
  FROM personas
  WHERE email IS NOT NULL AND email <> ''
  GROUP BY 1, 2
  HAVING count(*) > 1
`;
console.log('DUPLICADAS:', JSON.stringify(dup));
// (b) MEDICIÓN: propiedades que quedarían invisibles por no tener email.
const sinEmail = await p.$queryRaw`
  SELECT count(*)::int AS sin_email
  FROM inquilinos i
  JOIN contratos c ON c.id = i."contratoId"
  WHERE (i.email IS NULL OR i.email = '') AND c.estado = 'ACTIVO'
`;
console.log('SIN_EMAIL:', JSON.stringify(sinEmail));
await p.$disconnect();
EOF
```

Son dos `SELECT`, cero writes.

Expected para (a): `DUPLICADAS: []`. Si devuelve filas → **NO-GO**: hay que deduplicar esas personas ANTES de mergear (tarea aparte, fuera de este plan) y la Task 7 no arranca.

- [ ] **Step 2: Anotar la medición de propiedades invisibles**

El valor `SIN_EMAIL` del Step 1 son contratos activos cuyo `Inquilino` no tiene email: aun después de mergear el PR #27 **siguen invisibles** para el inquilino (no entran en `alquileresDeEmail` ni reciben OTP). No se arreglan en este plan.

**Anotarlo y reportárselo al usuario.** Si es > 0, avisar que hace falta una tarea aparte (endpoint para corregir el email de un `Inquilino` ya creado) o esas propiedades no van a aparecer nunca.

- [ ] **Step 3: Registrar el veredicto**

No hay commit en esta task (no toca archivos). Dejar constancia en el reporte al usuario: resultado de ambas consultas y veredicto GO/NO-GO.

---

## Task 7: Mergear el PR #27 (dos contratos en la misma inmobiliaria)

Solo si la Task 6 dio GO. El PR #27 mueve el `@@unique([inmobiliariaId, email])` de `Inquilino` a `Persona`, que es lo que hoy hace imposible el caso "dos propiedades en la misma inmobiliaria".

**Files:**
- Ninguno en este worktree (el cambio vive en la rama del PR #27).

**Interfaces:**
- Consumes: el GO de la Task 6.
- Produces: `main` con el unique movido y su migración.

- [ ] **Step 1: Confirmar que el PR sigue mergeable**

```bash
cd ~/dev/myalq-multiprop
gh pr view 27 --json number,state,mergeable,title -q '"PR #\(.number) [\(.state)] mergeable=\(.mergeable) — \(.title)"'
```

Expected: `state=OPEN`, `mergeable=MERGEABLE`. Si dice `CONFLICTING`, resolver el conflicto antes de seguir (no está previsto en este plan; reportarlo).

- [ ] **Step 2: Mergear**

```bash
cd ~/dev/myalq-multiprop
gh pr merge 27 --merge
gh pr view 27 --json state -q .state
```

Expected: `MERGED`.

- [ ] **Step 3: Traer main y rebasar esta rama**

```bash
cd ~/dev/myalq-multiprop
git fetch origin
git rebase origin/main
```

Expected: rebase limpio (esta rama solo toca front + docs + un script; el PR #27 toca schema y core.ts).

- [ ] **Step 4: Verificar el caso "misma inmobiliaria" en local**

Recrear la DB local con el schema nuevo y agregar un 3er alquiler para el MISMO email en la MISMA inmobiliaria que el 1º:

```bash
cd ~/dev/myalq-multiprop/apps/api
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
export DATABASE_URL="postgresql://alannaimtapia@localhost:5432/myalq_multiprop2"
export JWT_SECRET="secreto-local-de-16-o-mas-chars"
dropdb --if-exists myalq_multiprop2 && createdb myalq_multiprop2
npx prisma migrate deploy && npx prisma generate
npx tsx prisma/escenario-multi-alquiler.ts
```

Luego, con el API levantado contra esa DB, crear un 2º contrato en "Inmobiliaria del Sol" para `mariela.sosa@gmail.com` vía `POST /contratos` (login de panel: `roberto@delsol.com` / `delsol123`, propiedad libre `prp_006`).

Expected: el alta **NO** devuelve 409 (antes sí) y `POST /auth/otp/verify` para ese email devuelve **3 alquileres**, dos de ellos de "Inmobiliaria del Sol".

- [ ] **Step 5: Escribir el test automatizado que al PR #27 le falta**

El PR #27 mueve el unique pero no deja un assert de que el inquilino VE los dos alquileres. Crear `apps/api/test/multi-alquiler-mismo-tenant.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * Dos contratos del MISMO email en la MISMA inmobiliaria (bug histórico: el
 * @@unique([inmobiliariaId, email]) de Inquilino lo hacía imposible, y el
 * workaround era dejar el email vacío → la propiedad quedaba invisible para el
 * inquilino). Crear las dos filas ya es media prueba: con el unique vivo, el
 * segundo create tira P2002. La otra media es que /auth/otp/verify liste las dos.
 */
const EMAIL = 'dos.alquileres@test.com';

let app: FastifyInstance;
let prisma: PrismaClient;

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  const propietario = await prisma.propietario.findFirstOrThrow({ where: { inmobiliariaId: inmo.id } });

  for (const n of [1, 2]) {
    const propiedad = await prisma.propiedad.create({
      data: {
        inmobiliariaId: inmo.id,
        direccion: `Test multi ${n}`,
        ciudad: 'CABA',
        provincia: 'Buenos Aires',
        tipo: 'DEPARTAMENTO',
        estado: 'ALQUILADA',
      },
    });
    await prisma.participacionPropietario.create({
      data: { propiedadId: propiedad.id, propietarioId: propietario.id, porcentaje: 100 },
    });
    const contrato = await prisma.contrato.create({
      data: {
        inmobiliariaId: inmo.id,
        propiedadId: propiedad.id,
        estado: 'ACTIVO',
        monto: 100_000 * n,
        moneda: 'ARS',
        fechaInicio: new Date('2026-01-01T00:00:00Z'),
        fechaFin: new Date('2028-01-01T00:00:00Z'),
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
        tipoContrato: 'ALQUILER',
        modoCobranza: 'INMOBILIARIA',
      },
    });
    // Con el @@unique([inmobiliariaId, email]) vivo, ESTA línea tira P2002 en n=2.
    await prisma.inquilino.create({
      data: {
        inmobiliariaId: inmo.id,
        nombre: 'Dos',
        apellido: `Alquileres ${n}`,
        email: EMAIL,
        contratoId: contrato.id,
        esInvitado: false,
      },
    });
  }
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('multi-alquiler en la misma inmobiliaria', () => {
  it('el OTP lista los DOS alquileres del mismo email en el mismo tenant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/otp/verify',
      payload: { email: EMAIL, code: '000000' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.personaToken).toBeTruthy();
    expect(body.alquileres).toHaveLength(2);
    // Los dos son de la MISMA inmobiliaria: es exactamente el caso que antes no existía.
    const inmobiliarias = new Set(body.alquileres.map((a: { inmobiliaria: string }) => a.inmobiliaria));
    expect(inmobiliarias.size).toBe(1);
  });

  it('se puede entrar a cada uno y el token apunta a contratos distintos', async () => {
    const verify = await app.inject({
      method: 'POST',
      url: '/auth/otp/verify',
      payload: { email: EMAIL, code: '000000' },
    });
    const { personaToken, alquileres } = verify.json();
    const contratos = new Set<string>();
    for (const a of alquileres as Array<{ inquilinoId: string }>) {
      const elegir = await app.inject({
        method: 'POST',
        url: '/auth/inquilino/elegir',
        headers: { authorization: `Bearer ${personaToken}` },
        payload: { inquilinoId: a.inquilinoId },
      });
      expect(elegir.statusCode).toBe(200);
      contratos.add(elegir.json().contratoId);
    }
    expect(contratos.size).toBe(2);
  });
});
```

Correrlo:

```bash
cd ~/dev/myalq-multiprop/apps/api
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
export DATABASE_URL="postgresql://alannaimtapia@localhost:5432/myalq_mismotenant"
export JWT_SECRET="secreto-local-de-16-o-mas-chars"
export NODE_ENV=test
dropdb --if-exists myalq_mismotenant && createdb myalq_mismotenant
npx prisma migrate deploy
npx vitest run test/multi-alquiler-mismo-tenant.test.ts
```

Expected: 2 tests PASS. (Si se corre ANTES de mergear el PR #27, el `beforeAll` falla con P2002 — eso confirma que el test prueba lo que dice probar.)

- [ ] **Step 6: Correr los tests del back que tocan el alta**

```bash
cd ~/dev/myalq-multiprop/apps/api
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
export DATABASE_URL="postgresql://alannaimtapia@localhost:5432/myalq_tests"
export JWT_SECRET="secreto-local-de-16-o-mas-chars"
export NODE_ENV=test
dropdb --if-exists myalq_tests && createdb myalq_tests
npx prisma migrate deploy
npx vitest run test/core.test.ts test/auth.test.ts
```

Expected: PASS. (Correr el suite completo junto contamina entre archivos por DB compartida — correr por archivo.)

- [ ] **Step 7: Commit del test nuevo**

```bash
cd ~/dev/myalq-multiprop
git add apps/api/test/multi-alquiler-mismo-tenant.test.ts
git commit -m "test(api): dos contratos del mismo email en la misma inmobiliaria

Assert que al PR #27 le faltaba: crear las dos filas Inquilino ya prueba que
el @@unique([inmobiliariaId, email]) se fue (antes tiraba P2002), y el test
verifica que /auth/otp/verify lista los DOS alquileres y que se puede entrar
a cada uno con un contrato distinto.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Si el rebase del Step 3 no generó cambios propios, no forzar un commit vacío aparte.

---

## Task 8: Verificación final y deploy

**Files:**
- Ninguno.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la feature en producción (solo con confirmación del usuario).

- [ ] **Step 1: Build de producción del front**

```bash
cd ~/dev/myalq-multiprop/apps/inquilino && rm -rf .next && npx next build
```

Expected: `✓ Compiled successfully` y la generación de páginas sin errores de módulos.

- [ ] **Step 2: Verificar que no hubo regresión de tipos en el back**

```bash
cd ~/dev/myalq-multiprop/apps/api && pnpm lint 2>&1 | grep -c "error TS"
```

Expected: un número **≤ 259** (baseline preexistente). Si sube, hay regresión: encontrarla y corregirla.

- [ ] **Step 3: Recorrido E2E completo (test de aceptación)**

Con el escenario local, verificar en una sola pasada:

1. Login con `mariela.sosa@gmail.com` → aparece el selector con las propiedades.
2. Entrar a **Mendoza 3344** → la home dice "Administra **Alquileres del Norte**" y $999.999.
3. Volver a la lista **desde el sidenav** (desktop) y **desde el header** (mobile).
4. Cambiar a **Gorriti 4521** → la home dice "Administra **Inmobiliaria del Sol**". ← *el test que importa* (ver la nota de la Task 2 Step 5: el nombre de la inmobiliaria es la señal confiable, el monto NO — se actualiza igual sin el fix).
5. Volver a Mendoza → "Administra **Alquileres del Norte**" de nuevo.
6. `/cuenta` muestra la fila "Mis propiedades" siempre.
7. Un alquiler FINALIZADO muestra el badge en `/mis-alquileres` (usar el UPDATE de la Task 3 Step 5 y revertirlo después).
8. **No regresión:** con un email de un solo alquiler, el login entra directo sin pasar por el selector.

Expected: los 8 puntos en verde. Transcribir los textos exactos vistos.

- [ ] **Step 4: Push y PR**

```bash
cd ~/dev/myalq-multiprop
git push -u origin feat/inquilino-multi-propiedad
gh pr create --base main --head feat/inquilino-multi-propiedad \
  --title "feat(inquilino): ver mis propiedades y entrar a cada una sin que se mezclen los datos" \
  --body "Ver docs/superpowers/specs/2026-07-27-inquilino-multi-propiedad-design.md

## Qué resuelve
- **P0**: al cambiar de alquiler se veía la deuda y el contrato de la OTRA propiedad (QueryClient del layout raíz + queryKeys sin contrato + cero limpieza). Fix: hard nav al elegir alquiler, entrar y cerrar sesión.
- 'Ver mis propiedades' era invisible (un solo link en todo el repo, escondido en Mi cuenta y gateado por un contador que se congela en el login).
- No se veía en qué propiedad estabas parado (mobile).
- Los alquileres finalizados se veían iguales que los vigentes (el API ya mandaba el dato).

## Verificación
- Escenario local reproducible: mismo email, 2 alquileres, 2 inmobiliarias, montos distintos (\`apps/api/prisma/escenario-multi-alquiler.ts\`).
- E2E en navegador: entrar a A → ver plata de A → cambiar a B → ver plata de B. Antes del fix mostraba la de A.
- typecheck del front limpio · \`next build\` OK · sin regresión de tipos en el back.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 5: Deploy — PEDIR CONFIRMACIÓN ANTES**

**No ejecutar sin un "sí" explícito del usuario.** Este cambio toca el front del inquilino (`myalquiler-inquilino`); si la Task 7 se ejecutó, también el back (migración del PR #27).

Al pedir la confirmación, informar: qué servicios se tocan, que la migración del PR #27 corre en el boot del back, y el número medido en la Task 6 Step 2 (propiedades que seguirán invisibles por falta de email).

Con confirmación:

```bash
cd ~/dev/myalq-multiprop
railway up --service myalquiler-inquilino --environment production --detach
```

Y si la Task 7 corrió, también:

```bash
cd ~/dev/myalq-multiprop
railway up --service myalquiler-back --environment production --detach
```

Expected: build OK; en los logs del back, la migración aplicada sin error. Verificar el health del back y que la PWA levante.

- [ ] **Step 6: Mergear el PR**

`railway up` deja prod adelante de main. Después de verificar el deploy:

```bash
cd ~/dev/myalq-multiprop
gh pr merge --merge
```

Expected: `MERGED`, main y prod reconciliados.
