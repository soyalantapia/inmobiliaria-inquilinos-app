# Corregir un contrato rechazado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un contrato rechazado se pueda corregir y volver a mandar a aprobación, en vez de quedar muerto en Borradores.

**Architecture:** Arranca **sacando** el borrado del inquilino en el rechazo, que está justificado por un unique que ya no existe — eso deja el contrato completo y hace innecesario reconstruirlo. Después: el detalle expone y muestra la última decisión, un endpoint acotado edita el borrador reusando el schema del alta, y el reenvío crea una aprobación nueva con un índice único parcial que impide duplicados.

**Tech Stack:** pnpm monorepo · `apps/api` Fastify + Prisma + Postgres + vitest · `apps/inmobiliaria` Next 14 · `packages/shared` TS crudo.

**Spec:** `docs/superpowers/specs/2026-08-03-corregir-contrato-rechazado-design.md`

## Global Constraints

- **Worktree:** `~/dev/myalq-fase2`, rama `feat/corregir-contrato-rechazado`.
- 🔴 **La base NO es main**: es `feat/revision-contrato-aprobacion` (**PR #41, sin mergear**). Esta fase depende de que el rechazo conserve `periodosAnterioresPendientes`.
- **Nunca push ni merge a `main`.**
- 🔴 **Tests SOLO contra Postgres local efímero, JAMÁS la base remota.** El `apps/api/.env` del repo principal apunta a **producción**. **Verificá que tu API levantó de verdad antes de confiar en lo que responde**: hay otras sesiones y los puertos se pisan (`EADDRINUSE` deja hablando a la API ajena).
- **Baseline typecheck 0** en `pnpm --filter api lint` y `pnpm --filter inmobiliaria typecheck`. Si Prisma se queja, `cd apps/api && pnpm db:generate`.
- **La suite de `apps/api` tiene 5 fallas preexistentes**: 4 de conteo del seed en `core.test.ts`, 1 en `multi-alquiler.test.ts`. Correr la suite **completa** para compararlas (en aislamiento esos tests pasan).
- **El front NO tiene runner de tests.** Se verifica con `tsc --noEmit` y navegador.
- 🔴 **El flag `contratosRequierenAprobacion` está PRENDIDO en producción para `AyV alquileres y ventas`.** Este plan toca el rechazo, que ese cliente usa.
- **El PIN está eliminado**: `verificarPinUsuario` devuelve `{ok:true}` incondicional. No revivirlo.
- Copy en **español rioplatense**, tuteo.

---

## File Structure

| Archivo | Responsabilidad | Tareas |
|---|---|---|
| `apps/api/src/routes/plata.ts` | el rechazo deja de borrar el inquilino | 1 |
| `apps/api/src/routes/core.ts` | listados filtrados; `decisionAprobacion`; editor de borrador; reenvío | 1, 2, 3, 4 |
| `apps/api/prisma/migrations/<ts>_una_aprobacion_pendiente/migration.sql` | **(nuevo)** índice único parcial | 4 |
| `apps/api/test/corregir-rechazado.test.ts` | **(nuevo)** el ciclo completo y los candados | 1-4 |
| `apps/inmobiliaria/src/app/(app)/contratos/[id]/page-client.tsx` | tarjeta de rechazo persistente, botón Editar, reenviar | 2, 3, 4 |
| `apps/inmobiliaria/src/app/(app)/page.tsx` | el aviso de "tenés contratos para corregir" (es el inicio del panel) | 5 |

---

## Task 1: El rechazo deja de vaciar el contrato

**Files:**
- Modify: `apps/api/src/routes/plata.ts:2302-2326` (el bloque `if (accion === 'rechazar')`)
- Modify: `apps/api/src/routes/core.ts` (`GET /inquilinos` en `:1976`, y el deduplicado por persona que le sigue)
- Test: `apps/api/test/corregir-rechazado.test.ts` (crear)

**Interfaces:**
- Produces: tras un rechazo, el contrato conserva `inquilinoTitular` y sus documentos. Lo consumen las tareas 3 y 4.

**Contexto — por qué se saca:**

El bloque borra `CodigoOtp`, `AnuncioAcuse`, `Documento`, `CertificadoInquilino` e `Inquilino`, y su comentario lo justifica así: *"su email queda tomado (`@@unique [inmobiliariaId,email]`) y bloquea para siempre volver a cargar un contrato con ese inquilino"*.

**Esa razón está desactualizada** (el bloque es del 21/06, `0d886ac`):
- `Inquilino` **ya no tiene** unique de email — el schema lo documenta: *"El email NO es único a nivel Inquilino (fila-por-contrato)"*. El unique se mudó a **`Persona`** (`@@unique([inmobiliariaId, email])`).
- El rechazo **no toca `Persona`**.
- `buscarOCrearPersona` (`apps/api/src/lib/persona.ts:27`) es **find-or-create**: busca por DNI, después por email, y solo crea si no encuentra. Una `Persona` con ese email se reusa.

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/api/test/corregir-rechazado.test.ts`. Andamiaje: copiar `beforeAll`/`afterAll` de `apps/api/test/revision-aprobacion.test.ts` (dos tokens: `camila@delsol.com` **CARGA** y `roberto@delsol.com` **ADMIN**, password `delsol123` los dos) y su helper de crear propiedad — **no** uses `GET /propiedades?estado=DISPONIBLE`: ese endpoint ignora el query param y el seed no deja ninguna disponible.

⚠️ `POST /contratos` devuelve **200**, no 201.

```ts
it('rechazar conserva el inquilino y sus datos', async () => {
  const { contratoId, aprobacionId } = await cargarContratoPendiente({
    inquilino: { nombre: 'Sofia', apellido: 'Rechazada', email: 'sofia.rechazada@mail.com', dni: '31222333' },
  });

  const rech = await app.inject({
    method: 'POST',
    url: `/aprobaciones/${aprobacionId}/rechazar`,
    headers: authAdmin(),
    payload: { comentario: 'El monto no coincide con el contrato firmado' },
  });
  expect(rech.statusCode).toBe(200);

  const prisma = new PrismaClient();
  const contrato = await prisma.contrato.findUniqueOrThrow({
    where: { id: contratoId },
    include: { inquilinoTitular: true },
  });
  const inqs = await prisma.inquilino.count({ where: { contratoId } });
  await prisma.$disconnect();

  // Lo nuevo: el inquilino sobrevive
  expect(inqs).toBe(1);
  expect(contrato.inquilinoTitular).not.toBeNull();
  expect(contrato.inquilinoTitular?.nombre).toBe('Sofia');
  // Y lo que ya andaba, sin regresión
  expect(contrato.estado).toBe('BORRADOR');
  expect(contrato.pendienteAprobacion).toBe(false);
  expect(contrato.periodosAnterioresPendientes).not.toBeNull();
});

it('el inquilino de un contrato en borrador NO figura en los listados', async () => {
  const { contratoId, aprobacionId } = await cargarContratoPendiente({
    inquilino: { nombre: 'Tomas', apellido: 'Borrador', email: 'tomas.borrador@mail.com', dni: '31444555' },
  });
  await app.inject({
    method: 'POST',
    url: `/aprobaciones/${aprobacionId}/rechazar`,
    headers: authAdmin(),
    payload: { comentario: 'Faltan los documentos del garante' },
  });

  const lista = await app.inject({ method: 'GET', url: '/inquilinos', headers: authAdmin() });
  const nombres = (lista.json() as Array<{ nombre: string }>).map((i) => i.nombre);
  expect(nombres).not.toContain('Tomas');

  const personas = await app.inject({ method: 'GET', url: '/personas', headers: authAdmin() });
  const nomPersonas = (personas.json() as Array<{ nombre: string }>).map((p) => p.nombre);
  expect(nomPersonas).not.toContain('Tomas');
});
```

⚠️ **La ruta del listado deduplicado**: el spec la llama "el deduplicado por persona" y está definida justo debajo de `GET /inquilinos` en `core.ts`. **Buscá su path real** (`grep -n "Lista DEDUPLICADA por persona" -A 3 apps/api/src/routes/core.ts`) y usalo en el test; no asumas `/personas`.

Y el helper, que se usa en todas las tareas:

```ts
async function cargarContratoPendiente(opts: {
  inquilino: { nombre: string; apellido: string; email?: string; dni?: string };
  monto?: number;
}): Promise<{ contratoId: string; aprobacionId: string }> {
  const hoy = new Date();
  const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 2, 1));
  const fin = new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1));
  const alta = await app.inject({
    method: 'POST',
    url: '/contratos',
    headers: authCarga(),           // CARGA => queda BORRADOR + pendienteAprobacion
    payload: {
      propiedadId: await propiedadNueva(),
      inquilino: opts.inquilino,
      monto: opts.monto ?? 100000,
      fechaInicio: inicio.toISOString(),
      fechaFin: fin.toISOString(),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
      periodosAnteriores: [{ periodo: periodoDe(inicio), estado: 'ADEUDA' }],
    },
  });
  expect(alta.statusCode).toBeLessThan(300);
  const contratoId = alta.json().id as string;
  const det = await app.inject({ method: 'GET', url: `/contratos/${contratoId}`, headers: authAdmin() });
  return { contratoId, aprobacionId: det.json().revisionAprobacion.aprobacionId };
}

