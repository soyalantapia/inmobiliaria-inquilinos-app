# T-21 · El caso "solo expensas": cerrar el circuito en la PWA

- **fase final:** 8 (cerrada)
- **commit:** `a4acc13`, mergeado por fast-forward a `feat/reunion-camila-0308`
- **rama:** `feat/T-21-solo-expensas-pwa` · **worktree:** removido

## Hecho

Cableado `tipoContrato` + `montoExpensas` de `GET /mi-contrato` hasta las pantallas, y ajustadas
las superficies donde la app le hablaba de alquiler a quien no lo paga: home, detalle de pago,
pantalla de contrato (×2 variantes), checkout, certificado imprimible y el rótulo del switcher.
Criterio único en `apps/inquilino/src/lib/tipo-contrato.ts`.

**La trampa** no era copy: el checkout hacía `contrato?.montoActual ?? liq.montoAlquiler`, y `??`
no cae en `0`. Con `montoActual === 0` (que es lo normal en un solo-expensas) la referencia
quedaba en 0 y el banner de "pactá un plan de pago" saltaba con **cualquier** saldo.

## NO hecho, y por qué

- **La pregunta de la comisión** (punto 3 de la tarea): *¿cómo cobra la inmobiliaria por
  administrar una unidad de solo expensas?* Es una decisión de negocio del dueño. Hoy no cobra
  nada: con `montoAlquiler = 0` el `montoBruto` de la rendición da 0 y `POST /rendiciones` corta
  con `RendicionSinCobros`, así que **ese contrato no se rinde nunca y la comisión es cero**.
- **Migraciones:** ninguna. Este cambio no toca el schema.

## Veredicto de la Fase 7 (Camila)

> "Bueno, ahora sí. Antes le abría la app al de la unidad que sólo paga expensas y le decía
> *Alquiler cero* — y el tipo me llamaba a preguntar si le estábamos cobrando el alquiler
> también. Eso ya está.
>
> Lo del cartel de la deuda me lo tenés que explicar igual, porque me da miedo: si el sistema le
> dice a la gente *pactá un plan* cuando debe un mes nada más, yo tengo la oficina llena de gente
> queriendo pactar. Menos mal que lo agarraron.
>
> Ahora, lo que me sigue faltando: **yo por administrar esa unidad no estoy cobrando nada.**
> Ustedes me armaron todo el circuito para que el tipo pague las expensas, pero la comisión mía
> ahí es cero. Eso no lo pueden dejar así, porque si no ese contrato me cuesta plata en vez de
> darme."

## Tareas nuevas que salieron (registradas en el documento)

- **T-21-N1 · 🔴 El devengo no sabe qué es un solo expensas.** `montoAlquilerSegunTipo` tiene un
  único caller (el `PATCH /monto`); `computarLiquidacionesContrato` **ni siquiera recibe
  `tipoContrato`**. Hoy funciona por casualidad, porque `contrato.monto` vale 0. Pero
  `POST /ajustar` (`core.ts:1805`) y `POST /renovar` (`core.ts:1890`) escriben el canon con un
  `z.number().positive()` **sin mirar el tipo** → ajustar o renovar un solo-expensas le empieza a
  facturar alquiler a alguien que no paga alquiler, y el ajuste masivo del panel entra por ahí.
  **Es plata.**
- **T-21-N2 · 🟠 El alta deja crear un solo-expensas con alquiler > 0.** La validación es
  asimétrica: `core.ts:1029` rechaza `monto === 0` en un ALQUILER, pero no existe el chequeo
  inverso.
- **T-21-N3 · 🟢 `CLAUDE.md` apunta a `packages/db/prisma`, que no existe.** El schema está en
  `apps/api/prisma/schema.prisma`. Quien lo busque donde dice el doc concluye que el modelo no
  existe — que es exactamente lo que pasó al escribir T-21.

## Ojo para el que siga

`apps/inquilino/tsconfig.json` ahora excluye los `*.test.ts`, porque la PWA todavía no tiene
runner y el `import from 'vitest'` rompía `tsc`. **T-32 está montando ese runner en paralelo
(worktree `myalquiler-T-32`): al cerrarla hay que borrar ese `exclude`**, y ahí
`src/lib/tipo-contrato.test.ts` (16 casos, ya escritos) empieza a correr solo.
