# T-01-N1-N11 · Al inquilino cuyo pago confirmó el banco se le decía que se lo rechazaron

**Prioridad:** 🔴 · **Experto:** BE
**Origen:** rescatado de `origin/fix/followups-noche-2026-07-14`, una rama varada hace 37 días
(T-01-N1-N10). El arreglo se había reimplementado en `main` **sin** este detalle.

---

## El bug

`Pago` tiene un solo estado `RECHAZADO` para dos cosas que no se parecen en nada:

- **El inquilino mandó un comprobante y no servía.** Es suyo y cuenta como suyo.
- **La inmobiliaria dio de baja un cobro que ella misma registró.** No es culpa del inquilino.

Lo único que los distingue es un **prefijo en la `observacion`**: `Anulado tras conciliar:`.
Estaba escrito a mano en **tres** archivos (`plata.ts` ×2, `inquilino-mundo.ts` ×1).

Cuando la conciliación por extracto bancario empezó a cerrar avisos de pago
(`resumenes-bancarios.ts`), su autor no tenía cómo enterarse de que la convención existía y
escribió la observación a mano.

**Lo que le pasaba a esa persona.** Avisó que pagó. El **banco confirmó** la plata. Y el sistema:

| | qué veía |
|---|---|
| PWA, detalle del pago | **"Tu pago fue rechazado"** + botón "Volver a subir comprobante" |
| Feed | *"Tu comprobante fue rechazado"*, severidad **crítica** |
| Observación | se le filtraba la nota **interna** (*"Cerrado automáticamente…"*), que con el prefijo no se muestra |
| Certificado de inquilino | **le bajaba el nivel de buen pagador** |

Lo último es lo más caro y lo más irónico: el comentario de `PAGO_RECHAZADO_REAL`
(`inquilino-mundo.ts:43-49`) existe justamente para que eso no pase — dice que contar una
reversión interna como rechazo *"le bajaba **injustamente** el nivel de buen pagador… por algo
que no es su culpa"*. El caso del extracto bancario es exactamente ése, y se colaba igual.

## Lo que se hizo

1. **El cierre automático usa el prefijo.** Con eso el resto del sistema ya lo trata bien: no
   cuenta para el certificado, el feed dice "la inmobiliaria revirtió un cobro" y la nota
   interna no se le muestra.
2. **El prefijo deja de estar suelto.** Vive en `lib/reversion-interna.ts`, con
   `observacionDeReversion()` para escribirlo y `esReversionInterna()` para leerlo. Los tres
   lugares que lo repetían a mano pasan por ahí. La causa del bug no fue escribirlo mal: fue
   que un archivo nuevo no sabía que existía.
3. **Un guard para la clase entera:** ningún handler de `routes/` puede asignar `observacion:`
   con un literal. El motivo de un rechazo real sale de lo que tipeó el operador; una reversión
   interna tiene que pasar por el helper. Hoy hay **cero** literales, así que la regla no tolera
   falsos positivos.

## Lo que NO se hizo

- **No se inventó un tercer estado.** Lo correcto de verdad sería distinguir "superado porque la
  plata entró por otra vía" de "reversión operativa" — al inquilino se le dice "la inmobiliaria
  revirtió este cobro", que es raro cuando lo que pasó es que su pago se confirmó. Pero agregar
  un estado es un cambio de producto y de copy. **Queda anotado, no hecho:** lo que se arregla
  acá es que no se lo penalice.

## Cómo se verificó

- 5 tests puros; suite completa: `tsc` 0 y **602 verdes**.
- **El guard se comprobó reintroduciendo el bug original**: señala
  `resumenes-bancarios.ts:468` con el mensaje que explica la consecuencia.
- Un primer intento de guard **no servía y se descartó**: buscaba `estado: 'RECHAZADO'` y un
  `observacion:` en las 6 líneas siguientes, y el propio comentario del arreglo empujaba la
  línea fuera de la ventana — pasaba en verde con el bug puesto. Se detectó porque la
  verificación se hizo de verdad, reintroduciendo el bug, en vez de darla por buena.
