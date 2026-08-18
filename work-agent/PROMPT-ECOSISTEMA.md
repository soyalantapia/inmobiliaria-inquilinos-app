# Mapa del ecosistema completo — My Alquiler

> **Este archivo es un PROMPT para ejecutar.** Pegalo en una sesión nueva de Claude Code
> parada en la raíz del repo, o decile al agente:
> _"ejecutá `work-agent/PROMPT-ECOSISTEMA.md`"_.

---

## 0. Qué lo diferencia de los prompts que ya existen

Este repo ya tiene dos prompts de comprensión. **No los reemplaza: los complementa.**

| Prompt | Para qué sirve | Qué deja |
|---|---|---|
| `PROMPT-ESTADO-Y-ORIENTACION.md` | Ponerse al día rápido: ¿dónde estamos hoy? | Un informe de estado en el chat |
| `PROMPT-ONBOARDING-DEV-SENIOR.md` | Que un dev nuevo entienda todo y proponga con qué seguir | Una síntesis + recomendación en el chat |
| **`PROMPT-ECOSISTEMA.md`** (este) | **Entender el ecosistema como sistema vivo: los 3 frentes y cómo se conectan** | **Un documento permanente: `work-agent/07-ECOSISTEMA.md`** |

La diferencia clave: los otros dos producen **entendimiento efímero** — el agente entiende,
te lo cuenta, y cuando cierra la sesión se pierde. Este produce un **artefacto durable**
que cualquier sesión futura lee en 5 minutos en vez de reconstruirlo desde cero.

El foco tampoco es el mismo. Los otros recorren el proyecto **por archivo**. Este lo recorre
**por flujo**: seguís la plata y los datos atravesando los tres frentes (API ↔ panel de la
inmobiliaria ↔ PWA del inquilino) y contás qué ve y qué puede hacer **cada lado del mostrador**
en cada momento.

---

## 1. Quién sos

Sos el ingeniero que tiene que poder responder, sin abrir el código, preguntas como:

- _"Un inquilino informa un pago un martes a las 3 AM. Contame todo lo que pasa, hasta que
  el propietario ve la plata en su rendición."_
- _"¿Qué ve el inquilino que la inmobiliaria NO ve, y al revés?"_
- _"Si cambio el modo de cobranza de un contrato a mitad de mes, ¿qué se rompe?"_
- _"¿Dónde exactamente se decide que un reclamo lo paga el inquilino y no el propietario?"_

Si al final no podés responder eso con nombres de archivos, endpoints y modelos concretos,
el trabajo no está hecho.

## 2. Reglas innegociables

1. **Modo lectura.** No escribís código, no deployás, no corrés migraciones, no borrás nada.
   Solo `Read` / `Grep` / `Glob` / `Bash` de lectura (`git log`, `curl` a `/health`).
   **La única escritura permitida es `work-agent/07-ECOSISTEMA.md`**, el entregable.
2. **No tocar el tenant real** (Tapia Propiedades) ni correr los tests de `apps/api`
   (pegan a una DB remota y hacen reset/seed).
3. **Respetá las decisiones LOCKED** de `work-agent/05-DECISIONES.md`. No son bugs.
4. **Orden de verdad: código > git > prod > docs.** Los docs están muy al día, pero cuando
   algo no coincida, manda el código — y lo anotás como discrepancia (sección 6).
5. Si algo no lo pudiste verificar, **escribís que no lo verificaste**. Nada de rellenar
   con lo que parece razonable.

## 3. Contexto mínimo para arrancar

**My Alquiler** (codename `@llave/*`) es un SaaS multi-tenant de gestión de alquileres,
en producción para Tapia Propiedades. Monorepo pnpm + Turbo:

```
apps/api            Fastify 5.2 + Prisma 6.2 + PostgreSQL  (~153 endpoints, ~75 modelos)
apps/inmobiliaria   Next.js 14 App Router — panel admin, desktop-first
apps/inquilino      Next.js 14 App Router — PWA del inquilino, mobile-first
packages/shared     @llave/shared — permisos.ts, auth.ts (schemas JWT)
packages/ui         @llave/ui — shadcn/Radix + design system
packages/config     @llave/config — tsconfig + tailwind
```

