# Aprobación de contratos configurable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una inmobiliaria pueda exigir que los contratos cargados por su equipo queden pendientes de aprobación, en vez de activarse solos.

**Architecture:** El flujo de aprobación ya existe completo (borrador → bandeja → aprobar con claim atómico y devengado). Este plan solo cambia **el disparador**: deja de ser el rol hardcodeado `CARGA` y pasa a derivarse de un flag por inmobiliaria más el permiso `contrato.aprobar` — quien puede aprobar no necesita aprobación. Además persiste los períodos anteriores en el borrador para aplicarlos al aprobar.

**Tech Stack:** pnpm monorepo · Fastify + Prisma + Postgres (`apps/api`) · Next 14 + TanStack Query (`apps/inmobiliaria`) · `packages/shared` (TS crudo, sin build).

## Global Constraints

- Worktree: `~/dev/myalq-aprobacion`, rama `feat/aprobacion-contratos-configurable`, base `origin/main` (867a607). Trabajar SOLO acá. `pnpm install` ya corrido.
- **El flag arranca APAGADO** (`@default(false)`): ninguna inmobiliaria existente cambia de comportamiento al deployar.
- **Prenderlo en la cuenta de un cliente es un write en producción** y NO se hace sin confirmación explícita del usuario.
- **NO** implementar avisos/notificaciones: está fuera de alcance del spec y anotado como riesgo conocido.
- Tests del back: `pnpm vitest run <archivo>` desde `apps/api`, SIEMPRE contra **Postgres local efímero**. NUNCA contra la DB remota/compartida.
- Binarios de Postgres NO están en el PATH: usar `/opt/homebrew/opt/postgresql@18/bin/<cmd>`.
- **Baseline de tipos = CERO, verificado el 27/07 en este worktree** (`apps/api` con `pnpm lint` y `apps/inmobiliaria` con `pnpm typecheck`, ambos en 0). Main se limpió en los commits de cazabug. Por lo tanto **cualquier error de tipo es una regresión** — no hay margen de errores preexistentes que tolerar.
- El puerto 3000 suele estar ocupado por otro proyecto del usuario (`palta-app-admin-onb`): **NO matarlo**. El `pnpm build` del front tiene guard de puerto → usar `rm -rf .next && npx next build`.
- Commits en español, imperativo, terminando con: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Deploy a Railway requiere confirmación explícita del usuario.

---

## Task 1: La regla pura + migración

Define la regla en `packages/shared` (testeable sin DB, y reusable por el front para el copy del alta) y agrega las dos columnas.

**Files:**
- Modify: `packages/shared/src/permisos.ts` (agregar función al final, antes de `GRUPO_LABEL`)
- Modify: `apps/api/prisma/schema.prisma` (modelos `Inmobiliaria` y `Contrato`)
- Create: `apps/api/prisma/migrations/<timestamp>_aprobacion_contratos_configurable/migration.sql` (la genera Prisma)
- Create: `apps/api/test/aprobacion-regla.test.ts`

**Interfaces:**
- Consumes: `requiereAprobacion(rol, capacidad)` y `rolTienePermiso(rol, capacidad)`, ambos ya existentes en `permisos.ts:131,142`.
- Produces: `contratoQuedaPendiente(rol: Rol, contratosRequierenAprobacion: boolean): boolean`, exportado desde `@llave/shared`. Lo consumen las Tasks 2 y 5.

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/api/test/aprobacion-regla.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { contratoQuedaPendiente } from '@llave/shared';

/**
 * La regla del disparador de aprobación. Es PURA (sin DB) a propósito: es la
 * decisión de negocio y tiene que poder testearse sin levantar nada.
 */
