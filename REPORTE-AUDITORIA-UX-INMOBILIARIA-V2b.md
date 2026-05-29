# 🕵️ Auditoría UX — Panel inmobiliaria · V2b (secciones faltantes)

> **Persona:** Roberto Tapia (mismo de V2). Esta pasada cubre las secciones que el preview no me dejó abrir en la V2: Consorcios, Anuncios, Roadmap y los tabs de Configuración (Auditoría, Plan, Convenios, Mercado).

> **Configuración:** My Alquiler — panel inmobiliaria · http://localhost:3001 · navegación real con Claude Preview · español rioplatense.
> **Método:** navegación real en Consorcios / Anuncios / Roadmap / Configuración→Auditoría; los tabs Plan/Convenios/Mercado se revisaron por código (el preview tiene mucha fricción con el componente de tabs).

---

## 1. Resumen ejecutivo

Las 4 secciones recorridas están **muy bien diseñadas** — Consorcios con KPIs y deuda por UF, Anuncios con jerarquía Importante/Normal multicanal, Roadmap transparente con votos de pilotos, y la **Auditoría (historial inmutable) es la joya**: 155 eventos con autor + rol + acción + timestamp + 4 filtros. Confirma que la feature estrella de la landing existe y está bien ejecutada.

Pero al cruzar datos entre secciones aparecieron **5 inconsistencias** — la mayoría de mock data, y **2 que tocan la feature estrella (permisos + auditoría)**:

### Las 5 fricciones (ordenadas por impacto)

1. **`[V2b-05]` El historial muestra acciones que el rol no puede hacer.** Camila Acosta (rol "Carga") aparece en Auditoría "Pago manual cargado · $303.000". Pero el sistema de permisos (`permisos.ts`) define que `pago.manual.cargar` es solo ADMIN/OPERADOR — el rol Carga "no ve pagos". El generador de eventos del historial asigna autor al azar sin respetar permisos. **Esto contradice la promesa central de "permisos granulares + trazabilidad" justo en la pantalla que la demuestra.**
2. **`[V2b-04]` El mismo rol tiene dos nombres dentro de la app.** En Equipo y permisos el rol es "Carga limitada"; en el badge de Auditoría es "Carga". Misma incoherencia con "Solo lectura" vs "Lectura". Son dos fuentes de verdad (`configuracion/page.tsx` vs `permisos.ts`).
3. **`[V2b-02]` Autor fantasma: "Eugenia Rinaldi".** Figura como autora de un anuncio (CBU nuevo) y de eventos de auditoría, pero NO está en el equipo (Roberto, Luciana, Sergio, Martín, Camila). Un usuario que no existe firmando acciones.
4. **`[V2b-01]` El Consorcio Cabildo no cuadra consigo mismo.** Badge "24 UF", pero "UF al día 3/4" y "1 UF con deuda" — porque el array tiene 4 unidades reales, no 24. El KPI "36 total unidades" suma el 24 fantasma.
5. **`[V2b-03]` "Todo incluido" (landing) vs "Cobros aparte" (Roadmap).** La landing promete "Toda la plataforma sin restricciones / sin cargos extra", pero el Roadmap muestra "4 Cobros aparte · Servicios extra que se facturan suelto" + badge "+servicio extra". Contradicción comercial que un comprador detecta.

**Sensación general:** las secciones están **sólidas de diseño**; los problemas son de **coherencia de datos** entre superficies. Lo más serio es que 2 de ellos (V2b-04, V2b-05) erosionan justo la feature que más vende el producto (permisos + auditoría legal). Son fixes de bajo/medio esfuerzo con alto retorno de credibilidad.

---

## 2. Diario del usuario

**Consorcios.** Edificios bajo PH, expensas, deuda por UF. Gorriti 4521 (12 UF · 8/12 al día) y Cabildo 2890 (24 UF · 3/4 al día). Pará — el Cabildo dice "24 UF" pero "al día 3/4" y "1 con deuda". Si tiene 24, ¿por qué el ratio es sobre 4? *(`V2b-01`)*

**Anuncios.** Tres comunicaciones con buena jerarquía (Importante en amber, Normal en blanco), multicanal (APP/WhatsApp/Email). El del CBU nuevo lo firma "Eugenia Rinaldi"… ¿quién es Eugenia? No está en mi equipo. *(`V2b-02`)*

**Roadmap.** Excelente — 13 items, votos de pilotos ("22 pilotos lo pidieron"), quarters. Pero veo "4 Cobros aparte · Servicios extra que se facturan suelto" y un badge "+servicio extra". En la landing me vendieron "todo incluido sin restricciones"… ¿entonces hay cosas que se pagan aparte? *(`V2b-03`)*

**Auditoría.** Esta pantalla es la que me hace confiar: 155 acciones, cada una con quién/qué/cuándo, filtros por módulo/usuario/rango. **Pero** veo "Camila Acosta · Carga · Pago manual cargado · $303.000". Esperá: Camila es "Carga", y en Equipo dice que Carga "no ve pagos". ¿Cómo cargó un pago? Y su badge acá dice "Carga" pero en Equipo decía "Carga limitada". *(`V2b-04`, `V2b-05`)*

**Veredicto:** "El panel es potente y la auditoría me encanta. Pero si el historial me muestra a alguien haciendo algo que su rol no permite, ¿puedo confiar en la trazabilidad? Eso es justo lo que me vendieron. Y un autor que no está en mi equipo firmando un anuncio del CBU… me pone nervioso."

