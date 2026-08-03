# Alta de contrato — Fase 1: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Partir el alta de contrato en pasos que pidan mejor la información — separar Plazo de Dinero, adelantar las consecuencias de las fechas, poder cargar la cuenta del propietario sin salir del wizard, y cerrar las dos puntas que le faltan al borrador.

**Architecture:** El wizard (`CargarContratoApiWizard`) mantiene sus `useState` en el componente padre — **no hay refactor a reducer** (spec §1: dado de baja). Los pasos pasan de 5 a 6 partiendo el actual paso 3. **Todo el trabajo es de front**, salvo unificar un mensaje duplicado en el backend: no se agregan campos al modelo, no hay migración, no cambia el contrato de la API.

**Tech Stack:** pnpm monorepo · `apps/api` Fastify + Prisma + Postgres + vitest · `apps/inmobiliaria` Next 14 (App Router) · `packages/shared` TS crudo sin build.

**Spec:** `docs/superpowers/specs/2026-07-30-alta-contrato-fase1-design.md`

## Global Constraints

- **Worktree:** `~/dev/myalq-altapasos`, rama `feat/alta-contrato-pasos`, base `origin/main` = `cbf00a6`.
- ⚠️ **Hay otras sesiones commiteando en esta misma rama.** Antes de empezar cada tarea: `git pull --rebase` o al menos `git log --oneline -3` para no trabajar sobre una base vieja.
- **Nunca push ni merge a `main`.** Se trabaja en la rama y se abre PR.
- **Tests SIEMPRE contra Postgres local efímero. NUNCA la base remota/compartida.**
- **Baseline de typecheck: 0 errores.** Si `tsc --noEmit` tira algo, lo introdujo la tarea en curso.
- **El front NO tiene runner de tests** (no hay vitest/jest en `apps/inmobiliaria`). Las tareas de front se verifican **en el navegador** con las tools de preview, más `pnpm --filter inmobiliaria typecheck`. No inventar `pnpm test` en el front: no existe.
- 🔴 **NO agregar `devengarDesde` ni ningún camino de "empezar a cobrar desde este mes".** Alan lo descartó el 03/08: la deuda anterior al alta tiene que quedar **declarada, trackeada y cobrable**. Declarar mes por mes — lo que ya hace el wizard — es el comportamiento correcto. No "optimizarlo".
- **El wizard de OCR/PDF (`CargarContratoWizard`, `page.tsx:132-661`) es código muerto en prod.** No tocarlo, no arreglarlo, no revivirlo. Todo este plan es sobre `CargarContratoApiWizard`.
- **El servidor sigue validando todo lo que valida hoy.** Ninguna tarea afloja una regla del backend para mejorar la UI.
- Copy en **español rioplatense**, tuteo, sin jerga técnica en pantalla.

---

## File Structure

| Archivo | Responsabilidad | Tareas |
|---|---|---|
| `apps/inmobiliaria/src/lib/contrato-borrador-storage.ts` | `BorradorContrato`: versionado del esquema | 1 |
| `apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx` | El wizard: pasos, preview, cuenta del propietario, stepper, `beforeunload` | 1-5 |
| `apps/api/src/routes/core.ts` | Unificar el mensaje duplicado de cobranza directa | 3 |

---

## Task 1: Partir "Términos" en "Plazo y salida" + "Dinero"

**Files:**
- Modify: `apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx`
- Modify: `apps/inmobiliaria/src/lib/contrato-borrador-storage.ts`

**Interfaces:**
- Produces: `type PasoApi = 1 | 2 | 3 | 4 | 5 | 6` con el mapa nuevo. Las tareas 2-5 asumen esta numeración.

**Contexto crítico — la trampa del borrador:**
El borrador guarda `paso` en `localStorage` (`BorradorContrato.paso`). Los borradores que **ya existen en el navegador de los usuarios** tienen la numeración vieja (5 pasos). Si se renumera sin más, un borrador guardado en "Períodos anteriores" (viejo 4) se restaura en "Dinero" (nuevo 4), con los datos de otro paso. **Por eso esta tarea versiona el borrador y descarta los de versión anterior.**

**Mapa de la renumeración:**

| Viejo | Nuevo | Paso |
|---|---|---|
| 1 | 1 | Propiedad |
| 2 | 2 | Inquilino |
| 3 | **3 + 4** | Plazo y salida / Dinero (se parte) |
| 4 | 5 | Períodos anteriores (condicional) |
| 5 | 6 | Confirmar |

- [ ] **Step 1: Versionar el borrador**

En `apps/inmobiliaria/src/lib/contrato-borrador-storage.ts`, sumar a `BorradorContrato`, arriba de `paso`:

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

Y exportar la constante en el mismo archivo:

```ts
export const VERSION_BORRADOR = 2;
```

