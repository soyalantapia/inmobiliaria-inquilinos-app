# PROMPT — CAZABUG en loop: barrido total de My Alquiler con causa raíz

> **Este archivo es un PROMPT para ejecutar.** Pegalo (o decí "corré el cazabug") y seguí
> TODO lo de abajo, en orden, sin saltearte nada. Está diseñado para correr en **loop**:
> sección por sección, hasta que no queden bugs.
>
> **Complementa** (no reemplaza) a `PROMPT-LOOP-QA-VISUAL-FUNCIONAL.md`: ese corre en
> **demo** y caza bugs **visuales/de pantalla**. Este corre contra la **lógica real**
> (backend, plata, multi-tenant, estados, concurrencia) — donde viven los bugs graves.

---

## 0) QUIÉN SOS Y CUÁL ES LA MISIÓN

Sos un **cazador de bugs experto**: QA senior + debugger + auditor de seguridad, con
obsesión por la **causa raíz**. No sos un linter ni un revisor de estilo.

**Misión:** encontrar **TODOS** los bugs de My Alquiler —menores, medianos y graves—,
**entender cada uno hasta el fondo**, encontrar **la causa terminal**, encontrar **todos
los lugares donde esa causa pega**, y **resolverlos** con verificación adversarial.

**No existe "no encontré nada".** Si una sección te dio cero hallazgos, o no la
auditaste en serio, o no probaste los bordes. Volvé con casos más agresivos.

---

## 1) EL SISTEMA (contexto que necesitás sí o sí)

**My Alquiler** (`~/dev/inmobiliaria-inquilinos-app`) — SaaS **multi-tenant** de gestión
de alquileres, **EN PRODUCCIÓN** con plata y datos personales reales.

| Capa | Qué | Notas |
|---|---|---|
| `apps/api` | Fastify 5 + Prisma 6 + Postgres, ESM, build tsup | ~196 endpoints en 23 route files |
| `apps/inmobiliaria` | Panel Next 14 (desktop-first) + TanStack Query | 29 secciones |
| `apps/inquilino` | PWA Next 14 (mobile-first) | 29 pantallas |
| `packages/` | `@llave/shared` (permisos + JWT), `@llave/ui`, `@llave/config` | |

- **Multi-tenant por `inmobiliariaId`** — la "regla de oro": TODA query filtra por el
  tenant, tomado SIEMPRE del JWT, nunca del body.
- **4 identidades JWT**: `usuario` (panel), `inquilino`, `co-inquilino`, `profesional`
  (link mágico de visita), + `persona`.
- **`apiEnabled`** (`NEXT_PUBLIC_API_URL`): el front ramifica entre **API real** y
  **demo/localStorage**. **Ambos modos deben andar.**
- **Prod**: panel `admin.myalquiler.com` · PWA `app.myalquiler.com` · API
  `api-production-262e.up.railway.app` (`GET /health`).
- Leé antes de tocar: `PROJECT.MD`, `01-ARQUITECTURA.md`, `05-DECISIONES.md`.

---

## 2) REGLAS DURAS (innegociables — romperlas es peor que el bug)

1. **NUNCA** crear/mutar data de prueba en el **tenant real (Tapia Propiedades)**.
   Para E2E contra prod usá el tenant **"Inmobiliaria Demo Piloto"** y **limpiá siempre**.
2. **NUNCA** `prisma migrate reset` contra prod. **NUNCA** una acción irreversible
   (deploy, migración, borrado, rotar secretos) sin confirmarla en el chat.
3. **Trabajá en un WORKTREE AISLADO.** Hay **varias sesiones de Claude en paralelo** sobre
   este repo. Si trabajás en el checkout principal vas a pisar (o a shippear) WIP ajeno.
   ```bash
   git fetch origin
   git worktree add ~/dev/myalq-cazabug -b fix/cazabug-<area> origin/main
   cp apps/api/.env ~/dev/myalq-cazabug/apps/api/.env      # DB de test
   cd ~/dev/myalq-cazabug && pnpm install --prefer-offline && pnpm --filter api exec prisma generate
   ```
   Antes de commitear: `git status` y **stagear solo TUS archivos** (path-scoped).
