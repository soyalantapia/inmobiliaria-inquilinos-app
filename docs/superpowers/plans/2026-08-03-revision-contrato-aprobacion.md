# Revisión del contrato antes de aprobar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la administración pueda ver el contrato completo — incluida la deuda histórica declarada y qué va a pasar al aprobar — y decidir desde ahí, con comentario.

**Architecture:** El preview lo calcula el **servidor**, reusando `computarLiquidacionesContrato()`, que es la **función pura que ya genera las liquidaciones reales**. No se reimplementa aritmética de plata en ningún lado. `GET /contratos/:id` suma un campo `revisionAprobacion` solo cuando el contrato está pendiente; el front lo pinta y decide contra el endpoint de aprobación que ya existe.

**Tech Stack:** pnpm monorepo · `apps/api` Fastify + Prisma + Postgres + vitest · `apps/inmobiliaria` Next 14 · `packages/shared` TS crudo sin build.

**Spec:** `docs/superpowers/specs/2026-08-03-revision-contrato-aprobacion-design.md`

## Global Constraints

- **Worktree:** `~/dev/myalq-revision`, rama `feat/revision-contrato-aprobacion`, base `origin/main` = `2e8d4a4`.
- **Nunca push ni merge a `main`.** Se trabaja en la rama y se abre PR.
- **Tests SIEMPRE contra Postgres local efímero. NUNCA la base remota/compartida.** El `apps/api/.env` del repo principal apunta a **producción**.
- **Baseline de typecheck: 0 errores** en `pnpm --filter api lint` y `pnpm --filter inmobiliaria typecheck`. Si Prisma se queja, `cd apps/api && pnpm db:generate`.
- **La suite de `apps/api` tiene 5 fallas preexistentes**: 4 de conteo del seed en `core.test.ts` (contratos, propiedades, propietarios, inquilinos) y 1 en `multi-alquiler.test.ts`. **No son regresión.** Para compararlas hay que correr la suite **completa** — en aislamiento esos tests pasan.
- **El front NO tiene runner de tests** (no hay vitest/jest en `apps/inmobiliaria`). Se verifica con `tsc --noEmit` y navegador. No inventar `pnpm test` ahí.
- 🔴 **El flag `contratosRequierenAprobacion` está PRENDIDO en producción para `AyV alquileres y ventas`.** Cualquier regresión de este flujo pega en un cliente real.
- 🔴 **No reimplementar el cálculo de montos.** Todo lo que anuncie plata sale de `computarLiquidacionesContrato()`.
- 🔴 **El PIN está eliminado de la plataforma**: `verificarPinUsuario` devuelve `{ ok: true }` incondicional (`apps/api/src/auth/pin.ts:12`). No revivirlo ni escribir copy que lo prometa.
- **No se toca** el flujo de aprobación de los otros tres tipos (`GASTO_CAJA_ELIMINACION`, `DEVOLUCION_DEPOSITO`, `AJUSTE_FUERA_DE_INDICE`).
- Copy en **español rioplatense**, tuteo.

---

## File Structure

| Archivo | Responsabilidad | Tareas |
|---|---|---|
| `apps/api/src/lib/revision-aprobacion.ts` | **(nuevo)** función pura que arma el resumen de "qué va a pasar al aprobar" | 1 |
| `apps/api/test/revision-aprobacion.test.ts` | **(nuevo)** el preview coincide con lo aplicado | 1 |
| `apps/api/src/routes/core.ts` | `GET /contratos/:id` expone `revisionAprobacion` | 1 |
| `apps/api/src/routes/plata.ts` | el rechazo deja de borrar `periodosAnterioresPendientes` | 2 |
| `apps/api/test/rechazo-conserva-periodos.test.ts` | **(nuevo)** el dato sobrevive y no se puede aplicar | 2 |
| `apps/inmobiliaria/src/app/(app)/contratos/[id]/page-client.tsx` | la tarjeta muestra el detalle y decide de verdad | 3 |
| `apps/inmobiliaria/src/components/bandeja-aprobaciones.tsx` | para contratos, un botón que lleva al detalle | 4 |

---

## Task 1: El servidor calcula qué va a pasar al aprobar

**Files:**
- Create: `apps/api/src/lib/revision-aprobacion.ts`
- Create: `apps/api/test/revision-aprobacion.test.ts`
- Modify: `apps/api/src/routes/core.ts` (`GET /contratos/:id`, handler en `:182`, el `return` en `:224`)

