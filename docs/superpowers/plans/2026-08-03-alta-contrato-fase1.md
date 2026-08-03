# Alta de contrato — Fase 1: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el alta de contrato deje de morder — partir "Términos" en Plazo y Dinero, permitir arrancar a cobrar desde este mes sin declarar 7 meses a mano, y cargar la cuenta del propietario sin salir del wizard.

**Architecture:** El wizard (`CargarContratoApiWizard`) mantiene sus `useState` en el componente padre — **no hay refactor a reducer** (ver spec, sección 1: se dio de baja). Los pasos pasan de 5 a 6 partiendo el actual paso 3. El backend suma un solo campo opcional al body de `POST /contratos` (`devengarDesde`), que la maquinaria de devengo **ya honra** de punta a punta. La cuenta del propietario se resuelve reusando un dialog que ya existe.

**Tech Stack:** pnpm monorepo · `apps/api` Fastify + Prisma + Postgres + vitest · `apps/inmobiliaria` Next 14 (App Router) · `packages/shared` TS crudo sin build.

**Spec:** `docs/superpowers/specs/2026-07-30-alta-contrato-fase1-design.md`

## Global Constraints

- **Worktree:** `~/dev/myalq-altapasos`, rama `feat/alta-contrato-pasos`, base `origin/main` = `cbf00a6`.
- **Nunca push ni merge a `main`.** Se trabaja en la rama y se abre PR.
- **Tests SIEMPRE contra Postgres local efímero. NUNCA la base remota/compartida.**
- **Baseline de typecheck: 0 errores.** Si `tsc --noEmit` tira algo, lo introdujo la tarea en curso. No se acepta "ya venía roto".
- **El front NO tiene runner de tests** (no hay vitest/jest en `apps/inmobiliaria`). Las tareas de front se verifican **en el navegador** con las tools de preview, y con `pnpm --filter inmobiliaria typecheck`. No inventar `pnpm test` en el front: no existe.
- **El wizard de OCR/PDF (`CargarContratoWizard`, `page.tsx:132-661`) es código muerto en prod.** No tocarlo, no arreglarlo, no revivirlo. Todo este plan es sobre `CargarContratoApiWizard`.
- **El servidor sigue validando todo lo que valida hoy.** Ninguna tarea afloja una regla del backend para mejorar la UI.
- Copy en **español rioplatense**, tuteo, sin jerga técnica en pantalla.

---

## File Structure

| Archivo | Responsabilidad | Tareas |
|---|---|---|
| `apps/api/src/routes/core.ts` | `POST /contratos`: acepta `devengarDesde`, lo persiste, valida exclusión con `periodosAnteriores`; constante única del mensaje de cobranza directa | 1, 5 |
| `apps/api/test/devengar-desde-alta.test.ts` | **(nuevo)** integración de `devengarDesde` | 1 |
| `apps/inmobiliaria/src/lib/contrato-borrador-storage.ts` | `BorradorContrato`: sumar `devengarDesde` y `versionBorrador` | 2, 4 |
| `apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx` | El wizard: pasos, preview, arranque de cuenta, stepper, cuenta del propietario, `beforeunload` | 2-7 |

---

## Task 1: Backend — `devengarDesde` en el alta

**Files:**
- Modify: `apps/api/src/routes/core.ts` (schema del body ~`:867-897`, `tx.contrato.create` ~`:996`)
- Test: `apps/api/test/devengar-desde-alta.test.ts` (crear)

**Interfaces:**
- Consumes: `enumerarPeriodosContrato` (`packages/shared/src/periodos.ts`) y `generarLiquidacionesContrato` (`apps/api/src/lib/liquidaciones.ts`) — **ya honran `devengarDesde`**, arrancando en `max(devengarDesde, fechaInicio)`. No se tocan.
- Produces: `POST /contratos` acepta `devengarDesde?: string | Date`. Lo consume el front en la Tarea 4.

**Contexto que el implementador necesita:**
`Contrato.devengarDesde` **ya existe** en el schema (`schema.prisma:1259`) y la importación masiva ya lo usa (`importaciones-cartera.ts:487-493`). Lo único que falta es que el alta manual lo acepte. **No hay migración en esta tarea.**

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/api/test/devengar-desde-alta.test.ts`. Copiar el andamiaje (`beforeAll`/`afterAll`/`auth`) de `apps/api/test/alta-contrato-integracion.test.ts:1-40` — mismo seed, mismo login (`roberto@delsol.com` / `delsol123`), misma `buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' })`.