Aislamiento multi-tenant por `inmobiliariaId`. Auth propia: OTP + JWT, **3 tipos de token**
(usuario del panel / inquilino / co-inquilino). Deploy en Railway con volumen para archivos.

## 4. Recorrido

### Fase A — Leer la documentación autoritativa (no la resumas todavía)

En este orden, completos: `PROJECT.MD` · `CLAUDE.md` · `README.md` ·
`work-agent/01-ARQUITECTURA.md` · `work-agent/00-ESTADO.md` · `work-agent/05-DECISIONES.md` ·
`work-agent/04-PENDIENTES.md`. Escaneá `CHANGELOG.md` y `work-agent/03-AUDITORIAS.md`
buscando **por qué** las cosas quedaron como quedaron.

### Fase B — El modelo de datos es el mapa real del negocio

Leé `apps/api/prisma/schema.prisma` **entero**. Después escribí, en tus palabras:

- Los **agrupamientos** de los ~75 modelos (identidad y tenencia · propiedades ·
  contratos · plata · reclamos · consorcios · SaaS/billing · auditoría).
- El **grafo de las entidades centrales**: `Inmobiliaria` → `Propiedad` → `Contrato` →
  `Liquidacion` → `Pago` → `Rendicion` → `MovimientoCaja`. Quién apunta a quién y con qué
  cardinalidad.
- Cómo `Persona` se relaciona con inquilino/propietario/garante y por qué existe separada.
- **Qué modelos existen sin feature que los use** (cáscaras). `04-PENDIENTES.md` menciona
  varios; verificá contra el schema y el código cuáles siguen huérfanos.
- Todos los **enums de estado** y sus transiciones válidas: `EstadoContrato`,
  `EstadoDeposito`, estados de pago/liquidación/reclamo. Dibujá las máquinas de estado.

### Fase C — Trazar los flujos de punta a punta

Esto es el corazón del trabajo. Para **cada flujo**, seguí la cadena completa:

> componente del front → hook/fetch → endpoint → handler → servicio → Prisma → tablas
> → qué se le devuelve al otro lado del mostrador

**Flujos de plata (prioridad máxima — acá vive el riesgo real):**

1. **Devengamiento** — el cron in-process cada 6h + `/internal/cron/devengar` con
   `CRON_SECRET`. Cómo genera liquidaciones futuras y **por qué es idempotente**.
2. **Pago informado por el inquilino** — subir comprobante → "Por validar" en el panel →
   validación → impacto en la liquidación → visibilidad en "Pagos recibidos".
3. **Conciliación bancaria** — subir CSV/Excel → parseo → matching determinístico (sin IA)
   → creación del `Pago` en estado CONCILIADO. Qué pasa con lo que no matchea.
4. **Modos de cobranza** — `INMOBILIARIA` (banco recaudador) vs `PROPIETARIO_DIRECTO`.
   Dónde cambia el destino del dinero, qué valida el alta, y qué guarda el
   `PATCH /contratos/:id/modo-cobranza` (mirá el guard de rendición).
5. **Rendición al propietario** y su relación con la caja.
6. **Ciclo de vida del contrato** — depósito en custodia · ajuste de alquiler · renovación ·
   **rescisión con penalidad y neteo** · saldar deuda de ex-inquilinos. Seguí la aritmética.
7. **Reclamos "¿quién paga?"** — propietario / inquilino / depósito, y cómo cada rama
   impacta plata real (rendición del dueño · cargo al inquilino · deducción del depósito).
   Terminá en `GET /mis-cargos` y `POST /cargos/:id/saldar`.

**Flujos de identidad y acceso:**

8. **Auth completa** — OTP → emisión de los 3 tipos de JWT → dónde se valida → cómo se
   inyecta `inmobiliariaId` → qué pasa si falta.
9. **Accesos sin cuenta** — profesional por link mágico `/p/:token`, garante
   `/garantes/[token]`, verificación `/verificar/[hash]`. Qué puede hacer cada uno,
   cuánto vive el token, y **qué lo limita**.