**Interfaces:**
- Consumes: `computarLiquidacionesContrato(contrato, now, vigencias?)` de `apps/api/src/lib/liquidaciones.ts` — **función pura** que devuelve `Prisma.LiquidacionCreateManyInput[]`, exactamente las liquidaciones que `generarLiquidacionesContrato` va a crear. Y el tipo `PeriodoAnterior` de `apps/api/src/lib/estado-inicial-contrato.ts`.
- Produces: `resumenRevisionAprobacion(contrato, periodos, now)` → el objeto `revisionAprobacion` (sin `aprobacionId`, que lo agrega la ruta). Lo consume el front en la Tarea 3.

**Contexto que el implementador necesita:**

Un contrato pendiente está en estado `BORRADOR` y **todavía no tiene liquidaciones**: no se devengan hasta aprobar (`core.ts:1050`). La deuda declarada en el alta vive en `Contrato.periodosAnterioresPendientes` (Json). Al aprobar, `generarLiquidacionesContrato` crea las cuotas y después `aplicarEstadoInicial` las marca.

Por eso el preview **no puede leer montos de liquidaciones que no existen**: tiene que computarlas. `computarLiquidacionesContrato` hace exactamente eso y es pura — la misma que después se ejecuta.

Semántica que hay que respetar (`estado-inicial-contrato.ts:85-108`):
- **PAGADO** → pago sintético por el **total** del período. Todo va a conciliado.
- **PARCIAL** → pago sintético por `montoPagado`; la liquidación queda PARCIAL. **`montoPagado` va a conciliado y el remanente (`total - montoPagado`) a deuda.** El período cuenta en los dos lados.
- **ADEUDA** → sin pago; el **total** va a deuda.
- `moraManual`, cuando viene, suma a la mora (y pisa el cálculo del esquema).

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/api/test/revision-aprobacion.test.ts`. Copiar el andamiaje (`beforeAll`/`afterAll`/`auth`) de `apps/api/test/alta-contrato-integracion.test.ts:1-40`: mismo `seedBase`, misma `buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' })`.

Necesitás **dos** tokens: uno de `camila@delsol.com` (rol **CARGA** — sus contratos quedan pendientes) y uno de `roberto@delsol.com` (**ADMIN**, que revisa). La password de ambos en el seed es `delsol123`.

```ts
/**
 * El preview de "qué va a pasar al aprobar" no puede mentir: se compara contra
 * lo que efectivamente queda después de aprobar. Si divergen, la pantalla de
 * control estaría anunciando una cosa y el sistema haciendo otra — y lo que se
 * anuncia es plata que el sistema da por cobrada.
 */
it('el preview coincide con lo que realmente se aplica al aprobar', async () => {
  const hoy = new Date();
  const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 4, 1));
  const fin = new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1));
  const per = (n: number) => {
    const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  // Lo carga CARGA => queda BORRADOR + pendienteAprobacion
  const alta = await app.inject({
    method: 'POST',
    url: '/contratos',
    headers: { authorization: `Bearer ${tokenCarga}` },
    payload: {
      propiedadId: await propiedadDisponible(),
      inquilino: { nombre: 'Revision', apellido: 'Preview' },
      monto: 100000,
      montoExpensas: 20000,
      tipoContrato: 'ALQUILER_Y_EXPENSAS',
      fechaInicio: inicio.toISOString(),
      fechaFin: fin.toISOString(),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
      periodosAnteriores: [
        { periodo: per(4), estado: 'PAGADO' },
        { periodo: per(3), estado: 'PARCIAL', montoPagado: 50000 },
        { periodo: per(2), estado: 'ADEUDA' },
      ],
    },
  });
  expect(alta.statusCode).toBe(201);
  const contratoId = alta.json().id as string;

  // 1) El ADMIN lee el preview
  const det = await app.inject({
    method: 'GET',
    url: `/contratos/${contratoId}`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  expect(det.statusCode).toBe(200);
  const rev = det.json().revisionAprobacion;
  expect(rev).toBeTruthy();
  expect(rev.aprobacionId).toEqual(expect.any(String));
  expect(rev.periodosDeclarados).toHaveLength(3);

  // 2) Se aprueba
  const ap = await app.inject({
    method: 'POST',
    url: `/aprobaciones/${rev.aprobacionId}/aprobar`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { comentario: 'Revisado, va' },
  });
  expect(ap.statusCode).toBe(200);

  // 3) Lo anunciado tiene que coincidir con lo aplicado
  const prisma = new PrismaClient();
  const liqs = await prisma.liquidacion.findMany({ where: { contratoId } });
  const pagos = await prisma.pago.findMany({ where: { contratoId } });
  await prisma.$disconnect();

  expect(liqs).toHaveLength(rev.alAprobar.cuotasAGenerar);

  const conciliadoReal = pagos.reduce((s, p) => s + Number(p.monto), 0);
  expect(conciliadoReal).toBeCloseTo(rev.alAprobar.conciliado.monto, 2);

  // El total del período PAGADO (120000) + lo pagado del PARCIAL (50000)
  expect(rev.alAprobar.conciliado.monto).toBeCloseTo(170000, 2);
  // El remanente del PARCIAL (120000-50000) + el total del ADEUDA (120000)
  expect(rev.alAprobar.deudaInicial.capital).toBeCloseTo(190000, 2);
});

it('un contrato ya activo no trae revisionAprobacion', async () => {
  const hoy = new Date();
  const alta = await app.inject({
    method: 'POST',
    url: '/contratos',
    headers: { authorization: `Bearer ${tokenAdmin}` }, // ADMIN activa directo
    payload: {
      propiedadId: await propiedadDisponible(),
      inquilino: { nombre: 'Sin', apellido: 'Revision' },
      monto: 100000,
      fechaInicio: new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1)).toISOString(),
      fechaFin: new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1)).toISOString(),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
    },
  });
  const det = await app.inject({
    method: 'GET',
    url: `/contratos/${alta.json().id}`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  expect(det.json().revisionAprobacion).toBeUndefined();
});
```

