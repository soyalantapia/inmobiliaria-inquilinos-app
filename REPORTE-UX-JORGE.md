# 😤 REPORTE UX — Jorge Medina (inquilino, 45, tech a medias, criticón)

> Walkthrough en la piel de Jorge: un encargado de depósito que pagó el
> alquiler por transferencia + WhatsApp toda la vida y ahora la inmobiliaria
> lo obliga a usar una app. Viene cansado, un 8 del mes (atrasado), enojado y
> desconfiado. Recorrido real hecho en mobile 375px.

---

## 1. El diario de Jorge (en primera persona)

**Abro el link que me mandaron.** "Entrá a tu cuenta", me pide el mail. Bueno,
hasta ahí bien, no es difícil. Pero dice "te mandamos un código de 6 dígitos a
tu mail". *¿Otro código? Yo quería pagar, no andar buscando códigos en el mail
que casi no miro.* Pongo el mail, le doy.

**El código.** Aparece abajo en amarillo: 523829. Menos mal que lo veo acá,
porque dice "en producción llega por mail" — *o sea que el mes que viene voy a
tener que salir al mail, buscarlo, volver, y acordarme de 6 números. Un
quilombo para mí.* Toco los cuadraditos, se completa solo y entro. Ok, eso
estuvo rápido, no me trabé.

**Y me salta un tutorial. PASO 1 DE 9.** *¿NUEVE pasos? No, no, yo vine a pagar,
no a hacer un curso.* Busco cómo salir... "Saltar tour", ahí. Lo cierro de una.
*Me molesta que me metan eso en la cara apenas entro, sabiendo que estoy
apurado.*

**Llego a la pantalla principal y casi me agarra un infarto.** Un cartel rojo
grande: **"Tenés un pago atrasado · $596.882. Venció hace 29 días."** *¿596 MIL?
¡Mi alquiler es 480! ¿De dónde sacan 596? ¿Me están cobrando de más? ¿Y "venció
hace 29 días"? ¿No pagué el mes pasado?* Me sube la presión. Miro por todos
lados a ver si dice POR QUÉ es 596 y no 480, y **no dice nada**. Solo el número
grande, el rojo de alarma, y un botón "Regularizar" (regularizar, como si yo
fuera un moroso). *Estoy a dos segundos de llamar a la inmobiliaria a los gritos.*

**Toco "Pagar" para ver si entiendo algo.** Y ACÁ recién, en la pantalla de
pagar, me lo explica: **"Incluye $24.882 de punitorios por mora · tasa 0.15%
diario."** *¡AH! Por eso era 596. Son los intereses por los 29 días de atraso.*
Me sigue doliendo, pero al menos ahora entiendo. *Pero, ¿por qué no me lo
dijeron en la pantalla anterior? Me hicieron asustar al pedo.*

**El pago en sí — esto sí me gustó.** Dice "Pagar por transferencia", que es lo
que sé hacer. Me da todos los datos: titular, CUIT, banco, CBU, alias, y el
**monto exacto**, cada uno con un botón "Copiar". Y abajo me explica paso a
paso: "1. Entrá al banco, 2. Cargá el alias o CBU y transferí, 3. Volvé y subí
el comprobante." *Esto es como hacía antes, pero más ordenado. No me pierdo.*
Hasta hay un "Negociar por WhatsApp" por si no llego a pagar todo. *Eso me da
tranquilidad.*

**Subo el comprobante.** Área grande "Tocá o arrastrá un archivo", acepta foto
o PDF. El "N° de operación" dice opcional y me da un ejemplo. *No me obliga a
nada raro.* Saco la foto del comprobante del banco como hago siempre. Le doy
"Enviar comprobante".

**La confirmación — bien.** Tilde verde: "Comprobante recibido. Validamos en
24-48 hs hábiles y te avisamos por WhatsApp." Y me muestra lo que mandé: el
monto, el archivo, el N° de operación. *Ok, ahora sí me quedo tranquilo de que
llegó. Y me avisan por WhatsApp, que es lo que uso.*

**PERO entonces veo algo que me descompone de nuevo.** Abajo, en "DATOS LEÍDOS
POR IA", dice un nombre que NO es el mío: **"Florencia Russo"**. *¿QUIÉN ES
FLORENCIA RUSSO? ¿Le mandé la plata a otra persona? ¿Me mezclaron con otro
inquilino? ¡No, no, esto está mal!* Justo cuando me había quedado tranquilo de
que pagué, me muestran el nombre de un desconocido en MI comprobante. *Ahora sí
agarro el teléfono y llamo a la inmobiliaria, porque no me voy a quedar con la
duda de si mi plata se fue a la cuenta de una tal Florencia.*

---

## 2. Las 5 cosas que harían que Jorge ABANDONE (o llame furioso)

1. **El nombre de un desconocido en su comprobante.** "DATOS LEÍDOS POR IA:
   Florencia Russo" en SU recibo. Lo lee como "pagué a la persona equivocada".
   Destruye la confianza justo después de ganársela. → **el peor momento de
   todo el recorrido.** [BUG real, ya arreglado, ver §5]
2. **El home muestra $596.882 sin explicar por qué.** Espera $480.000, ve
   $596.882 en rojo "venció hace 29 días" y CERO desglose. Pánico inmediato.
   La explicación de los punitorios existe, pero recién un toque después (en el
   checkout). Para cuando la encuentra, ya entró en pánico.