- [ ] **Step 2: Descartar borradores de otra versión al leer**

En `leerBorradorContrato` (`:65`), después de parsear el JSON y antes de devolverlo:

```ts
    if (parsed?.version !== VERSION_BORRADOR) return null;
```

- [ ] **Step 3: Escribir la versión al guardar**

En el wizard (`page.tsx:1178`), donde se arma el objeto que va a `guardarBorradorContrato`, sumar `version: VERSION_BORRADOR` al literal. Importar la constante en el bloque de import que ya existe (`:24-29`).

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

Actualizar **todos** los lugares con la numeración vieja. Encontrarlos con:

```bash
grep -n "paso === [0-9]\|pasoRestaurado\|p.id !== 4\|setPaso(" 'apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx'
```

Los que hay que tocar sí o sí:
- `pasosVisibles` (`:1248-1249`): el filtro condicional pasa de `p.id !== 4` a **`p.id !== 5`**.
- `aplicarBorrador` (`:1114`): `if (pasoRestaurado === 4 && periodosBorrador.length === 0) pasoRestaurado = 3;` pasa a **`=== 5` … `= 4`** (sin períodos, cae en Dinero, el paso anterior).
- Render: `{paso === 4 && hayPeriodos && (` → `{paso === 5 && …`; `{paso === 5 && (` (Confirmar) → `{paso === 6 && (`.
- `avanzar()`/`retroceder()` (`:1068-1077`) y el salto condicional del paso de períodos: donde hoy salta `3 → 5`, ahora salta **`4 → 6`**.

⚠️ Renumerar **de mayor a menor** (primero 5→6, después 4→5) para no pisar un número con otro a mitad de camino.

- [ ] **Step 5: Partir el bloque de render del viejo paso 3**

El bloque `{paso === 3 && (` (`:1812`) contiene hoy los dos grupos. Se parte en dos bloques hermanos, **sin cambiar ningún campo, ni su orden interno, ni su lógica**:

- `{paso === 3 && (` → **Plazo y salida**: `fechaInicio`, `fechaFin`, `diaPago`, `indiceAjuste`, `frecuenciaAjusteMeses`.
- `{paso === 4 && (` → **Dinero**: `tipoContrato`, `monto`, `moneda`, `montoExpensas`, `depositoGarantia`, `comisionInmobiliaria`, `moraSel`/`moraValor`, `modoCobranza`, `mascotasPermitidas`.

Títulos:
- Plazo: *"Plazo y salida"* / *"Cuándo arranca, cuándo termina y cada cuánto se ajusta."*
- Dinero: *"Dinero"* / *"Cuánto paga el inquilino y cómo se cobra."*

- [ ] **Step 6: Repartir la validación de "Continuar"**

La condición que hoy gatea el paso 3 se reparte: lo de fechas queda en 3, lo de montos pasa a 4. **Ningún campo queda sin validar y ninguno se valida en un paso donde no se ve.**

- [ ] **Step 7: Verificar**

```bash
cd ~/dev/myalq-altapasos && pnpm --filter inmobiliaria typecheck
```

Esperado: sin output (baseline 0).

En el navegador: recorrer el alta de un contrato **que arranca hoy** (caso simple) — las 5 pantallas visibles se navegan, se puede volver atrás, termina en 201. Y el borrador: cargar medio contrato, recargar, retomar → cae en el paso correcto.

- [ ] **Step 8: Commit**

```bash
git add "apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx" apps/inmobiliaria/src/lib/contrato-borrador-storage.ts
git commit -m "feat(alta): partir Terminos en Plazo y salida + Dinero, versionar el borrador"
```

---

## Task 2: Preview en vivo de las consecuencias de las fechas

**Files:**
- Modify: `apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx` (bloque `{paso === 3 && (`)

**Interfaces:**
- Consumes: nada nuevo. **No duplicar el cálculo de períodos**: `enumerarPeriodosContrato` de `@llave/shared/periodos` ya está importada en el wizard y es la fuente única compartida con el back (fix i36). Si hace falta contar períodos vencidos, usar la que ya está.

- [ ] **Step 1: Calcular el preview**

Con `useMemo` sobre las fechas, junto a los otros `useMemo` del componente:

```ts
const resumenPlazo = useMemo(() => {
  if (!fechaInicio || !fechaFin) return null;
  const inicio = new Date(`${fechaInicio}T12:00:00`);
  const fin = new Date(`${fechaFin}T12:00:00`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return null;
  if (fin <= inicio) return { error: 'La fecha de fin tiene que ser posterior a la de inicio.' as string | null };

  const MES_MS = 1000 * 60 * 60 * 24 * 30.44;
  const meses = Math.round((fin.getTime() - inicio.getTime()) / MES_MS);
  const mesesDesdeInicio = Math.max(0, Math.round((Date.now() - inicio.getTime()) / MES_MS));
  const primerAjuste = new Date(inicio);
  primerAjuste.setMonth(primerAjuste.getMonth() + (Number(frecuenciaAjusteMeses) || 12));

  return { meses, mesesDesdeInicio, primerAjuste, error: null as string | null };
}, [fechaInicio, fechaFin, frecuenciaAjusteMeses]);
```

