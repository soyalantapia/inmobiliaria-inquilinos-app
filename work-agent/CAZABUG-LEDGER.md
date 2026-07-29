# CAZABUG — Ledger

> Barrido completo del backend de My Alquiler: primero **PLATA**, después la superficie
> restante (multi-tenant, permisos, endpoints públicos, archivos, mundo del inquilino).
> **20 causas raíz cerradas y mergeadas a main.** Nada deployado (el deploy es manual
> con `railway up`).

## Las 20 causas

### Plata mal calculada
| # | Causa raíz |
|---|---|
| F | El devengo no tenía canon POR PERÍODO: renovar por adelantado —el flujo normal— cobraba los meses intermedios al canon nuevo |
| L | La salud de pago mostraba la deuda SIN mora: leía `montoPunitorio`, una columna muerta que siempre vale 0 |
| P3 | Montos de pago sin redondear: un sub-centavo se guardaba como pago de $0 y `100.006` quedaba por encima del saldo |
| G2 | La importación de cartera tenía su propio parser de montos: una planilla en locale US entraba 1000x más chica |
| Q | Las ganancias de propiedad sumaban ARS + USD en un total y lo rotulaban con una sola moneda |

### Plata cobrada dos veces (o perdida)
| # | Causa raíz |
|---|---|
| E | `/listo` imputaba el costo del reclamo sin el guard anti-doble-cobro que sí tenía `/resolver` |
| J | Extractos con rangos solapados duplicaban créditos · un crédito en pesos cancelaba deuda en USD a 1:1 |
| I·S | El dedup de importación miraba sólo el email (opcional) → re-subir duplicaba la cartera entera |
| D | Al finalizar, la cuota futura con un pago RECHAZADO sobrevivía como deuda fantasma cobrable |
| R | Por link mágico se re-cerraba un reclamo reabierto: otro trabajo al profesional y el costo imputado de nuevo |

### Permisos, seguridad y datos
| # | Causa raíz |
|---|---|
| N | Login OTP y password sin tope de intentos: fuerza bruta de 6 dígitos contra el panel |
| O | El chequeo de "archivo huérfano" miraba 3 de 16 columnas de URL → borraba del Volume archivos ajenos vivos |
| K | Un rol CARGA podía dejar el alquiler en $1, cambiar el CBU de cobro o borrarle la mora a un moroso |
| M | El inquilino se auto-condonaba los punitorios backdateando la fecha de transferencia |
| P | El token del link mágico no vencía ni se consumía: sesiones de 14 días para siempre, con PII del inquilino |
| Q | Los 8 endpoints del expediente no pedían capacidad: un CARGA leía deuda, caja y comisiones |
| T | `/uploads` no revalidaba contra la DB: un co-inquilino revocado y un profesional con la visita cerrada seguían subiendo |
| T | `reenviar-bienvenida` pedía `contratos.crear`: un CARGA disparaba mails al inquilino |
| H2 | `MAX_FILAS` truncaba el archivo en silencio: el admin creía haber migrado la cartera completa |

### Documento legal y verificabilidad del deploy
| # | Causa raíz |
|---|---|
| V | **El contrato de locación imprimía datos FABRICADOS** en el Word/PDF que se FIRMA: depósito = alquiler vigente (tras ajustes, muy superior al entregado), día de pago 5 fijo, comisión 4,17% nunca pactada, ciudad CABA fija, y el canon de un contrato en USD con símbolo de pesos |
| U | `/health` no exponía versión y el repo no usa tags: no había forma de saber QUÉ está corriendo en prod ni de verificar que un deploy entró |

## Trampas que cambiaron el fix (el "obvio" habría roto algo)

- **D** — la FK `Pago→Liquidacion` es `ON DELETE RESTRICT`: cambiar sólo el filtro daba 500.
  Hay que soltar los pagos muertos ANTES de anular la cuota.
- **F** — `PATCH /contratos/:id/monto` cambia el canon **sin dejar fila de ajuste**. La regla
  intuitiva ("manda el último ajuste") habría revertido ese cambio en silencio.
- **F (producto)** — el primer fix bloqueaba la vigencia futura con 400, pero **renovar por
  adelantado es el flujo normal**. Se reemplazó por el motor de canon por período.
- **N** — los comentarios afirmaban que estas rutas heredaban "el lockout anti-fuerza-bruta
  de `verificarPinUsuario`". Esa protección **ya no existe**: el PIN se eliminó y esa función
  devuelve `{ok:true}`. Quedó el comentario, no el candado.
- **O** — la asimetría manda el diseño: un falso "sí está en uso" deja un archivo de más
  (barato, reversible); un falso "no está en uso" **destruye** un archivo ajeno.
