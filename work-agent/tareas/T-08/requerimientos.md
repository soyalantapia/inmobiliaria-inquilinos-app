# T-08 · Encabezado fijo con la propiedad en el wizard de alta

## 1. El problema, en una frase

Mientras carga un contrato, la operadora no puede ver de qué propiedad es, y se pierde.

## 2. La cita

Camila `[19:06]`: *"Estoy adentro de un contrato y no sé en qué inmueble estoy, no lo veo."*
Camila `[21:19]`: *"Tendría que dejar puesto que es Lourdes 11 primero A, de lo que ella está
poniendo, que quede siempre arriba, que se vea la propiedad."*

Es parte de un problema más grande que ella nombró aparte `[37:56]`: *"de un lado tenés que
entrar a propiedades, después al contrato, después al inquilino… yo me pierdo, me cuesta"*.

## 3. Estado actual — verificado hoy contra el código

- El wizard de producción es `PasoApi`, en `contratos/nuevo/page.tsx:873`. Tiene **5 pasos**:
  1 elegir propiedad (`:1595`) · 2 inquilino (`:1645`) · 3 términos (`:1857`) ·
  4 períodos anteriores (`:2151`, condicional) · 5 confirmar (`:2283`).
- La propiedad se elige en el paso 1 y **después no se vuelve a mostrar en ningún lado**.
  Confirmado: lo único que se renderiza arriba de los pasos es el link "Volver", el indicador
  `StepsApi` y el botón "Cancelar carga" (`:1520-1551`).
- Ya existe `propiedadSel` en el scope (`:1025-1026`), o sea que **el dato está a mano**: no hace
  falta ni una query nueva.
- Ya existe el helper de rótulo `lib/rotulo-propiedad.ts` (`rotuloPrincipal`,
  `rotuloSecundario`, `rotuloEnLinea`), con la prioridad **consorcio > complejo > dirección**.
- El `Topbar` **no** es sticky (`components/topbar.tsx:13`), así que una barra `sticky top-0`
  dentro de `<main>` se fija bien y el topbar scrollea por detrás.

**El "Estado verificado" que traía la tarea era correcto.** No hubo que corregir el documento.

## 4. Comportamiento esperado

Desde el paso 2 en adelante, una barra fija arriba muestra la propiedad del contrato que se está
cargando, con el rótulo que la inmobiliaria usa de verdad (complejo/consorcio en primer plano, la
dirección como dato secundario), y permite volver al paso 1 a cambiarla.

## 5. Alcance

**Entra:** la barra sticky en el wizard de alta de contrato (`PasoApi`), con acción para cambiar
la propiedad.

**NO entra:**
- El wizard **demo** (`!apiEnabled`, `:145-228`): tiene otra estructura de pasos y no es lo que
  usa Camila. No se toca.
- Migrar el resto del panel al helper de rótulo: **eso es T-06**, tarea aparte.
- Rediseñar el flujo propiedad → contrato → inquilino: **eso es T-10**.

## 6. Criterios de aceptación

- **AC-1** · En los pasos 2, 3, 4 y 5, la propiedad elegida se ve **sin scrollear**.
- **AC-2** · Al hacer scroll dentro de un paso largo (el 3 es el más largo), la barra **sigue
  visible**.
- **AC-3** · El rótulo respeta la prioridad del helper: si la propiedad tiene consorcio o
  complejo, ése va **en primer plano** y la dirección abajo. Si no tiene, va la dirección sola,
  **sin dejar un renglón vacío**.
- **AC-4** · Hay una acción visible para volver al paso 1 y cambiar la propiedad, y usarla **no
  borra lo ya cargado** en los otros pasos.
- **AC-5** · En el paso 1 la barra **no** aparece (sería redundante: ahí se está eligiendo).
- **AC-6** · En mobile (375px) la barra no ocupa más de dos renglones ni tapa el contenido.

## 7. Impacto en plata / permisos / multi-tenant

**Ninguno.** Es presentación: no toca endpoints, ni queries, ni el payload del alta. El dato ya
está en el cliente.

## 8. Qué NO se puede romper

- El **autosave del borrador** (`contrato-borrador-storage.ts`): volver al paso 1 y cambiar la
  propiedad tiene que seguir persistiendo bien.
- El **modo demo** (`apiEnabled === false`): el otro wizard no se toca y tiene que seguir igual.
- El **encadenado desde "cargar propiedad"** (`?propiedad=<id>`, `:1029-1050`), que preselecciona
  y salta al paso 2 — justo el caso donde la barra tiene que aparecer ya cargada.
- El indicador de pasos `StepsApi` y el botón "Cancelar carga".
