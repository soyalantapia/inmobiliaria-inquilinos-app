# Orientación y estado — "¿Dónde estamos parados?" · My Alquiler

> **Este archivo es un PROMPT para ejecutar.** Pegalo en una sesión nueva parada en la
> raíz del repo (`~/dev/inmobiliaria-inquilinos-app`), o decile a un agente
> "ejecutá `work-agent/PROMPT-ESTADO-Y-ORIENTACION.md`". El objetivo es simple:
> **analizar TODO en orden y devolver un mapa claro de dónde estamos parados HOY** —
> sin tocar código, sin deployar, sin asumir nada que no puedas verificar.
>
> No es el onboarding profundo (para eso está `PROMPT-ONBOARDING-DEV-SENIOR.md`, que
> además recorre el código). Este es el "ponete al día rápido y decime el estado real".

---

## 0. Quién sos y qué tenés que lograr

Sos un ingeniero que se para frente a **My Alquiler** —un SaaS **multi-tenant de gestión
de alquileres EN PRODUCCIÓN** (plata y datos reales del cliente Tapia Propiedades)— y
tenés que **entender el estado actual de verdad** y reportarlo. Tu entregable es **un
solo informe estructurado** (sección 4). Nada de código todavía.

Fuente de verdad, en este orden de prioridad: **código > git > prod > docs**. Los docs
están muy al día (se mantienen en el mismo PR que el cambio), pero si algo no coincide,
**manda el código / git / prod** y lo anotás como discrepancia.

## 1. Reglas antes de empezar (no negociable)

1. **Modo lectura.** No escribas código, no deployes, no corras migraciones, no borres
   nada. Solo Read / Grep / Bash de lectura (`git log`, `curl` a `/health`, etc.).
2. **No toques el tenant real** (Tapia Propiedades) ni corras los tests de `apps/api`
   (pegan a una DB remota y hacen reset/seed).
3. **Respetá las decisiones LOCKED del dueño** — no las leas como bugs. Están en
   `work-agent/05-DECISIONES.md`.

## 2. Recorrido EN ORDEN (leé así, de arriba a abajo)

Andá tomando nota de: **qué hay, qué está EN VIVO, qué se hizo último, qué falta**.

1. **`README.md`** — qué es, stack, URLs en vivo, cómo está organizado el repo, tooling
   y accesos (Railway, DB, storage, email). Es el mapa.
2. **`PROJECT.MD`** — documento maestro (contexto absoluto): arquitectura, modelo de
   datos, API, plata, auth, storage, deploy, decisiones, roadmap. Es largo; leelo entero
   o al menos el índice + las secciones de estado/roadmap.
3. **`work-agent/00-ESTADO.md`** — **el resumen ejecutivo de dónde estamos hoy.** Fijate
   la fecha y el último commit del encabezado: ese es el "ancla" de cuán fresco está.
4. **`work-agent/04-PENDIENTES.md`** — qué falta / roadmap. Distinguí: (a) pendientes que
   necesitan **decisión o insumo del owner** (billing, referidos, screening NOSIS,
   WhatsApp real, IA/OCR opcional), (b) **front pendiente** con backend ya listo, (c) lo
   marcado **ya hecho**. **No hay bugs abiertos conocidos** — si encontrás uno, es hallazgo.
5. **`work-agent/05-DECISIONES.md`** — reglas de negocio LOCKED del dueño + reglas duras +
   datos del tenant real. Leelas para no "des-arreglar" nada.
6. **`work-agent/03-AUDITORIAS.md`** — historia de las campañas de QA/auditoría + los
   falsos positivos conocidos (NO re-arreglar).
7. **`work-agent/{01-ARQUITECTURA,02-DEPLOY,06-ANALISIS-SENIOR}.md`** — skim: patrones
   (multi-tenant, money model, apiEnabled, auth, storage, cron), cómo se deploya, análisis.
8. **`CHANGELOG.md`** — recorré las entradas más recientes (por fecha) para ver la
   **secuencia de lo que se shipeó último** y entender la trayectoria.
9. **`docs/`** (referencia, consultá lo que necesites): `API.md` (endpoints), `DATA-MODEL.md`
   (ERD + onDelete), `CONFIG.md` (env vars), `RUNBOOK.md`, `TESTING.md`, `FRONTEND.md`,
   `GLOSARIO.md`.

## 3. Verificá contra la realidad (no te quedes solo con los docs)

```bash
git log --oneline -20                 # qué se shipeó último (la trayectoria real)
git status --short && git branch --show-current   # rama actual + ¿árbol limpio?
git rev-parse --short HEAD && git rev-parse --short origin/main   # ¿main == origin?
curl -s https://api-production-262e.up.railway.app/health         # prod viva? {ok, db, ts}
curl -s -o /dev/null -w '%{http_code}\n' -I https://admin.myalquiler.com   # panel 200?
curl -s -o /dev/null -w '%{http_code}\n' -I https://app.myalquiler.com     # inquilino 200?
```

Chequeos útiles de "frescura" (si algún número del doc te hace ruido, verificalo):
```bash
grep -rhoE "app\.(get|post|put|delete|patch)\(" apps/api/src/routes | wc -l   # nº endpoints
grep -cE "^model " apps/api/prisma/schema.prisma   # nº modelos
grep -cE "^enum "  apps/api/prisma/schema.prisma   # nº enums
```
Si el `git log` muestra commits más nuevos que la fecha de `00-ESTADO.md`, **el estado
real está más adelante que el doc** → reconstruí el delta desde los mensajes de commit.

## 4. Entregable: informe "DÓNDE ESTAMOS PARADOS"

Devolvé UN informe con estas 6 partes, concreto y honesto (citá archivos/commits reales):

1. **Qué es** (2-3 líneas): el producto, los dos frentes (panel inmobiliaria / PWA
   inquilino), el tenant real, y que está EN PRODUCCIÓN.
2. **En vivo ahora**: las 3 URLs + el resultado real de los `curl` (health/panel/inquilino),
   HEAD actual, si `main == origin/main`, y si el árbol está limpio.
3. **Qué se hizo último** (trayectoria): los últimos ~5-10 hitos con su commit/fecha,
   sacados de `git log` + `CHANGELOG.md` + `00-ESTADO.md`. Contá la historia, no listes.
4. **Qué falta** (roadmap, priorizado): agrupá en (a) **decisiones/insumo del owner**,
   (b) **front pendiente con backend listo**, (c) **hallazgos nuevos** (si detectaste
   algo). Para cada uno: el porqué y el impacto/riesgo.
5. **Discrepancias** (si hay): cosas donde el código/git/prod NO coinciden con los docs.
   Si no hay, decilo explícito ("docs consistentes con el código").
6. **Recomendación**: con qué arrancarías vos y **por qué**, marcando qué necesita
   decisión del owner. Cerrá **preguntándole al owner con cuál querés que arranque** (o
   si prefiere correr `PROMPT-LOOP-QA-VISUAL-FUNCIONAL.md` para una pasada de QA primero).

## 5. Disciplina

- ❌ No codees, no deployes, no toques prod ni el tenant real en este recorrido.
- ❌ No confíes en `work-agent/historico/` como estado actual (es contexto viejo).
- ✅ Sé escéptico: verificá los números y el estado contra el código y git.
- ✅ Terminá con el informe de la sección 4 y **esperá la decisión del owner**.

---

_Al terminar: entregá el informe "DÓNDE ESTAMOS PARADOS" (sección 4) y preguntá con qué
seguimos. Recién con el OK del owner: rama + plan + ejecución prolija._
