# Guía de frontend — My Alquiler

> El patrón `apiEnabled` (real vs demo), convenciones de hooks, subida de archivos y
> el design system `@llave/ui`. Aplica a `apps/inmobiliaria` (panel) y `apps/inquilino` (PWA).

---

## Visión general

Dos apps Next.js 14 (App Router) consumen el mismo API Fastify: `apps/inmobiliaria` (panel del agente) y `apps/inquilino` (portal del inquilino). Las dos comparten **exactamente el mismo cliente HTTP** (`src/lib/api/client.ts` es idéntico en ambas) y el design system `@llave/ui`. Todo dato de pantalla pasa por un **hook de datos** que decide entre el API real y un fallback local de demo.

Regla de oro: **toda pantalla debe andar en los dos modos** — con backend (`apiEnabled === true`) y sin backend (demo offline en GitHub Pages). Si rompés uno, rompés un canal de distribución.

## El patrón `apiEnabled`: real vs. demo

`client.ts` deriva el modo de una sola variable de entorno:

```ts
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
export const apiEnabled = API_URL.length > 0;
```

- **Prod / dev con back:** `NEXT_PUBLIC_API_URL` apunta al Fastify de Railway → `apiEnabled === true` → los hooks hablan con el API real.
- **Demo GH Pages / dev sin back:** la env queda vacía → `apiEnabled === false` → los hooks caen al modo `localStorage` (mock data persistida en el browser).

Por qué ambos deben andar: la **demo offline** es una vidriera pública (GH Pages, sin servidor) que tiene que funcionar sola, y el **modo real** es el producto. El mismo bundle sirve a los dos; lo único que cambia es esa env en build-time. Por eso ningún hook puede asumir que hay servidor.

Piezas del cliente:

- **`apiFetch<T>(path, init)`** — wrapper de `fetch` sobre `API_URL`. Inyecta `Authorization: Bearer <token>` si hay sesión, agrega `Content-Type: application/json` **solo si hay body** (Fastify rechaza JSON vacío con 400), y en error tira `ApiError(status, message)` parseando el `message` del body. En `apps/inquilino` además hace **auto-logout en 401**: si un request autenticado (fuera de `/login`) recibe 401, limpia el token + la sesión y redirige a `/login?expirada=1` para no dejar al inquilino atrapado en "Reintentar" con un token muerto. El cliente de `inmobiliaria` **no** trae ese branch de 401.
- **`getToken()` / `setToken()`** — leen/escriben `localStorage['llave:auth:token']` con guardas para SSR (`typeof window === 'undefined`) y storage bloqueado.
- **`ApiError`** — clase de error con `status` y `message`, para que la UI distinga 401/403/404 etc.

## Convención de hooks de datos

Cada recurso vive en `src/lib/api/use-<recurso>.ts` y exporta un hook que **siempre ramifica por `apiEnabled`**. Hay dos estilos según la app/complejidad:

### Estilo A — `useState`/`useEffect`/`useCallback` (panel inmo, escritura CRUD)

Usado en `use-documentos.ts` y `use-servicios-publicos.ts`. El hook mantiene estado local (`datos`, `hidratado`) y expone acciones (`subir`, `guardar`, `eliminar`). Estructura típica:

```ts
const recargar = useCallback(async () => {
  if (!apiEnabled) {                       // rama demo
    setDatos(leerDesdeLocalStorage(id));
    setHidratado(true);
    return;
  }
  try {                                    // rama API
    const filas = await apiFetch<FilaApi[]>(`/recurso/${id}`);
    setDatos(filas.map(mapFila));
  } catch {
    setDatos([]);
  } finally {
    setHidratado(true);
  }
}, [id]);
useEffect(() => { void recargar(); }, [recargar]);
```

Cada acción de escritura repite el `if (!apiEnabled) { …localStorage…; return; }` antes de tocar el API, y luego llama `recargar()`.

### Estilo B — react-query (portal inquilino, lectura cacheada)

Usado en `use-mis-reclamos.ts`. Lectura vía `useQuery` con `enabled: apiEnabled` (no dispara fetch en demo) y `staleTime`; mutaciones que llaman `apiFetch` y luego `qc.invalidateQueries`. El provider está en `src/components/query-provider.tsx` (ambas apps). El hook devuelve un objeto unificado (`reclamos`, `cargando`, `deApi`, `hayError`, acciones) y arranca con **tres returns tempranos**: rama `!apiEnabled` (lee de localStorage + merge cross-app), rama `q.isError`, y la rama feliz del API.

