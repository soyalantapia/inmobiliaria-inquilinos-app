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

### 3. Gastos de rendición SOLO de propiedades con ingreso (y por partes en multi-dueño)
En la rendición de un período se descuentan **solo** los gastos de las propiedades que
aportaron alquiler a esa rendición (`propIdsConIngreso`), NO de todas las del dueño.
Commit `afaefe3`. **Además (auditoría 27/06, B2):** en propiedades con varios dueños el
gasto se rinde **por partes** (cada dueño su participación) y se marca descontado-total
recién cuando las partes cubren el 100% → conservación del total. Commit `dac6d4a`.

### 4. PROPIETARIO_DIRECTO no es ingreso de la inmobiliaria
Tanto `POST /rendiciones` como `GET /caja/cierre` filtran `modoCobranza='INMOBILIARIA'`:
en cobranza directa la inmo no cobra ni gana comisión. (B1, auditoría 27/06, `74d519f`.)

### 5. Resumen bancario = CSV/Excel del banco, matching determinístico SIN IA/OCR
El validador de resumen bancario **parsea el extracto** (CSV/Excel del banco), NO usa OCR
ni IA. El dueño lo eligió explícitamente. Reglas de confianza del match: **monto ±$50 +
nombre → ALTA**; **monto solo → MEDIA**; **±5% del saldo real + nombre → MEDIA**; **±5%
solo → BAJA**. FIFO: la liquidación vencida más vieja primero (`orderBy fechaVencimiento
asc`). Conciliar (con PIN) crea un **Pago CONCILIADO directo** (TRANSFERENCIA, sin pasar
por INFORMADO porque lo detectó el banco). Commit `1404004` (2026-07-04). **NO reemplazar
por IA/OCR sin pedírselo.** Demo intacta / ambos modos andan.

### 6. Migración de cartera = mapeo flexible de columnas
La migración masiva de cartera deja que el dueño suba **su propia planilla** (Excel/CSV) y
**mapee qué columna es qué** (con sinónimos auto-sugeridos). NO se impone un formato fijo:
la inmo trae el archivo como lo tiene y la app se adapta. Commit `b153ebe` (2026-07-04).
Demo intacta / ambos modos andan.

## Decisiones de seguridad / acceso (ya implementadas)

- **Email de usuario del panel es GLOBAL** (no por tenant) a propósito: el login busca
  el email global, así que dos tenants no pueden compartir email. NO scopear por tenant.
- **Co-inquilino "Ver" ve el CBU/datos bancarios en el checkout** (decisión: dejarlo ver
  y pagar). El backend no lo bloquea (ver decisión 2).
- **La inmobiliaria puede dar de alta co-inquilinos desde el panel** (auditoría 27/06,
  D1): CRUD real `/contratos/:contratoId/co-inquilinos` (requireUsuario, tenant-scope).
  En prod el **email es obligatorio** (la activación del co-inquilino es por email,
  igual que el inquilino) — antes el panel los guardaba solo en localStorage.
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