3. **El tutorial de 9 pasos como muro de entrada.** Viene apurado a pagar y lo
   frenan con "PASO 1 DE 9". Lo saltea con bronca.
4. **El OTP por mail cada vez.** Jorge casi no mira el mail. Tener que salir a
   buscar un código de 6 dígitos cada mes para pagar es fricción que su
   "transferencia de siempre" no tenía.
5. **La palabra "Regularizar" en rojo.** Lo trata de moroso. Un inquilino que
   se atrasó unos días por olvido se siente acusado, no ayudado.

---

## 3. Tabla de fricciones

| # | Pantalla | Fricción | Gravedad para Jorge | Qué necesitaría |
|---|---|---|---|---|
| J1 | Confirmación pago | "Florencia Russo" (nombre ajeno) en su comprobante | **Abandono / llama furioso** | Que diga SU nombre, o nada |
| J2 | Home | $596.882 sin desglose ni explicación del +116k | **Me estresa (casi abandono)** | "Alquiler $480.000 + $24.882 intereses por atraso" ahí mismo |
| J3 | Entrada | Tutorial 9 pasos obligatorio al entrar apurado | Me molesta | Que sea opcional/discreto, no un muro |
| J4 | Login | Código OTP al mail cada vez | Me molesta (cada mes) | Recordarme la sesión, o login más simple |
| J5 | Home | "Regularizar" en rojo = me trata de moroso | Me molesta | Tono más humano: "Ponerte al día" |
| J6 | Checkout | (positivo) datos + copiar + pasos numerados | ✅ me tranquilizó | — mantener |
| J7 | Confirmación | (positivo) "recibido, te avisamos por WhatsApp" | ✅ me tranquilizó | — mantener |

---

## 4. El veredicto de Jorge (una frase)

> *"Si no fuera porque vi el nombre de otra persona en mi comprobante, casi me
> convencen — pagar fue más claro de lo que esperaba. Pero ESO me hizo
> desconfiar de todo. Hasta que no me expliquen por qué aparecía Florencia, yo
> sigo mandando la transferencia por WhatsApp como toda la vida."*

(Tras el fix de §5, el veredicto cambia a: "Ok, esta vez vi mi nombre, me llegó
la confirmación y me avisan por WhatsApp. Le doy una oportunidad el mes que
viene — pero arreglen lo del número que me asusta apenas entro.")

---

## 5. Recomendaciones priorizadas (en lenguaje de Jorge, no técnico)

### 🔴 Crítico — ya ARREGLADO en este pase
- **J1 — El comprobante mostraba el nombre de un desconocido.** La "lectura por
  IA" elegía un nombre al azar de una lista en vez del inquilino que paga.
  **Fix aplicado** (commit `d220dca`): ahora muestra al inquilino logueado.
  Verificado en vivo: aparece "Mariela Sosa", ya no "Florencia Russo". Sin esto,
  cada inquilino veía un nombre random en su recibo → pánico garantizado.

### 🟠 Alto — recomendado (requiere tu decisión de producto)
- **J2 — Mostrar el desglose del monto en el HOME, no solo en el checkout.**
  El número grande del home ($596.882) debería venir acompañado de algo como
  "Alquiler $480.000 + $24.882 de intereses por 29 días de atraso". Jorge no
  debería tener que tocar "Pagar" para entender por qué debe de más. Es donde
  más cerca estuvo de abandonar.

### 🟡 Medio — pulido de confianza
- **J3 — El tour de 9 pasos no debería ser un muro al entrar.** Ofrecerlo como
  un botón discreto ("¿Primera vez? Te muestro cómo"), no interponerlo entre
  Jorge y su pago. (Ya hay onboarding persistente — basta con que el primer
  paso no tape el home.)
- **J5 — Suavizar "Regularizar".** "Ponerte al día" o "Pagar lo atrasado" suena
  a ayuda, no a acusación. El rojo + "regularizar" hace sentir delincuente a
  alguien que se olvidó tres días.

### 🟢 Bajo — si se puede
- **J4 — Reducir fricción del login mensual.** La sesión ya dura; confirmar que
  Jorge no tenga que pedir código OTP cada vez que entra a pagar. Si la sesión
  expira rápido, alargarla — Jorge paga una vez por mes, no quiere el código
  cada vez.

---

## Lo que la app hace BIEN para Jorge (no todo es crítica)
- El flujo de pago en sí (datos copiables, monto exacto, pasos numerados,
  "Negociar por WhatsApp") **le habla en su idioma**. Es lo mejor de la app.
- La confirmación final ("recibido, te avisamos por WhatsApp") **responde a su
  miedo #1** (¿pagué bien?). Excelente.
- El N° de operación opcional con ejemplo y el "podés enviar sin foto" **no lo
  castigan** por no tener todo perfecto.

**Conclusión:** la app tiene un flujo de pago sorprendentemente bueno para
alguien como Jorge — pero dos golpes de desconfianza (el monto sin explicar en
el home, y el nombre ajeno en el comprobante) casi tiran todo abajo. Uno ya está
arreglado; el otro (desglose en el home) es la recomendación de mayor impacto
para que Jorge realmente adopte la app en vez de volver al WhatsApp.