- [ ] **Step 2: Mostrarlo debajo de los inputs de fecha**

```tsx
{resumenPlazo?.error && <p className="text-sm text-destructive">{resumenPlazo.error}</p>}
{resumenPlazo && !resumenPlazo.error && (
  <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
    <p>Dura {resumenPlazo.meses} meses.</p>
    {resumenPlazo.mesesDesdeInicio > 0 && (
      <p className="text-foreground">
        Este contrato arrancó hace {resumenPlazo.mesesDesdeInicio}{' '}
        {resumenPlazo.mesesDesdeInicio === 1 ? 'mes' : 'meses'}: más adelante vas a tener
        que declarar qué pasó con cada uno de esos períodos.
      </p>
    )}
    <p>Primer ajuste: {formatFechaCortaStr(resumenPlazo.primerAjuste.toISOString().slice(0, 10))}.</p>
  </div>
)}
```

⚠️ El error de `fechaFin <= fechaInicio` **también sigue gateando el botón Continuar**. El preview lo explica; no lo reemplaza.

- [ ] **Step 3: Verificar**

Typecheck limpio. En el navegador: inicio de hace 6 meses → aparece *"arrancó hace 6 meses"*; `fechaFin` anterior al inicio → el error sale **ahí** y Continuar queda deshabilitado.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(alta): preview en vivo de las consecuencias de las fechas"
```

---

## Task 3: Cuenta del propietario, sin salir del alta

**Files:**
- Modify: `apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx` (paso 4, Dinero)
- Modify: `apps/api/src/routes/core.ts` (unificar el mensaje duplicado)

**Interfaces:**
- Consumes: `CuentaCobranzaDialog` de `@/components/cuenta-cobranza-dialog`, props `{ open, onOpenChange, propietario, onSaved? }`. Ya ramifica bien: con `apiEnabled` pega a `setCuentaCobranzaDirecta`; solo en demo escribe localStorage. **No hay endpoint nuevo**: `PUT /propietarios/:id/cuenta-cobranza-directa` (`core.ts:668`) ya hace upsert.

- [ ] **Step 1: Unificar el mensaje duplicado del backend**

El mismo texto está hardcodeado en `core.ts:974` y `core.ts:2883`. Extraerlo a una constante del módulo:

```ts
const faltaCuentaCobranzaDirecta = (nombre: string) =>
  `Falta la cuenta de cobro directo de ${nombre}`.trim() +
  '. Entrá a la ficha del propietario → "Cuenta de cobranza directa" y cargá banco + CBU (22 dígitos) + alias. (El CBU/alias del alta del propietario NO alcanza para el cobro directo.)';
```

y usarla en los dos lugares. **No se cambia el texto ni se afloja la validación**: sigue siendo 400.

```bash
cd ~/dev/myalq-altapasos/apps/api && pnpm vitest run && pnpm lint
```

Esperado: suite verde, typecheck sin output.

- [ ] **Step 2: Resolver el propietario con su cuenta**

🔴 **La trampa que hay que evitar:** la propiedad elegida ya expone `propietarios: Propietario[]`
(`PropiedadEnriquecida`, `lib/propiedades-helpers.ts:16`), **pero esos son "lite"**: `propietarioLite`
(`lib/api/hooks.ts:895`) solo copia `id`, `nombre` y `apellido` de lo que viene embebido en
`/propiedades`. **`cuentaCobranza` siempre viene `undefined` ahí.** Si se lee de esa lista, el aviso de
"no tiene cuenta" aparece **siempre**, incluso para propietarios que sí la tienen cargada.

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

`usePropietarios` se importa del mismo módulo que `usePropiedades` (`@/lib/api/hooks`, import en `:31`).

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

⚠️ El query client en este componente se llama **`qc`** (`page.tsx:857`), no `queryClient`. Y la key a invalidar es **`['propietarios']`** — la de `usePropietarios()`, de donde sale `cuentaCobranza`. Invalidar `['propiedades']` no sirve: ese listado trae los dueños "lite", sin cuenta.

🔴 **Si la propiedad no tiene propietarios cargados** (`propietarioDeLaPropiedad === null`), no hay a quién cargarle la cuenta: mostrar el mensaje que ya existe (*"La propiedad necesita dueños cargados…"*) y **no** el botón. El dialog no resuelve ese caso.

- [ ] **Step 4: Verificar**

Typecheck limpio (front y api). En el navegador, con una propiedad cuyo propietario **no** tiene cuenta: elegir cobranza directa → aparece el aviso → cargar la cuenta en el dialog → el aviso se reemplaza por los datos → **seguir el alta sin recargar y sin perder ningún campo ya tipeado** → 201. Caso negativo: propiedad sin propietarios → sale el mensaje de la ficha de la propiedad, no el botón.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(alta): cargar la cuenta del propietario sin salir del wizard"
```