```ts
/**
 * `devengarDesde` en el alta manual: un contrato que arrancó hace meses puede
 * nacer cobrando SOLO desde el mes en curso, sin declarar cada período vencido.
 * La maquinaria (enumerarPeriodosContrato → generarLiquidacionesContrato) ya lo
 * honraba; lo que faltaba era que POST /contratos lo aceptara.
 */
it('con devengarDesde del mes en curso, no genera cuotas anteriores', async () => {
  const hoy = new Date();
  const primeroDeEsteMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const inicioHace6Meses = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 6, 1));
  const fin = new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1));

  const res = await app.inject({
    method: 'POST',
    url: '/contratos',
    headers: auth(),
    payload: {
      propiedadId: await propiedadDisponible(),
      inquilino: { nombre: 'Devengo', apellido: 'Desde' },
      monto: 100000,
      fechaInicio: inicioHace6Meses.toISOString(),
      fechaFin: fin.toISOString(),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
      devengarDesde: primeroDeEsteMes.toISOString(),
    },
  });

  expect(res.statusCode).toBe(201);
  const contratoId = res.json().id as string;

  const prisma = new PrismaClient();
  const liqs = await prisma.liquidacion.findMany({ where: { contratoId }, select: { periodo: true } });
  await prisma.$disconnect();

  // Sin devengarDesde serían 7 (los 6 vencidos + el actual). Con él, sólo el actual.
  expect(liqs).toHaveLength(1);
});

it('devengarDesde junto con periodosAnteriores es 400', async () => {
  const hoy = new Date();
  const primeroDeEsteMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const inicioHace6Meses = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 6, 1));
  const mesPasado = `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth()).padStart(2, '0')}`;

  const res = await app.inject({
    method: 'POST',
    url: '/contratos',
    headers: auth(),
    payload: {
      propiedadId: await propiedadDisponible(),
      inquilino: { nombre: 'Doble', apellido: 'Declaracion' },
      monto: 100000,
      fechaInicio: inicioHace6Meses.toISOString(),
      fechaFin: new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1)).toISOString(),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
      devengarDesde: primeroDeEsteMes.toISOString(),
      periodosAnteriores: [{ periodo: mesPasado, estado: 'ADEUDA' }],
    },
  });

  expect(res.statusCode).toBe(400);
  expect(res.json().message).toMatch(/una sola/i);
});

it('sin devengarDesde, el alta se comporta igual que siempre (no regresión)', async () => {
  const hoy = new Date();
  const inicioHace2Meses = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 2, 1));

  const res = await app.inject({
    method: 'POST',
    url: '/contratos',
    headers: auth(),
    payload: {
      propiedadId: await propiedadDisponible(),
      inquilino: { nombre: 'Sin', apellido: 'Devengo' },
      monto: 100000,
      fechaInicio: inicioHace2Meses.toISOString(),
      fechaFin: new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1)).toISOString(),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
    },
  });

  expect(res.statusCode).toBe(201);
  const prisma = new PrismaClient();
  const liqs = await prisma.liquidacion.count({ where: { contratoId: res.json().id } });
  await prisma.$disconnect();
  expect(liqs).toBeGreaterThan(1); // los períodos vencidos siguen devengándose
});
```

Escribir también el helper `propiedadDisponible()` que devuelve el `id` de una propiedad en estado `DISPONIBLE` del tenant del seed (una por test — el alta la deja `ALQUILADA`):

```ts
async function propiedadDisponible(): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/propiedades?estado=DISPONIBLE', headers: auth() });
  const lista = res.json();
  const items = Array.isArray(lista) ? lista : lista.items;
  if (!items?.length) throw new Error('El seed no dejó propiedades DISPONIBLE para el test');
  return items[0].id;
}
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd ~/dev/myalq-altapasos/apps/api && pnpm vitest run test/devengar-desde-alta.test.ts
```

Esperado: **FAIL**. El primero da 7 liquidaciones en vez de 1 (zod descarta `devengarDesde` por no estar en el schema); el segundo da 201 en vez de 400.

- [ ] **Step 3: Sumar `devengarDesde` al schema del body**

En `apps/api/src/routes/core.ts`, dentro del `z.object({...})` de `POST /contratos`, justo **después** del bloque `periodosAnteriores` (~`:896`):