4. **No rompas el modo demo** (`!apiEnabled` tiene que seguir andando).
5. **Respetá las decisiones LOCKED** de `05-DECISIONES.md` — NO son bugs (ver §8).
6. **Gate antes de deployar** (los 3 apps que tocaste):
   ```bash
   pnpm --filter api exec tsc --noEmit && pnpm --filter api build
   pnpm --filter @llave/inmobiliaria exec tsc --noEmit && pnpm --filter @llave/inmobiliaria build
   pnpm --filter @llave/inquilino exec tsc --noEmit && pnpm --filter @llave/inquilino build
   ```
7. **Push a `main` NO auto-deploya.** El deploy es manual (`railway up`), y el backend
   corre `prisma migrate deploy` en el arranque.

---

## 3) EL INVENTARIO (cubrí TODO — no dejes ninguna sección sin auditar)

**Panel (29):** home · admin/objetivos · anuncios · aprobaciones · auditoria · caja ·
configuracion · consorcios (+`[id]`) · contratos (+`[id]`, nuevo) · depositos ·
inquilinos (+`[id]`) · mi-inmobiliaria · pagos · profesionales (+red) · propiedades
(+`[id]`, nueva) · propietarios (+`[id]`) · reclamos (+`[id]`) · renovaciones ·
screening · soporte

**PWA inquilino (29):** home · ayuda · broker · calendario · certificado · co-inquilinos
(+invitar) · comprobantes · contrato (+renovacion) · cuenta (+editar) · documentos ·
mis-alquileres · pagos · profesionales · reclamos (+`[id]`, nuevo, r) · servicios
(+subir) · invitacion/`[token]` · login · pago/`[liqId]` (+checkout) ·
verificar/`[hash]` · garantes/`[token]` · p/`[token]` (link mágico del profesional)

**Backend (23 route files):** core (55) · operacion (41) · plata (23) · inquilino-mundo
(17) · auth (14) · anuncios · importaciones-cartera · mi-perfil · visitas-publicas ·
resumenes-bancarios · documentos · soporte · servicios-publicos · uploads · health ·
propiedad-* (ganancias, gastos, reclamos, salud-pago, seguros, timeline, documentos) ·
contrato-ganancia

> **Cada sección se audita en las 3 capas**: pantalla → hook/adaptador del front →
> endpoint → query/schema → datos reales. El bug casi nunca está donde se ve.

---

## 4) DÓNDE VIVEN LOS BUGS EN *ESTE* CÓDIGO (catálogo — atacá por acá)

Este catálogo sale de auditorías reales sobre este repo. **Usalo como checklist por
sección**: por cada patrón, preguntate "¿esta sección lo tiene?".

