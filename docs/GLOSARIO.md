# Glosario — dominio inmobiliario

> Términos del dominio (alquileres en Argentina) usados en el código y el producto.
> Para que cualquiera entienda los modelos, los endpoints y las reglas de plata.

---

## Glosario del dominio (My Alquiler)

Términos del negocio inmobiliario argentino tal como aparecen en el código (`apps/api/prisma/schema.prisma`, `packages/shared/src/permisos.ts`). Las MAYÚSCULAS son valores literales de enums.

### Plataforma y arquitectura

- **Multi-tenant / `inmobiliariaId`**: el sistema aloja muchas inmobiliarias en una misma base. Casi todo modelo de negocio lleva `inmobiliariaId` para aislar datos entre tenants. La `Inmobiliaria` es el tenant raíz.
- **`apiEnabled`**: flag de frontend que distingue mock (datos de demo en el cliente) de API real. No es columna de base; cuando está activo, los datos vienen del backend en vez de un fixture local.
- **Roles (`Rol`)**: matriz de quién puede hacer qué dentro del panel. `ADMIN` (acceso total, aprueba lo que cargan otros), `OPERADOR` (día a día sin "firmar plata"), `CARGA` (solo carga inicial, queda pendiente de aprobación), `LECTURA` (solo lectura). Definido en `permisos.ts` como capacidades chequeables.
- **PIN requerido / aprobación**: las acciones sensibles (conciliar, rendir, devolver depósito) exigen además del rol el PIN del usuario; lo que carga un rol menor queda pendiente de aprobación de un ADMIN.

### Contrato y ajuste

- **Contrato**: el alquiler vigente entre propietario e inquilino sobre una propiedad. Estados (`EstadoContrato`): `BORRADOR` (cargado, sin activar), `ACTIVO`, `FINALIZADO` (terminó su plazo), `RESCINDIDO` (cortado antes de tiempo).
- **`TipoContrato`**: qué se cobra. `ALQUILER`, `SOLO_EXPENSAS`, `ALQUILER_Y_EXPENSAS`.
- **Índice de ajuste (`IndiceAjuste`)**: índice por el que sube el alquiler periódicamente. `ICL` (Índice de Contratos de Locación, BCRA), `IPC` (inflación, INDEC), `CASA_PROPIA` (índice oficial del programa homónimo), `UVA` (Unidad de Valor Adquisitivo), `CAC` (Cámara Argentina de la Construcción, costos de obra), `RIPTE` (salarios registrados), `FIJO` (escalonado pactado, sin índice externo).
- **Expensas**: gasto mensual del edificio/consorcio (mantenimiento, servicios comunes) que paga la unidad. Puede facturarse junto con el alquiler o solo (`SOLO_EXPENSAS`).
- **Depósito de garantía (`depositoGarantia`)**: suma que el inquilino deja en garantía al inicio y se le devuelve al final (acción sensible `deposito.devolver`).
- **Comisión (`comisionInmobiliaria` / `comisionPct`)**: porcentaje que la inmobiliaria cobra al propietario por administrar; se descuenta al rendir. En `Rendicion` se congela como snapshot (`comisionMonto`).
- **Punitorio (`tasaPunitorioDiaria` / `montoPunitorio`)**: recargo por mora. Es lineal y se recalcula al día con fechas locales; el `montoPunitorio` guardado es solo un snapshot informativo, la verdad la calcula el server.

### Cobranza y modo

- **`ModoCobranza`**: quién recibe la plata del inquilino. `INMOBILIARIA` (cobra la inmo y luego rinde al propietario) vs `PROPIETARIO_DIRECTO` (el inquilino le paga directo al dueño; la inmo solo administra/registra).
- **Devengar**: generar el cargo del mes cuando corresponde, exista o no el pago todavía. La `Liquidacion` mensual es el cargo devengado (alquiler + expensas + punitorio) con su `fechaVencimiento`.
- **Liquidación (`Liquidacion`)**: el cargo mensual de un contrato para un período `YYYY-MM`. Estados (`EstadoLiquidacion`): `PENDIENTE`, `PAGADO`, `PARCIAL` (pago incompleto), `VENCIDO`. Puede tener N `Pago` (parciales).

### Pago y conciliación