Con el helper (una propiedad por test — el alta la deja ALQUILADA o reservada):

```ts
async function propiedadDisponible(): Promise<string> {
  const res = await app.inject({
    method: 'GET',
    url: '/propiedades?estado=DISPONIBLE',
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  const lista = res.json();
  const items = Array.isArray(lista) ? lista : lista.items;
  if (!items?.length) throw new Error('El seed no dejó propiedades DISPONIBLE para el test');
  return items[0].id;
}
```

⚠️ Si el seed no deja suficientes propiedades DISPONIBLE para los dos tests, creá las que falten con `POST /propiedades` en el `beforeAll` en vez de bajar las expectativas del test.

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd ~/dev/myalq-revision/apps/api && pnpm vitest run test/revision-aprobacion.test.ts
```

Esperado: **FAIL** — `revisionAprobacion` es `undefined`, el `expect(rev).toBeTruthy()` no pasa.

- [ ] **Step 3: Escribir la función pura**

Crear `apps/api/src/lib/revision-aprobacion.ts`:

```ts
import { computarLiquidacionesContrato, type ContratoParaLiquidar } from './liquidaciones.js';
import type { PeriodoAnterior } from './estado-inicial-contrato.js';

export type RevisionAprobacion = {
  periodosDeclarados: PeriodoAnterior[];
  alAprobar: {
    cuotasAGenerar: number;
    rangoCuotas: { desde: string; hasta: string } | null;
    conciliado: { periodos: number; monto: number };
    deudaInicial: { periodos: number; capital: number; mora: number };
  };
};

/**
 * Resumen de lo que va a pasar cuando se apruebe un contrato que está en BORRADOR.
 *
 * 🔴 Las cuotas salen de `computarLiquidacionesContrato`, la MISMA función pura que
 * `generarLiquidacionesContrato` usa para crearlas de verdad. No se recalcula ningún
 * monto acá: si el número que se muestra saliera de otro lado, podría divergir del
 * que se ejecuta.
 *
 * Un período PARCIAL cuenta en los DOS lados: lo pagado va a `conciliado` y el
 * remanente a `deudaInicial`. `periodos` de cada lado NO son conjuntos disjuntos.
 */