---

## 3. Tabla priorizada

| ID | Problema | Severidad | Esfuerzo | Quick win? |
|---|---|---|---|---|
| V2b-05 | Historial muestra acción que el rol no permite (Camila/Carga + pago) | Alta | Medio | ✅ |
| V2b-04 | Rol con dos nombres: "Carga"/"Lectura" vs "Carga limitada"/"Solo lectura" | Media | Bajo | ✅ |
| V2b-02 | Autor fantasma "Eugenia Rinaldi" (anuncios + auditoría) | Media | Bajo | ✅ |
| V2b-01 | Consorcio Cabildo: cantUf 24 ≠ 4 unidades reales | Media | Bajo | ✅ |
| V2b-03 | "Todo incluido" (landing) vs "Cobros aparte" (Roadmap) | Media | Bajo | ✅ |

---

## 4. Hallazgos detallados

### [V2b-05] [Permisos/Trazabilidad] — El historial muestra acciones que el rol no puede hacer
📍 `apps/inmobiliaria/src/lib/auditoria-storage.ts` (generador `generarSeedSinteticos`, línea ~240: `const usuario = pick(usuarios)`)
👀 Camila Acosta (rol CARGA) figura "Pago manual cargado". El permiso `pago.manual.cargar` en `permisos.ts:106` es `roles: ['ADMIN','OPERADOR']` — CARGA no lo tiene. El generador elige autor al azar sin verificar permiso.
😖 Es la pantalla que demuestra "trazabilidad legal + permisos granulares" (feature estrella). Si muestra a un rol haciendo algo que no puede, el comprador desconfía de toda la promesa.
🔥 Alta · 🔧 Medio
✅ Que el generador elija el autor entre los roles habilitados para cada tipo de evento (mapa tipo→roles). Camila (CARGA) solo debería aparecer en CONTRATO_CARGADO / PROPIEDAD_CARGADA.

### [V2b-04] [Consistencia] — El mismo rol tiene dos nombres
📍 `permisos.ts:28-29` (`CARGA: 'Carga'`, `LECTURA: 'Lectura'`) vs `configuracion/page.tsx:132-137` (`'Carga limitada'`, `'Solo lectura'`)
👀 El badge de Auditoría usa `ROL_LABEL` ("Carga"/"Lectura"); Equipo usa su propio mapeo ("Carga limitada"/"Solo lectura").
😖 El usuario ve el mismo rol con dos nombres en dos pantallas. (El fix I2-04 de la V2 alineó la landing, pero quedó esta segunda fuente de verdad dentro de la app.)
🔥 Media · 🔧 Bajo
✅ Unificar `ROL_LABEL` en `permisos.ts` a "Carga limitada" / "Solo lectura" (los descriptivos que ya usa Equipo).

### [V2b-02] [Datos] — Autor fantasma "Eugenia Rinaldi"
📍 `auditoria-storage.ts:164` + `anuncios-storage.ts:129`
👀 Eugenia Rinaldi firma un anuncio (CBU nuevo) y genera eventos de auditoría, pero no está en el equipo (`configuracion/page.tsx`).
😖 Un autor que no existe en el equipo firmando acciones sensibles rompe la coherencia de la trazabilidad.
🔥 Media · 🔧 Bajo
✅ Reemplazar "Eugenia Rinaldi" por un miembro real del equipo (ej. Luciana Vidal, Operadora) en ambos archivos.

### [V2b-01] [Datos] — Consorcio Cabildo: 24 UF declaradas, 4 reales
📍 `consorcios-storage.ts:299` (`cantUf: 24`) — el array `unidades` tiene 4 entradas.
👀 Badge "24 UF" pero ratio "3/4" y "1 UF con deuda" (calculados sobre el array de 4). El KPI "36 total unidades" suma el 24 fantasma.
😖 Los números del consorcio no cuadran entre sí — en una pantalla de plata, eso enciende alarmas.
🔥 Media · 🔧 Bajo
✅ Alinear `cantUf` a la cantidad real de unidades del array (4). KPI total pasa a 16 (12+4), coherente.

### [V2b-03] [Coherencia comercial] — "Todo incluido" vs "Cobros aparte"
📍 `landing-data.json` (precios.incluye "Toda la plataforma sin restricciones" / extras "Sin cargos por usuarios extra") vs Roadmap ("Cobros aparte · servicios extra que se facturan suelto")
👀 La landing promete todo incluido; el Roadmap admite add-ons pagos.
😖 El comprador que leyó "sin restricciones" y ve "servicios extra" siente letra chica.
🔥 Media · 🔧 Bajo
✅ Alinear el copy: en la landing, aclarar que el plan incluye toda la operación core y que ciertas funciones avanzadas con IA son add-ons opcionales. (O quitar el absoluto "sin restricciones".)

---

## 5. Recomendaciones
**Quick wins (todos esta tanda):** los 5 son de esfuerzo Bajo/Medio y se aplican juntos. El de mayor valor es V2b-05 (respetar permisos en el historial) porque blinda la feature estrella.

**No auditado a fondo:** tabs Configuración → Plan y facturas, Convenios, Mercado (revisados por código, sin hallazgos evidentes; quedan para una pasada dedicada si se quiere).
