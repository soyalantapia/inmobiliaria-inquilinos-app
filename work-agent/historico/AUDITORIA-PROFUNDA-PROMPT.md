# Auditoría profunda de MyAlquiler — prompt reutilizable

> **Para qué sirve:** encontrar y arreglar los bugs que sufriría un **usuario real**
> (una inmobiliaria o un inquilino de carne y hueso) **antes** de que los viva —
> crashes, plata mal calculada, datos que se pierden, éxitos falsos, fugas entre
> inmobiliarias, acciones que no debería poder hacer un rol. **No** estilo, **no**
> nits, **no** refactors cosméticos.
>
> **Cómo usarlo:** pegale a Claude Code "Corré la auditoría profunda de
> `AUDITORIA-PROFUNDA-PROMPT.md`" (o pegá el bloque _MISIÓN_ + _DIMENSIONES_ +
> _REGLAS_ directo). Está pensado para correrse como **workflow multi-agente**
> (ver _RECETA DE EJECUCIÓN_), pero también funciona como guía de revisión manual.

---

## EL LENTE: "¿lo viviría un usuario común?"

Antes de reportar algo, preguntate: **¿un usuario real lo va a chocar?** Priorizá
por daño observable, no por elegancia del código:

| Severidad | Qué es | Ejemplos en MyAlquiler |
|---|---|---|
| **CRÍTICA** | Plata mal, datos de otro tenant, pérdida de datos | comisión/rendición mal calculada; un tenant ve/toca filas de otro; un pago informado se pierde |
| **ALTA** | Crash, acción bloqueada que debería andar, rol que hace lo que no debe, éxito falso | pantalla en blanco por `undefined.map`; contrato de renta fija da 400; CARGA borra/finaliza; toast "enviado" sin llamar a la API |
| **MEDIA** | UX rota en prod, race poco probable, validación faltante | conteo mock en prod; doble-submit duplica; `new Date('xx')` → 500 |
| **BAJA** | Inexactitud cosmética, hardening | método de pago hardcodeado; contador no atómico |

Si **no podés trazar el camino de ejecución que falla**, no lo reportes.

---

## CONTEXTO DEL CODEBASE (para no inventar ni re-reportar)

- **Stack:** Fastify + Prisma (Postgres) en `apps/api`; Next.js 15 panel en
  `apps/inmobiliaria`; Next.js PWA en `apps/inquilino`; packages `@llave/shared`
  (`permisos.ts`, `auth.ts`), `@llave/ui`, `@llave/config`.
- **Multi-tenant:** toda fila scoped por `inmobiliariaId`. Guards en
  `apps/api/src/auth/guards.ts`: `requireUsuario(req,reply,capacidad?)` →
  `{userId, inmobiliariaId, rol}`; `requireInquilino`; `requireContratoAcceso(minPermiso)`
  para co-inquilinos (revalida el permiso **contra la DB** cada request, no en el JWT).
- **Roles:** `ADMIN | OPERADOR | CARGA | LECTURA` (capacidades en `permisos.ts`).
  Ojo: `propietarios.crear` / `propiedades.crear` / `contratos.crear` **incluyen CARGA**,
  por eso las acciones destructivas (DELETE, finalizar) llevan un guard de rol explícito.
- **Error handler global** (`apps/api/src/app.ts`): ZodError→400, P2002/P2003→409,
  P2025→404. **No reportes "falta try/catch" si el handler global lo cubre.**
- **`apiEnabled`** (front): `NEXT_PUBLIC_API_URL` seteado ⇒ API real; vacío ⇒
  mock/localStorage (demo). **Ambos modos deben andar.** Las dos clases de bug acá:
  (a) en prod muestra/persiste data mock; (b) éxito falso (toast OK sin llamar a la API).
- **Plata:** Liquidaciones (devengadas al activar contrato) → Pagos
  (`INFORMADO→CONCILIADO|RECHAZADO`) → Rendiciones (`bruto − comisión − gastos = neto`).
  La comisión y el neto al propietario se calculan **sobre el alquiler** (no sobre
  el total: las expensas pasan al consorcio). Liquidación: `montoAlquiler` ≠ `montoTotal`.
- **Lock atómico** (el patrón canónico): `updateMany({where:{id, estado:'X'}})` →
  si `count===0` ⇒ 409 (otra request ganó). Toda mutación crítica debe usarlo en vez
  de _leer-luego-escribir_.

---

## DIMENSIONES (qué buscar, dónde)

Corré un finder por dimensión. Que cada uno **lea los archivos completos** y trace
el repro exacto.