export function resumenRevisionAprobacion(
  contrato: ContratoParaLiquidar,
  periodos: PeriodoAnterior[],
  now: Date,
): RevisionAprobacion {
  const futuras = computarLiquidacionesContrato(contrato, now);
  const totalPorPeriodo = new Map(futuras.map((l) => [l.periodo, Number(l.montoTotal)]));

  let conciliadoMonto = 0;
  let conciliadoPeriodos = 0;
  let deudaCapital = 0;
  let deudaPeriodos = 0;
  let deudaMora = 0;

  for (const p of periodos) {
    const total = totalPorPeriodo.get(p.periodo);
    // Un período declarado que el devengo no genera es el bug i36: no lo inventamos,
    // lo salteamos — aplicarEstadoInicial lo va a rechazar con 400 al aprobar.
    if (total == null) continue;
    if (p.moraManual != null) deudaMora += Math.max(0, p.moraManual);

    if (p.estado === 'PAGADO') {
      conciliadoMonto += total;
      conciliadoPeriodos += 1;
    } else if (p.estado === 'PARCIAL') {
      const pagado = p.montoPagado ?? 0;
      conciliadoMonto += pagado;
      conciliadoPeriodos += 1;
      deudaCapital += Math.max(0, total - pagado);
      deudaPeriodos += 1;
    } else {
      deudaCapital += total;
      deudaPeriodos += 1;
    }
  }

  return {
    periodosDeclarados: periodos,
    alAprobar: {
      cuotasAGenerar: futuras.length,
      rangoCuotas: futuras.length
        ? { desde: futuras[0].periodo, hasta: futuras[futuras.length - 1].periodo }
        : null,
      conciliado: { periodos: conciliadoPeriodos, monto: conciliadoMonto },
      deudaInicial: { periodos: deudaPeriodos, capital: deudaCapital, mora: deudaMora },
    },
  };
}
```

✅ Verificado: `ContratoParaLiquidar` ya está exportado (`liquidaciones.ts:6`) y todos sus campos
(`id`, `inmobiliariaId`, `monto`, `montoExpensas`, `moneda`, `fechaInicio`, `fechaFin`, `diaPago`,
`devengarDesde`) están en la fila del contrato, así que el `rest` del handler lo satisface tal cual.

- [ ] **Step 4: Exponerlo en `GET /contratos/:id`**

En `apps/api/src/routes/core.ts`, dentro del handler de `GET /contratos/:id` (arranca en `:182`),
**antes del `return`** (`:224`). ✅ Verificado: `now` ya está definido en `:216` y `rest` en `:215`,
así que los dos están en scope ahí.

```ts
    // Revisión previa a la aprobación: solo cuando el contrato está esperando
    // decisión. El que aprueba tiene que ver la deuda declarada y lo que se le va
    // a dar por cobrado — hoy eso vivía en un Json que no leía nadie.
    let revisionAprobacion: (RevisionAprobacion & { aprobacionId: string }) | undefined;
    if (rest.pendienteAprobacion) {
      const aprobacion = await prisma.aprobacion.findFirst({
        where: {
          inmobiliariaId: u.inmobiliariaId,
          tipo: 'CONTRATO_CARGADO',
          entidadId: rest.id,
          estado: 'PENDIENTE',
        },
        select: { id: true },
      });
      if (aprobacion) {
        const declarados = PeriodosAnterioresSchema.safeParse(rest.periodosAnterioresPendientes);
        revisionAprobacion = {
          aprobacionId: aprobacion.id,
          ...resumenRevisionAprobacion(rest, declarados.success ? declarados.data : [], now),
        };
      }
    }
```

y sumarlo al objeto del `return`:

```ts
      ...(revisionAprobacion ? { revisionAprobacion } : {}),
```

🔴 **`PeriodosAnterioresSchema` hoy vive en `plata.ts`** (está definido justo abajo de `GET /aprobaciones`, con el comentario *"es una columna Json: la volvemos a validar antes de tocar plata"*). Movelo a `apps/api/src/lib/estado-inicial-contrato.ts` y que **los dos** lo importen de ahí. Es Json crudo: no castearlo a ciegas en un lugar nuevo.

⚠️ Si el parse falla (Json corrupto), `revisionAprobacion` sale con `periodosDeclarados: []` y el preview solo muestra las cuotas. **No tirar 500**: el detalle del contrato tiene que seguir abriéndose.

- [ ] **Step 5: Correr los tests y verificar que pasan**

```bash
cd ~/dev/myalq-revision/apps/api && pnpm vitest run test/revision-aprobacion.test.ts
```

Esperado: **2 passed**.

- [ ] **Step 6: No regresión + typecheck**

```bash
cd ~/dev/myalq-revision/apps/api && pnpm vitest run && pnpm lint
```

Esperado: typecheck sin output. La suite con **las mismas 5 fallas preexistentes y ninguna más** (4 en `core.test.ts`, 1 en `multi-alquiler.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/lib/revision-aprobacion.ts apps/api/test/revision-aprobacion.test.ts apps/api/src/routes/core.ts apps/api/src/routes/plata.ts apps/api/src/lib/estado-inicial-contrato.ts
git commit -m "feat(aprobacion): el detalle del contrato expone que va a pasar al aprobar"
```

---

## Task 2: Rechazar deja de borrar la deuda declarada

**Files:**
- Modify: `apps/api/src/routes/plata.ts` (~`:2270`, la rama `rechazar` del `contrato.updateMany`)
- Create: `apps/api/test/rechazo-conserva-periodos.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: tras un rechazo, `Contrato.periodosAnterioresPendientes` conserva lo declarado.