### `mapX`: fila del API → tipo del front

La fila del API y el tipo que renderiza la UI **no son el mismo shape**. Cada hook define una interface `…Api` y una función `map…` que traduce:

- `null` del API → `undefined` en el front (ej. `numeroMedidor: s.numeroMedidor ?? undefined`), porque el front modela "ausente" con opcionales.
- **Denormalización**: `use-mis-reclamos` aplana `profesional` a `profesionalAsignadoNombre/Telefono/Categoria`, y completa identidad (`inquilino`, `direccion`) desde `useCurrentUser()` + `useMiContrato()` (en demo, desde el mock `inquilinoActual`).
- **Filtrado**: tipos de evento que la UI no conoce (`CLASIFICADO`, `PROFESIONAL_ASIGNADO`) se descartan para no romper la timeline.
- **Memoización**: `mapReclamo` crea objetos nuevos cada llamada, así que el array mapeado se envuelve en `useMemo` con dependencias **primitivas** (`q.data`, `identidad.inquilino`, `identidad.direccion`) — si no, `reclamos` cambia de identidad en cada render y dispara loops en effects que copian el dato a estado.

### Fallback a localStorage en demo

El branch `!apiEnabled` delega en módulos de storage dedicados (`@/lib/contrato-documentos-storage`, `@/lib/servicios-publicos-storage`, `@/lib/reclamos-storage`, etc.) que ya existían antes de cablear el API — son la "base de datos" de la demo. La regla es **no cambiar el comportamiento offline**: el branch demo debe seguir leyendo/escribiendo el mismo storage y devolviendo el mismo shape que la UI ya renderiza. Algunas acciones son **solo-prod** (ej. `confirmarResolucion`, `calificarReclamo`): en demo se reemplazan por funciones que tiran `Error('Disponible solo con servidor')` o se manejan directo desde la página vía storage local.

Convención de flags expuestos: `deApi` (¿vino del API o de la demo?), `hidratado`/`cargando` (¿ya resolvió la primera lectura?), `hayError`.

## Subida de archivos

Flujo en dos pasos, porque el archivo y su metadato/registro son requests distintos:

1. **`subirArchivo(file)`** (en `client.ts`) hace `POST /uploads` como `multipart/form-data`. **No** usa `apiFetch` a propósito: `apiFetch` fuerza `Content-Type: application/json`, y acá hay que dejar que el browser ponga el `boundary` del multipart solo. Manda el `Authorization` a mano. Devuelve `ArchivoSubido { url, nombreArchivo, tipoMime, tamanioBytes }`, con `url` apuntando a `/uploads/...` (Railway Volume).
2. El hook toma ese `url` y crea el **registro de dominio** con `apiFetch` (ej. `POST /contratos/:id/documentos` con `archivoUrl: subido.url`).

**Servir el archivo en un `<img>`/`<a>`:** estos tags **no mandan el header `Authorization`**, así que se construye una URL con el token en query:

```ts
function urlServible(archivoUrl: string): string {
  const token = getToken();
  return `${API_URL}${archivoUrl}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}
