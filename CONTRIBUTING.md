# Contribuir a My Alquiler

Guía para trabajar el repo en equipo. Antes de tu primer cambio leé
[`PROJECT.MD`](./PROJECT.MD) (contexto absoluto) y
[`work-agent/01-ARQUITECTURA.md`](./work-agent/01-ARQUITECTURA.md) (patrones).

## Setup

```bash
corepack enable                 # pnpm 10
pnpm install
pnpm dev                        # panel (:3001) + inquilino (:3000)
# backend local: pnpm --filter api dev  (necesita apps/api/.env con DATABASE_URL + JWT_SECRET)
```

Detalle en [`README.md`](./README.md) y env en [`docs/CONFIG.md`](./docs/CONFIG.md).

## Flujo de trabajo

1. **Rama** desde `main`. Nombre: `feat/<tema>`, `fix/<tema>`, `docs/<tema>`,
   `chore/<tema>`. Una rama por unidad de trabajo coherente.
2. Cambios chicos y enfocados. Si tocás backend **y** front, está bien en un PR si
   son del mismo flujo (ej. un endpoint nuevo + su hook).
3. **Antes de pushear/deployar**, pasá el gate de verificación (abajo).
4. **PR** a `main` (pushear directo a `main` está permitido en este repo, pero para
   trabajo en equipo preferí PR + review). Descripción: qué, por qué, cómo lo probaste.
5. Si tocaste algo estructural (endpoint, regla de plata, modelo, env var),
   **actualizá la doc en el mismo PR** (`PROJECT.MD` + el `docs/` o `work-agent/` afín).

## Convención de commits

Estilo conventional, en español, imperativo y específico:

```
<tipo>(<área>): <qué hace>

<por qué / contexto / cómo se verificó>

Co-Authored-By: ...
```

- **tipos**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
- **área** (opcional): `api`, `plata`, `uploads`, `co-inquilinos`, `inmobiliaria`,
  `inquilino`, etc.
- Ejemplos reales del repo: `feat(uploads): file storage REAL sobre Railway Volume`,
  `fix(plata): gasto multi-propietario se rinde por partes y se conserva (B2)`.

## Gate de verificación (obligatorio antes de deployar)

```bash
pnpm --filter api exec tsc --noEmit && pnpm --filter api build
pnpm --filter @llave/inmobiliaria exec tsc --noEmit && pnpm --filter @llave/inmobiliaria build
pnpm --filter @llave/inquilino exec tsc --noEmit && pnpm --filter @llave/inquilino build
```

Si tocaste un endpoint: además un **E2E mínimo contra prod** después de deployar
(ver [`docs/TESTING.md`](./docs/TESTING.md) y [`work-agent/02-DEPLOY.md`](./work-agent/02-DEPLOY.md)).

## Estilo de código

- **TypeScript estricto** — no `any` salvo justificado; el código debe pasar `tsc --noEmit`.
- **Prettier** (`prettier-plugin-tailwindcss`): `pnpm format`. No pelees el formateo a mano.
- **Comentarios**: explicá el *por qué* (la decisión, el bug que evita), no el *qué*
  obvio. El código del repo comenta densamente las decisiones de plata/seguridad —
  mantené ese estándar.
- **Naming**: seguí el código que rodea. Español para dominio (liquidación, rendición),
  consistente con lo existente.

## Checklist de review

- [ ] `tsc` + `build` pasan en los 3 apps tocados.
- [ ] **Multi-tenant**: ¿toda query nueva filtra por `inmobiliariaId`? (nunca
      `findUnique/update/delete` por id del request sin scope — usar `findFirst` + `inmobiliariaId`).
- [ ] **Auth**: ¿el endpoint tiene el guard correcto (`requireUsuario`/`requireInquilino`/
      `requireContratoAcceso`) y la capacidad/permiso adecuado?
- [ ] **Plata**: ¿respeta las reglas LOCKED? (comisión sobre alquiler, PARCIAL≠PAGADO,
      PROPIETARIO_DIRECTO no es ingreso, participaciones=100, nada negativo). Ver
      [`work-agent/05-DECISIONES.md`](./work-agent/05-DECISIONES.md).
- [ ] **`apiEnabled`**: ¿el front anda en demo (`!apiEnabled`) **y** en prod? ¿Nada de
      "éxito falso" (toast OK cuando la API falló o no se llamó)?
- [ ] **Validación**: ¿body/query validados con zod? ¿errores devuelven el código correcto?
- [ ] **Mutaciones** devuelven el objeto completo (con relaciones) para no romper el front.
- [ ] Doc actualizada si el cambio es estructural.

## Reglas duras (innegociables)

1. **NUNCA** `prisma migrate reset` contra prod.
2. No correr acciones irreversibles (deploy, migración de schema, borrado) sin confirmar.
3. **No crear data de prueba en el tenant real** (Tapia Propiedades).
4. No correr los tests de `apps/api` contra una DB incierta (ver [`docs/TESTING.md`](./docs/TESTING.md)).
5. gh token **sin** workflow scope → no tocar `.github/workflows/`.