**Contexto:** hoy el rechazo escribe `periodosAnterioresPendientes: Prisma.DbNull`. Se saca, para que la fase 2 (corregir y reenviar) tenga el dato. **El riesgo es que ese dato quede aplicable**: hay que probar que no.

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/api/test/rechazo-conserva-periodos.test.ts`, con el mismo andamiaje que el de la Tarea 1 (dos tokens: CARGA y ADMIN).

```ts
it('rechazar conserva los períodos declarados y no los aplica', async () => {
  const hoy = new Date();
  const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 2, 1));
  const p = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 2, 1));
  const periodo = `${p.getUTCFullYear()}-${String(p.getUTCMonth() + 1).padStart(2, '0')}`;

  const alta = await app.inject({
    method: 'POST',
    url: '/contratos',
    headers: { authorization: `Bearer ${tokenCarga}` },
    payload: {
      propiedadId: await propiedadDisponible(),
      inquilino: { nombre: 'Rechazo', apellido: 'Conserva' },
      monto: 100000,
      fechaInicio: inicio.toISOString(),
      fechaFin: new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1)).toISOString(),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
      periodosAnteriores: [{ periodo, estado: 'ADEUDA' }],
    },
  });
  const contratoId = alta.json().id as string;

  const det = await app.inject({
    method: 'GET',
    url: `/contratos/${contratoId}`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  const aprobacionId = det.json().revisionAprobacion.aprobacionId as string;

  // Sin comentario sigue siendo 400 (no regresión)
  const sinMotivo = await app.inject({
    method: 'POST',
    url: `/aprobaciones/${aprobacionId}/rechazar`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: {},
  });
  expect(sinMotivo.statusCode).toBe(400);

  const rech = await app.inject({
    method: 'POST',
    url: `/aprobaciones/${aprobacionId}/rechazar`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { comentario: 'El monto no coincide con el contrato firmado' },
  });
  expect(rech.statusCode).toBe(200);

  const prisma = new PrismaClient();
  const contrato = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
  const liqs = await prisma.liquidacion.count({ where: { contratoId } });
  const aprobacion = await prisma.aprobacion.findUniqueOrThrow({ where: { id: aprobacionId } });
  await prisma.$disconnect();

  expect(contrato.estado).toBe('BORRADOR');
  expect(contrato.pendienteAprobacion).toBe(false);
  expect(contrato.periodosAnterioresPendientes).not.toBeNull(); // <-- lo nuevo
  expect(aprobacion.estado).toBe('RECHAZADA');
  expect(aprobacion.comentarioAprobador).toContain('no coincide');
  expect(liqs).toBe(0);
});