1. **Corrección del dinero** — `plata.ts`, `lib/liquidaciones.ts`, plata de
   `inquilino-mundo.ts`/`core.ts`. Liquidaciones mal devengadas (meses faltantes/dobles,
   vencimientos, redondeo), pagos que sobre/sub-acreditan, PARCIAL vs PAGADO,
   rendiciones con comisión/neto/gastos mal, gastos contados dos veces o en el período
   equivocado, doble-cobro, montos negativos. **Trazá con números concretos.**
2. **Aislamiento multi-tenant** — `guards.ts` + todos los routes. `findUnique/
   findFirst/update/delete` por un id que viene del request **sin filtrar por
   `inmobiliariaId`** (tenant A toca filas de tenant B con un id ajeno),
   `updateMany/deleteMany` sin `inmobiliariaId`, relaciones seguidas sin re-scopear.
3. **Máquinas de estado / ciclo de vida** — contrato (BORRADOR→ACTIVO→FINALIZADO),
   reclamo, pago, liquidación, propiedad (DISPONIBLE→ALQUILADA), aprobaciones.
   Transiciones ilegales permitidas, estados colgados (propiedad ALQUILADA para siempre),
   efectos colaterales que no se revierten al cambiar de estado.
4. **Races / atomicidad / idempotencia** — toda mutación. Read-then-write sin
   transacción ni lock (doble-click duplica/doble-acredita), check-then-act sin
   `updateMany` condicionado, boundaries de transacción mal puestos, `createMany` sin
   `skipDuplicates` donde corresponde. **Mostrá la intercalación de 2 requests que rompe.**
5. **Auth / autorización** — `auth.ts`, `guards.ts`, `pin.ts`, `permisos.ts` y el USO
   de los guards. Endpoint sin guard o con la capacidad equivocada, rol que hace lo que
   no debe, acción de plata sin PIN, co-inquilino con permiso insuficiente que igual
   pasa, JWT/OTP/PIN con agujeros, escalación de privilegios. **Verificá capacidad por
   endpoint contra `permisos.ts`.**
6. **Validación / integridad de datos** — schemas Zod + `schema.prisma`. Inputs sin
   validar (negativos, vacíos, fechas inválidas, enums incompletos — el clásico:
   `IndiceAjuste.FIJO` que el Prisma acepta pero el Zod rechaza), `@@unique/onDelete`
   que permiten huérfanos, normalización inconsistente (emails con/sin minúsculas).
7. **`inquilino-mundo.ts`** (el archivo más grande, la API de la PWA) — un finder
   dedicado, TODAS las dimensiones a la vez. Mezcla identidad del inquilino, contrato,
   liquidaciones, reclamos, comprobantes y permisos de co-inquilino.
8. **Robustez / errores backend** — `app.ts`, `mailer.ts`, `env.ts` + barrido. 500 que
   deberían ser 4xx y NO los cubre el handler global, `await` faltantes, **respuestas de
   mutación que NO incluyen las relaciones que el cliente va a mapear** (crash
   `undefined.map` del lado del front), env vars sin validar.
9. **Panel en modo prod** (`apps/inmobiliaria`, `apiEnabled=true`) — `lib/api/hooks.ts`
   + páginas/componentes grandes. **Toasts de éxito falso**, data que el usuario carga y
   se descarta en silencio, hooks mal cableados, conteos/badges que leen mock en prod,
   estados de carga ausentes (doble-submit).
10. **PWA inquilino en modo prod** (`apps/inquilino`) — checkout completo, reclamos,
    comprobantes, servicios, contrato, login OTP, `p/[token]`. Pago que se pierde,
    CBU/monto equivocado, éxito falso al subir comprobante, reclamo que no persiste,
    permiso de co-inquilino mal aplicado en el front.
11. **Robustez frontend** (ambas apps) — `.map/.length/.toFixed` sobre algo que la API
    puede devolver vacío/null (pantalla en blanco), botones de mutación sin `disabled`
    durante el envío, errores de fetch no surfaceados, `useEffect` con loops de render.

---

## REGLAS DURAS (esto es lo que separa una auditoría útil de una lista de ruido)

1. **REGLA DE ORO — solo bugs trazables.** Cada hallazgo necesita: secuencia EXACTA
   de pasos/inputs que lo dispara + efecto observable (qué dato se corrompe, qué plata
   se pierde, qué tenant ve qué). Sin repro concreto, no se reporta.
2. **Verificación adversarial de TODO hallazgo.** Antes de darlo por bueno, pasalo por
   escépticos con lentes distintas que intentan **refutarlo**:
   - _Ejecución:_ ¿el camino del repro realmente se ejecuta y falla? (default: no, si no
     lo podés reproducir leyendo el código).
   - _Ya-manejado:_ ¿no está ya cubierto por un guard / el error handler global / un
     schema Zod / un constraint de la DB / el gating de demo?
   - _Impacto-fix:_ ¿el impacto es real y el fix propuesto no rompe el otro tenant ni el
     modo demo?
   - Sobrevive solo por **mayoría** (≥2/3).