- **J** — `nroOperacion` no sirve solo como clave de dedup: cuando el extracto no trae esa
  columna, el parser usa el índice de fila. Y el monto vuelve de la DB como `Decimal` y del
  parser como `number`: sin normalizar los dos, el dedup nunca encuentra el duplicado.
- **K** — el guard va por ROL, no cambiando la capacidad: mover `contratos.crear` le habría
  sacado el acceso al OPERADOR, que es quien legítimamente ajusta el canon.
- **M** — el tope de backdating rompía un test con fecha hardcodeada. El test declaraba
  querer ser "independiente de la fecha en que corre": se arregló el test, no el guard.

- **V** — los datos reales YA venían del API (`diaPago`, `comisionInmobiliaria`, `ciudad`,
  `depositoGarantia`); simplemente no se mapeaban al front. Y había que borrar los CUATRO
  defaults del generador, no sólo arreglar el panel: mientras existieran, cualquier caller
  futuro reintroducía el documento falso. El `?? 5` del día de pago es el más traicionero
  porque ese campo es NOT NULL en la DB — un 5 impreso siempre es mentira.
- **U** — el fallback de `version` es `'desconocido'` a propósito. Usar el `version` del
  package.json habría mentido (no se bumpea por deploy), y un endpoint de verificación que
  miente es peor que no tenerlo.

## ⚠️ La lección más importante (causa S)

El dedup por dirección se mergeó, y **un refactor posterior de otra sesión se llevó el
cableado de la ruta**. Como el parámetro era OPCIONAL, no falló nada: el dedup simplemente
dejó de existir. **Y el test seguía verde**, porque cubría la función pura y no el call site.

Un test unitario no puede detectar que a la función dejaron de llamarla.

Por eso el arreglo fue en dos capas: re-cablear, y hacer el parámetro **obligatorio** para
que el compilador lo exija. Más un test contra el ENDPOINT.

**Regla para el que siga:** si el fix vive en una función y el bug real estaba en *usarla*,
el test tiene que ejercitar el cableado.

## Pendiente: 23 hallazgos confirmados del barrido de front/costuras
La última cacería (front del panel + PWA, costura demo/prod, cron, routes restantes) devolvió
24 hallazgos, TODOS confirmados por verificación adversarial. Se cerró el más grave (V). Los
P1 que quedan: la comisión del dashboard se calcula sobre TODO lo cobrado (expensas y mora
incluidas) en vez de sobre el alquiler —viola el modelo LOCKED—; el botón "Rendir" queda
deshabilitado si el mes se cobró PARCIAL, así que esa plata nunca llega al propietario; el
mismo botón se traba con un propietario que cobra en ARS y USD; ajustar el alquiler no
invalida la cache de liquidaciones y el panel sigue cobrando con el canon viejo; el
compositor de anuncios muestra destinatarios y consorcios DE LOS MOCKS en prod (se confirma
un envío masivo a ciegas); y el botón "Devengar" del panel resucita la deuda histórica falsa
de la cartera importada.

## Reconciliación con otras sesiones
Hay ~9 worktrees trabajando el mismo repo. Varias causas se cazaron **en paralelo**: cuando
main ya la tenía, se descartó el duplicado y **se conservó el test**, que pasa a auditar la
implementación ajena. Los cuatro dan verde: `saldar-deuda-concurrencia`,
`deposito-cap-disponible`, `rendicion-reclamo-multiduenio`, `extracto-csv-parseo`.

Un fix propio se descartó **por ser peor que el ajeno**: mi lock del import marcaba
CONFIRMADO al arrancar y habría roto la reanudación que implementó main.

## Verificación
Gate por commit: `tsc --noEmit` 0 errores en las 3 apps + `tsup build`. Los fixes sutiles
con rojo-antes/verde-después real (el de doble-cobro pasó de crear 5 pagos por una deuda a 1).

⚠️ **La DB de test es COMPARTIDA entre sesiones y Railway se cae seguido.** `core.test.ts`
afirma conteos exactos del seed y falla cada vez que otra sesión deja datos (se vio una
propiedad extra, 2 inquilinos de más y `own_001` renombrado a "Repro"). También aparecen 401
de login y `Can't reach database server`. **Cada file re-corrido aislado pasa.** No confundir
ese ruido con una regresión: reproducir la causa antes de dar por bueno un fallo.

## Falsos positivos (NO tocar)
email global de /usuarios (el unique es compuesto `inmobiliariaId_email`) · rendiciones
"fuera de tx" · tamanioBytes en /boletas · PIN eliminado (`verificarPin` devuelve `{ok:true}`).