describe('contratoQuedaPendiente', () => {
  it('CARGA siempre queda pendiente, aunque el flag esté apagado (baseline del catálogo)', () => {
    expect(contratoQuedaPendiente('CARGA', false)).toBe(true);
    expect(contratoQuedaPendiente('CARGA', true)).toBe(true);
  });

  it('OPERADOR queda pendiente SOLO si la inmobiliaria lo pidió', () => {
    expect(contratoQuedaPendiente('OPERADOR', false)).toBe(false); // comportamiento de hoy
    expect(contratoQuedaPendiente('OPERADOR', true)).toBe(true);
  });

  it('ADMIN nunca queda pendiente: puede aprobar, así que no necesita aprobación', () => {
    expect(contratoQuedaPendiente('ADMIN', false)).toBe(false);
    expect(contratoQuedaPendiente('ADMIN', true)).toBe(false);
  });

  it('con el flag prendido y un solo ADMIN, no hay lockout posible', () => {
    // Si el único usuario que puede cargar es ADMIN y ADMIN está exento,
    // prender el flag nunca deja a la inmobiliaria sin poder dar de alta.
    expect(contratoQuedaPendiente('ADMIN', true)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd ~/dev/myalq-aprobacion/apps/api && npx vitest run test/aprobacion-regla.test.ts
```

Expected: FAIL — `contratoQuedaPendiente` no existe / no exporta.

- [ ] **Step 3: Implementar la regla**

En `packages/shared/src/permisos.ts`, agregar después de `requiereAprobacion` (línea ~146) y antes de `export const GRUPO_LABEL`:

```ts
/**
 * ¿El contrato que carga este rol queda PENDIENTE de aprobación?
 *
 * Dos fuentes se suman:
 *  1. El baseline del catálogo (`rolesAprobacion` de `contratos.crear` — hoy: CARGA).
 *  2. El switch de la inmobiliaria: si lo prendió, queda pendiente todo el que NO
 *     pueda aprobar. Derivar del permiso (y no de una lista de roles suelta) evita
 *     dos cosas: que la regla se desincronice de la matriz, y que alguien se deje
 *     afuera a sí mismo — quien aprueba nunca necesita que le aprueben.
 */
export function contratoQuedaPendiente(rol: Rol, contratosRequierenAprobacion: boolean): boolean {
  if (requiereAprobacion(rol, 'contratos.crear')) return true;
  return contratosRequierenAprobacion && !rolTienePermiso(rol, 'contrato.aprobar');
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
cd ~/dev/myalq-aprobacion/apps/api && npx vitest run test/aprobacion-regla.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Agregar las columnas al schema**

En `apps/api/prisma/schema.prisma`, dentro de `model Inmobiliaria` (después de `esPiloto`):

```prisma
  /**
   * Si está en true, los contratos cargados por quien NO tiene `contrato.aprobar`
   * quedan BORRADOR pendientes de aprobación en vez de activarse solos.
   * Default false: prenderlo es una decisión explícita de cada inmobiliaria.
   */
  contratosRequierenAprobacion Boolean @default(false)
```

Y dentro de `model Contrato` (junto a `pendienteAprobacion`):

```prisma
  /**
   * Estado inicial declarado en el alta (períodos ya vencidos: pagado / parcial /
   * adeuda), guardado mientras el contrato es BORRADOR. Se aplica al APROBARLO,
   * porque recién ahí existen las liquidaciones sobre las que impactar. Se limpia
   * al aplicarlo. Shape: PeriodoAnterior[] de lib/estado-inicial-contrato.ts.
   */
  periodosAnterioresPendientes Json?
```

- [ ] **Step 6: Generar la migración**

```bash
cd ~/dev/myalq-aprobacion/apps/api
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
export DATABASE_URL="postgresql://alannaimtapia@localhost:5432/myalq_aprob_dev"
dropdb --if-exists myalq_aprob_dev && createdb myalq_aprob_dev
npx prisma migrate dev --name aprobacion_contratos_configurable
```

Expected: crea `apps/api/prisma/migrations/<timestamp>_aprobacion_contratos_configurable/migration.sql` con dos `ALTER TABLE ... ADD COLUMN`. Verificar que el SQL sea SOLO aditivo (ningún `DROP`, ningún `NOT NULL` sin default sobre tabla con filas).

- [ ] **Step 7: Commit**

```bash
cd ~/dev/myalq-aprobacion
git add packages/shared/src/permisos.ts apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/test/aprobacion-regla.test.ts
git commit -m "feat(aprobacion): regla del disparador + columnas del flag y los períodos pendientes

La regla se deriva del permiso, no de un rol suelto: quien puede aprobar no
necesita aprobación, así no se desincroniza de la matriz ni hay lockout posible.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `core.ts` usa la regla y persiste los períodos

**Files:**
- Modify: `apps/api/src/routes/core.ts` (líneas 914-924, 994-995, 1054-1071, 1086-1088, 1093)
- Test: `apps/api/test/aprobacion-alta.test.ts` (crear)

**Interfaces:**
- Consumes: `contratoQuedaPendiente(rol, flag)` de la Task 1.
- Produces: `POST /contratos` deja el contrato en `BORRADOR` con `periodosAnterioresPendientes` cargado cuando corresponde. La Task 3 consume esa columna.

- [ ] **Step 1: Escribir el test de integración que falla**

Crear `apps/api/test/aprobacion-alta.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * El alta con el flag de aprobación prendido. Cubre lo que el unit puro no puede:
 * que el borrador NO reclame la propiedad, NO devengue, y que los períodos
 * anteriores queden guardados para aplicarse al aprobar.
 */
let app: FastifyInstance;
let prisma: PrismaClient;
let tokenOperador: string;
let inmobiliariaId: string;

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  inmobiliariaId = inmo.id;
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'luciana@delsol.com', password: 'delsol123' }, // OPERADOR del seed
  });
  tokenOperador = login.json().token;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const auth = () => ({ authorization: `Bearer ${tokenOperador}` });

async function propiedadLibre(nombre: string): Promise<string> {
  const propietario = await prisma.propietario.findFirstOrThrow({ where: { inmobiliariaId } });
  const p = await prisma.propiedad.create({
    data: {
      inmobiliariaId,
      direccion: `Test aprobación ${nombre}`,
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
      estado: 'DISPONIBLE',
    },
  });
  await prisma.participacionPropietario.create({
    data: { inmobiliariaId, propiedadId: p.id, propietarioId: propietario.id, porcentaje: 100 },
  });
  return p.id;
}

function altaBase(propiedadId: string, nombre: string) {
  return {
    propiedadId,
    inquilino: { nombre },
    monto: 100_000,
    fechaInicio: '2026-01-01',
    fechaFin: '2028-01-01',
    diaPago: 10,
    indiceAjuste: 'ICL',
    frecuenciaAjusteMeses: 12,
  };
}

describe('POST /contratos con aprobación configurable', () => {
  it('flag APAGADO: el OPERADOR activa directo (comportamiento de hoy, no regresión)', async () => {
    await prisma.inmobiliaria.update({
      where: { id: inmobiliariaId },
      data: { contratosRequierenAprobacion: false },
    });
    const propiedadId = await propiedadLibre('off');
    const res = await app.inject({
      method: 'POST', url: '/contratos', headers: auth(),
      payload: altaBase(propiedadId, 'Directo'),
    });
    expect(res.statusCode).toBeLessThan(300);
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: res.json().id } });
    expect(c.estado).toBe('ACTIVO');
    expect(c.pendienteAprobacion).toBe(false);
    const prop = await prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadId } });
    expect(prop.contratoActualId).toBe(c.id); // reclamó la propiedad
  });

  it('flag PRENDIDO: el OPERADOR deja borrador, sin reclamar la propiedad ni devengar, y con Aprobación en la bandeja', async () => {
    await prisma.inmobiliaria.update({
      where: { id: inmobiliariaId },
      data: { contratosRequierenAprobacion: true },
    });
    const propiedadId = await propiedadLibre('on');
    const res = await app.inject({
      method: 'POST', url: '/contratos', headers: auth(),
      payload: altaBase(propiedadId, 'Pendiente'),
    });
    expect(res.statusCode).toBeLessThan(300);
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: res.json().id } });
    expect(c.estado).toBe('BORRADOR');
    expect(c.pendienteAprobacion).toBe(true);
    const prop = await prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadId } });
    expect(prop.contratoActualId).toBeNull(); // NO reclamó
    expect(await prisma.liquidacion.count({ where: { contratoId: c.id } })).toBe(0); // NO devengó
    const apr = await prisma.aprobacion.findFirstOrThrow({ where: { entidadId: c.id } });
    expect(apr.tipo).toBe('CONTRATO_CARGADO');
    expect(apr.rolAutor).toBe('OPERADOR'); // el rol REAL, no 'CARGA' hardcodeado
  });

  it('flag PRENDIDO con períodos anteriores: ya no da 400, quedan guardados en el borrador', async () => {
    await prisma.inmobiliaria.update({
      where: { id: inmobiliariaId },
      data: { contratosRequierenAprobacion: true },
    });
    const propiedadId = await propiedadLibre('periodos');
    const res = await app.inject({
      method: 'POST', url: '/contratos', headers: auth(),
      payload: {
        ...altaBase(propiedadId, 'EnCurso'),
        periodosAnteriores: [{ periodo: '2026-01', estado: 'ADEUDA' }],
      },
    });
    expect(res.statusCode).toBeLessThan(300);
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: res.json().id } });
    expect(c.estado).toBe('BORRADOR');
    expect(c.periodosAnterioresPendientes).toEqual([{ periodo: '2026-01', estado: 'ADEUDA' }]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd ~/dev/myalq-aprobacion/apps/api
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
export DATABASE_URL="postgresql://alannaimtapia@localhost:5432/myalq_aprob_t2"
export JWT_SECRET="secreto-local-de-16-o-mas-chars"
export NODE_ENV=test
dropdb --if-exists myalq_aprob_t2 && createdb myalq_aprob_t2
npx prisma migrate deploy && npx prisma generate
npx vitest run test/aprobacion-alta.test.ts
```

Expected: FAIL — el 2º test da `ACTIVO` en vez de `BORRADOR` (el flag todavía no se lee) y el 3º da 400.

- [ ] **Step 3: Reemplazar el disparador y sacar el candado**

En `apps/api/src/routes/core.ts`, reemplazar las líneas 914-924:

```ts
    // CARGA carga contratos para REVISIÓN (permisos.ts: contratos.crear con
    // rolesAprobacion incluye CARGA): NO se activan solos. ADMIN/OPERADOR activan directo.
    const esCarga = u.rol === 'CARGA';
    // El BORRADOR de CARGA no devenga liquidaciones hasta la aprobación, así que
    // no hay períodos donde aplicar el estado inicial: lo rechazamos claro en vez
    // de descartarlo en silencio. (Extensión al flujo de aprobación: pendiente.)
    if (esCarga && d.periodosAnteriores?.length) {
      return reply.code(400).send({
        message: 'La carga para revisión no soporta períodos anteriores — pedile a un Admin/Operador que lo cargue',
      });
    }
```

por:

```ts
    // ¿Este contrato queda pendiente de aprobación? La regla vive en shared y se
    // deriva del PERMISO (contratoQuedaPendiente): el baseline del catálogo (CARGA)
    // más el switch de la inmobiliaria, que alcanza a todo el que no pueda aprobar.
    const inmoFlags = await prisma.inmobiliaria.findUnique({
      where: { id: u.inmobiliariaId },
      select: { contratosRequierenAprobacion: true },
    });
    const contratoPendiente = contratoQuedaPendiente(
      u.rol,
      inmoFlags?.contratosRequierenAprobacion ?? false,
    );
    // Los períodos anteriores YA NO se rechazan: el borrador los guarda y se aplican
    // al aprobar (plata.ts), cuando ya existen las liquidaciones sobre las que impactar.
    // Antes daban 400 y eso dejaba al equipo sin poder cargar la cartera en curso.
```

Y agregar `contratoQuedaPendiente` al import de `@llave/shared` que ya existe en el archivo (si no hay ninguno, agregar `import { contratoQuedaPendiente } from '@llave/shared';` junto a los demás imports del tope).

- [ ] **Step 4: Usar la nueva variable en los 4 lugares restantes**

En la misma `core.ts`:

1. Línea ~994-995, reemplazar:
```ts
          estado: esCarga ? 'BORRADOR' : 'ACTIVO',
          pendienteAprobacion: esCarga,
```
por:
```ts
          estado: contratoPendiente ? 'BORRADOR' : 'ACTIVO',
          pendienteAprobacion: contratoPendiente,
          // El estado inicial se guarda con el borrador y se aplica al aprobar.
          periodosAnterioresPendientes:
            contratoPendiente && d.periodosAnteriores?.length ? d.periodosAnteriores : undefined,
```

2. Línea ~1054, reemplazar `if (esCarga) {` por `if (contratoPendiente) {`

3. Línea ~1066, reemplazar `rolAutor: 'CARGA',` por:
```ts
            // El rol REAL de quien cargó (antes hardcodeaba 'CARGA' y con un
            // OPERADOR la bandeja mostraba un autor equivocado).
            rolAutor: u.rol as 'OPERADOR' | 'CARGA',
```

4. Línea ~1086-1088, reemplazar:
```ts
      if (d.periodosAnteriores?.length) {
        await aplicarEstadoInicial(tx, contrato, d.periodosAnteriores, u.userId);
      }
```
por:
```ts
      // Solo el camino que ACTIVA aplica el estado inicial acá; si quedó pendiente,
      // los períodos viajan en periodosAnterioresPendientes y los aplica la aprobación.
      if (d.periodosAnteriores?.length) {
        await aplicarEstadoInicial(tx, contrato, d.periodosAnteriores, u.userId);
      }
```
(el `if (contratoPendiente)` de arriba ya hizo `return contrato` antes de llegar acá, así que el bloque solo corre en el camino activo — el comentario documenta por qué no hace falta otra guarda)

5. Línea ~1093, reemplazar `if (emailInq && !esCarga) {` por `if (emailInq && !contratoPendiente) {`

- [ ] **Step 5: Correr el test y verificar que pasa**

```bash
cd ~/dev/myalq-aprobacion/apps/api
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
export DATABASE_URL="postgresql://alannaimtapia@localhost:5432/myalq_aprob_t2"
export JWT_SECRET="secreto-local-de-16-o-mas-chars"
export NODE_ENV=test
dropdb --if-exists myalq_aprob_t2 && createdb myalq_aprob_t2 && npx prisma migrate deploy
npx vitest run test/aprobacion-alta.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 6: Verificar que no hay regresión en el alta**

```bash
cd ~/dev/myalq-aprobacion/apps/api
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
export DATABASE_URL="postgresql://alannaimtapia@localhost:5432/myalq_aprob_core"
export JWT_SECRET="secreto-local-de-16-o-mas-chars"
export NODE_ENV=test
dropdb --if-exists myalq_aprob_core && createdb myalq_aprob_core && npx prisma migrate deploy
npx vitest run test/core.test.ts
```

Expected: PASS (el flag arranca apagado, así que el comportamiento por defecto no cambia).

- [ ] **Step 7: Commit**

```bash
cd ~/dev/myalq-aprobacion
git add apps/api/src/routes/core.ts apps/api/test/aprobacion-alta.test.ts
git commit -m "feat(aprobacion): el alta usa la regla del permiso y guarda los períodos del borrador

El disparador deja de ser el rol CARGA hardcodeado. Además la Aprobación
registra el rol REAL de quien cargó (antes decía siempre CARGA) y los períodos
anteriores dejan de dar 400: viajan en el borrador hasta la aprobación.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Al aprobar, aplicar los períodos guardados

**Files:**
- Modify: `apps/api/src/routes/plata.ts` (líneas 2043-2051 y el `.catch` de 2083-2090)
- Test: `apps/api/test/aprobacion-periodos.test.ts` (crear)

**Interfaces:**
- Consumes: `Contrato.periodosAnterioresPendientes` que escribe la Task 2.
- Produces: nada nuevo (cierra el circuito).

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/api/test/aprobacion-periodos.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * El circuito completo: un contrato EN CURSO cargado por el equipo queda pendiente
 * con sus períodos guardados, y al aprobarlo se activa, devenga y aplica el estado
 * inicial. Si los períodos se perdieran entre el borrador y la aprobación, la deuda
 * histórica del inquilino desaparecería sin aviso — por eso este test existe.
 */
let app: FastifyInstance;
let prisma: PrismaClient;
let tokenOperador: string;
let tokenAdmin: string;
let inmobiliariaId: string;

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  inmobiliariaId = inmo.id;
  await prisma.inmobiliaria.update({
    where: { id: inmobiliariaId },
    data: { contratosRequierenAprobacion: true },
  });
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tokenOperador = (await app.inject({
    method: 'POST', url: '/auth/login',
    payload: { email: 'luciana@delsol.com', password: 'delsol123' },
  })).json().token;
  tokenAdmin = (await app.inject({
    method: 'POST', url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  })).json().token;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('aprobar un contrato en curso', () => {
  it('activa, devenga y aplica los períodos anteriores que venían del borrador', async () => {
    const propietario = await prisma.propietario.findFirstOrThrow({ where: { inmobiliariaId } });
    const propiedad = await prisma.propiedad.create({
      data: {
        inmobiliariaId, direccion: 'Test aprobar en curso', ciudad: 'CABA',
        provincia: 'Buenos Aires', tipo: 'DEPARTAMENTO', estado: 'DISPONIBLE',
      },
    });
    await prisma.participacionPropietario.create({
      data: { inmobiliariaId, propiedadId: propiedad.id, propietarioId: propietario.id, porcentaje: 100 },
    });

    // Contrato que arrancó hace 3 meses → tiene períodos vencidos.
    const hoy = new Date();
    const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 3, 1));
    const periodoViejo = `${inicio.getUTCFullYear()}-${String(inicio.getUTCMonth() + 1).padStart(2, '0')}`;

    const alta = await app.inject({
      method: 'POST', url: '/contratos',
      headers: { authorization: `Bearer ${tokenOperador}` },
      payload: {
        propiedadId: propiedad.id,
        inquilino: { nombre: 'En Curso' },
        monto: 100_000,
        fechaInicio: inicio.toISOString().slice(0, 10),
        fechaFin: new Date(Date.UTC(inicio.getUTCFullYear() + 2, inicio.getUTCMonth(), 1)).toISOString().slice(0, 10),
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
        periodosAnteriores: [{ periodo: periodoViejo, estado: 'PAGADO' }],
      },
    });
    expect(alta.statusCode).toBeLessThan(300);
    const contratoId = alta.json().id;

    const apr = await prisma.aprobacion.findFirstOrThrow({ where: { entidadId: contratoId } });
    const res = await app.inject({
      method: 'POST', url: `/aprobaciones/${apr.id}/aprobar`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: { pin: '1234' },
    });
    expect(res.statusCode, res.body).toBe(200);

    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    expect(c.estado).toBe('ACTIVO');
    expect(c.periodosAnterioresPendientes).toBeNull(); // se consumieron

    const prop = await prisma.propiedad.findUniqueOrThrow({ where: { id: propiedad.id } });
    expect(prop.contratoActualId).toBe(contratoId); // reclamó la propiedad

    // El período declarado PAGADO quedó cerrado con su pago sintético.
    const liq = await prisma.liquidacion.findFirstOrThrow({
      where: { contratoId, periodo: periodoViejo },
    });
    expect(liq.estado).toBe('PAGADO');
    expect(await prisma.pago.count({ where: { liquidacionId: liq.id } })).toBe(1);
  });
});
```

Nota: `1234` es el `PIN_DEV` del seed (`apps/api/prisma/seed.ts:13`) y `delsol123` el `PASSWORD_DEV` (`:12`) — verificados, no hace falta buscarlos.

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd ~/dev/myalq-aprobacion/apps/api
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
export DATABASE_URL="postgresql://alannaimtapia@localhost:5432/myalq_aprob_t3"
export JWT_SECRET="secreto-local-de-16-o-mas-chars"
export NODE_ENV=test
dropdb --if-exists myalq_aprob_t3 && createdb myalq_aprob_t3 && npx prisma migrate deploy
npx vitest run test/aprobacion-periodos.test.ts
```

Expected: FAIL — la liquidación del período viejo queda `VENCIDO` (no se aplicó el estado inicial) y `periodosAnterioresPendientes` sigue cargado.

- [ ] **Step 3: Agregar los imports y el schema de validación**

En `apps/api/src/routes/plata.ts`, cerca de los demás imports del tope, agregar:

```ts
import { Prisma } from '@prisma/client';
import { aplicarEstadoInicial, EstadoInicialInvalido } from '../lib/estado-inicial-contrato.js';
```

(si alguno ya está importado, no duplicarlo)

Y antes del registro de las rutas de aprobaciones (arriba del `app.post(\`/aprobaciones/:id/${accion}\`)`), agregar:

```ts
/**
 * Re-validación del estado inicial guardado en el borrador. Ya fue validado por el
 * Zod de POST /contratos al cargarlo, pero es una columna Json: la volvemos a
 * validar antes de tocar plata, en vez de castearla a ciegas.
 */
const PeriodosAnterioresSchema = z.array(
  z.object({
    periodo: z.string().regex(/^\d{4}-\d{2}$/),
    estado: z.enum(['PAGADO', 'PARCIAL', 'ADEUDA']),
    montoPagado: z.number().positive().optional(),
    moraManual: z.number().nonnegative().optional(),
  }),
);
```

- [ ] **Step 4: Aplicar los períodos en la aprobación**

En `apps/api/src/routes/plata.ts`, reemplazar el bloque de las líneas 2043-2051:

```ts
          if (accion === 'aprobar') {
            const contratoActualizado = await tx.contrato.findUniqueOrThrow({ where: { id: apr.entidadId } });
            const claim = await tx.propiedad.updateMany({
              where: { id: contratoActualizado.propiedadId, inmobiliariaId: u.inmobiliariaId, contratoActualId: null },
              data: { contratoActualId: contratoActualizado.id, estado: 'ALQUILADA' },
            });
            if (claim.count === 0) throw new Error('PROP_OCUPADA');
            await generarLiquidacionesContrato(tx, contratoActualizado);
          }
```

por:

```ts
          if (accion === 'aprobar') {
            const contratoActualizado = await tx.contrato.findUniqueOrThrow({ where: { id: apr.entidadId } });
            const claim = await tx.propiedad.updateMany({
              where: { id: contratoActualizado.propiedadId, inmobiliariaId: u.inmobiliariaId, contratoActualId: null },
              data: { contratoActualId: contratoActualizado.id, estado: 'ALQUILADA' },
            });
            if (claim.count === 0) throw new Error('PROP_OCUPADA');
            await generarLiquidacionesContrato(tx, contratoActualizado);
            // Estado inicial del contrato EN CURSO: el alta lo guardó en el borrador
            // porque todavía no había liquidaciones donde impactarlo. Recién ahora,
            // devengado, se aplica — en la MISMA transacción que la activación: o
            // queda todo el estado inicial o no queda nada.
            const pendientes = PeriodosAnterioresSchema.safeParse(
              contratoActualizado.periodosAnterioresPendientes,
            );
            if (pendientes.success && pendientes.data.length > 0) {
              await aplicarEstadoInicial(tx, contratoActualizado, pendientes.data, u.userId);
              await tx.contrato.update({
                where: { id: contratoActualizado.id },
                data: { periodosAnterioresPendientes: Prisma.DbNull },
              });
            }
          }
```

- [ ] **Step 5: Mapear el error del estado inicial a un 400 claro**

En el `.catch` de la línea ~2083, agregar el mapeo antes del `throw e`:

```ts
      }).catch((e: unknown) => {
        // PROP_OCUPADA: al aprobar, la propiedad ya fue reclamada por otro contrato
        // (carrera o un segundo BORRADOR sobre la misma propiedad). El throw hizo
        // rollback TOTAL → la aprobación vuelve a PENDIENTE. Lo mapeamos a 409 acá
        // porque el handler global no mapea un Error genérico (caería en 500).
        if (e instanceof Error && e.message === 'PROP_OCUPADA') return { http: 409 as const, motivo: 'PROP_OCUPADA' as const };
        // Estado inicial inconsistente (período que no existe, parcial sin monto…):
        // 400 con el detalle, igual que hace POST /contratos. La transacción ya
        // revirtió, así que la aprobación sigue PENDIENTE y se puede reintentar.
        if (e instanceof EstadoInicialInvalido) return { http: 400 as const, mensaje: e.message };
        throw e;
      });
      if (result.http === 400) return reply.code(400).send({ message: result.mensaje });
      if (result.http === 404) return reply.code(404).send({ message: 'Aprobación inexistente' });
```

- [ ] **Step 6: Correr el test y verificar que pasa**

```bash
cd ~/dev/myalq-aprobacion/apps/api
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
export DATABASE_URL="postgresql://alannaimtapia@localhost:5432/myalq_aprob_t3"
export JWT_SECRET="secreto-local-de-16-o-mas-chars"
export NODE_ENV=test
dropdb --if-exists myalq_aprob_t3 && createdb myalq_aprob_t3 && npx prisma migrate deploy
npx vitest run test/aprobacion-periodos.test.ts
```

Expected: PASS.

- [ ] **Step 7: Verificar que no hay regresión en plata**

```bash
cd ~/dev/myalq-aprobacion/apps/api
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
export DATABASE_URL="postgresql://alannaimtapia@localhost:5432/myalq_aprob_plata"
export JWT_SECRET="secreto-local-de-16-o-mas-chars"
export NODE_ENV=test
dropdb --if-exists myalq_aprob_plata && createdb myalq_aprob_plata && npx prisma migrate deploy
npx vitest run test/plata.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd ~/dev/myalq-aprobacion
git add apps/api/src/routes/plata.ts apps/api/test/aprobacion-periodos.test.ts
git commit -m "feat(aprobacion): al aprobar se aplica el estado inicial guardado en el borrador

Cierra el circuito del contrato en curso: el alta guarda los períodos y la
aprobación los aplica ya devengado, en la misma transacción que la activación.
El estado inicial inconsistente mapea a 400 en vez de caer en 500.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Exponer el flag en la API de configuración

**Files:**
- Modify: `apps/api/src/routes/operacion.ts` (GET líneas 1833-1863; agregar PUT nuevo después de la línea 1889)

**Interfaces:**
- Consumes: la columna de la Task 1.
- Produces: `GET /mi-inmobiliaria/reglas` devuelve `aprobaciones: { contratosRequierenAprobacion: boolean }`; `PUT /mi-inmobiliaria/aprobaciones` con body `{ contratosRequierenAprobacion: boolean }`. La Task 5 los consume.

- [ ] **Step 1: Agregar el flag al GET**

En `apps/api/src/routes/operacion.ts`, en el `select` de la línea ~1835:

```ts
      select: {
        preavisoRescisionMesesDefault: true,
        penalidadRescisionMesesDefault: true,
        esPiloto: true,
        mesesGratisGanados: true,
        contratosRequierenAprobacion: true,
      },
```

Y en el `return` de la línea ~1851, agregar el grupo nuevo antes de `plan`:

```ts
      aprobaciones: { contratosRequierenAprobacion: i.contratosRequierenAprobacion },
      plan: { esPiloto: i.esPiloto, mesesGratisGanados: i.mesesGratisGanados },
```

- [ ] **Step 2: Agregar el PUT**

Después del cierre del `app.put('/mi-inmobiliaria/rescision', ...)` (línea ~1889), agregar:

```ts
  // Switch: ¿los contratos que carga el equipo requieren aprobación del admin?
  // El disparador real vive en contratoQuedaPendiente (shared): quien puede
  // aprobar queda exento, así que prenderlo nunca deja a nadie sin poder cargar.
  app.put('/mi-inmobiliaria/aprobaciones', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    if (u.rol !== 'ADMIN') return reply.code(403).send({ message: 'Necesitás permiso de Admin para editar esta sección' });
    const body = z
      .object({ contratosRequierenAprobacion: z.boolean() })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Valor inválido' });
    await prisma.inmobiliaria.update({
      where: { id: u.inmobiliariaId },
      data: { contratosRequierenAprobacion: body.data.contratosRequierenAprobacion },
    });
    return { contratosRequierenAprobacion: body.data.contratosRequierenAprobacion };
  });
```

- [ ] **Step 3: Verificar los tipos del back**

```bash
cd ~/dev/myalq-aprobacion/apps/api && pnpm lint 2>&1 | grep -c "error TS"
```

Expected: **0**. El baseline es cero (verificado), así que cualquier error es una regresión de esta tarea: corregirla antes de seguir.

- [ ] **Step 4: Commit**

```bash
cd ~/dev/myalq-aprobacion
git add apps/api/src/routes/operacion.ts
git commit -m "feat(aprobacion): exponer el switch en la API de Mi Inmobiliaria

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: El switch en el panel y el copy del alta

**Files:**
- Modify: `apps/inmobiliaria/src/lib/api/use-mi-inmobiliaria.ts`
- Modify: `apps/inmobiliaria/src/app/(app)/mi-inmobiliaria/page.tsx`
- Modify: `apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx` (mensaje de éxito)

**Interfaces:**
- Consumes: `GET /mi-inmobiliaria/reglas` y `PUT /mi-inmobiliaria/aprobaciones` de la Task 4.
- Produces: nada nuevo.

- [ ] **Step 1: Extender el hook**

En `apps/inmobiliaria/src/lib/api/use-mi-inmobiliaria.ts`, agregar el campo a la interface:

```ts
export interface ReglasMiInmobiliaria {
  rescision: { preavisoMeses: number; penalidadMeses: number };
  comision: {
    propietarios: number;
    promedioPct: number | null;
    minPct: number | null;
    maxPct: number | null;
  };
  aprobaciones: { contratosRequierenAprobacion: boolean };
  plan: { esPiloto: boolean; mesesGratisGanados: number };
}
```

Y agregar el setter al final del archivo, calcando `setRescisionDefault`:

```ts
/** Prende o apaga la aprobación obligatoria de contratos del equipo. Solo ADMIN. */
export async function setContratosRequierenAprobacion(
  valor: boolean,
): Promise<{ contratosRequierenAprobacion: boolean }> {
  await ensureApiSession();
  return apiFetch('/mi-inmobiliaria/aprobaciones', {
    method: 'PUT',
    body: JSON.stringify({ contratosRequierenAprobacion: valor }),
  });
}
```

- [ ] **Step 2: Agregar la card en Mi Inmobiliaria**

En `apps/inmobiliaria/src/app/(app)/mi-inmobiliaria/page.tsx`, agregar `setContratosRequierenAprobacion` al import de `use-mi-inmobiliaria` (donde ya está `setRescisionDefault`), agregar `ShieldCheck` al import de `lucide-react`, y agregar este componente junto a `RescisionCard`:

```tsx
// ===== Aprobación de contratos del equipo =====
function AprobacionContratosCard({ reglas }: { reglas: ReglasMiInmobiliaria | null }) {
  const qc = useQueryClient();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!reglas) return null;
  const activo = reglas.aprobaciones.contratosRequierenAprobacion;

  const cambiar = async (valor: boolean) => {
    setError(null);
    setGuardando(true);
    try {
      await setContratosRequierenAprobacion(valor);
      toast({
        variant: 'success',
        title: valor
          ? 'Los contratos del equipo van a quedar pendientes de tu aprobación'
          : 'Los contratos del equipo se activan directo',
      });
      await qc.invalidateQueries({ queryKey: ['mi-inmobiliaria-reglas'] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar el cambio.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Aprobación de contratos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={activo}
            disabled={guardando}
            onChange={(e) => void cambiar(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          />
          <span className="text-sm">
            Los contratos que carga el equipo requieren mi aprobación
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Quedan pendientes en la bandeja y no se activan —ni reclaman la propiedad, ni
              generan cuotas— hasta que los apruebes. Vos y cualquiera que pueda aprobar
              siguen cargando directo.
            </span>
          </span>
        </label>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

Y renderizarla en el layout: en la línea **81** está `<RescisionCard reglas={reglas} />` (entre `<ComisionCard>` de la 79 y `<PlanCard>` de la 89). Agregar inmediatamente después de la 81:

```tsx
            <AprobacionContratosCard reglas={reglas} />
```

- [ ] **Step 3: Corregir el mensaje de éxito del alta**

En `apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx` hay tres cambios puntuales.

1. La interface (líneas 687-689) hoy es solo el id. `POST /contratos` devuelve el contrato completo, así que alcanza con declarar el campo:

```tsx
interface ContratoNuevoApi {
  id: string;
  /** 'BORRADOR' cuando quedó pendiente de aprobación; 'ACTIVO' cuando se activó. */
  estado?: string;
}
```

2. Justo después del `apiFetch` del alta (línea ~1163), derivar el estado:

```tsx
      const creado = await apiFetch<ContratoNuevoApi>('/contratos', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      // El contrato puede haber quedado PENDIENTE de aprobación: hay que decirlo, en
      // vez de afirmar que se activó. Antes el copy mentía cuando la inmobiliaria
      // tenía prendida la aprobación obligatoria.
      const quedoPendiente = creado.estado === 'BORRADOR';
```

3. Reemplazar el `toast` de éxito (está después del `setConfirmando(false)`, ~línea 1197):

```tsx
      toast({
        variant: dniFallo ? 'default' : 'success',
        title: 'Contrato dado de alta',
        description: dniFallo
          ? 'Se creó el contrato, pero no pudimos subir alguna foto del DNI. Cargalas desde el detalle.'
          : 'Generamos la primera liquidación y la propiedad pasó a alquilada.',
      });
```

por:

```tsx
      toast({
        variant: dniFallo ? 'default' : 'success',
        title: quedoPendiente ? 'Contrato cargado — queda pendiente de aprobación' : 'Contrato dado de alta',
        description: dniFallo
          ? 'Se creó el contrato, pero no pudimos subir alguna foto del DNI. Cargalas desde el detalle.'
          : quedoPendiente
            ? 'Un Admin tiene que aprobarlo. Hasta entonces no genera cuotas ni ocupa la propiedad.'
            : 'Generamos la primera liquidación y la propiedad pasó a alquilada.',
      });
```

- [ ] **Step 4: Verificar tipos y build del front**

```bash
cd ~/dev/myalq-aprobacion/apps/inmobiliaria && pnpm typecheck
```
Expected: exit 0.

```bash
cd ~/dev/myalq-aprobacion/apps/inmobiliaria && rm -rf .next && npx next build
```
Expected: `✓ Compiled successfully` y las páginas generadas sin errores.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/myalq-aprobacion
git add apps/inmobiliaria/src/lib/api/use-mi-inmobiliaria.ts "apps/inmobiliaria/src/app/(app)/mi-inmobiliaria/page.tsx" "apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx"
git commit -m "feat(aprobacion): switch en Mi Inmobiliaria y copy honesto en el alta

El alta ya no afirma que el contrato se activó cuando quedó pendiente.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Verificación end-to-end, PR y deploy

**Files:** ninguno.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la feature lista para producción.

- [ ] **Step 1: Correr toda la batería de tests de esta feature**

```bash
cd ~/dev/myalq-aprobacion/apps/api
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
export DATABASE_URL="postgresql://alannaimtapia@localhost:5432/myalq_aprob_final"
export JWT_SECRET="secreto-local-de-16-o-mas-chars"
export NODE_ENV=test
dropdb --if-exists myalq_aprob_final && createdb myalq_aprob_final && npx prisma migrate deploy
npx vitest run test/aprobacion-regla.test.ts
npx vitest run test/aprobacion-alta.test.ts
npx vitest run test/aprobacion-periodos.test.ts
```

Expected: los tres archivos en verde. (Correr por archivo: el suite completo junto contamina entre archivos porque comparten DB.)

- [ ] **Step 2: Recorrido E2E en el navegador**

Levantar el stack contra la DB local y recorrer:

```bash
# API
cd ~/dev/myalq-aprobacion/apps/api
DATABASE_URL="postgresql://alannaimtapia@localhost:5432/myalq_aprob_final" \
JWT_SECRET="secreto-local-de-16-o-mas-chars" NODE_ENV=development DEMO_MODE=true PORT=3007 \
npx tsx src/index.ts

# Panel (3000 suele estar ocupado por otro proyecto: NO lo mates)
cd ~/dev/myalq-aprobacion/apps/inmobiliaria
NEXT_PUBLIC_API_URL=http://localhost:3007 npx next dev -p 3051
```

Recorrido, con login `roberto@delsol.com` / `delsol123` (ADMIN) y `luciana@delsol.com` / `delsol123` (OPERADOR):

1. Como ADMIN, ir a **Mi Inmobiliaria** → la card "Aprobación de contratos" aparece, desmarcada.
2. Marcarla → toast de confirmación. Recargar: sigue marcada (persistió).
3. Como **OPERADOR**, cargar un contrato → el mensaje dice que **queda pendiente de aprobación**.
4. Verificar que la propiedad **no** quedó ALQUILADA y el contrato no tiene cuotas.
5. Como ADMIN, ir a la bandeja de **Aprobaciones** (dentro de Pagos) → el contrato figura con el autor correcto.
6. Aprobarlo → el contrato pasa a ACTIVO, la propiedad queda ALQUILADA y aparecen las cuotas.
7. Apagar el switch y repetir el paso 3: el contrato del OPERADOR **se activa directo** (no regresión).

Transcribir en el reporte los textos exactos vistos.

- [ ] **Step 3: Verificar que no hay regresión de tipos en el back**

```bash
cd ~/dev/myalq-aprobacion/apps/api && pnpm lint 2>&1 | grep -c "error TS"
cd ~/dev/myalq-aprobacion/apps/inmobiliaria && pnpm typecheck 2>&1 | grep -c "error TS"
```
Expected: **0 en los dos**.

- [ ] **Step 4: Push y PR**

```bash
cd ~/dev/myalq-aprobacion
git push -u origin feat/aprobacion-contratos-configurable
gh pr create --base main --head feat/aprobacion-contratos-configurable \
  --title "feat(contratos): aprobación configurable por inmobiliaria" \
  --body "Ver docs/superpowers/specs/2026-07-27-aprobacion-contratos-configurable-design.md

## Qué resuelve
Camila pidió que los contratos que carga su equipo queden pendientes de su aprobación. El flujo de aprobación **ya existía completo**, pero el disparador estaba cableado al rol \`CARGA\` — y en producción **nadie tiene ese rol**: la bandeja de aprobaciones estaba vacía y el contrato que ella reportó lo cargó un OPERADOR, que activa directo.

## Cómo
- Flag \`contratosRequierenAprobacion\` por inmobiliaria (**default apagado**: nadie cambia de comportamiento al deployar).
- La regla se deriva del permiso (\`contratoQuedaPendiente\` en shared): **quien puede aprobar no necesita aprobación** → no se desincroniza de la matriz y no hay lockout posible.
- El backend pasa a usar \`requiereAprobacion()\` de shared, que ya existía y no llamaba nadie: hoy la pantalla de permisos muestra una regla que el servidor no aplica.
- Los períodos anteriores dejan de dar 400 en el borrador: se guardan y se aplican al aprobar (la cartera de Camila es casi toda contratos en curso).
- La Aprobación registra el rol REAL de quien cargó (antes decía siempre \`CARGA\`).

## Verificación
4 tests unitarios de la regla + 3 de integración del alta + 1 del circuito completo de aprobación con períodos anteriores. Sin regresión en \`core\` ni \`plata\`. Recorrido E2E en el navegador.

**Migración aditiva** (dos columnas con default/nullable).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 5: Deploy — PEDIR CONFIRMACIÓN ANTES**

**No ejecutar sin un "sí" explícito del usuario.** Toca back (migración) y front.

Al pedir la confirmación, informar: que la migración corre en el boot del back, que es aditiva, y que **el flag arranca apagado — ninguna inmobiliaria cambia de comportamiento hasta prenderlo**.

Con confirmación:

```bash
cd ~/dev/myalq-aprobacion
railway up --service myalquiler-back --environment production --detach
railway up --service myalquiler-front --environment production --detach
```

Verificar en los logs del back que la migración aplicó y que el server levantó.

- [ ] **Step 6: Mergear el PR**

`railway up` deja prod adelante de main. Después de verificar el deploy:

```bash
cd ~/dev/myalq-aprobacion && gh pr merge --merge
```

- [ ] **Step 7: Prender el flag para Camila — PEDIR CONFIRMACIÓN**

**Es un write en producción sobre la cuenta de un cliente: NO se hace sin autorización explícita.**

Cuando el usuario lo autorice, prender el flag SOLO para la inmobiliaria de Camila (`AyV alquileres y ventas`) y avisarle a ella que el cambio está activo. Sin este paso, la feature está deployada pero **no cambia nada** para ella.
