# Decisiones de negocio del dueño + reglas duras

> Decisiones que NO son bugs: las tomó el dueño (Alan) explícitamente. Documentadas
> para que un chat nuevo no las "des-arregle". Tres se tomaron el 2026-06-21.

## Decisiones de producto / plata

### 1. Comisión y rendición SOBRE EL ALQUILER (no sobre el total)
La comisión de la inmobiliaria y el neto que recibe el propietario se calculan sobre
**`montoAlquiler`**, NO sobre `montoTotal` (que incluye expensas + punitorios). Las
**expensas pasan al consorcio**, no al propietario. Aplicado en `plata.ts` (rendiciones)
y en el KPI del panel (`hooks.ts`). Commit `019598b` + `afaefe3`.

### 2. Cualquier co-inquilino puede pagar el alquiler
`POST /pagos/informar` usa `requireContratoAcceso(req, reply, 'VER')` (antes `'PAGAR'`).
Decisión: pagar el alquiler no se restringe por permiso — cualquier miembro del contrato
(incluido un co-inquilino "Ver") puede informar el pago. El tier PAGAR ya no agrega nada
sobre VER para esa acción. Commit `019598b`.

### 3. Gastos de rendición SOLO de propiedades con ingreso
En la rendición de un período se descuentan **solo** los gastos de las propiedades que
aportaron alquiler a esa rendición (las que tienen liquidación PAGADA del período =
`propIdsConIngreso`), NO de todas las propiedades del dueño. Antes una propiedad
solo-expensas reducía el neto de las de alquiler. Commit `afaefe3`.

## Decisiones de seguridad / acceso (ya implementadas)

- **Email de usuario del panel es GLOBAL** (no por tenant) a propósito: el login busca
  el email global, así que dos tenants no pueden compartir email. NO scopear por tenant.
- **Co-inquilino "Ver" ve el CBU/datos bancarios en el checkout** (decisión: dejarlo ver
  y pagar). El backend no lo bloquea (ver decisión 2).
- **Backdoor demo (OTP `000000`)** excluido de producción (`NODE_ENV !== 'production'`).

## Reglas duras (innegociables — del dueño)

1. **NUNCA `prisma migrate reset` contra prod.**
2. **No correr acciones irreversibles** (deploy, migración de schema, borrado de datos)
   **sin confirmarlo en el chat.**
3. **No crear cuentas ni data de prueba en el tenant real** (Tapia Propiedades) — esa
   restricción aplica también a no poder testear flujos end-to-end que requieran crear
   cuenta / entrar password / clickear en el browser.
4. **No correr los tests de `apps/api` contra una DB incierta** (pegan a Railway, hacen
   reset/seed). Solo si hay certeza de que NO es prod.
5. Repo `soyalantapia/inmobiliaria-inquilinos-app`. El gh token está **sin workflow
   scope** → no tocar `.github/workflows/`. Pushear a `main` está OK en este repo.

## Tenant real (datos canónicos)

- Inmobiliaria: **Tapia Propiedades**.
- Admin: `alannaimtapia@gmail.com` / `Tapia.2026!` / **PIN 1234**.
- (Datos de ejemplo cargados durante el desarrollo: propiedad Av. Santa Fe 4922 5°A;
  inquilino Martín Gómez. Verificar contra la DB de prod antes de asumir que siguen.)