```ts
        // Contrato EN CURSO, camino corto: "empezar a cobrar desde este mes".
        // No devenga nada anterior a esta fecha — lo previo se saldó por afuera.
        // Es lo que la importación masiva ya hace (importaciones-cartera.ts:487).
        // EXCLUYENTE con periodosAnteriores: expresan lo mismo de dos maneras.
        devengarDesde: z.coerce.date().optional(),
```

- [ ] **Step 4: Validar la exclusión, antes de abrir la transacción**

En el mismo handler, junto a la validación de mora que ya está (~`:903`, `if (d.moraTipo && ...)`):

```ts
    if (d.devengarDesde && d.periodosAnteriores?.length) {
      return reply.code(400).send({
        message:
          'Elegí una sola forma de arrancar la cuenta: "empezar a cobrar desde este mes" o declarar los períodos anteriores uno por uno.',
      });
    }
```

- [ ] **Step 5: Persistir el campo**

En `tx.contrato.create({ data: {...} })` (~`:996`), sumar al `data`:

```ts
          devengarDesde: d.devengarDesde ?? null,
```

⚠️ Va **solo** en el `create`. `generarLiquidacionesContrato(tx, contrato)` (~`:1094`) recibe el contrato ya creado y lee el campo de ahí: no hay que pasarle nada aparte.

- [ ] **Step 6: Correr los tests y verificar que pasan**

```bash
cd ~/dev/myalq-altapasos/apps/api && pnpm vitest run test/devengar-desde-alta.test.ts
```

Esperado: **3 passed**.

- [ ] **Step 7: No regresión + typecheck**

```bash
cd ~/dev/myalq-altapasos/apps/api && pnpm vitest run && pnpm lint
```