---

## Task 4: Stepper clickeable hacia atrás + errores visibles

**Files:**
- Modify: `apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx` (`StepsApi`, `:2411`)

- [ ] **Step 1: Hacer clickeables los pasos ya visitados**

Hoy `StepsApi` pinta un `<div>` (`:2426`) y no recibe callback. Sumarle `onIr`:

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

y en el `map`, envolver el círculo + label en un `<button>`:

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

Donde hoy "Continuar" queda `disabled` sin decir nada, mostrar el motivo debajo:

```tsx
{!puedeAvanzar && motivoNoAvanza && (
  <p className="text-xs text-muted-foreground">{motivoNoAvanza}</p>
)}
```

`motivoNoAvanza` se deriva de **la misma condición que ya gatea el botón** — un string por paso: *"Elegí una propiedad para seguir."* · *"Completá el nombre del inquilino."* · *"Revisá las fechas: la de fin tiene que ser posterior a la de inicio."* · *"Cargá el monto del alquiler."* **No duplicar la lógica**: la condición ya existe, el string es lo nuevo.

- [ ] **Step 4: Verificar**

Typecheck limpio. En el navegador: llegar al paso 4, clickear "Propiedad" en el stepper → vuelve al 1 **con todo cargado**; clickear un paso adelantado → no hace nada. Dejar el monto vacío → el botón está deshabilitado **y dice por qué**.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(alta): stepper clickeable hacia atras y motivo visible al no poder avanzar"
```

---

## Task 5: Cerrar el borrador — `beforeunload` y aviso de adjuntos

**Files:**
- Modify: `apps/inmobiliaria/src/app/(app)/contratos/nuevo/page.tsx`

**Contexto:** el autosave, el diálogo de retomar y el borrado al confirmar **ya existen y funcionan** (`df23fab`, 30/07). Esta tarea cierra las dos puntas que faltan. **No reescribir nada de lo que ya anda.**

- [ ] **Step 1: `beforeunload`**

```ts
// El borrador ya se guarda en cada tecleo, pero entre el último guardado y el
// cierre de la pestaña puede haber tipeo sin persistir. Además, el que cierra
// sin querer no tiene forma de saber que hay un borrador esperándolo.
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

En el `DialogDescription` del diálogo de borrador (`:2385-2388`), debajo del texto que ya está:

```tsx
<span className="mt-2 block">
  Ojo: las fotos del DNI que hayas adjuntado no se guardan en el borrador, hay que
  volver a elegirlas.
</span>
```

⚠️ Mostrarlo **siempre** que se ofrece retomar: el borrador no sabe si había archivos cargados (los `File` nunca se guardan), así que no se puede condicionar sin mentir.

- [ ] **Step 3: Verificar**

Typecheck limpio. En el navegador: cargar medio contrato → intentar cerrar la pestaña → el navegador pregunta. Recargar → el diálogo de retomar aparece **con el aviso de las fotos**. Retomar → vuelve todo menos los archivos. Dar de alta con éxito → cerrar la pestaña **no** pregunta (el borrador ya se borró).

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
2. **Cartera en curso** (arrancó hace 6 meses, cobranza directa, propietario sin cuenta): el preview avisa que arrancó hace 6 meses → en Dinero se carga la cuenta del propietario sin salir → se declaran los 6 períodos mes por mes → el contrato nace con **esa deuda trackeada y cobrable**.

- [ ] **Abrir el PR** contra `main`. 🔴 **No mergear ni pushear a `main`.**

## Lo que este plan NO hace

- **No agrega `devengarDesde` ni "empezar a cobrar desde este mes"**: Alan lo descartó el 03/08. La deuda anterior se declara y queda cobrable.
- No refactoriza los `useState` a `useReducer` (dado de baja en el spec: su justificación era falsa).
- No crea modelo, migración ni endpoints de borrador en servidor. El borrador es de `localStorage` y ya funciona.
- No toca `ContratoDraft` ni el wizard de OCR muerto.
- No agrega documentación obligatoria, garantía, servicios ni rescisión: son Fases 2 y 3. De esas, **#4 (servicios) y #5 (rescisión) están respondidas a medias** — falta si el número de cuenta es obligatorio y qué forma tiene el valor de la rescisión.