3. **VERIFICÁ CADA CONFIRMADO CONTRA EL CÓDIGO REAL antes de aplicar.** Históricamente
   ~50% de los "confirmados" son falsos positivos. Leé el archivo, seguí el flujo, y
   recién ahí tocá. Ejemplos reales que se cayeron al verificar: "scopear el email de
   `POST /usuarios` por tenant" (el login ES global por email a propósito → scopearlo
   rompe el 2do tenant); "rendiciones sin transacción" (el lock atómico de gastos ya
   previene la corrupción).
4. **Distinguí bug de decisión.** Si algo cambia **plata que recibe alguien** o el
   modelo de producto (¿las expensas van al consorcio o al dueño?; ¿un co-inquilino
   "Ver" puede pagar?), **no lo apliques solo: preguntá.**
5. **Conocé lo que YA está arreglado** (no re-reportar): lockout de PIN cableado; OTP
   cross-tenant; co-inquilino revalida en DB; PARCIAL vs PAGADO; locks atómicos en
   validar/rechazar pago, finalizar/claim de contrato, resolver/confirmar reclamo;
   `inmobiliariaId` en operaciones internas de plata; CARGA no borra/finaliza;
   `mapPropiedad/mapContrato` defensivos; comisión sobre alquiler; cualquier
   co-inquilino puede pagar.
6. **Conocé lo deferido-a-propósito** (no es bug salvo que CORROMPA estado/plata):
   features demo-gated que muestran "Próximamente" o mock en prod.

---

## RECETA DE EJECUCIÓN (cómo correrlo sin tropezar con lo mismo que yo)

> Aprendido a los golpes en la auditoría del 2026-06-20/21:

- **Workflow multi-agente**, no un solo agente. Pipeline: finders por dimensión →
  verificación adversarial (3 escépticos, mayoría) → síntesis (dedup + plan con
  file:lines, repro, impacto, fix exacto, riesgo).
- **Usá `sonnet` para finders y verificadores, en tandas secuenciales de ~3 finders.**
  Disparar 11 finders **opus** a la vez leyendo archivos grandes **revienta el
  rate-limit del servidor** (te mata 9 de 11). Sonnet + tandas chicas pasa limpio.
- **La síntesis final, cuidado con opus:** una lista consolidada de vulnerabilidades
  multi-tenant/auth puede disparar el **filtro de ciberseguridad de opus** (aunque sea
  hardening defensivo de tu propio código). Si pasa, corré la síntesis en sonnet.
- **Aplicá los fixes en el main loop** (no en los agentes): verificá cada uno contra el
  código, agrupá por archivo para no pisarte, y **typecheck + build entre tandas**.
- **No corras los tests contra una DB incierta:** las suites de `apps/api` pegan a una
  DB remota de Railway (schema "test") y hacen resets/seed en `beforeAll`. Si no tenés
  certeza 100% de que no es prod, NO los corras (regla dura: nunca arriesgar prod).
- **Deploy:** `railway up --service <svc> --environment production --detach` (los
  servicios NO están conectados a GitHub; pushear no deploya). Polleá `railway status
  --json` hasta `SUCCESS`. Deployá solo los servicios que tocaste.
- **Smoke test en prod sin ensuciar el tenant real:** `/health` (incluye DB), un
  endpoint protegido sin token → debe dar **401 no 500**, un body inválido → **400** (el
  error handler vivo), y que ambos fronts (`admin.myalquiler.com`, `app.myalquiler.com`)
  den 200. **Nunca crear data de prueba en el tenant real (Tapia Propiedades).**

---

## CONTRATO DE SALIDA (qué entrega cada hallazgo)

Para cada bug confirmado:

```
severidad   CRÍTICA | ALTA | MEDIA | BAJA
área        api | panel | inquilino | shared | schema
file        path relativo
lines       rango
título      una línea
repro       la secuencia EXACTA de pasos/inputs que lo dispara
impacto     el efecto observable concreto (dato / plata / tenant)
fix         el cambio preciso (qué línea, qué reemplazar) — aplicable sin re-investigar
riesgo      qué podría romper (demo / otro tenant / migración necesaria)
```

Y al final: **qué se aplicó, qué se descartó como falso positivo (con la evidencia del
código), qué se difirió y por qué, qué necesita decisión del dueño.**

---

## REGLA DEL DUEÑO (innegociable)

- Nunca `prisma migrate reset` contra prod.
- No correr acciones irreversibles (deploy, migración de schema, borrado) sin
  confirmarlo en el chat.
- No crear cuentas / data de prueba en el tenant real.
