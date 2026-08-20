# T-10 · Unificar el flujo propiedad → contrato → inquilino — requerimientos

## La cita

Reunión del 03/08 `[37:56]`, Camila:
> *"Es como que de un lado tenés que entrar a propiedades, después el otro tenés que ir al
> contrato, después lo otro tenés que ir al inquilino, como que está medio… yo me pierdo,
> me cuesta."*

Alan `[38:08]`: *"No está bueno eso, tenemos que hacerlo más sencillo."*

## El recorrido real, verificado paso a paso (19/08, rama `feat/reunion-camila-0308`)

| # | Dónde estás | Cómo seguís | ¿Se corta? |
|---|---|---|---|
| 1 | `/propiedades` | botón "Cargar propiedad" | no |
| 2 | `/propiedades/nueva` | guardar → `/propiedades/{id}` (`propiedades/nueva/page.tsx:474`) | no en prod |
| 3 | `/propiedades/{id}` | "Cargar contrato" → `/contratos/nuevo?propiedad={id}` (`page-client.tsx:730`) | no |
| 4 | wizard de contrato | el inquilino se carga **adentro**; al confirmar → `/contratos` (`contratos/nuevo/page.tsx:1491`) | **SÍ** |
| 5 | querés algo del inquilino | las acciones viven **sólo** en la ficha de la propiedad | **SÍ** |

Los pasos 1→3 ya están encadenados: el commit `0427afa` sinceró propiedad/propietario y
`afbf08f` desbloqueó "Cargar inquilino". **El problema que queda es el final del recorrido.**

### Corte 1 — el wizard te deja en una lista

`contratos/nuevo/page.tsx:1427` guarda la respuesta en `creado` y **usa `creado.id`** para subir
los documentos (`:1451`)… y después hace `router.push('/contratos')`. El id del contrato recién
creado existe y se descarta. Camila termina de cargar todo y tiene que **buscar en una lista** el
contrato que acaba de hacer.

### Corte 2 — desde el contrato no se llega al inquilino

`InquilinoActualAcciones` —reenviar el email de bienvenida, sumar co-inquilinos— se monta en **un
solo lugar**: `propiedades/[id]/page-client.tsx:499`. Desde el detalle del contrato el único link
a la propiedad está enterrado adentro de la card "Servicios de la propiedad", como
*"Editar en la propiedad →"* (`contratos/[id]/page-client.tsx:1376`). En el header, el rótulo de
la propiedad es texto plano (`:240`).

O sea: para tocar algo del inquilino, desde el contrato hay que volver al menú lateral. Que es
literalmente lo que Camila describe.

### Lo que NO está roto (verificado, no hace falta tocarlo)

- **La invitación al inquilino ya sale sola.** `core.ts:1254`, dentro del alta: si el inquilino
  tiene email y el contrato no queda pendiente de aprobación, se manda. No hay que agregar un
  paso "invitar".
- **El wizard ya entiende `?propiedad=<id>`** y arranca en el paso del inquilino
  (`contratos/nuevo/page.tsx:1038`).

## Alcance

**Entra:** cerrar los dos cortes (pasos 4 y 5).

**NO entra:**
- La barra fija con la propiedad dentro del wizard: es **T-08**, la está haciendo otro chat en
  el worktree `../myalquiler-T-08`. No toco el header del wizard para no chocar.
- El rótulo de propiedad en el resto del panel: es **T-06**.
- Duplicar el editor de co-inquilinos en el contrato. El dato vive en la propiedad y tener dos
  editores del mismo dato es peor que un link. Se navega, no se duplica.
- **Modo demo en el paso 2.** En demo la propiedad no se crea (`propiedades/nueva/page.tsx:487`
  es un `setTimeout` de 600 ms), así que no hay ficha a la que ir y por eso cae en
  `/propiedades`. Arreglarlo pide persistencia demo de propiedades: otra tarea, no esta.

## Comportamiento esperado

1. Al confirmar el alta, Camila aterriza **en el contrato que acaba de crear**, no en la lista.
2. Desde el detalle del contrato se llega a la ficha de la propiedad **en un click**, desde el
   header, sin pasar por el menú lateral.

## Criterios de aceptación

- **AC-1** · Alta exitosa desde el wizard → la URL es `/contratos/<id del contrato creado>`.
- **AC-2** · Si el contrato queda **pendiente de aprobación** (rol CARGA), también aterriza en su
  detalle: es donde se ve que está pendiente.
- **AC-3** · En el header del detalle, el rótulo de la propiedad es un link a
  `/propiedades/<propiedadId>`; desde ahí se llega a reenviar el email de bienvenida.
- **AC-4** · Si el contrato no trae `propiedadId` (el tipo lo declara opcional), el rótulo se
  sigue viendo como texto plano — **no** se rompe ni queda un link muerto.
- **AC-5** · El recorrido completo propiedad → contrato → inquilino se hace **sin tocar el menú
  lateral ni una vez**.
- **AC-6** · Modo demo: el detalle del contrato sigue andando y el link no aparece si no hay
  `propiedadId`.

## Impacto en plata / permisos / multi-tenant

- **Plata:** ninguno. Es navegación.
- **Permisos:** ninguno nuevo. `/propiedades/{id}` ya tiene su propio guard.
- **Multi-tenant:** ninguno. El `propiedadId` viene del contrato que el backend ya acotó al
  tenant.

## Qué NO se puede romper

- El borrador del wizard (`borrarBorradorContrato`) se sigue borrando **sólo** en el camino
  exitoso: si el alta falla hay que poder reintentar sin perder lo cargado.
- La subida de documentos post-alta (`:1451`) ocurre **antes** de navegar.
- El caso `dniFallo`: el toast tiene que seguir diciendo que alguna foto no subió.
