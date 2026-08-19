# T-07 · Completar el expediente del contrato — requerimientos

## El problema, en una frase

La administradora abre un contrato para revisar qué se cargó y varias pestañas están vacías
aunque el dato exista, así que no puede usar la ficha del contrato como expediente.

## La cita

Camila, reunión del 03/08 `[49:52]`:
> *"No cargó nada de los garantes, no tengo documentos, no tengo servicios, no tengo persona…
> debería dejar en la parte de expediente."*

## Estado actual verificado (19/08, rama `feat/reunion-camila-0308`)

Fui pestaña por pestaña. **Dos de las cuatro cosas que nombró ya funcionan** — su queja era del
03/08 y parte se resolvió después:

| Lo que nombró | Estado real | Evidencia |
|---|---|---|
| Garantes | ✅ **anda** | `GET /contratos/:id` incluye `garantes` (`core.ts:~360`); el tab monta `ContratoGarantesPanel` (`page-client.tsx:557`) |
| Documentos | ✅ **anda** | `include: { documentos: true }`; el tab monta `ContratoDocumentosPanel` + `DocumentosInquilinoPanel` (`page-client.tsx:550-553`) |
| Servicios | ❌ **no existe en el contrato** | No hay tab ni sección. El dato SÍ existe: `GET /propiedades/:propiedadId/servicios` (`servicios-publicos.ts:77`) y el hook `use-servicios-publicos.ts` |
| Persona | ❌ **no hay acceso** | El detalle no linkea a la ficha de la persona, que existe en `/inquilinos/[id]` con `GET /personas/:id` (`core.ts:2026`) |

Y encontré un quinto, más grave, que no estaba en su lista porque **no tenía cómo saberlo**:

| Hueco | Evidencia |
|---|---|
| El tab **Historial** dice siempre *"Sin eventos registrados todavía"* aunque en la base HAYA eventos | `use-contrato.ts:300` hardcodea `eventos: []`. `EventoContrato` se **escribe** en `core.ts:1793` (renovación) y `core.ts:2846` (ajuste de alquiler) y **ningún endpoint lo devuelve**: es write-only |
| Y si se expusiera tal cual, el autor sería ilegible | Las dos escrituras guardan `autor: u.userId`, un cuid. El comentario del modelo (`schema.prisma`) dice *"'Sistema' en eventos automáticos"*, o sea que se esperaba un nombre |

## Comportamiento esperado

1. El tab **Historial** muestra los eventos reales del contrato, con **el nombre** de quien lo
   hizo, del más nuevo al más viejo. Si no hay ninguno, sigue mostrando el empty state.
2. El contrato muestra los **servicios públicos** de su propiedad (luz, gas, agua…), con su
   número de cuenta y quién los paga.
3. Desde el contrato se puede **ir a la ficha de la persona** del inquilino titular.

## Alcance

**Entra:** el endpoint de eventos + resolución del autor a nombre; cablear el tab Historial;
mostrar servicios en el detalle; link a la ficha de la persona.

**NO entra —y es deliberado:**
- El tab **Comunicaciones** (también vacío). Registrar comunicaciones de verdad es una feature,
  no "completar el expediente", y depende de la decisión de T-17 sobre qué se notifica. El copy
  mentiroso del diálogo (*"queda registrado en el historial"*) es **T-18**.
- Ampliar el enum `TipoEventoContrato` ni agregar eventos nuevos (que `CREADO`, `PAGO_RECIBIDO`,
  etc. no se escriban nunca es otro problema). Acá sólo se expone lo que ya se guarda.
- Editar servicios desde el contrato: se muestran, se editan donde ya se editan (la propiedad).

## Criterios de aceptación

- **AC-1** · `GET /contratos/:id/eventos` devuelve los `EventoContrato` de ese contrato, ordenados
  por fecha descendente, y **404 si el contrato es de otro tenant**.
- **AC-2** · Cada evento trae el **nombre** del autor, no su id. Si el autor no se puede resolver
  (evento viejo, `'Sistema'`), se devuelve el valor tal cual, nunca un cuid crudo.
- **AC-3** · Tras aplicar un ajuste de alquiler, el tab Historial del contrato muestra ese evento
  con su título, la fecha y el nombre de quien lo aplicó.
- **AC-4** · Un contrato sin eventos sigue mostrando *"Sin eventos registrados todavía"* (no un
  error ni un spinner infinito).
- **AC-5** · El detalle del contrato lista los servicios públicos de su propiedad. Si la propiedad
  no tiene ninguno cargado, lo dice explícitamente.
- **AC-6** · Desde el detalle se llega a la ficha de la persona del inquilino en un click, y sólo
  aparece el link si esa persona existe.
- **AC-7** · Ningún rol sin `contratos.ver` puede leer los eventos.

## Impacto en plata / permisos / multi-tenant

- **Plata:** ninguno. Es lectura.
- **Permisos:** el endpoint nuevo pide `contratos.ver`, igual que `GET /contratos/:id`.
- **Multi-tenant:** el endpoint filtra por `inmobiliariaId` **antes** de leer los eventos.
  Es el punto de riesgo de esta tarea: un `findMany` por `contratoId` sin validar el tenant
  expondría el historial de otra inmobiliaria.

## Qué NO se puede romper

- El tab Historial **en modo demo** (`apiEnabled === false`) sigue usando `eventosContratoMock`.
- El tab Pagos, Documentos y Garantes siguen andando igual.
- `GET /contratos/:id` no cambia de forma: los eventos van por su propio endpoint, para no
  engordar una respuesta que ya trae todas las liquidaciones.