Esperado: suite entera verde, `tsc --noEmit` sin output.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/routes/core.ts apps/api/test/devengar-desde-alta.test.ts
git commit -m "feat(alta): POST /contratos acepta devengarDesde, excluyente con periodosAnteriores"
```

---

## Task 2: Partir "Términos" en "Plazo y salida" + "Dinero"

**Files:**
- Modify: `apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx`
- Modify: `apps/inmobiliaria/src/lib/contrato-borrador-storage.ts`

**Interfaces:**
- Produces: `type PasoApi = 1 | 2 | 3 | 4 | 5 | 6` con el mapa nuevo. Las tareas 3-7 asumen esta numeración.

**Contexto crítico — la trampa del borrador:**
El borrador guarda `paso` en `localStorage` (`BorradorContrato.paso`). Los borradores que ya existen en el navegador de los usuarios tienen la numeración **vieja** (5 pasos). Si se renumera sin más, un borrador guardado en "Períodos anteriores" (viejo 4) se restaura en "Dinero" (nuevo 4) con los datos de otro paso. **Por eso esta tarea versiona el borrador y descarta los de versión anterior.**

**Mapa de la renumeración:**

| Viejo | Nuevo | Paso |
|---|---|---|
| 1 | 1 | Propiedad |
| 2 | 2 | Inquilino |
| 3 | **3 + 4** | Plazo y salida / Dinero (se parte) |
| 4 | 5 | Períodos anteriores (condicional) |
| 5 | 6 | Confirmar |

- [ ] **Step 1: Versionar el borrador**

En `apps/inmobiliaria/src/lib/contrato-borrador-storage.ts`, sumar a la interfaz `BorradorContrato` (arriba de todo, junto a `paso`):

```ts
export interface BorradorContrato {
  /**
   * Versión del ESQUEMA del borrador, no de los datos. Se sube cuando cambia la
   * numeración de los pasos o se agrega/quita un campo que rompe la restauración.
   * Un borrador con versión distinta se descarta en silencio: es preferible a
   * restaurar al usuario en el paso equivocado con los datos de otro.
   */
  version: number;
  paso: number;
  // ...el resto queda igual
```

Y exportar la constante, en el mismo archivo:

```ts
export const VERSION_BORRADOR = 2;
```

- [ ] **Step 2: Descartar borradores de otra versión al leer**

En `leerBorradorContrato` (`:65`), después de parsear el JSON y antes de devolverlo:

```ts
    if (parsed?.version !== VERSION_BORRADOR) return null;
```

- [ ] **Step 3: Escribir la versión al guardar**

En el wizard (`page.tsx:1178`), donde se arma el objeto que va a `guardarBorradorContrato`, sumar `version: VERSION_BORRADOR` al literal, e importar la constante desde `@/lib/contrato-borrador-storage` (el import ya existe en `:24-29`, agregarla ahí).

- [ ] **Step 4: Renumerar los pasos**

En `page.tsx`:

```ts
type PasoApi = 1 | 2 | 3 | 4 | 5 | 6;

const pasosApi: ReadonlyArray<{ id: PasoApi; label: string }> = [
  { id: 1, label: 'Propiedad' },
  { id: 2, label: 'Inquilino' },
  { id: 3, label: 'Plazo y salida' },
  { id: 4, label: 'Dinero' },
  { id: 5, label: 'Períodos anteriores' },
  { id: 6, label: 'Confirmar' },
];
```

Y actualizar **todos** los lugares que referencian la numeración vieja. Buscar con `grep -n "paso === [0-9]\|pasoRestaurado\|p.id !== 4" page.tsx` y ajustar:
- `pasosVisibles` (`:1248-1249`): el filtro condicional pasa de `p.id !== 4` a **`p.id !== 5`**.
- `aplicarBorrador` (`:1114`): `if (pasoRestaurado === 4 && periodosBorrador.length === 0) pasoRestaurado = 3;` pasa a **`=== 5` … `= 4`** (si no hay períodos, cae en Dinero, que es el paso anterior).
- Los bloques de render: `{paso === 4 && hayPeriodos && (` → `{paso === 5 && hayPeriodos && (`; `{paso === 5 && (` (Confirmar) → `{paso === 6 && (`.
- `avanzar()`/`retroceder()` (`:1068-1077`) y el salto condicional del paso de períodos: donde hoy salta `3 → 5`, ahora salta **`4 → 6`**.

⚠️ Renumerar **de mayor a menor** (primero 5→6, después 4→5) para no pisar un número con otro a mitad de camino.

- [ ] **Step 5: Partir el bloque de render del viejo paso 3**

El bloque `{paso === 3 && (` (`:1812`) contiene hoy los dos grupos. Se parte en dos bloques hermanos, **sin cambiar ningún campo, ni su orden interno, ni su lógica**:

- `{paso === 3 && (` → **Plazo y salida**: `fechaInicio`, `fechaFin`, `diaPago`, `indiceAjuste`, `frecuenciaAjusteMeses`.
- `{paso === 4 && (` → **Dinero**: `tipoContrato`, `monto`, `moneda`, `montoExpensas`, `depositoGarantia`, `comisionInmobiliaria`, `moraSel`/`moraValor`, `modoCobranza`, `mascotasPermitidas`.

Actualizar el `CardTitle`/`CardDescription` de cada uno:
- Plazo: *"Plazo y salida"* / *"Cuándo arranca, cuándo termina y cada cuánto se ajusta."*
- Dinero: *"Dinero"* / *"Cuánto paga el inquilino y cómo se cobra."*

- [ ] **Step 6: Mover la validación de "Continuar" al paso que corresponde**

La validación que hoy gatea el paso 3 se reparte: lo que valida fechas queda en 3, lo que valida montos pasa a 4. Ningún campo queda sin validar y ninguno se valida en el paso donde no se ve.

- [ ] **Step 7: Verificar en el navegador**

```bash
cd ~/dev/myalq-altapasos && pnpm --filter inmobiliaria typecheck
```

Esperado: sin output (baseline 0).

Después, con el preview levantado, recorrer el alta entera de un contrato **que arranca hoy** (el caso simple): las 5 pantallas visibles (sin períodos anteriores) se navegan, se puede volver atrás, y el alta termina en 201. Y probar el borrador: cargar medio contrato, recargar, retomar → cae en el paso correcto.

- [ ] **Step 8: Commit**

```bash
git add apps/inmobiliaria/src/app/\(app\)/contratos/nuevo/page.tsx apps/inmobiliaria/src/lib/contrato-borrador-storage.ts
git commit -m "feat(alta): partir Terminos en Plazo y salida + Dinero, versionar el borrador"
```

---

## Task 3: Preview en vivo de las consecuencias de las fechas

**Files:**
- Modify: `apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx` (bloque `{paso === 3 && (`)

**Interfaces:**
- Consumes: `enumerarPeriodosContrato` de `@llave/shared/periodos` — **ya está importada en el wizard** y es la fuente única compartida con el back. No duplicar el cálculo.

- [ ] **Step 1: Calcular el preview**

Debajo de los inputs de fecha del paso 3, con `useMemo` sobre `fechaInicio`/`fechaFin`/`diaPago`/`frecuenciaAjusteMeses`:

```tsx
const resumenPlazo = useMemo(() => {
  if (!fechaInicio || !fechaFin) return null;
  const inicio = new Date(`${fechaInicio}T12:00:00`);
  const fin = new Date(`${fechaFin}T12:00:00`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return null;
  if (fin <= inicio) return { error: 'La fecha de fin tiene que ser posterior a la de inicio.' };

  const meses = Math.round((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  const mesesDesdeInicio = Math.max(
    0,
    Math.round((Date.now() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 30.44)),
  );
  const freq = Number(frecuenciaAjusteMeses) || 12;
  const primerAjuste = new Date(inicio);
  primerAjuste.setMonth(primerAjuste.getMonth() + freq);

  return { meses, mesesDesdeInicio, primerAjuste, error: null as string | null };
}, [fechaInicio, fechaFin, frecuenciaAjusteMeses]);
```

- [ ] **Step 2: Mostrarlo**

```tsx
{resumenPlazo?.error && (
  <p className="text-sm text-destructive">{resumenPlazo.error}</p>
)}
{resumenPlazo && !resumenPlazo.error && (
  <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
    <p>Dura {resumenPlazo.meses} meses.</p>
    {resumenPlazo.mesesDesdeInicio > 0 && (
      <p className="text-foreground">
        Este contrato arrancó hace {resumenPlazo.mesesDesdeInicio}{' '}
        {resumenPlazo.mesesDesdeInicio === 1 ? 'mes' : 'meses'}: más adelante vas a
        elegir desde cuándo cobrarlo.
      </p>
    )}
    <p>Primer ajuste: {formatFechaCortaStr(resumenPlazo.primerAjuste.toISOString().slice(0, 10))}.</p>
  </div>
)}
```

⚠️ El error de `fechaFin <= fechaInicio` **también sigue gateando el botón Continuar**. El preview lo explica; no lo reemplaza.

- [ ] **Step 3: Verificar en el navegador**

Typecheck limpio. En el preview: poner un inicio de hace 6 meses → aparece *"arrancó hace 6 meses"*; poner `fechaFin` anterior al inicio → aparece el error en rojo **ahí**, y Continuar queda deshabilitado.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(alta): preview en vivo de las consecuencias de las fechas"
```

---

## Task 4: Arranque de cuenta — "empezar a cobrar desde este mes"

**Files:**
- Modify: `apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx` (paso 5, el de períodos)
- Modify: `apps/inmobiliaria/src/lib/contrato-borrador-storage.ts`

**Interfaces:**
- Consumes: `POST /contratos` con `devengarDesde` (Tarea 1).

- [ ] **Step 1: Estado nuevo + al borrador**

En el wizard:

```ts
type ArranqueCuenta = 'DESDE_ESTE_MES' | 'MES_POR_MES';
const [arranqueCuenta, setArranqueCuenta] = useState<ArranqueCuenta>('MES_POR_MES');
```

🔴 **Sumarlo a `BorradorContrato`** (`arranqueCuenta: string`), al objeto que se guarda en `:1178`, y a `aplicarBorrador`. Si se agrega al wizard y no al borrador, se pierde en silencio al retomar y el contrato nace con la deuda equivocada. **Subir `VERSION_BORRADOR` a 3.**

- [ ] **Step 2: Los dos caminos en el paso 5**

Arriba de la tabla de períodos que ya existe, dos opciones excluyentes:

```tsx
<div className="space-y-2">
  <button
    type="button"
    onClick={() => setArranqueCuenta('DESDE_ESTE_MES')}
    className={`w-full rounded-md border p-3 text-left text-sm ${arranqueCuenta === 'DESDE_ESTE_MES' ? 'border-primary bg-primary/5' : ''}`}
  >
    <span className="font-medium">Empezar a cobrar desde este mes</span>
    <span className="block text-muted-foreground">
      Lo anterior no se carga al sistema: queda saldado por afuera. Es lo más rápido.
    </span>
  </button>
  <button
    type="button"
    onClick={() => setArranqueCuenta('MES_POR_MES')}
    className={`w-full rounded-md border p-3 text-left text-sm ${arranqueCuenta === 'MES_POR_MES' ? 'border-primary bg-primary/5' : ''}`}
  >
    <span className="font-medium">Declarar mes por mes</span>
    <span className="block text-muted-foreground">
      Cargás qué pasó con cada uno de los {periodosVencidos.length} períodos vencidos.
    </span>
  </button>
</div>
```

La tabla de períodos se muestra **solo** con `arranqueCuenta === 'MES_POR_MES'`.

- [ ] **Step 3: Mandar el campo correcto en el alta**

En `dar_de_alta`, donde hoy se arma `periodosAnteriores`:

```ts
      ...(arranqueCuenta === 'DESDE_ESTE_MES'
        ? { devengarDesde: primerDiaDelMesActualISO() }
        : { periodosAnteriores: periodosVencidos.map((p) => { /* lo de hoy */ }) }),
```

Con el helper, junto a los otros de fecha del archivo:

```ts
function primerDiaDelMesActualISO(): string {
  const h = new Date();
  return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), 1)).toISOString();
}
```

🔴 **Nunca los dos juntos**: el backend responde 400 (Tarea 1) y el contrato no se crea.

- [ ] **Step 4: Reflejarlo en Confirmar**

En el paso 6, donde se resume el alta, mostrar cuál se eligió: *"Se empieza a cobrar desde {mes actual}. Los {N} meses anteriores no se cargan."* o *"Se declaran {N} períodos anteriores."*

- [ ] **Step 5: Verificar en el navegador**

Typecheck limpio. Alta de un contrato que arrancó hace 6 meses eligiendo *"desde este mes"* → se crea con **1 cuota, no 7** (verificar en el detalle del contrato). Y el otro camino sigue funcionando igual que hoy.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(alta): empezar a cobrar desde este mes, sin declarar mes por mes"
```

---

## Task 5: Cuenta del propietario, sin salir del alta

**Files:**
- Modify: `apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx` (paso 4, Dinero)
- Modify: `apps/api/src/routes/core.ts` (unificar el mensaje duplicado)

**Interfaces:**
- Consumes: `CuentaCobranzaDialog` de `@/components/cuenta-cobranza-dialog`, props `{ open, onOpenChange, propietario, onSaved? }`. Ya ramifica bien: con `apiEnabled` pega a `setCuentaCobranzaDirecta`; solo en demo escribe localStorage.

- [ ] **Step 1: Unificar el mensaje duplicado del backend**

El mismo texto está hardcodeado en `core.ts:974` y `core.ts:2883`. Extraerlo a una constante junto a los otros helpers del módulo:

```ts
const faltaCuentaCobranzaDirecta = (nombre: string) =>
  `Falta la cuenta de cobro directo de ${nombre}`.trim() +
  '. Entrá a la ficha del propietario → "Cuenta de cobranza directa" y cargá banco + CBU (22 dígitos) + alias. (El CBU/alias del alta del propietario NO alcanza para el cobro directo.)';
```

y usarla en los dos lugares. **No se cambia el texto ni se afloja la validación**: sigue siendo 400.

- [ ] **Step 2: Traer el estado de la cuenta al wizard**

🔴 **La trampa que hay que evitar:** la propiedad elegida ya expone `propietarios: Propietario[]`
(`PropiedadEnriquecida`, `lib/propiedades-helpers.ts:16`), **pero esos son "lite"**: `propietarioLite`
(`lib/api/hooks.ts:895`) solo copia `id`, `nombre` y `apellido` de lo que viene embebido en
`/propiedades`. **`cuentaCobranza` siempre viene `undefined` ahí.** Si se lee de esa lista, el aviso
de "no tiene cuenta" aparece **siempre**, incluso para propietarios que sí la tienen cargada.

El detalle completo lo trae `usePropietarios()` (`hooks.ts:1089`, queryKey `['propietarios']`), cuyo
`Propietario` sí tiene `cuentaCobranza?: CuentaCobranzaDirecta`. Entonces: **id desde la propiedad,
cuenta desde `usePropietarios()`**.

```ts
const { propietarios } = usePropietarios();

const propietarioDeLaPropiedad = useMemo(() => {
  const prop = disponibles.find((p) => p.propiedad.id === propiedadId);
  const lite = prop?.propietarios[0];
  if (!lite) return null;
  // El lite NO trae cuentaCobranza: hay que resolverlo contra el detalle.
  return propietarios.find((o) => o.id === lite.id) ?? lite;
}, [disponibles, propiedadId, propietarios]);
```

🔴 **Si la propiedad no tiene propietarios cargados** (`propietarioDeLaPropiedad === null`), no hay a
quién cargarle la cuenta: mostrar el mensaje que ya existe (*"La propiedad necesita dueños cargados…"*)
y **no** el botón. El dialog no resuelve ese caso.

- [ ] **Step 3: El aviso con el botón**

```tsx
{modoCobranza === 'PROPIETARIO_DIRECTO' && propietarioDeLaPropiedad && (
  propietarioDeLaPropiedad.cuentaCobranza ? (
    <div className="rounded-md border bg-muted/40 p-3 text-sm">
      <p className="font-medium">Cuenta de {propietarioDeLaPropiedad.nombre}</p>
      <p className="text-muted-foreground">
        {propietarioDeLaPropiedad.cuentaCobranza.banco} · CBU ····
        {propietarioDeLaPropiedad.cuentaCobranza.cbu.slice(-4)} ·{' '}
        {propietarioDeLaPropiedad.cuentaCobranza.alias}
      </p>
      <Button variant="link" className="h-auto p-0" onClick={() => setCuentaDialogAbierto(true)}>
        Editar
      </Button>
    </div>
  ) : (
    <div className="rounded-md border border-amber-500/50 bg-amber-500/5 p-3 text-sm">
      <p className="font-medium">
        {propietarioDeLaPropiedad.nombre} todavía no tiene cuenta de cobro directo
      </p>
      <p className="text-muted-foreground">
        Sin la cuenta, el inquilino no tiene a dónde transferir. Cargala acá y seguí con el alta.
      </p>
      <Button size="sm" className="mt-2" onClick={() => setCuentaDialogAbierto(true)}>
        Cargar la cuenta del propietario
      </Button>
    </div>
  )
)}

<CuentaCobranzaDialog
  open={cuentaDialogAbierto}
  onOpenChange={setCuentaDialogAbierto}
  propietario={propietarioDeLaPropiedad}
  onSaved={() => void qc.invalidateQueries({ queryKey: ['propietarios'] })}
/>
```

⚠️ El query client en este componente se llama **`qc`** (`page.tsx:857`), no `queryClient`. Y la key a invalidar es **`['propietarios']`** — la de `usePropietarios()`, que es de donde sale `cuentaCobranza`. Invalidar `['propiedades']` no sirve: ese listado trae los dueños "lite", sin cuenta.

- [ ] **Step 4: Verificar en el navegador**

Typecheck limpio. Con una propiedad cuyo propietario **no** tiene cuenta: elegir cobranza directa → aparece el aviso → cargar la cuenta en el dialog → el aviso se reemplaza por los datos → **seguir el alta sin recargar y sin perder ningún campo ya tipeado** → 201. Y el caso negativo: propiedad sin propietarios → sale el mensaje de la ficha de la propiedad, no el botón.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(alta): cargar la cuenta del propietario sin salir del wizard"
```

---

## Task 6: Stepper clickeable hacia atrás + errores visibles

**Files:**
- Modify: `apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx` (`StepsApi`, `:2411`)

- [ ] **Step 1: Hacer clickeables los pasos ya visitados**

Hoy `StepsApi` pinta un `<div>` (`:2426`) y no recibe callback. Sumarle `onIr` y `maxVisitado`:

```tsx
function StepsApi({
  actual,
  pasos,
  onIr,
}: {
  actual: PasoApi;
  pasos: ReadonlyArray<{ id: PasoApi; label: string }>;
  onIr: (p: PasoApi) => void;
}) {
```

y en el `map`, envolver el círculo + label en un `<button>` cuando `p.id < actual`:

```tsx
const visitado = p.id < actual;
// ...
<button
  type="button"
  disabled={!visitado}
  onClick={() => visitado && onIr(p.id)}
  className={`flex items-center gap-2 sm:gap-3 ${visitado ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
  aria-label={visitado ? `Volver a ${p.label}` : undefined}
>
```

Hacia adelante **no** se puede saltar: sigue requiriendo la validación del paso.

- [ ] **Step 2: Cablearlo**

En `:1521`: `<StepsApi actual={paso} pasos={pasosVisibles} onIr={(p) => setPaso(p)} />`

- [ ] **Step 3: Explicar por qué no se puede avanzar**

Donde hoy el botón "Continuar" queda `disabled` sin decir nada, mostrar el motivo debajo:

```tsx
{!puedeAvanzar && motivoNoAvanza && (
  <p className="text-xs text-muted-foreground">{motivoNoAvanza}</p>
)}
```

con `motivoNoAvanza` derivado de la misma condición que ya gatea el botón — un string por paso (*"Elegí una propiedad para seguir."*, *"Completá el nombre del inquilino."*, *"Revisá las fechas: la de fin tiene que ser posterior a la de inicio."*, *"Cargá el monto del alquiler."*). **No duplicar la lógica**: la condición es la que ya existe, el string es nuevo.

- [ ] **Step 4: Verificar en el navegador**

Typecheck limpio. Llegar al paso 4, clickear "Propiedad" en el stepper → vuelve al 1 **con todo cargado**; clickear un paso adelantado → no hace nada. Dejar el monto vacío → el botón está deshabilitado **y dice por qué**.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(alta): stepper clickeable hacia atras y motivo visible al no poder avanzar"
```

---

## Task 7: Cerrar el borrador — `beforeunload` y aviso de adjuntos

**Files:**
- Modify: `apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx`

**Contexto:** el autosave, el diálogo de retomar y el borrado al confirmar **ya existen y funcionan** (`df23fab`, 30/07). Esta tarea cierra las dos puntas que faltan. **No reescribir nada de lo que ya anda.**

- [ ] **Step 1: `beforeunload`**

```ts
// El borrador ya se guarda en cada tecleo, pero entre el último guardado y el
// cierre de la pestaña puede haber tipeo sin persistir. Además, el usuario que
// cierra sin querer no tiene forma de saber que hay un borrador esperándolo.
useEffect(() => {
  if (paso === 1 && !propiedadId) return; // wizard vacío: no molestar
  if (enviando) return; // alta en curso: el 'estás seguro' del navegador estorba
  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [paso, propiedadId, enviando]);
```

- [ ] **Step 2: Avisar por los adjuntos al retomar**

En el `DialogDescription` del diálogo de borrador (`:2385-2388`), agregar debajo del texto que ya está:

```tsx
<span className="mt-2 block">
  Ojo: las fotos del DNI que hayas adjuntado no se guardan en el borrador, hay que
  volver a elegirlas.
</span>
```

⚠️ Mostrarlo **siempre** que se ofrece retomar: el borrador no sabe si había archivos cargados (los `File` nunca se guardan), así que no se puede condicionar sin mentir.

- [ ] **Step 3: Verificar en el navegador**

Typecheck limpio. Cargar medio contrato → intentar cerrar la pestaña → el navegador pregunta. Recargar → el diálogo de retomar aparece **con el aviso de las fotos**. Retomar → todo vuelve menos los archivos. Dar de alta con éxito → cerrar la pestaña **no** pregunta (el borrador ya se borró).

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(alta): avisar antes de cerrar con un alta a medias y aclarar que los adjuntos no se guardan"
```

---

## Cierre

- [ ] **Verificación final completa**

```bash
cd ~/dev/myalq-altapasos && pnpm --filter api test && pnpm --filter api lint && pnpm --filter inmobiliaria typecheck
```

Esperado: suite de API verde, ambos typechecks sin output (baseline 0 errores).

- [ ] **Recorrido E2E de los dos casos que importan**

1. **Alta simple** (contrato que arranca hoy): 5 pantallas, sin paso de períodos, 201.
2. **Cartera en curso** (arrancó hace 6 meses, cobranza directa, propietario sin cuenta): preview avisa que arrancó hace 6 meses → en Dinero se carga la cuenta del propietario sin salir → *"empezar a cobrar desde este mes"* → se crea con **1 cuota**.

- [ ] **Abrir el PR** contra `main`. 🔴 **No mergear ni pushear a `main`.**

## Lo que este plan NO hace

- No refactoriza los `useState` a `useReducer` (dado de baja en el spec: su justificación era falsa).
- No crea modelo, migración ni endpoints de borrador en servidor. El borrador es de `localStorage` y ya funciona.
- No toca `ContratoDraft` ni el wizard de OCR muerto.
- No agrega documentación obligatoria, garantía, servicios ni rescisión: son Fases 2 y 3, bloqueadas esperando decisiones de Camila.