it('aprobar una aprobación ya rechazada no genera nada', async () => {
  const hoy = new Date();
  const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 2, 1));
  const p = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 2, 1));
  const periodo = `${p.getUTCFullYear()}-${String(p.getUTCMonth() + 1).padStart(2, '0')}`;

  const alta = await app.inject({
    method: 'POST',
    url: '/contratos',
    headers: { authorization: `Bearer ${tokenCarga}` },
    payload: {
      propiedadId: await propiedadDisponible(),
      inquilino: { nombre: 'Doble', apellido: 'Decision' },
      monto: 100000,
      fechaInicio: inicio.toISOString(),
      fechaFin: new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1)).toISOString(),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
      periodosAnteriores: [{ periodo, estado: 'ADEUDA' }],
    },
  });
  const contratoId = alta.json().id as string;
  const det = await app.inject({
    method: 'GET',
    url: `/contratos/${contratoId}`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  const aprobacionId = det.json().revisionAprobacion.aprobacionId as string;

  await app.inject({
    method: 'POST',
    url: `/aprobaciones/${aprobacionId}/rechazar`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { comentario: 'Rechazado por error de carga' },
  });

  // Segundo intento: aprobar la MISMA aprobación ya rechazada
  const ap = await app.inject({
    method: 'POST',
    url: `/aprobaciones/${aprobacionId}/aprobar`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: { comentario: 'ok' },
  });

  const prisma = new PrismaClient();
  const liqs = await prisma.liquidacion.count({ where: { contratoId } });
  const contrato = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
  await prisma.$disconnect();

  expect(ap.statusCode).not.toBe(200);
  expect(liqs).toBe(0);
  expect(contrato.estado).toBe('BORRADOR');
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
cd ~/dev/myalq-revision/apps/api && pnpm vitest run test/rechazo-conserva-periodos.test.ts
```

Esperado: **el primero FALLA** en `expect(contrato.periodosAnterioresPendientes).not.toBeNull()`, porque hoy se borra. El segundo probablemente ya pase (el `updateMany` filtra por `estado: 'PENDIENTE'`) — si pasa, **dejalo igual**: es la red que protege el cambio del primero.

- [ ] **Step 3: Sacar el borrado**

En `apps/api/src/routes/plata.ts`, en el `contrato.updateMany` de la decisión (~`:2270`), la rama de rechazo pasa de:

```ts
                : { pendienteAprobacion: false, periodosAnterioresPendientes: Prisma.DbNull },
```

a:

```ts
                // El estado inicial declarado NO se borra: queda para que quien lo
                // cargó pueda corregir y reenviar (fase 2). No queda aplicable —
                // la aplicación está gateada por el updateMany con estado PENDIENTE
                // de la Aprobación, con test en rechazo-conserva-periodos.test.ts.
                : { pendienteAprobacion: false },
```

⚠️ Si `Prisma` queda sin usar en el archivo, sacá el import; si se usa en otro lado, dejalo.

- [ ] **Step 4: Correr y verificar que pasan**

```bash
cd ~/dev/myalq-revision/apps/api && pnpm vitest run test/rechazo-conserva-periodos.test.ts
```

Esperado: **2 passed**.

- [ ] **Step 5: No regresión + typecheck**

```bash
cd ~/dev/myalq-revision/apps/api && pnpm vitest run && pnpm lint
```

Esperado: typecheck limpio, las mismas 5 preexistentes y ninguna más.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/plata.ts apps/api/test/rechazo-conserva-periodos.test.ts
git commit -m "fix(aprobacion): el rechazo conserva la deuda declarada para poder corregirla"
```

---

## Task 3: La tarjeta del detalle muestra y decide de verdad

**Files:**
- Modify: `apps/inmobiliaria/src/app/(app)/contratos/[id]/page-client.tsx` (`AprobacionContratoCard` en `:1184`, su render en `:206`, los botones en `:1284` y `:1292`)
- Modify: `apps/inmobiliaria/src/lib/types.ts` (el tipo del contrato suma `revisionAprobacion?`)

**Interfaces:**
- Consumes: `revisionAprobacion` de `GET /contratos/:id` (Tarea 1), y `useAprobaciones()` de `@/lib/api/hooks`, que **ya expone** `aprobarApi(id, pin, comentario?)` y `rechazarApi(id, pin, motivo)` y **ya invalida** `['contrato']` y `['aprobaciones']`.

**Contexto:** la tarjeta ya existe y ya aparece cuando `c.pendienteAprobacion`. Hoy sus botones tienen `disabled={apiEnabled}` con `title="Próximamente"` y, en demo, escriben en `localStorage` vía `aprobaciones-storage.ts`. **La rama de demo se mantiene sin tocar**; lo que se agrega es la rama real.

- [ ] **Step 1: Tipar `revisionAprobacion`**

En `apps/inmobiliaria/src/lib/types.ts`, junto a `pendienteAprobacion?: boolean` (`:284`):

```ts
  /** Solo viaja cuando el contrato está esperando decisión (ver GET /contratos/:id). */
  revisionAprobacion?: {
    aprobacionId: string;
    periodosDeclarados: Array<{
      periodo: string;
      estado: 'PAGADO' | 'PARCIAL' | 'ADEUDA';
      montoPagado?: number;
      moraManual?: number;
    }>;
    alAprobar: {
      cuotasAGenerar: number;
      rangoCuotas: { desde: string; hasta: string } | null;
      conciliado: { periodos: number; monto: number };
      deudaInicial: { periodos: number; capital: number; mora: number };
    };
  };
```

- [ ] **Step 2: Pasarle el dato a la tarjeta**

En `:206`, sumar la prop:

```tsx
          <AprobacionContratoCard
            contratoId={c.id}
            cargadoPor={c.cargadoPor ?? 'Usuario desconocido'}
            cargadoAt={c.cargadoAt ?? ''}
            inquilino={c.inquilino}
            revision={c.revisionAprobacion}
          />
```

y en la firma de `AprobacionContratoCard` (`:1184`) agregar `revision?: NonNullable<Contrato['revisionAprobacion']>`.

- [ ] **Step 3: Mostrar los períodos declarados**

Dentro de la tarjeta, cuando `revision?.periodosDeclarados.length`:

```tsx
<div className="mt-3 space-y-1.5">
  <p className="text-sm font-medium">Lo que se declaró del pasado</p>
  <ul className="space-y-1 text-sm text-muted-foreground">
    {revision.periodosDeclarados.map((p) => (
      <li key={p.periodo} className="flex justify-between gap-3">
        <span>{p.periodo}</span>
        <span>
          {p.estado === 'PAGADO' && 'Pagado fuera del sistema'}
          {p.estado === 'PARCIAL' && `Pagó ${formatMonto(p.montoPagado ?? 0)}`}
          {p.estado === 'ADEUDA' && 'Adeuda'}
          {p.moraManual != null && ` · mora ${formatMonto(p.moraManual)}`}
        </span>
      </li>
    ))}
  </ul>
</div>
```

- [ ] **Step 4: Mostrar qué va a pasar al aprobar**

```tsx
{revision && (
  <div className="mt-3 rounded-md border bg-background/60 p-3 text-sm">
    <p className="font-medium">Al aprobar este contrato</p>
    <ul className="mt-1.5 space-y-1 text-muted-foreground">
      <li>La propiedad pasa a alquilada.</li>
      <li>
        Se generan {revision.alAprobar.cuotasAGenerar}{' '}
        {revision.alAprobar.cuotasAGenerar === 1 ? 'cuota' : 'cuotas'}
        {revision.alAprobar.rangoCuotas &&
          ` (${revision.alAprobar.rangoCuotas.desde} → ${revision.alAprobar.rangoCuotas.hasta})`}
        .
      </li>
      {revision.alAprobar.conciliado.monto > 0 && (
        <li className="font-medium text-amber-700 dark:text-amber-300">
          Se dan por cobrados {formatMonto(revision.alAprobar.conciliado.monto)} que quedan
          conciliados sin que nadie los transfiera.
        </li>
      )}
      {revision.alAprobar.deudaInicial.capital > 0 && (
        <li className="text-foreground">
          El inquilino arranca debiendo {formatMonto(revision.alAprobar.deudaInicial.capital)}
          {revision.alAprobar.deudaInicial.mora > 0 &&
            ` + ${formatMonto(revision.alAprobar.deudaInicial.mora)} de mora`}
          .
        </li>
      )}
    </ul>
  </div>
)}
```

🔴 **No mostrar "N períodos acá y M allá".** Un período PARCIAL cuenta en las dos cifras: presentarlos como grupos separados hace que no cierren. El copy habla de **plata**, no de cantidad de períodos.

- [ ] **Step 5: Hacer que los botones decidan**

Sacar `disabled={apiEnabled}` y `title="Próximamente"` de `:1284` y `:1292`. Con `apiEnabled` y `revision`, los handlers abren un diálogo y pegan a la API:

- **Aprobar**: `ConfirmDialog` con `Textarea` de comentario **opcional** → `aprobarApi(revision.aprobacionId, undefined, comentario || undefined)`.
- **Rechazar**: `ConfirmDialog` con `Textarea` de motivo **obligatorio**; si `motivo.trim().length < 5`, `toast` con *"Falta el motivo"* y no se manda. → `rechazarApi(revision.aprobacionId, undefined, motivo.trim())`.

Son **las mismas reglas** que ya aplica `bandeja-aprobaciones.tsx:96`: no inventar un mínimo distinto. El servidor igual devuelve 400 si el motivo es corto.

Tras la respuesta OK, mostrar el estado resuelto (la tarjeta ya tiene esas dos ramas, `:1196` y `:1210`) e invalidar `['contrato', contratoId]`.

⚠️ Sin `revision` (contrato pendiente pero sin aprobación PENDIENTE, o modo demo), **los botones siguen como hoy**. No romper la demo.

- [ ] **Step 6: Verificar**

```bash
cd ~/dev/myalq-revision && pnpm --filter inmobiliaria typecheck
```

Esperado: sin output (baseline 0).

En el navegador: cargar un contrato con un usuario CARGA, entrar como ADMIN al detalle, ver los períodos declarados y el bloque de consecuencias, aprobar con comentario y que el contrato quede activo.

- [ ] **Step 7: Commit**

```bash
git add "apps/inmobiliaria/src/app/(app)/contratos/[id]/page-client.tsx" apps/inmobiliaria/src/lib/types.ts
git commit -m "feat(aprobacion): el detalle muestra la deuda declarada y sus consecuencias, y decide"
```

---

## Task 4: La bandeja lleva al contrato

**Files:**
- Modify: `apps/inmobiliaria/src/components/bandeja-aprobaciones.tsx` (`AprobacionCard` en `:274`, botones en `:349-355`)

**Interfaces:**
- Consumes: `aprobacion.entidadId`, que para `tipo === 'CONTRATO_CARGADO'` **es el id del contrato** (`core.ts:1073`).

- [ ] **Step 1: Para contratos, un solo botón que lleva a revisar**

En `AprobacionCard`, cuando `aprobacion.tipo === 'CONTRATO_CARGADO'` y está pendiente, reemplazar los botones Aprobar/Rechazar por:

```tsx
<Button size="sm" asChild>
  <Link href={`/contratos/${aprobacion.entidadId}`}>
    Revisar y decidir
  </Link>
</Button>
```

Para los otros tres tipos (`GASTO_CAJA_ELIMINACION`, `DEVOLUCION_DEPOSITO`, `AJUSTE_FUERA_DE_INDICE`), **los botones quedan exactamente como están**.

🔴 **No dejar Aprobar/Rechazar al lado del link para contratos.** Si quedan, se sigue decidiendo sin ver, que es el problema que este trabajo resuelve.

⚠️ `Link` de `next/link` puede no estar importado en este archivo: verificalo y agregalo si falta.

- [ ] **Step 2: Verificar**

```bash
cd ~/dev/myalq-revision && pnpm --filter inmobiliaria typecheck
```

Esperado: sin output.

En el navegador: la bandeja muestra "Revisar y decidir" en las aprobaciones de contrato y lleva al detalle correcto; las de los otros tipos siguen decidiéndose ahí mismo.

- [ ] **Step 3: Commit**

```bash
git add apps/inmobiliaria/src/components/bandeja-aprobaciones.tsx
git commit -m "feat(aprobacion): los contratos se revisan en su detalle, no en la bandeja"
```

---

## Cierre

- [ ] **Verificación final**

```bash
cd ~/dev/myalq-revision && pnpm --filter api test && pnpm --filter api lint && pnpm --filter inmobiliaria typecheck
```

Esperado: ambos typechecks sin output; la suite con las **mismas 5 fallas preexistentes** y ninguna más.

- [ ] **E2E en navegador**

Contra una **base local efímera** (nunca la de producción):

1. Cargar un contrato con `camila@delsol.com` (CARGA) que arranque hace 4 meses, declarando períodos PAGADO, PARCIAL y ADEUDA.
2. Entrar como `roberto@delsol.com` (ADMIN) → Pagos → aprobaciones → **"Revisar y decidir"**.
3. En el detalle: se ven los períodos declarados y el bloque "Al aprobar este contrato".
4. Aprobar con comentario → el contrato queda ACTIVO, la propiedad ALQUILADA, y **la cantidad de cuotas y la plata conciliada coinciden con lo que anunciaba el preview**.
5. Repetir con otro contrato y rechazarlo: sin motivo no deja, con motivo queda RECHAZADA y el comentario se ve en la bandeja.

- [ ] **Abrir el PR** contra `main`. 🔴 **No mergear ni pushear a `main`.**

## Lo que este plan NO hace

- **No** permite corregir un contrato rechazado y reenviarlo: es la fase 2. Hasta entonces, rechazar sigue matando el contrato — se conserva la deuda declarada justamente para poder construirla después.
- **No** toca la edición de contrato (`Editar`, también en "Próximamente").
- **No** cambia el flujo de los otros tres tipos de aprobación.
- **No** revive el PIN.
