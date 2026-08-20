# T-01-N1-N4 · Los dos fronts se caen abriendo un reclamo

**Prioridad:** 🔴 crash en producción
**Origen:** barrido de regresiones de T-01-N1. El barrido reportó **uno** de los dos crashes y
afirmó que *"la PWA del inquilino sí los contempla"*. Verificándolo apareció el otro.

---

## Qué pasa

`TipoEventoReclamo` en Prisma tiene **13** valores. Cada front mantiene a mano su propia copia
de esa lista, y las dos se quedaron cortas — en mitades distintas:

| | valores que conoce | se cae con | quién los escribe |
|---|---|---|---|
| `apps/inmobiliaria` | 10 | `VISITA_CONFIRMADA`, `VISITA_EN_CAMINO`, `VISITA_LISTO` | el profesional, desde el link público (`visitas-publicas.ts:179,200,273`) |
| `apps/inquilino` | 11 | `CLASIFICADO`, `PROFESIONAL_ASIGNADO` | la inmobiliaria (`operacion.ts:372,528,634`) |

Los dos renderean igual, sin guarda:

```tsx
const Icon = iconForTipo[ev.tipo];              // undefined
<p>{labelForTipo[ev.tipo](ev)}</p>              // undefined(ev) → TypeError
```

Y ningún endpoint filtra por tipo: el panel recibe `eventos: { orderBy: { fecha: 'asc' } }`
(`operacion.ts:241`) y el inquilino lo mismo por `GET /mis-reclamos` (`operacion.ts:800`).

**El resultado concreto:** el profesional confirma la visita por el link → Camila abre ese
reclamo en el panel → pantalla rota. Y al revés: la inmobiliaria clasifica un reclamo → el
inquilino abre su reclamo en la app → pantalla rota.

Se cae justo en los reclamos donde **algo está pasando**. Un reclamo quieto se ve bien.

## Por qué TypeScript no lo agarró

`Record<TipoEventoReclamo, X>` **sí** exige exhaustividad — y estaba completo. El problema es
que `TipoEventoReclamo` en cada front es una copia escrita a mano del enum de Prisma. El
compilador verificaba que el Record cubriera la lista local, y la lista local estaba mal. La
verificación era real y comparaba contra la referencia equivocada.

Por eso no alcanza con agregar los valores que faltan: en dos meses alguien agrega el catorceavo
y vuelve a pasar.

---

## Lo que se hace

**1. Un test que ata las TRES listas: `schema.prisma`, la del panel y la de la PWA.** Lee las
tres y exige que coincidan exactamente. Corre en la compuerta nueva (T-01-N1), así que la
desincronización sale en rojo en cada push en vez de en la pantalla de alguien.

> **Se intentó primero una lista única en `packages/shared`, y se descartó.** Es el diseño más
> lindo, pero `apps/inquilino` no depende de `@llave/shared` y agregarle la dependencia toca el
> `pnpm-lock.yaml` — un archivo que ahora mismo están tocando varios chats en paralelo, y que si
> queda mal hace fallar el `--frozen-lockfile` de CI. Habría quedado además lo peor de los dos
> mundos: un front leyendo la lista compartida y el otro la suya. El test cubre a los dos por
> igual y no toca ninguna dependencia. Si algún día la PWA necesita `@llave/shared` por otra
> razón, mover la lista ahí es un cambio chico.

**2. Los valores que faltan, en cada front:**
- Panel: los tres `VISITA_*`, con ícono, color y texto.
- PWA: `PROFESIONAL_ASIGNADO` (al inquilino le sirve saber que va un profesional).

**3. `CLASIFICADO` no le dice al inquilino QUÉ se decidió.** Su `contenido` es
`"Paga: ${labelPagador(...)}"` — o sea quién se hace cargo del arreglo, la inmobiliaria o el
propietario. Es una decisión interna sobre la plata de otros. El inquilino no la necesita y el
proyecto ya viene siendo cuidadoso con esto (ver T-01-N1-N2).

En vez de esconder la fila entera, el evento se rotula *"La inmobiliaria revisó el reclamo"* y
se suprime su `contenido`. El inquilino se entera de lo que le sirve —que lo miraron— y no de
lo que se arregló entre la inmobiliaria y el dueño. Filtrar la fila habría dejado una entrada
muerta en los tres `Record` sólo para satisfacer al compilador; así no queda código de adorno.

**4. Una guarda igual, en los dos.** Un tipo desconocido rendea una fila neutra en vez de tirar
la pantalla. El punto 1 lo agarra en el push, pero eso no cubre el rato entre que se despliega
la API y se despliega el front: en ese rato la base ya tiene eventos que el front viejo no
conoce. Degradar es aceptable; caerse no.

## Lo que NO se hace

- **No se filtran eventos en el server.** Sería cambiar el contrato de dos endpoints que ya
  consume producción. El recorte de lo que ve el inquilino se hace donde se decide qué mostrar.
- **No se toca el copy de los eventos existentes.**
- **No se agrega ninguna dependencia.**

## Cómo se verifica

Se sacaron los tres `VISITA_*` de la lista del panel, o sea se recreó el bug exacto, y
**dispararon las dos defensas a la vez**:

- el test de sincronización: **3 casos en rojo**;
- `tsc` del panel: **3 errores TS2353**, uno por cada `Record`, señalando la línea exacta.

Restaurado, las dos vuelven a verde. Además:

- `tsc` 0 en los cinco paquetes.
- Compuerta completa en verde.

## No verificado

**No se probó en el navegador** — el crash es de render y lo correcto sería abrir un reclamo con
un evento `VISITA_*` y ver la fila. Queda dicho: la corrección está verificada por tipos y por
tests, no visualmente.
