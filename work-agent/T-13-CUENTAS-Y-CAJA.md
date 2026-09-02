# T-13 · Cuentas de caja: relevamiento del flujo real

**El problema que reportó Camila ya está resuelto en `main`.** Fue a Caja buscando las cuentas y no
estaban, porque `/cuentas` y `/caja` eran dos pantallas hermanas sin un solo link entre ellas. Hoy:

- **"Cuentas" es una pestaña adentro de `/caja`.** Verificado en el navegador contra el panel
  local: la pantalla abre con las pestañas `Movimientos | Cuentas`.
- **El ítem del menú es uno solo: "Caja y cuentas".** El ítem hermano duplicado se sacó — dejarlo
  habría mantenido la misma confusión con un click extra.
- **`/caja?tab=cuentas` es linkeable**, así que se puede mandar por chat o dejar como favorito.
- **`/cuentas` sigue existiendo como ruta**, para no romper un link viejo.
- Y la pestaña explica la relación con palabras, que era lo que faltaba: *"Tus cuentas de caja: de
  dónde sale y a dónde entra la plata (Mercado Pago, efectivo, banco…). Al cargar un movimiento en
  Caja, elegís la cuenta."*

---

## Los tres flujos que el ticket pedía relevar

| Flujo | Estado |
|---|---|
| **Cargar un gasto eligiendo cuenta** | ✅ El formulario tiene el selector, y **filtra por dirección**: sólo ofrece cuentas activas compatibles con el tipo de movimiento (ENTRADA / SALIDA / AMBAS). |
| **Ver el saldo por cuenta** | ✅ Cada cuenta muestra su saldo **por moneda**, con el negativo resaltado, y se puede abrir el detalle de sus movimientos. |
| **Mover plata entre cuentas** | ❌ **No existe.** Ver abajo. |

---

## 🟡 T-13-a · Mover plata entre cuentas no existe, y el atajo ensucia los números

Es el caso de Camila: *"Gaspar retira Mercado Pago, la otra bebé retiro"*. Hoy, para reflejar que
la plata pasó de Mercado Pago a efectivo, hay que cargar **dos movimientos**: un `GASTO` en la
cuenta de origen y un `INGRESO_EXTRA` en la de destino. Los únicos dos tipos que existen son ésos
—`TipoMovimientoCaja` no tiene un traspaso—.

Qué pasa con eso:

- **Los saldos por cuenta quedan bien** (−X en una, +X en la otra). En eso el atajo funciona.
- **Pero los totales de la inmobiliaria quedan inflados**: aparece un gasto de $X que nadie gastó y
  un ingreso extra de $X que nadie ingresó. Cualquier lectura de "gastos del mes" o "ingresos
  extra" cuenta plata que sólo cambió de bolsillo.
- **🔴 Y si alguien elige una propiedad, la plata sale del sistema hacia un tercero.** El campo
  Propiedad es opcional y arranca en *"Sin propiedad — gasto de la inmobiliaria"*, así que por
  defecto es inofensivo. Pero un `INGRESO_EXTRA` **con** propiedad **se le acredita al dueño en la
  rendición** —el propio código lo dice: *"hoy la rendición levanta explícitamente `tipo:
  'INGRESO_EXTRA'` con `descontadoEnRendicion: false` y se lo ACREDITA al dueño"*— y un `GASTO`
  con propiedad **se le descuenta**. Un traspaso mal cargado le regala plata a un propietario y se
  la cobra a otro.

**Propuesta:** una acción "Mover plata entre cuentas" que pida origen, destino, monto y fecha, y
escriba el par de movimientos con un tipo propio (`TRASPASO`) que los totales y la rendición
ignoren. Alcance: el enum, el par de movimientos atados entre sí, y excluirlo de los tres lugares
que hoy suman por tipo. **No se hizo acá** porque toca el modelo de plata y el objetivo de T-13
—"que Camila encuentre las cuentas donde las busca"— ya está cumplido; mezclarlo habría convertido
una verificación en una refactorización del libro de caja.
