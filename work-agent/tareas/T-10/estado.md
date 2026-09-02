# T-10 · Unificar el flujo propiedad → contrato → inquilino — TERMINADA

rama: `feat/reunion-camila-0308` · fase: 8

## Los dos cortes que había (verificados, no supuestos)

1. **El wizard te dejaba en una lista.** `contratos/nuevo/page.tsx` usaba `creado.id` para subir
   los documentos y después hacía `router.push('/contratos')`. Terminabas de cargar todo y
   tenías que **buscar en una tabla** el contrato que acababas de hacer.
2. **Desde el contrato no se llegaba al inquilino.** `InquilinoActualAcciones` (reenviar el email
   de bienvenida, co-inquilinos) se monta en **un solo lugar**: la ficha de la propiedad. Desde el
   detalle del contrato el único link a la propiedad estaba enterrado adentro de la card de
   servicios. O sea: había que volver al menú lateral. El laberinto que describió Camila.

Los pasos 1→3 (propiedades → cargar → ficha → cargar contrato) ya estaban encadenados por
`0427afa` y `afbf08f`. El problema era el final del recorrido.

## Qué cambió

- `contratos/nuevo/page.tsx` → `router.push(\`/contratos/${creado.id}\`)`.
- `contratos/[id]/page-client.tsx` → el rótulo de la propiedad en el header es link a
  `/propiedades/{propiedadId}`. Sin `propiedadId`, texto plano (nada de links muertos).
- `lib/api/use-contrato.ts` → en demo se **deriva** `propiedadId` del cruce
  `propiedadesMock.contratoActualId` que ya se hacía ahí. No se hardcodeó en `contratosMock`
  a propósito: habría dejado dos copias de la misma relación, y además `propiedades/page.tsx:144`
  usa `contrato.propiedadId` del **listado** para sumar deuda de ex-inquilinos — al derivarlo sólo
  en el detalle, ese cálculo queda intacto.

## Verificación

Recorrido completo en el navegador (demo, `localhost:3001`):
`/contratos/cnt_001` → click en "Complejo Lourdes" → `/propiedades/prp_001` → pestaña
**Inquilino** → aparecen "Reenviar email de bienvenida" y "Co-inquilinos". **Sin tocar el menú
lateral.** (AC-3, AC-5 en su tramo contrato→inquilino.)

- **AC-4/AC-6** · antes del fix el link no existía y la página andaba igual; con `propiedadId`
  ausente cae en el texto plano. Verificado en el navegador.
- **AC-2** · `/contratos/cnt_006` (BORRADOR) renderiza y su link anda. Del lado del API,
  `GET /contratos/:id` (`core.ts:294`) filtra sólo por `id` + `inmobiliariaId`, no por estado.
- `tsc --noEmit` limpio; `next lint` sin hallazgos nuevos; consola y logs del server sin errores.
- `/propiedades` sigue listando las 6 propiedades.

### Lo que NO pude verificar corriendo

**AC-1 (aterrizar en `/contratos/<id creado>`) no se ejecutó.** Ese camino es `apiEnabled` y
necesita API + Postgres; en esta máquina no hay `DATABASE_URL`. Queda verificado por lectura:
`creado.id` está en scope y ya se usaba doce líneas arriba para `POST /contratos/:id/documentos`.
**Hay que probarlo en staging antes de dar T-10 por cerrada del todo.**

## Fuera de alcance, anotado

- **Modo demo, paso 2:** al crear una propiedad en demo se cae en `/propiedades` (la lista) en vez
  de la ficha, porque en demo la propiedad **no se crea** (`propiedades/nueva/page.tsx:487` es un
  `setTimeout` de 600 ms) y no hay id al que ir. Pide persistencia demo de propiedades.
- **T-08** (barra fija con la propiedad dentro del wizard) lo está haciendo otro chat en
  `../myalquiler-T-08`. No toqué el header del wizard para no chocar.
- Bug visto de paso, NO tocado: `inquilino-actual-acciones.tsx:68` muestra el badge
  **"Cuenta activa"** fijo, sin mirar si el inquilino activó la cuenta.