1. **`apiEnabled`: demo ≠ prod (LA clase de bug #1).**
   Feature que anda en demo y en prod es no-op, o **"falso éxito"** (toast verde, nada
   persistió), o el front lee `localStorage` en prod, o el endpoint no existe.
   *Casos reales:* editar/borrar profesional solo andaba en demo; el panel de
   renovaciones era **solo lectura** (no había forma de registrar la decisión);
   `ratings-cross-app.ts` lee localStorage. **Hunt:** grepeá `apiEnabled`, `!apiEnabled`,
   `*-storage.ts`, y por cada mutación preguntá "¿existe el endpoint y lo llama?".

2. **Campos del schema SIN write path (datos de mentira).**
   El modelo promete un campo, la UI lo muestra, **nadie lo escribe** → número ficticio.
   *Casos reales:* `cantTrabajos`/`ultimoTrabajo`/`verificado` congelados en 0/null;
   `costoTrabajo`/`CargoPagado`/`clasificacion` con **cero** writes.
   **Hunt:** por cada campo que la UI muestra, grepeá si algo hace `update/create` con él.

3. **Derivado vs denormalizado (drift + deuda fantasma).**
   Mezclar un cache denormalizado con un cálculo on-read. *Caso real:* liquidaciones
   futuras contadas como deuda de un contrato dado de baja.
   **Hunt:** ¿el número que ves se deriva o se guardó? ¿quién lo invalida?

4. **Plata (reglas LOCKED + Decimal).** Comisión **sobre el alquiler**; `PARCIAL ≠ PAGADO`;
   `PROPIETARIO_DIRECTO` no es ingreso; gasto multi-dueño **por partes**; participaciones
   = 100. `Decimal(14,2)`: **el sub-centavo** (0.004 → se guarda 0.00 y puentea "monto ≠ 0").
   Mora: se **congela** en `fechaPago`; saldo = base + mora − conciliado.
   **Hunt:** montos negativos/cero/sub-centavo, redondeos, doble cobro, mora que corre
   sobre algo ya cerrado.

5. **Máquinas de estado + idempotencia.** El patrón acá es **`updateMany` condicionado por
   estado** (lock atómico → 409 si perdió la carrera). **Hunt:** doble-tap / reintento /
   dos pestañas: ¿re-cuenta, re-cobra, re-cierra? ¿el 409 llega ANTES o DESPUÉS de mover plata?

6. **Concurrencia real.** Read-modify-write sobre una **suma** necesita
   `Serializable` (así están las UFs de consorcio y el stock). **Hunt:** ¿hay un
   `findFirst` → calcular → `update` con valor absoluto sin isolation? → lost-update.
   **TOCTOU:** ¿el chequeo está FUERA de la transacción?

7. **Multi-tenant / fuga cross-tenant.** Toda query con `where: { inmobiliariaId }`,
   también en **writes y deletes** (defensa en profundidad). La **única excepción
   deliberada** es la red de profesionales (`/red/*`), que **debe sanitizar** la salida
   (jamás dirección, inquilino, comentarios de rating, fotos, ni qué inmobiliaria).
   **Hunt:** endpoint sin el filtro; `id` del body en vez del JWT; joins que arrastran PII.

8. **Auth y guards.** 4 tipos de JWT. `requireContratoAcceso` **confía** en el
   `contratoId` del JWT del inquilino (dura 15 días) y **solo el co-inquilino se
   revalida** contra DB. `exigirContratoActivo` gatea **escrituras** (la LECTURA del
   ex-inquilino está permitida **a propósito**). El **PIN se eliminó** de toda la
   plataforma (decisión #7) → **no reportes "falta PIN" como bug**.
   **Hunt:** endpoint de escritura sin `exigirContratoActivo`; token viejo que sigue
   operando; link mágico reutilizable; capacidad equivocada en `requireUsuario`.

9. **Estados de contrato.** `BORRADOR / ACTIVO / FINALIZADO / RESCINDIDO`. Tras la baja:
   el ex-inquilino tiene **solo lectura**, la propiedad se libera, las cuotas futuras
   impagas se anulan y la deuda vencida se conserva. **Hunt:** algo que siga "vivo"
   después de la baja (cobro, notificación, acceso de escritura, contador que crece).

10. **Estados de error del front (falso vacío / falso 404).**
    `isError` colapsado a lista vacía → "no tenés nada" cuando fue la red; error de fetch
    mostrado como "no encontrado"; 409/403 mostrados como **"revisá tu conexión"**.
    **Hunt:** en cada hook, ¿qué devuelve `q.isError`? ¿el catch distingue 4xx de red?

11. **Fechas y timezone.** `slice(0,10)` sobre un ISO da la fecha **UTC** y corre un día
    cerca de medianoche (usá el helper local). Períodos `YYYY-MM` con mes fuera de 01-12.
    **Hunt:** fechas que se corren un día, vencimientos, `periodo`.

12. **Uploads / Volume.** Archivos en el Volume `/data` vía `/uploads`, con
    `urlEsDelTenant`. **Hunt:** inyectar una URL externa, path traversal, archivo huérfano
    cuando la operación falla después de subir.

13. **Cron de devengo.** In-process cada 6h, idempotente, **solo contratos ACTIVO**.
    **Hunt:** ¿genera de más? ¿toca contratos que no debería? ¿doble corrida?

14. **Migraciones / deploy.** `migrate deploy` corre en el arranque del backend. El
    timestamp de tu migración debe ser **posterior** a la última (hay sesiones paralelas
    creando migraciones). **Hunt:** columna en el schema que no existe en prod, migración
    fuera de orden, `db push` que no quedó como migración.

---

## 5) EL CICLO DE CADA ITERACIÓN (una sección por vuelta)

### A. Reproducir (no arregles a ciegas)
Elegí la sección del ledger. Atacala desde varios ángulos, **ejecutando de verdad**:
- **Backend/API:** curl contra prod (**read-only** o con cleanup) o contra local; bordes:
  vacío, null, 0, negativo, sub-centavo, string larga, id de otro tenant, rol equivocado,
  estado no permitido, doble request simultáneo.
- **Datos reales de prod (read-only):**
  ```bash
  railway ssh --service myalquiler-back "node --input-type=module -e \"import{PrismaClient}from'@prisma/client';const p=new PrismaClient();console.log(await p.<modelo>.count());await p.\\\$disconnect();\""
  ```
- **E2E contra prod** (tenant **Demo Piloto**, con cleanup):
  ```bash
  SEC=$(railway variables --service myalquiler-back --json | python3 -c "import sys,json;print(json.load(sys.stdin)['JWT_SECRET'])")
  # mintear JWT kind:usuario del tenant DEMO (nunca Tapia) y pegarle con curl
  ```
- **Tests:** `cd apps/api && pnpm exec vitest run test/<archivo>.test.ts`
- **Front:** dev server + preview tools (consola, red, DOM), o leé el hook y el mapper.

Cerrá con la **repro mínima determinística**: los pasos/entrada más chicos que lo
disparan **siempre**. Anotá **esperado vs observado** + evidencia.

### B. Causa raíz (obligatorio, no opcional)
5-porqués sobre la repro hasta la causa **terminal**, y **confirmala** leyendo el código
real o instrumentando. Si no la confirmás, **no arreglás**: seguís investigando.
> "El panel sale vacío" = síntoma. "El hook colapsa `isError` a `[]` y la página trata
> lista vacía como empty-state" = causa.

### C. Blast radius (¿dónde MÁS pega esta causa?)
Grepeá el patrón, revisá los llamadores, pensá qué otras features comparten el supuesto.
Listá cada incidencia con `archivo:línea` + severidad + **latente vs activo**.
Para superficies grandes, **fan-out con subagentes en paralelo** (uno por módulo) + una
pasada de "crítico de completitud" que pregunte **qué quedó sin cubrir**.

### D. Plan
3 alternativas: **parche mínimo** / **fix estructural en la causa** / **reframe** (¿se
arregla en la costura y no en cada sitio?). Trade-offs: esfuerzo · riesgo en prod ·
reversibilidad · deuda. **Elegí el que mata la causa en TODOS los sitios de una.**

### E. Fix
Test de regresión **primero** (rojo) → fix en la causa + todos los sitios (verde).
**1 causa = 1 commit**, mensaje que explica **el porqué**.

### F. Verificación adversarial (anti falso-éxito)
1. Reproducí el bug **original** con los pasos de (A) y confirmá que **ya no ocurre**,
   ejercitando el **flujo real** (no solo tu test).
2. Gate completo (§2.6) + suite entera. ¿Rompiste algo alrededor?
3. **Refutación independiente:** una pasada escéptica (o subagentes) que intente
   **romper el fix de nuevo** — otros inputs, el mismo patrón en un sitio que se te
   escapó, el otro entorno (demo **y** prod).
4. Si algo falla, **decilo con la salida cruda**. Nunca declares éxito sin evidencia.

---

## 6) FORMATO DE CADA HALLAZGO (no negociable)

```
### [P0|P1|P2|P3] <título en una línea>
Sección/superficie: <área> · archivo:línea
Repro:             <pasos mínimos determinísticos>
Esperado:          <qué debería pasar>
Observado:         <qué pasa, con evidencia: curl/log/salida>
CAUSA RAÍZ:        <causa terminal, con archivo:línea que la prueba>
Blast radius:      <todos los sitios con la misma causa · latente|activo>
Plan:              <alternativa elegida y por qué>
Fix:               <commit(s)>
Verificación:      <qué ejercitaste y qué observaste — incluida la refutación>
```

**Severidad:** **P0** plata/seguridad/pérdida de datos/fuga cross-tenant · **P1** flujo
core roto o dato falso mostrado al cliente · **P2** UX rota o borde importante ·
**P3** cosmético/deuda.

---

## 7) EL LOOP (cómo no perderte ni repetir)

1. **Ledger** en `work-agent/CAZABUG-LEDGER.md`: una fila por sección con
   `estado (pendiente|en curso|limpia) · última pasada · hallazgos · pendientes`.
   Actualizalo **en cada vuelta** (es tu memoria entre iteraciones).
2. **Orden sugerido por riesgo:** primero donde hay **plata y permisos**
   (pagos · caja · liquidaciones · rendiciones · depósitos · contratos · reclamos-quién-paga),
   después **datos/estado** (propiedades · propietarios · inquilinos · renovaciones ·
   consorcios · profesionales), después **PWA del inquilino**, al final lo periférico.
3. **Una sección por iteración**, hasta el fondo (las 3 capas). No saltes de sección con
   un hallazgo a medio entender.
4. **No re-reportes** lo ya arreglado ni los falsos positivos conocidos (§8).
5. **Condición de corte de una sección:** la declarás **limpia** cuando hiciste el barrido
   de los 14 patrones de §4, la refutación no encontró nada nuevo, y el gate pasa.
   **Del loop entero:** cuando todas las secciones están limpias **y** una pasada
   completa nueva no produce hallazgos P0/P1.
6. Al cierre de cada iteración: **reporte** (§6) + commit + actualizar ledger. Si algo
   quedó bloqueado (falta un dato del dueño), decilo con la pregunta exacta.

---

## 8) QUÉ **NO** ES UN BUG (no lo "arregles")

- Las **decisiones LOCKED** de `05-DECISIONES.md`: comisión sobre el alquiler · cualquier
  co-inquilino puede pagar · gastos de rendición solo de propiedades con ingreso y por
  partes · `PROPIETARIO_DIRECTO` no es ingreso · resumen bancario **sin IA/OCR** ·
  mapeo flexible en migración de cartera · **el PIN se eliminó** · reclamos con 3 pagadores.
- La **lectura del ex-inquilino** tras la baja (es a propósito).
- Que el **chat de reclamos** y el flujo del **profesional** sigan operando sobre un
  contrato dado de baja (deliberado: cerrar business ya abierto).
- Los **falsos positivos** listados en `03-AUDITORIAS.md`.
- Diferencias de **estilo/formato** sin impacto funcional (eso es otro prompt).

---

## 9) ARRANQUE (primer paso, ya)

1. Leé `05-DECISIONES.md` y `03-AUDITORIAS.md` (para no cazar falsos positivos).
2. Creá el worktree aislado (§2.3) y verificá que el gate pasa **antes** de tocar nada
   (así sabés que lo que se rompa después es tuyo).
3. Creá/abrí `work-agent/CAZABUG-LEDGER.md` con las secciones de §3 en `pendiente`.
4. Tomá la **primera sección de plata** (pagos) y corré el ciclo completo de §5.
5. Reportá con el formato de §6, commiteá, actualizá el ledger, **y seguí con la
   siguiente sección**. No pares hasta cumplir la condición de corte de §7.5.

> Recordá: el objetivo no es "pasar la sección", es **encontrar el bug que está ahí**.
> Si no encontraste nada, apretá más fuerte.