- **Pago informado**: el inquilino declara que pagó (`MetodoPagoInformado`: transferencia, MercadoPago, efectivo, cheque) y sube comprobante. Queda a la espera de validación de la inmo.
- **Conciliación (`EstadoConciliacion`)**: el cruce entre lo que el inquilino informó y lo que la inmo verifica. `INFORMADO` (declarado, sin revisar), `CONCILIADO` (verificado y dado por bueno), `RECHAZADO`. Revertir una conciliación es acción sensible (`pago.revertir`).

### Caja y rendición

- **Caja / movimiento de caja (`MovimientoCaja`)**: registro diario de plata que entra o sale en la oficina (`GASTO` o `INGRESO_EXTRA`), con categorías como plomería, electricidad, expensas, materiales.
- **Cierre de caja**: `GET /caja/cierre` calcula el corte del día **al vuelo** (lo cobrado + comisión); hoy NO se persiste — el modelo `CierreCaja` existe en el schema pero todavía no se escribe. Eliminar un gasto ya cargado es acción sensible.
- **Rendición (`Rendicion`)**: la liquidación de cuentas al propietario por período. `montoNeto = montoBruto − comisionMonto − totalGastos`. Al rendir, los gastos de caja se marcan descontados y se linkean (loop caja→rendición). "Rendir a propietario" es acción ADMIN + PIN.
- **Gasto rendido (`GastoRendido`)**: snapshot congelado de un gasto al momento de rendir, para que el comprobante histórico sobreviva a ediciones del origen (caja o reclamo).

### Personas y screening

- **Propietario**: dueño de la propiedad; recibe la rendición. Puede confirmar recibo de lo rendido.
- **Garante (`TipoGarante`)**: respaldo del inquilino ante incumplimiento. `PROPIETARIA` (garantía propietaria, otro inmueble), `CAUCION` (seguro de caución), `SUELDO` (recibo de sueldo), `DIGITAL` (garantía digital).
- **Screening (`Screening`)**: evaluación previa de un candidato a inquilino. Estados: `EN_CURSO`, `COMPLETO`, `CONVERTIDO` (pasó a inquilino con contrato). Arroja una `Recomendacion`: `APTO`, `APTO_CON_GARANTIA`, `NO_APTO`.
- **Co-inquilino (`CoInquilino`) y permisos (`PermisoCoInquilino`)**: persona adicional que comparte el contrato en la app del inquilino. Su acceso: `VER` (solo mira), `PAGAR` (puede informar pagos), `COMPLETO` (todo).

### Sociedad, consorcio y reclamos

- **Sociedad (`Sociedad`)**: razón social bajo la que la inmobiliaria factura/opera; cada tenant tiene una sociedad principal y puede tener más. Un contrato sin `sociedadId` cae en la principal (fallback).
- **Consorcio (`Consorcio`)**: el edificio como entidad de administración: unidades funcionales (UF) con coeficientes que suman 100, expensas, servicios comunes (`TipoServicioConsorcio`: luz de pasillo, gas central, ascensor, ABL, etc.) y asambleas (ordinaria/extraordinaria).
- **UF (unidad funcional, `EstadoUF`)**: cada unidad del consorcio. Estado de pago de expensas: `AL_DIA`, `PENDIENTE`, `VENCIDO`, `CON_PLAN_PAGO`.
- **Reclamo (`Reclamo`)**: pedido de arreglo del inquilino. Categorías (`CategoriaReclamo`): plomería, electricidad, cerradura, calefacción, otro. Estados (`EstadoReclamo`): `ABIERTO`, `EN_CURSO`, `RESUELTO`, `CERRADO`, `RECHAZADO`.
- **Clasificación del reclamo (`ClasificacionReclamo`)**: a quién le toca pagar. `USO_Y_GOCE` (mantenimiento normal, suele ir por cuenta del inquilino/uso) vs `DESPERFECTO` (falla estructural, a cargo del propietario).
- **Boleta de servicio (`BoletaServicio`)**: factura de un servicio (`TipoServicio`: luz, gas, agua, internet, ABL, cable) que se sube/registra. Estados (`EstadoBoleta`): `SUBIDA` (UI: "Cargada"), `EN_REVISION`, `PAGADA`.

Archivos relevantes:
- `/Users/alannaimtapia/dev/inmobiliaria-inquilinos-app/apps/api/prisma/schema.prisma`
- `/Users/alannaimtapia/dev/inmobiliaria-inquilinos-app/packages/shared/src/permisos.ts`