function periodoDe(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
cd ~/dev/myalq-fase2/apps/api && pnpm vitest run test/corregir-rechazado.test.ts
```

Esperado: **el primero FALLA** (`expect(inqs).toBe(1)` da 0, hoy se borra). El segundo puede pasar por la razón equivocada (el inquilino no está porque se borró): **no lo tomes como verde** — va a ser significativo recién después del Step 3.

- [ ] **Step 3: Sacar el borrado**

En `apps/api/src/routes/plata.ts`, reemplazar el bloque `if (accion === 'rechazar') { … }` (~`:2302-2326`) por el comentario que explica **por qué ya no hace falta**:

```ts
          if (accion === 'rechazar') {
            // Antes acá se borraba el Inquilino del borrador (y sus hijos: CodigoOtp,
            // AnuncioAcuse, Documento, CertificadoInquilino) porque "su email queda
            // tomado (@@unique [inmobiliariaId,email]) y bloquea volver a cargarlo".
            // Esa razón MURIÓ con multi-alquiler: Inquilino ya NO tiene unique de email
            // (el schema lo documenta), el unique vive en Persona — que este handler no
            // toca — y buscarOCrearPersona (lib/persona.ts) es find-or-create, así que
            // un email repetido se reusa en vez de chocar.
            // Conservarlo es lo que permite CORREGIR el contrato rechazado y reenviarlo
            // en vez de cargarlo de cero. No volver a agregar el borrado.
          }
```

⚠️ Si al sacarlo queda alguna variable o import sin usar (`inqs`, `inqIds`), sacalos también.

- [ ] **Step 4: Filtrar los listados**

En `apps/api/src/routes/core.ts`:

- `GET /inquilinos` (`:1976`): sumar al `where` la exclusión de los que cuelgan de un contrato en borrador. Un inquilino de borrador **no es inquilino todavía**: lo es cuando el contrato se aprueba.
- El listado **deduplicado por persona** (justo debajo): mismo criterio. Su `where` filtra `Persona`, así que la exclusión va sobre la relación `inquilinos`.

En los dos, dejá un comentario de una línea explicando el criterio.

⚠️ **No filtres por `pendienteAprobacion`**: un contrato rechazado lo tiene en `false` y igual debe quedar excluido. El criterio es **el estado del contrato**.

- [ ] **Step 5: Correr y verificar que pasan**

```bash
cd ~/dev/myalq-fase2/apps/api && pnpm vitest run test/corregir-rechazado.test.ts
```

Esperado: **2 passed**.

- [ ] **Step 6: No regresión + typecheck**

```bash
cd ~/dev/myalq-fase2/apps/api && pnpm vitest run && pnpm lint
```

Esperado: typecheck sin output; **las mismas 5 fallas preexistentes y ninguna más**.

⚠️ Si aparece una falla nueva en un test que cuenta inquilinos, **miralá en serio**: puede ser que el filtro nuevo excluya de más. No la agregues a la lista de "preexistentes".

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/plata.ts apps/api/src/routes/core.ts apps/api/test/corregir-rechazado.test.ts
git commit -m "fix(aprobacion): el rechazo deja de borrar el inquilino, su razon ya no existe"
```

---

## Task 2: El contrato dice que lo rechazaron, y por qué

**Files:**
- Modify: `apps/api/src/routes/core.ts` (`GET /contratos/:id`, el bloque de `revisionAprobacion` en `:237-262`)
- Modify: `apps/inmobiliaria/src/lib/types.ts`, `apps/inmobiliaria/src/lib/api/use-contrato.ts`
- Modify: `apps/inmobiliaria/src/app/(app)/contratos/[id]/page-client.tsx`
- Test: `apps/api/test/corregir-rechazado.test.ts` (agregar)

**Interfaces:**
- Produces: `decisionAprobacion?: { estado, comentario, decididoPor, decididoAt }` en el detalle. La Tarea 3 lo usa para mostrar el botón de corregir.

**Contexto:** hoy el cartel de rechazado es `useState<'APROBADO'|'RECHAZADO'|null>` en `AprobacionContratoCard` (`page-client.tsx:1215`): **se pierde al recargar**. Y la tarjeta entera está gateada por `c.pendienteAprobacion` (`:208`), que tras el rechazo es `false`, así que en el contrato no queda rastro.

- [ ] **Step 1: Escribir el test que falla**

```ts
it('el contrato rechazado expone la decisión con su motivo', async () => {
  const { contratoId, aprobacionId } = await cargarContratoPendiente({
    inquilino: { nombre: 'Ivan', apellido: 'Motivo' },
  });
  await app.inject({
    method: 'POST',
    url: `/aprobaciones/${aprobacionId}/rechazar`,
    headers: authAdmin(),
    payload: { comentario: 'Las expensas no coinciden con la liquidación del consorcio' },
  });

  const det = await app.inject({ method: 'GET', url: `/contratos/${contratoId}`, headers: authAdmin() });
  const d = det.json().decisionAprobacion;
  expect(d).toBeTruthy();
  expect(d.estado).toBe('RECHAZADA');
  expect(d.comentario).toContain('consorcio');
  expect(d.decididoPor).toContain('Roberto');     // el NOMBRE, no el user id
  expect(d.decididoAt).toEqual(expect.any(String));
  // Y ya no está pendiente, así que no viaja la revisión
  expect(det.json().revisionAprobacion).toBeUndefined();
});
```

- [ ] **Step 2: Correr y verificar que falla**

Esperado: **FAIL**, `decisionAprobacion` es `undefined`.

- [ ] **Step 3: Exponerlo en el backend**

En `core.ts`, el bloque que hoy busca la `Aprobacion` PENDIENTE (`:239`) pasa a buscar **la última decisión de ese contrato**, en **una sola query**:

```ts
    // La ÚLTIMA aprobación de este contrato: si está PENDIENTE alimenta la revisión
    // previa; si ya se decidió, alimenta el cartel con el motivo. Antes se filtraba
    // por estado PENDIENTE y el rechazo no dejaba rastro en el contrato.
    const aprobacion = await prisma.aprobacion.findFirst({
      where: { inmobiliariaId: u.inmobiliariaId, tipo: 'CONTRATO_CARGADO', entidadId: rest.id },
      orderBy: [{ aprobadoAt: 'desc' }, { cargadoAt: 'desc' }],
      select: {
        id: true,
        estado: true,
        comentarioAprobador: true,
        aprobadoAt: true,
        cargadoPor: { select: { nombre: true, apellido: true, rol: true } },
        aprobadoPor: { select: { nombre: true, apellido: true } },
      },
    });
```

`revisionAprobacion` se arma **solo si `aprobacion?.estado === 'PENDIENTE'`** y el contrato está pendiente (lo que ya hacía). Y se suma:

```ts
    const decisionAprobacion =
      aprobacion && aprobacion.estado !== 'PENDIENTE'
        ? {
            estado: aprobacion.estado,
            comentario: aprobacion.comentarioAprobador,
            decididoPor: aprobacion.aprobadoPor
              ? `${aprobacion.aprobadoPor.nombre} ${aprobacion.aprobadoPor.apellido ?? ''}`.trim()
              : 'Alguien de la inmobiliaria',
            decididoAt: aprobacion.aprobadoAt?.toISOString() ?? null,
          }
        : undefined;
```

y al `return`: `...(decisionAprobacion ? { decisionAprobacion } : {})`.

⚠️ `orderBy` con `aprobadoAt desc` deja las PENDIENTE (que lo tienen null) **al final** en Postgres si no se cuida el orden de nulls. Por eso el segundo criterio es `cargadoAt desc`. **Verificá con el test de la Tarea 4** (donde hay una rechazada vieja y una pendiente nueva) que la que gana es la pendiente.

- [ ] **Step 4: Tiparlo y mapearlo en el front**

En `apps/inmobiliaria/src/lib/types.ts`, junto a `revisionAprobacion`:

```ts
  /** Última decisión de aprobación, cuando ya se decidió. */
  decisionAprobacion?: {
    estado: 'APROBADA' | 'RECHAZADA';
    comentario: string | null;
    decididoPor: string;
    decididoAt: string | null;
  };
```

🔴 **Y sumarlo al mapeo de `apps/inmobiliaria/src/lib/api/use-contrato.ts`.** Ese archivo mapea **campo por campo** (`mapContrato`), no hace spread: si te olvidás, el campo llega del backend y se descarta en silencio, y la tarjeta no aparece nunca. Ya pasó exactamente eso con `revisionAprobacion`.

- [ ] **Step 5: La tarjeta persistente**

En `page-client.tsx`, el render de `:208` pasa a mostrar la tarjeta cuando el contrato está pendiente **o** cuando hay una decisión de rechazo:

- `pendienteAprobacion` → la tarjeta de revisión que ya existe (Tarea del PR #41), sin cambios.
- `decisionAprobacion?.estado === 'RECHAZADA'` → una tarjeta roja con el motivo, quién lo rechazó y cuándo.

**Sacar el `useState<'APROBADO'|'RECHAZADO'|null>`**: el estado ahora viene del servidor. Tras decidir, se invalida `['contrato', id]` y la tarjeta se re-renderiza con el dato real.

⚠️ El copy *"{cargadoPor} ya recibió la notificación"* (`:1250`) **es falso** — nadie manda nada. Cambialo por lo que pasa de verdad: que el contrato queda para corregir y que quien lo cargó lo va a ver en su panel.

- [ ] **Step 6: Verificar**

```bash
cd ~/dev/myalq-fase2/apps/api && pnpm vitest run test/corregir-rechazado.test.ts && pnpm lint
cd ~/dev/myalq-fase2 && pnpm --filter inmobiliaria typecheck
```

Esperado: 3 passed, typechecks sin output.

- [ ] **Step 7: Commit**

```bash
git commit -am "feat(aprobacion): el contrato rechazado muestra el motivo, de forma persistente"
```

---

## Task 3: El editor del borrador

**Files:**
- Modify: `apps/api/src/routes/core.ts` (extraer el schema del alta; endpoint nuevo)
- Modify: `apps/inmobiliaria/src/app/(app)/contratos/[id]/page-client.tsx` (botón Editar)
- Test: `apps/api/test/corregir-rechazado.test.ts` (agregar)

**Interfaces:**
- Produces: `PUT /contratos/:id/borrador`, mismo body que `POST /contratos`. La Tarea 4 reenvía después de esto.

**Contexto:** el repo **no tiene** un PUT general de contrato; tiene endpoints granulares con lógica propia (`PATCH /contratos/:id/monto` recalcula liquidaciones, `PATCH /modo-cobranza` valida la cuenta del propietario, `PUT /contratos/:id/mora`, `PATCH /inquilino-contacto`). **No los toques ni los reemplaces.** El endpoint nuevo es para lo que ellos no cubren: editar un borrador entero, donde no hay liquidaciones ni pagos que recalcular.

- [ ] **Step 1: Escribir el test que falla**

```ts
it('PUT /contratos/:id/borrador corrige el contrato rechazado', async () => {
  const { contratoId, aprobacionId } = await cargarContratoPendiente({
    inquilino: { nombre: 'Nadia', apellido: 'Corrige' },
    monto: 100000,
  });
  await app.inject({
    method: 'POST',
    url: `/aprobaciones/${aprobacionId}/rechazar`,
    headers: authAdmin(),
    payload: { comentario: 'El monto está mal, son 150.000' },
  });

  const antes = await app.inject({ method: 'GET', url: `/contratos/${contratoId}`, headers: authCarga() });
  const c = antes.json();

  const put = await app.inject({
    method: 'PUT',
    url: `/contratos/${contratoId}/borrador`,
    headers: authCarga(),
    payload: {
      propiedadId: c.propiedadId,
      inquilino: { nombre: 'Nadia', apellido: 'Corrige' },
      monto: 150000,                       // <-- lo corregido
      fechaInicio: c.fechaInicio,
      fechaFin: c.fechaFin,
      diaPago: c.diaPago,
      indiceAjuste: c.indiceAjuste,
      frecuenciaAjusteMeses: c.frecuenciaAjusteMeses,
    },
  });
  expect(put.statusCode).toBe(200);

  const prisma = new PrismaClient();
  const ct = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
  const liqs = await prisma.liquidacion.count({ where: { contratoId } });
  await prisma.$disconnect();

  expect(Number(ct.monto)).toBe(150000);
  expect(ct.estado).toBe('BORRADOR');       // sigue siendo borrador
  expect(ct.pendienteAprobacion).toBe(false); // editar NO reenvía
  expect(liqs).toBe(0);                     // no devengó nada
});

it('PUT /contratos/:id/borrador sobre un contrato ACTIVO da 409 y no lo toca', async () => {
  // Alta directa como ADMIN => queda ACTIVO
  const hoy = new Date();
  const alta = await app.inject({
    method: 'POST',
    url: '/contratos',
    headers: authAdmin(),
    payload: {
      propiedadId: await propiedadNueva(),
      inquilino: { nombre: 'Activo', apellido: 'Intocable' },
      monto: 100000,
      fechaInicio: new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1)).toISOString(),
      fechaFin: new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1)).toISOString(),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
    },
  });
  const contratoId = alta.json().id as string;

  const put = await app.inject({
    method: 'PUT',
    url: `/contratos/${contratoId}/borrador`,
    headers: authAdmin(),
    payload: {
      propiedadId: alta.json().propiedadId,
      inquilino: { nombre: 'Activo', apellido: 'Intocable' },
      monto: 999999,
      fechaInicio: alta.json().fechaInicio,
      fechaFin: alta.json().fechaFin,
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
    },
  });
  expect(put.statusCode).toBe(409);

  const prisma = new PrismaClient();
  const ct = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
  await prisma.$disconnect();
  expect(Number(ct.monto)).toBe(100000);   // no se tocó
});
```

- [ ] **Step 2: Correr y verificar que falla**

Esperado: **FAIL**, la ruta no existe (404).

- [ ] **Step 3: Extraer el schema del alta**

En `core.ts`, el body de `POST /contratos` está **inline** (`:847-941`, un `z.object({...}).safeParse(...)`). Extraerlo a una constante del módulo, por ejemplo `const contratoBodySchema = z.object({ … })`, y que `POST /contratos` lo use con `contratoBodySchema.safeParse(request.body ?? {})`.

🔴 **Es una extracción mecánica: el schema no cambia.** Ni un campo, ni un `.optional()`, ni un `.max()`. Compará el antes y el después antes de seguir — si se afloja algo, se rompió el alta.

- [ ] **Step 4: El endpoint**

```ts
  /**
   * Edición de un contrato en BORRADOR (típicamente uno rechazado que se va a
   * corregir y reenviar). Deliberadamente NO es un PUT genérico de contrato: los
   * contratos ACTIVOS se modifican con las acciones puntuales que ya existen
   * (PATCH /monto recalcula liquidaciones, PATCH /modo-cobranza valida la cuenta
   * del propietario, PUT /mora), que tienen lógica que un PUT general pisaría.
   * Acá no hay liquidaciones ni pagos: el borrador todavía no devengó nada.
   */
  app.put('/contratos/:id/borrador', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = contratoBodySchema.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos del contrato incompletos' });

    const actual = await prisma.contrato.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!actual) return reply.code(404).send({ message: 'Contrato inexistente' });
    if (actual.estado !== 'BORRADOR') {
      return reply.code(409).send({
        message:
          'Este contrato ya está activo: modificá el monto, la mora o la cobranza desde las acciones del contrato.',
      });
    }
    // ... actualizar contrato + inquilino titular + periodosAnterioresPendientes
  });
```

Qué actualiza:
- El **contrato**: los campos del schema (monto, moneda, fechas, día de pago, índice, frecuencia, tipo, expensas, depósito, comisión, modo de cobranza, mora).
- El **inquilino titular**: nombre, apellido, email, teléfono, DNI.
- `periodosAnterioresPendientes`: con lo que venga en `periodosAnteriores` (o `Prisma.DbNull` si no viene).

🔴 **Lo que NO hace:** no activa, no genera liquidaciones, no reclama la propiedad, no toca `pendienteAprobacion`. Editar y reenviar son dos acciones distintas: alguien puede guardar a mitad de camino.

⚠️ Si cambia `propiedadId`, validá que la nueva esté libre — el mismo chequeo `prop.contratoActualId` que hace el alta (`core.ts:974`).

- [ ] **Step 5: El botón en el front**

En `page-client.tsx`, el botón "Editar" (`:241`, hoy `disabled title="Próximamente"` cuando `apiEnabled`) se habilita **solo cuando `c.estado === 'BORRADOR'`**. En los demás estados queda exactamente como está.

Al clickearlo, lleva al wizard de alta en modo edición. **Si eso resulta ser más de lo que entra en esta tarea, dejá el botón llevando a una pantalla de edición mínima con los campos del schema** y decilo en el reporte — pero no lo dejes deshabilitado prometiendo algo que no hace.

- [ ] **Step 6: Verificar**

```bash
cd ~/dev/myalq-fase2/apps/api && pnpm vitest run && pnpm lint
cd ~/dev/myalq-fase2 && pnpm --filter inmobiliaria typecheck
```

Esperado: los tests nuevos pasan, las 5 preexistentes siguen igual, typechecks en 0.

- [ ] **Step 7: Commit**

```bash
git commit -am "feat(contratos): editar un contrato en borrador con PUT /contratos/:id/borrador"
```

---

## Task 4: Reenviar a aprobación, con candado

**Files:**
- Create: `apps/api/prisma/migrations/20260803150000_una_aprobacion_pendiente/migration.sql`
- Modify: `apps/api/src/routes/core.ts` (endpoint de reenvío)
- Modify: `apps/inmobiliaria/src/app/(app)/contratos/[id]/page-client.tsx`
- Test: `apps/api/test/corregir-rechazado.test.ts` (agregar)

- [ ] **Step 1: Escribir el test que falla**

```ts
it('reenviar crea una aprobación nueva y el ciclo cierra con los datos corregidos', async () => {
  const { contratoId, aprobacionId } = await cargarContratoPendiente({
    inquilino: { nombre: 'Ciclo', apellido: 'Completo' },
    monto: 100000,
  });
  await app.inject({
    method: 'POST', url: `/aprobaciones/${aprobacionId}/rechazar`,
    headers: authAdmin(), payload: { comentario: 'El monto está mal, son 150.000' },
  });

  const c = (await app.inject({ method: 'GET', url: `/contratos/${contratoId}`, headers: authCarga() })).json();
  await app.inject({
    method: 'PUT', url: `/contratos/${contratoId}/borrador`, headers: authCarga(),
    payload: {
      propiedadId: c.propiedadId, inquilino: { nombre: 'Ciclo', apellido: 'Completo' },
      monto: 150000, fechaInicio: c.fechaInicio, fechaFin: c.fechaFin,
      diaPago: c.diaPago, indiceAjuste: c.indiceAjuste, frecuenciaAjusteMeses: c.frecuenciaAjusteMeses,
    },
  });

  const re = await app.inject({
    method: 'POST', url: `/contratos/${contratoId}/reenviar-aprobacion`, headers: authCarga(), payload: {},
  });
  expect(re.statusCode).toBe(200);

  // La NUEVA aprobación es la que ve el detalle
  const det = (await app.inject({ method: 'GET', url: `/contratos/${contratoId}`, headers: authAdmin() })).json();
  expect(det.pendienteAprobacion).toBe(true);
  expect(det.revisionAprobacion).toBeTruthy();
  const nuevaId = det.revisionAprobacion.aprobacionId;
  expect(nuevaId).not.toBe(aprobacionId);      // no reusó la rechazada
  expect(det.decisionAprobacion).toBeUndefined(); // ya no muestra el rechazo viejo

  // Se aprueba y queda activo CON EL MONTO CORREGIDO
  const ap = await app.inject({
    method: 'POST', url: `/aprobaciones/${nuevaId}/aprobar`, headers: authAdmin(), payload: { comentario: 'Ahora sí' },
  });
  expect(ap.statusCode).toBe(200);

  const prisma = new PrismaClient();
  const ct = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
  const liq = await prisma.liquidacion.findFirst({ where: { contratoId } });
  await prisma.$disconnect();
  expect(ct.estado).toBe('ACTIVO');
  expect(Number(ct.monto)).toBe(150000);
  expect(Number(liq!.montoTotal)).toBe(150000);  // las cuotas salieron con el monto corregido
});

it('no se puede reenviar dos veces: una sola aprobación pendiente por contrato', async () => {
  const { contratoId, aprobacionId } = await cargarContratoPendiente({
    inquilino: { nombre: 'Doble', apellido: 'Reenvio' },
  });
  await app.inject({
    method: 'POST', url: `/aprobaciones/${aprobacionId}/rechazar`,
    headers: authAdmin(), payload: { comentario: 'Corregilo por favor' },
  });

  const uno = await app.inject({ method: 'POST', url: `/contratos/${contratoId}/reenviar-aprobacion`, headers: authCarga(), payload: {} });
  expect(uno.statusCode).toBe(200);
  const dos = await app.inject({ method: 'POST', url: `/contratos/${contratoId}/reenviar-aprobacion`, headers: authCarga(), payload: {} });
  expect(dos.statusCode).toBe(409);

  const prisma = new PrismaClient();
  const pendientes = await prisma.aprobacion.count({ where: { entidadId: contratoId, estado: 'PENDIENTE' } });
  await prisma.$disconnect();
  expect(pendientes).toBe(1);
});
```

- [ ] **Step 2: Correr y verificar que falla**

Esperado: **FAIL**, la ruta no existe.

- [ ] **Step 3: La migración con el índice parcial**

Crear `apps/api/prisma/migrations/20260803150000_una_aprobacion_pendiente/migration.sql`:

```sql
-- Una sola Aprobacion PENDIENTE por contrato.
-- Hasta ahora era inalcanzable porque el único create vivía dentro de POST /contratos,
-- atado a un contrato recién creado. El reenvío desde un contrato rechazado abre esa
-- puerta: dos reenvíos seguidos dejarían dos pendientes, y aprobar una no cerraría la
-- otra — la bandeja mostraría un fantasma que al aprobarse intentaría activar un
-- contrato ya activo.
-- Va como SQL crudo porque Prisma no expresa índices parciales en el schema.
CREATE UNIQUE INDEX "aprobaciones_una_pendiente_por_entidad"
  ON "aprobaciones" ("entidadId")
  WHERE "estado" = 'PENDIENTE';
```

⚠️ **Antes de aplicarla**, verificá contra tu base local que no haya ya duplicados que la hagan fallar:
`SELECT "entidadId", count(*) FROM aprobaciones WHERE estado='PENDIENTE' GROUP BY 1 HAVING count(*)>1;`
Si el seed genera alguno, arreglá el seed — no bajes el índice.

- [ ] **Step 4: El endpoint de reenvío**

```ts
  /**
   * Vuelve a mandar a aprobación un contrato en BORRADOR que ya fue corregido.
   * Crea una Aprobacion NUEVA (no reusa la rechazada: el histórico tiene que
   * conservar qué se rechazó y por qué).
   */
  app.post('/contratos/:id/reenviar-aprobacion', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    // ... 404 si no existe; 409 si no está en BORRADOR
    // ... 409 si ya tiene una PENDIENTE (mapeá el P2002 del índice parcial, no lo dejes salir como 500)
    // ... create de la Aprobacion + contrato.update({ pendienteAprobacion: true })
  });
```

La `Aprobacion` se arma **igual que en el alta** (`core.ts:1102-1116`): `tipo: 'CONTRATO_CARGADO'`, `titulo: \`${inquilino.nombre} · ${propiedad.direccion}\``, `entidadId: contrato.id`, `cargadoPorId: u.userId`, `rolAutor: u.rol`, `cargadoAt: new Date()`. La `descripcion` puede decir que es un reenvío.

🔴 **El `P2002` del índice tiene que salir como 409 con un mensaje claro**, no como 500. Y el chequeo previo no reemplaza al índice: entre el `findFirst` y el `create` hay una carrera, y el índice es lo que la cierra de verdad.

- [ ] **Step 5: El botón en el front**

En la tarjeta de rechazo (Tarea 2), el botón **"Corregir y reenviar"**. Tras corregir, un botón **"Reenviar a aprobación"** que pega al endpoint e invalida `['contrato', id]` y `['aprobaciones']`.

- [ ] **Step 6: Verificar**

```bash
cd ~/dev/myalq-fase2/apps/api && pnpm vitest run && pnpm lint
cd ~/dev/myalq-fase2 && pnpm --filter inmobiliaria typecheck
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(aprobacion): reenviar un contrato corregido, con candado de una pendiente por contrato"
```

---

## Task 5: El aviso en el panel

**Files:**
- Modify: `apps/inmobiliaria/src/app/(app)/page.tsx` — ✅ verificado: es el inicio del panel (no existe una carpeta `inicio/`)
- Modify: `apps/inmobiliaria/src/lib/api/hooks.ts` si hace falta un selector

**Interfaces:**
- Consumes: `GET /aprobaciones` (ya existe, devuelve todas con `cargadoPor`) y `useMe()` (`hooks.ts:735`) para saber quién soy.

- [ ] **Step 1: El selector**

Un aviso para **quien cargó el contrato**: aprobaciones con `estado === 'RECHAZADA'`, `cargadoPor` = el usuario actual, y **cuyo contrato sigue en BORRADOR** (si ya se reenvió o se aprobó, no va más).

⚠️ `GET /aprobaciones` **no trae el estado del contrato**. Resolvelo sin inventar un endpoint: o cruzás con `useContratos()` (que ya se usa en el panel), o el aviso se conforma con `RECHAZADA` + el contrato no aparece como activo. **Elegí uno y explicá en el reporte por qué.**

- [ ] **Step 2: El aviso**

En el inicio del panel, cuando hay al menos uno:

> **Tenés 1 contrato rechazado para corregir** — *"El monto no coincide con el contrato firmado"* · [Ver contrato]

Con más de uno, el conteo y un link al listado filtrado por Borradores.

⚠️ Que **no aparezca** si no hay ninguno: nada de una tarjeta vacía diciendo "0 contratos".

- [ ] **Step 3: Verificar**

```bash
cd ~/dev/myalq-fase2 && pnpm --filter inmobiliaria typecheck
```

En el navegador: entrar como `camila@delsol.com` (la que carga) con un contrato rechazado y ver el aviso; entrar como `roberto@delsol.com` (que rechazó) y **no** verlo.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(aprobacion): avisar en el panel a quien cargo un contrato rechazado"
```

---

## Cierre

- [ ] **Verificación final**

```bash
cd ~/dev/myalq-fase2 && pnpm --filter api test && pnpm --filter api lint && pnpm --filter inmobiliaria typecheck
```

Esperado: las mismas 5 fallas preexistentes y ninguna más; typechecks en 0.

- [ ] **E2E en navegador**, contra una base local efímera (nunca producción):

1. Cargar un contrato como `camila@delsol.com` (CARGA), con deuda declarada.
2. Como `roberto@delsol.com` (ADMIN), revisarlo y **rechazarlo** con un motivo concreto.
3. Volver como Camila: **el aviso aparece en el panel**.
4. Entrar al contrato: **se ve el motivo**, y el inquilino sigue ahí.
5. Corregir lo que le marcaron y **reenviar**.
6. Como Roberto: el contrato **volvió a la bandeja**, con los datos corregidos en el preview.
7. Aprobarlo → **queda ACTIVO con el dato corregido**, y las cuotas salen con ese monto.

- [ ] **Abrir el PR.** 🔴 **No mergear ni pushear a `main`.** ⚠️ Aclarar en el cuerpo que **depende del PR #41**.

## Lo que este plan NO hace

- **No** edita contratos activos: para eso están `PATCH /monto`, `PATCH /modo-cobranza` y `PUT /mora`.
- **No** manda mail: el SMTP no está configurado y el aviso va al panel.
- **No** revive el PIN.
- **No** toca los otros tres tipos de aprobación.