10. **Co-inquilinos** — invitación, alta, qué ve respecto del inquilino titular.

**Flujos de entrada de datos:**

11. **Migración de cartera** — Excel/CSV → mapeo flexible de columnas → validación fila a
    fila → creación de propiedades + inquilinos + contratos. Qué pasa con una fila inválida.
12. **Archivos** — los 4 flujos de upload contra el volumen de Railway (`/data`, `/uploads`).
    Prestá atención a `urlEsDelTenant` y por qué existe.

### Fase D — La matriz de los dos lados

El pedido explícito del owner: entender **inquilino y administrador**, no uno u otro.

Armá una tabla que para cada dominio (contrato · liquidaciones · pagos · reclamos ·
documentos · servicios · propiedad · notificaciones) responda:

| Dominio | Qué ve la inmobiliaria | Qué puede hacer | Qué ve el inquilino | Qué puede hacer | Dónde se cruzan |
|---|---|---|---|---|---|

Y marcá explícitamente:

- Qué es **asimétrico a propósito** (uno ve algo que el otro no, por diseño).
- Qué está **demo-gated a propósito** en prod (`04-PENDIENTES.md` sección B) — no son bugs.
- Qué escribe todavía a **localStorage en vez de la API** (fake en prod).

### Fase E — Verificar contra la realidad

- `git log --oneline -40` y `git status`: ¿qué se movió después de la última fecha de
  `00-ESTADO.md`? Ese doc dice 28/07 pero hay push posterior — **averiguá qué entró**.
- `00-ESTADO.md` y `04-PENDIENTES.md` marcan trabajo **"en `main`, sin deployar"**.
  Verificá contra `git log origin/main` y, si podés, contra `/health` de prod.
  **Decí claramente qué está deployado y qué no.**
- Contá endpoints reales (`grep` sobre las rutas de `apps/api`) y modelos reales del
  schema. Si no dan ~153 y ~75, informá los números correctos.

---

## 5. Entregable: `work-agent/07-ECOSISTEMA.md`

Escribí **un solo archivo**, en español, con este esqueleto:

1. **Resumen ejecutivo** — 10 líneas. Qué es el sistema y cómo se sostiene.
2. **Mapa de los 3 frentes** — qué hace cada app, qué comparten, cómo se hablan.
3. **Modelo de datos** — los agrupamientos, el grafo central, las máquinas de estado.
4. **Multi-tenant y auth** — cómo se garantiza el aislamiento, los 3 tokens, los accesos
   sin cuenta, y dónde está el punto débil si lo hay.
5. **Los flujos de plata**, uno por uno, con la cadena completa front→API→DB y las reglas
   que los gobiernan.
6. **La matriz inmobiliaria ↔ inquilino** (Fase D).
7. **Qué es real, qué es demo y qué es cáscara** — tres listas separadas, sin ambigüedad.
8. **Discrepancias doc ↔ código** que encontraste.
9. **Riesgos y deuda técnica** ordenados por impacto en plata o en datos personales.
10. **Preguntas abiertas** que solo el owner puede responder.

Reglas del documento: cada afirmación fuerte va con **referencia concreta**
(`apps/api/src/rutas/pagos.ts:120`, `Contrato.modoCobranza`, `POST /cargos/:id/saldar`).
Si algo no lo verificaste, escribí _"no verificado"_. Sin relleno.

## 6. Mientras leés: reportá secretos

Este repo estuvo **público** y tenía credenciales de producción en `README.md` y
`work-agent/00-ESTADO.md`. Si encontrás **cualquier** otro secreto vivo —claves, tokens,
contraseñas, connection strings, webhooks— en código, docs o historial, **paralo todo y
avisá primero**, antes de seguir con el mapa. No lo escribas en el entregable.

## 7. Cierre

Terminá con:

- La ruta del archivo que escribiste.
- **Tres cosas que te sorprendieron** al trazar los flujos (algo que el código hace y los
  docs no dejaban ver).
- **Las tres preguntas** cuya respuesta más cambiaría tu entendimiento del sistema.
- Y **preguntá al owner con qué seguimos.** No escribas código sin que te lo pida.
