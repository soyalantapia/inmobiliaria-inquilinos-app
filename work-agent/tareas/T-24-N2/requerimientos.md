# T-24-N2 · Avisar "este DNI ya está en tu cartera" al cargar deuda histórica

## 1. El problema, en una frase
La operadora carga la deuda de un moroso viejo, pone el DNI, y no se entera de que esa persona
ya está en su cartera hasta que ya lo guardó — si es que se entera.

## 2. La cita
Camila `[52:00]`: su sistema, al cargar el DNI de un inquilino de hace seis años, le avisa
*"ya estás registrado"*. Quiere lo mismo acá.

## 3. Estado actual verificado (19/08, sobre 7a78c8b)
- El diálogo es `cargar-deuda-historica-dialog.tsx:66-283`. El DNI es opcional, `Input` de texto
  libre **sin `type`, sin `inputMode`, sin normalización** (`:179`).
- Debajo hay una promesa en texto de ayuda (`:180-183`): *"Con el DNI, si esta persona ya está en
  tu cartera se une a su ficha en vez de duplicarse."* **Nada la verifica.** Cero `useEffect`,
  cero fetch: tipear el DNI no consulta nada.
- El toast de éxito (`:137-140`) arma el mensaje con el nombre **local del formulario** y
  **descarta `r.personaId`**, que el server sí devuelve (`core.ts:1457-1461`).
- El backend YA hace todo: `personaId` opcional en el schema (`core.ts:1295`), validado contra el
  tenant con 404 (`core.ts:1344-1349`), y sin él `buscarOCrearPersona` **une por DNI igual**
  (`persona.ts:32-35`, `@@unique([inmobiliariaId, dni])` en `schema.prisma:1449`).
- `GET /personas?q=` ya existe, filtra por `inmobiliariaId` (`core.ts:2327`) y matchea con
  `contains` sobre el dni (`core.ts:2321`).
- **El patrón ya está escrito y probado en navegador**: commit `e1f3da0` (rama
  `origin/feat/semaforo-dni`, no mergeada) hace exactamente esto en el alta normal de contrato.
- **El mensaje de error 409 de este mismo endpoint** (`core.ts:1469`) manda al operador a
  *«buscalo en "¿Ya está en tu cartera?"»* — un control que **en esta pantalla no existe**.

## 4. Comportamiento esperado
Al tipear un DNI completo, si esa persona ya está en la cartera, el diálogo lo dice **antes** de
guardar, con nombre y apellido, y dice **qué va a pasar**: la deuda se suma a esa ficha. Al
guardar, el toast nombra la ficha a la que se sumó.

## 5. Alcance
**Entra** (un solo archivo de front, `cargar-deuda-historica-dialog.tsx`):
1. Normalizar el DNI a dígitos (`replace(/\D/g,'').slice(0,9)`) + `inputMode="numeric"`, calcado
   del alta (`contratos/nuevo/page.tsx:2369`).
2. Consulta con debounce (350 ms) a `/personas?q=` desde 7 dígitos, comparación **exacta** en el
   cliente, con `if (!apiEnabled) return;` como primera línea.
3. Aviso ámbar con nombre + apellido y botón "Usar sus datos".
4. Toast que nombra la ficha a la que se sumó.

**NO entra:**
- Endpoint nuevo de match por DNI: `GET /personas?q=` alcanza.
- Normalizar el DNI en el backend (`persona.ts:28` sólo hace `.trim()`): toca la dedup de los
  tres caminos de alta y no hay un solo test puro sobre `buscarOCrearPersona`. Tarea aparte.
- Traer el semáforo completo (deuda, mora, reclamos): es un segundo request y un tercer estado
  de carga. Camila pidió "avisame", no "mostrame el legajo".
- Convertirlo en bloqueo o 409: el merge por DNI es deliberado y sostiene el multi-alquiler.
- Tocar el alta normal (eso es `e1f3da0`) ni el importador (eso es T-24-N1).
- Extraer un componente compartido: el bloque del alta está inline y atado a 10 `useState` del
  wizard. Copiar 40 líneas cuesta menos que la abstracción.
- Tocar `apps/api`: T-24-N1 está construida encima de esta base y **saca el handler de
  `/contratos/historico` a `lib/contrato-historico.ts`**. Si toco `core.ts` ahí, conflicto seguro.

## 6. Criterios de aceptación
- AC-1: tipear un DNI que ya existe en la cartera muestra el aviso con nombre y apellido, sin
  guardar nada.
- AC-2: el aviso dice que la deuda **se va a sumar** a esa ficha — no "puede que", no "ojo".
- AC-3: un DNI parcial que es prefijo de otro (`2845678` contra `28456789`) **no** avisa.
- AC-4: "Usar sus datos" completa nombre/apellido/teléfono con los de la ficha y manda
  `personaId` en el body.
- AC-5: el DNI se guarda sólo en dígitos: tipear `20.123.456` manda `20123456`.
- AC-6: si hubo coincidencia (la haya confirmado o no), el toast nombra la ficha.
- AC-7: en modo demo (`apiEnabled === false`) no se dispara **ninguna** request.

## 7. Impacto en plata / permisos / multi-tenant
Plata: ninguno — no cambia ni un monto ni una liquidación.
Permisos: ninguno — el diálogo ya está gateado a ADMIN/OPERADOR (`core.ts:1319`) y
`GET /personas` pide `contratos.ver`, que esos dos roles ya tienen.
Multi-tenant: **verificado sano**. `Persona` tiene `inmobiliariaId` (`schema.prisma:1433`), los
uniques son compuestos (`:1449`, `:1452`) y `GET /personas` filtra por el tenant del token
(`core.ts:2327`). El aviso sólo puede confirmar DNIs de la propia cartera.
Datos personales: el banner muestra **nombre y apellido y nada más**. Meter teléfono o deuda ahí
sería ampliar superficie sin que nadie lo haya pedido.

## 8. Qué NO se puede romper
- Modo demo: el diálogo se **monta sin gate de `apiEnabled`** (`propiedades/[id]/page-client.tsx:236-241`),
  así que su cuerpo corre igual en el build demo. Sin el guard le pegaría a una URL relativa.
- El merge por DNI del backend sigue siendo el que manda: el front avisa, no decide.
- El formulario sigue guardando sin DNI (es opcional) y sin coincidencia.
- Cero cambios en `apps/api`.
