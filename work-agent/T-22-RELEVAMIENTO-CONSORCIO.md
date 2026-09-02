# T-22 · Consorcio: relevamiento de qué se puede hacer hoy

El ticket pedía **relevar antes de construir**. Esto es el relevamiento.

## El titular

**La parte de consorcio está construida a la mitad, y la mitad que falta no es una pantalla: es
una foreign key.**

El sistema tiene dos universos paralelos que no se tocan:

| El consorcio | Los alquileres |
|---|---|
| `Consorcio` → `UnidadFuncional` | `Propiedad` → `Contrato` → `Liquidacion` → `Pago` |
| identificación (`1°A`), **`titular` (un string con un nombre)**, coeficiente, teléfono | el inquilino real, con su login, su deuda y sus pagos |
| `saldoDeudor` y `estado` (AL_DIA / …), **cargados a mano** | la deuda real, calculada |
| `expensasPeriodoActual` del edificio | `Contrato.montoExpensas` de cada contrato |
| `MovimientoConsorcio` (el libro), **escrito a mano** | `MovimientoCaja`, escrito por el sistema |

**`UnidadFuncional` no tiene ninguna referencia a `Propiedad`.** `Propiedad.consorcioId` existe —una
propiedad sabe de qué edificio es— pero **nada dice qué unidad es**. Y sin eso, ningún dato puede
cruzar: no se puede saber a qué contrato aplicarle la expensa de la unidad, ni a qué inquilino
avisarle, ni qué deuda real tiene el 1°A.

Todo lo demás de T-22 depende de esa FK.

---

## Lo que SÍ funciona hoy

- **CRUD completo de consorcios y unidades**, con validación del coeficiente (la suma no puede
  pasar de 100, y al editar el propio no cuenta contra el disponible).
- **Expensa por unidad, calculada**: `cargoFijo` si la unidad pactó monto fijo, o
  `expensasPeriodoActual × coeficiente / 100`. Las dos modalidades están soportadas. **Pero es
  sólo display**: el número se muestra y no se escribe en ningún lado.
- **Libro del consorcio** (`MovimientoConsorcio`), con signo acoplado a la categoría (COBRANZA es
  ingreso, el resto egreso) para que nadie infle ingresos con un "sueldo" positivo.
- **Asambleas, inventario, servicios comunes**: CRUD.
- **Régimen mixto**: verificado en T-20. Una unidad alquilada y otra de sólo expensas conviven sin
  configuración especial.
- **El pago llega unificado**: verificado en T-19. El inquilino paga alquiler + expensas en una
  sola operación.

## Los cuatro agujeros, que son el mismo visto de cuatro lados

1. **La expensa del mes no llega a las cuotas.** `expensasPeriodoActual` se carga en el consorcio y
   no lo lee nadie: el devengo usa `Contrato.montoExpensas`. Cada mes hay que entrar contrato por
   contrato. Una unidad olvidada sale con la expensa vieja: **se le cobra de menos al inquilino y
   la inmobiliaria le paga igual al consorcio.** *(T-19)*
2. **La cobranza no entra al libro del consorcio.** El inquilino paga, la inmobiliaria cobra, y esa
   plata no aparece como `COBRANZA` salvo que alguien la cargue a mano por segunda vez. *(T-20)*
3. **Hay dos verdades sobre la misma deuda.** `UnidadFuncional.saldoDeudor` y `estado` se tipean a
   mano y no miran ninguna liquidación. **El 1°A puede decir AL_DIA en la pantalla del consorcio
   mientras su inquilino debe tres meses en la de contratos.** Y la que se ve al abrir el edificio
   es la de a mano.
4. **No se le puede avisar a nadie.** `enviarAnuncioEmail` existe y sirve —es lo que el ticket
   proponía reusar— pero necesita el email del destinatario. La unidad sólo guarda `titular` (un
   nombre suelto) y un teléfono. El email del inquilino está del otro lado de la FK que no existe.

---

## Lo que hay que decidir antes de construir (para Alan)

Ninguna de estas es técnica. Sin respuesta, cualquier implementación adivina.

1. **¿La unidad funcional y la propiedad son la misma cosa?** Si sí, la FK es directa y `titular`
   pasa a derivarse del contrato. Si no —hay unidades del edificio que la inmobiliaria administra
   como consorcio pero **no alquila**—, la FK es opcional y hay que decidir qué se muestra para las
   que no tienen contrato. *(Mi lectura: opcional. Un administrador de consorcio ve el edificio
   entero, alquile o no cada unidad.)*
2. **¿Quién manda con la deuda de una unidad alquilada: el consorcio o el contrato?** No pueden
   convivir dos. O `saldoDeudor` se vuelve de sólo lectura y se calcula, o se acepta que es un dato
   aparte y hay que decir en pantalla que no es la deuda del alquiler.
3. **"Aplicar la expensa del período": ¿qué hace exactamente?** ¿Escribe `Contrato.montoExpensas`
   de cada unidad con contrato activo? ¿Qué pasa con las que tienen un pago en vuelo — se respeta
   la regla que ya usa `PATCH /contratos/:id/expensas` (dejar esas cuotas con el monto viejo)?
   ¿Y con las unidades sin contrato?
4. **El aviso por mail: ¿a quién y cuándo?** ¿Al inquilino de cada unidad al aplicar la expensa, o
   es un anuncio manual del administrador? ¿Incluye el monto de esa unidad?
5. **Los coeficientes que no suman 100.** Hoy el sistema no deja pasar de 100, pero sí deja quedar
   en 90 — y ahí la expensa repartida no cubre el total del edificio. ¿Se avisa? ¿Se bloquea el
   "aplicar"?

**Orden sugerido, si se decide avanzar:** primero la FK (1) — sin eso nada más se puede construir;
después "aplicar la expensa" (3), que es lo que convierte la pantalla en útil; después el aviso
(4); y (2) puede esperar, pero mientras tanto conviene aclarar en la pantalla que ese saldo es
manual, porque hoy parece calculado.