```

En demo no hay `url` servible: el branch `!apiEnabled` lee el archivo como **dataURL** (`leerArchivoComoDataUrl`) y lo guarda en localStorage. El `mapX` unifica ambos casos en el mismo campo que la UI consume (en `use-documentos`, `dataUrl`): en prod es la `urlServible(archivoUrl)`, en demo es la dataURL real.

## Design system `@llave/ui`

Paquete workspace `@llave/ui` (shadcn/ui sobre Radix + CVA + Tailwind). Se importa por **subpath explícito**, un componente por entry (ver `exports` en `packages/ui/package.json`):

```ts
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { useToast } from '@llave/ui/use-toast';
import '@llave/ui/globals.css';
```

Componentes disponibles: `button`, `card`, `input`, `label`, `badge`, `avatar`, `tabs`, `dialog`, `select`, `textarea`, `separator`, `progress`, `skeleton`, `table`, `toast`/`use-toast`, `dropdown-menu`, `confirm-dialog`, `theme-toggle`. Helpers: `cn` (clsx + tailwind-merge), `tokens` (`brand`, `monedaLabel`, `indiceLabel`).

- **Variantes con CVA**: ej. `Button` expone `variant` (`default | destructive | outline | secondary | ghost | link`) y `size` (`default | sm | lg | xl | icon`), con `asChild` vía Radix `Slot` para renderizar el estilo sobre otro elemento (ej. un `<Link>`).
- **Tokens de tema** en `packages/ui/src/globals.css`: variables HSL al estilo shadcn (`--primary`, `--background`, `--foreground`, `--border`, `--ring`, `--radius`, etc.). La marca es **violeta/lavanda**, `--primary: 262 78% 56%` (= `brand.primaryHsl` en `lib/tokens.ts`). Las clases Tailwind (`bg-primary`, `text-muted-foreground`, `border-border`) resuelven contra estas variables.
- **Sin dark mode**: la app está forzada a light. La clase `.dark` redefine las variables con los **mismos valores** que `:root`, y se neutraliza el auto-dark de Chrome/Dark Reader. No agregues estilos que dependan de un dark real.

## Checklist: agregar una pantalla nueva sin romper la demo

1. **Hook de datos por recurso** en `src/lib/api/use-<recurso>.ts`. Elegí estilo: react-query si es lectura cacheada (patrón inquilino), `useState`/`useEffect`/`useCallback` si es CRUD con escritura (patrón inmo).
2. **Ramificá por `apiEnabled` en TODA función** (lectura y cada acción). Rama API con `apiFetch`; rama demo leyendo/escribiendo el módulo `@/lib/*-storage` correspondiente. Nunca asumas servidor.
3. **Definí `…Api` + `mapX`**: no devuelvas la fila cruda del API. Mapeá `null → undefined`, denormalizá lo que la UI espera, filtrá enums desconocidos, y **memoizá** el resultado con dependencias primitivas si el map crea objetos nuevos.
4. **Devolvé un shape unificado** (mismos campos en demo y en prod) más flags `deApi` / `cargando|hidratado` / `hayError`. La página no debería saber de qué modo viene el dato.
5. **Archivos**: subí con `subirArchivo` (no con `apiFetch`), guardá la `url` en el registro de dominio vía `apiFetch`, y para mostrarlos usá `urlServible(...)` con `?token=`. En demo, dataURL en localStorage, expuesto en el **mismo campo**.
6. **Acciones solo-prod**: si algo no existe offline, hacé que la rama demo tire un `Error` claro o que la página lo resuelva con storage local — no dejes la acción rota silenciosamente.
7. **UI con `@llave/ui`** por subpath; estilá con clases de token (`bg-primary`, `text-muted-foreground`) y `cn(...)`. No introduzcas colores hardcodeados ni dependencias de dark mode.
8. **SSR-safe**: todo acceso a `window`/`localStorage` va detrás de `typeof window !== 'undefined'` (ya cubierto si usás `getToken`/los módulos de storage). Marcá los componentes/hooks con `'use client'`.
9. **Probá los dos modos**: corré con `NEXT_PUBLIC_API_URL` seteada (real) y vacía (demo) antes de dar por cerrada la pantalla.

---

Archivos de referencia (todos absolutos):
- Cliente HTTP (idéntico en ambas apps): `/Users/alannaimtapia/dev/inmobiliaria-inquilinos-app/apps/inquilino/src/lib/api/client.ts` y `/Users/alannaimtapia/dev/inmobiliaria-inquilinos-app/apps/inmobiliaria/src/lib/api/client.ts`
- Hooks ejemplo: `apps/inmobiliaria/src/lib/api/use-documentos.ts`, `apps/inmobiliaria/src/lib/api/use-servicios-publicos.ts`, `apps/inquilino/src/lib/api/use-mis-reclamos.ts`
- Design system: `/Users/alannaimtapia/dev/inmobiliaria-inquilinos-app/packages/ui/` (`package.json` exports, `src/globals.css`, `src/lib/tokens.ts`, `src/components/*.tsx`)
- Providers react-query: `apps/{inquilino,inmobiliaria}/src/components/query-provider.tsx`

