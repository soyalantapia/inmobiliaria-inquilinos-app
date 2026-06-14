-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'OPERADOR', 'CARGA', 'LECTURA');

-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('ARS', 'USD');

-- CreateEnum
CREATE TYPE "EstadoContrato" AS ENUM ('BORRADOR', 'ACTIVO', 'FINALIZADO', 'RESCINDIDO');

-- CreateEnum
CREATE TYPE "IndiceAjuste" AS ENUM ('ICL', 'IPC', 'CASA_PROPIA', 'UVA', 'CAC', 'RIPTE', 'FIJO');

-- CreateEnum
CREATE TYPE "TipoContrato" AS ENUM ('ALQUILER', 'SOLO_EXPENSAS', 'ALQUILER_Y_EXPENSAS');

-- CreateEnum
CREATE TYPE "ModoCobranza" AS ENUM ('INMOBILIARIA', 'PROPIETARIO_DIRECTO');

-- CreateEnum
CREATE TYPE "EstadoLiquidacion" AS ENUM ('PENDIENTE', 'PAGADO', 'PARCIAL', 'VENCIDO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('TRANSFERENCIA', 'MERCADOPAGO', 'EFECTIVO');

-- CreateEnum
CREATE TYPE "TipoPago" AS ENUM ('TOTAL', 'PARCIAL');

-- CreateEnum
CREATE TYPE "MetodoPagoInformado" AS ENUM ('TRANSFERENCIA', 'MERCADOPAGO', 'EFECTIVO', 'CHEQUE');

-- CreateEnum
CREATE TYPE "EstadoConciliacion" AS ENUM ('INFORMADO', 'CONCILIADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "MetodoComprobante" AS ENUM ('MERCADOPAGO', 'TRANSFERENCIA', 'QR', 'CRIPTO');

-- CreateEnum
CREATE TYPE "TipoPropiedad" AS ENUM ('DEPARTAMENTO', 'CASA', 'LOCAL', 'GALPON');

-- CreateEnum
CREATE TYPE "EstadoPropiedad" AS ENUM ('ALQUILADA', 'DISPONIBLE', 'EN_EDICION');

-- CreateEnum
CREATE TYPE "CondicionFiscal" AS ENUM ('MONOTRIBUTO', 'RESPONSABLE_INSCRIPTO', 'EXENTO');

-- CreateEnum
CREATE TYPE "TipoComprobanteAfip" AS ENUM ('FACTURA_C', 'FACTURA_A', 'FACTURA_B', 'RECIBO_C');

-- CreateEnum
CREATE TYPE "TipoGarante" AS ENUM ('PROPIETARIA', 'CAUCION', 'SUELDO', 'DIGITAL');

-- CreateEnum
CREATE TYPE "PermisoCoInquilino" AS ENUM ('VER', 'PAGAR', 'COMPLETO');

-- CreateEnum
CREATE TYPE "EstadoInvitacion" AS ENUM ('PENDIENTE', 'ACEPTADO');

-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('F', 'M');

-- CreateEnum
CREATE TYPE "RangoIngreso" AS ENUM ('A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7');

-- CreateEnum
CREATE TYPE "Recomendacion" AS ENUM ('APTO', 'APTO_CON_GARANTIA', 'NO_APTO');

-- CreateEnum
CREATE TYPE "EstadoScreening" AS ENUM ('EN_CURSO', 'COMPLETO', 'CONVERTIDO');

-- CreateEnum
CREATE TYPE "TipoEventoContrato" AS ENUM ('CREADO', 'AJUSTE_APLICADO', 'PAGO_RECIBIDO', 'PAGO_VENCIDO', 'RECLAMO_CREADO', 'COMUNICACION_ENVIADA', 'GARANTE_RENOVADO', 'INTENCION_RENOVACION');

-- CreateEnum
CREATE TYPE "DecisionRenovacion" AS ENUM ('RENOVAR', 'NO_RENOVAR', 'PENSANDO', 'SIN_RESPUESTA');

-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('GASTO', 'INGRESO_EXTRA');

-- CreateEnum
CREATE TYPE "CategoriaGasto" AS ENUM ('PLOMERIA', 'ELECTRICIDAD', 'GAS', 'CERRAJERIA', 'PINTURA', 'EXPENSAS', 'MATERIALES', 'OTRO');

-- CreateEnum
CREATE TYPE "MetodoRendicion" AS ENUM ('TRANSFERENCIA', 'MERCADOPAGO', 'EFECTIVO');

-- CreateEnum
CREATE TYPE "TipoGastoRendido" AS ENUM ('CAJA', 'TRABAJO');

-- CreateEnum
CREATE TYPE "MetodoCargoPagado" AS ENUM ('TRANSFERENCIA', 'MERCADOPAGO', 'OTRO');

-- CreateEnum
CREATE TYPE "FormaPago" AS ENUM ('DEBITO_AUTOMATICO', 'PREPAGO', 'ANUAL');

-- CreateEnum
CREATE TYPE "MovimientoTipo" AS ENUM ('pago', 'pago_expensa', 'ajuste', 'punitorio', 'reembolso', 'aviso');

-- CreateEnum
CREATE TYPE "SignoMovimiento" AS ENUM ('salida', 'entrada', 'info');

-- CreateEnum
CREATE TYPE "TipoAprobacion" AS ENUM ('CONTRATO_CARGADO', 'GASTO_CAJA_ELIMINACION', 'DEVOLUCION_DEPOSITO', 'AJUSTE_FUERA_DE_INDICE');

-- CreateEnum
CREATE TYPE "RolAutorAprobacion" AS ENUM ('OPERADOR', 'CARGA');

-- CreateEnum
CREATE TYPE "EstadoAprobacion" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "TipoEventoAuditoria" AS ENUM ('PAGO_CONCILIADO', 'PAGO_RECHAZADO', 'PAGO_REVERTIDO', 'PAGO_MANUAL_CARGADO', 'CONTRATO_CARGADO', 'CONTRATO_APROBADO', 'CONTRATO_RECHAZADO', 'PROPIEDAD_CARGADA', 'GASTO_CAJA_CARGADO', 'GASTO_CAJA_ELIMINADO', 'RECLAMO_CLASIFICADO', 'PROFESIONAL_ASIGNADO', 'EQUIPO_INVITADO', 'EQUIPO_REMOVIDO', 'FACTURA_ARCA_EMITIDA', 'PROPIETARIO_CONFIRMO_RECIBO', 'PROPIETARIO_RENDIDO', 'MODO_COBRANZA_CAMBIADO');

-- CreateEnum
CREATE TYPE "GrupoCapacidad" AS ENUM ('lectura', 'carga', 'operativa', 'sensible');

-- CreateEnum
CREATE TYPE "TipoReporte" AS ENUM ('BUG', 'IDEA');

-- CreateEnum
CREATE TYPE "SeveridadReporte" AS ENUM ('BLOQUEA', 'MOLESTO', 'MENOR');

-- CreateEnum
CREATE TYPE "TipoTrial" AS ENUM ('PROMOTOR', 'LANZAMIENTO', 'CUSTOM');

-- CreateEnum
CREATE TYPE "KeyTramoPlan" AS ENUM ('STARTER', 'GROWTH', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "KeyTramoPlanConsorcios" AS ENUM ('CNS_BASIC', 'CNS_STANDARD', 'CNS_PREMIUM', 'CNS_ELITE');

-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('PAGADA', 'PENDIENTE', 'VENCIDA');

-- CreateEnum
CREATE TYPE "MetodoPagoFactura" AS ENUM ('TRANSFERENCIA', 'TARJETA');

-- CreateEnum
CREATE TYPE "EstadoConvenio" AS ENUM ('ACTIVO', 'PROXIMAMENTE', 'CERRADO');

-- CreateEnum
CREATE TYPE "EstadoReferido" AS ENUM ('INVITADO', 'REGISTRADO', 'ACTIVO', 'CHURN');

-- CreateEnum
CREATE TYPE "PrioridadBloqueador" AS ENUM ('alta', 'media', 'baja');

-- CreateEnum
CREATE TYPE "CategoriaReclamo" AS ENUM ('PLOMERIA', 'ELECTRICIDAD', 'CERRADURA', 'CALEFACCION', 'OTRO');

-- CreateEnum
CREATE TYPE "UrgenciaReclamo" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'EMERGENCIA');

-- CreateEnum
CREATE TYPE "EstadoReclamo" AS ENUM ('ABIERTO', 'EN_CURSO', 'RESUELTO', 'CERRADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "ClasificacionReclamo" AS ENUM ('USO_Y_GOCE', 'DESPERFECTO');

-- CreateEnum
CREATE TYPE "TipoEventoReclamo" AS ENUM ('CREADO', 'ASIGNADO', 'EN_CURSO', 'RESUELTO', 'CERRADO', 'RECHAZADO', 'MENSAJE_INQUILINO', 'MENSAJE_INMO', 'CLASIFICADO', 'PROFESIONAL_ASIGNADO', 'VISITA_CONFIRMADA', 'VISITA_EN_CAMINO', 'VISITA_LISTO');

-- CreateEnum
CREATE TYPE "CategoriaProfesional" AS ENUM ('PLOMERO', 'ELECTRICISTA', 'GASISTA', 'CERRAJERO', 'PINTOR', 'TECNICO_AC', 'FLETE');

-- CreateEnum
CREATE TYPE "EstadoVisitaProfesional" AS ENUM ('ASIGNADO', 'CONFIRMADA', 'EN_CAMINO', 'LISTO');

-- CreateEnum
CREATE TYPE "DecisionInquilino" AS ENUM ('CONFORME', 'PERSISTE');

-- CreateEnum
CREATE TYPE "EstadoUF" AS ENUM ('AL_DIA', 'PENDIENTE', 'VENCIDO', 'CON_PLAN_PAGO');

-- CreateEnum
CREATE TYPE "CategoriaMovimientoConsorcio" AS ENUM ('COBRANZA', 'SUELDO', 'MANTENIMIENTO', 'SERVICIO', 'IMPUESTO', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoAsamblea" AS ENUM ('ORDINARIA', 'EXTRAORDINARIA');

-- CreateEnum
CREATE TYPE "CategoriaInventario" AS ENUM ('ILUMINACION', 'PLOMERIA', 'CERRAJERIA', 'LIMPIEZA', 'ELECTRICIDAD', 'OFICINA', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoMovimientoInventario" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "TipoServicioConsorcio" AS ENUM ('LUZ_PASILLO', 'GAS_CENTRAL', 'AGUA_GENERAL', 'ASCENSOR', 'CALEFACCION_CENTRAL', 'ABL', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoDocContrato" AS ENUM ('CONTRATO_FIRMADO', 'DNI_TITULAR_FRENTE', 'DNI_TITULAR_DORSO', 'DNI_GARANTE_FRENTE', 'DNI_GARANTE_DORSO', 'RECIBO_SUELDO', 'CONVENIO_DESOCUPACION', 'PAGARE', 'FOTO_WHATSAPP', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoInvitadoInquilino" AS ENUM ('PENDIENTE_ACTIVACION', 'ACTIVO');

-- CreateEnum
CREATE TYPE "PrioridadAnuncio" AS ENUM ('NORMAL', 'IMPORTANTE', 'URGENTE');

-- CreateEnum
CREATE TYPE "AudienciaAnuncio" AS ENUM ('TODOS_INQUILINOS', 'INQUILINOS_MOROSOS', 'INQUILINOS_PENDIENTES', 'TODOS_PROPIETARIOS', 'TODOS_CONSORCIOS', 'INQUILINOS_CONSORCIO', 'CONTRATOS_ESPECIFICOS');

-- CreateEnum
CREATE TYPE "CanalAnuncio" AS ENUM ('APP', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "TipoServicio" AS ENUM ('LUZ', 'GAS', 'AGUA', 'INTERNET', 'ABL', 'CABLE');

-- CreateEnum
CREATE TYPE "EstadoBoleta" AS ENUM ('SUBIDA', 'PAGADA', 'EN_REVISION');

-- CreateEnum
CREATE TYPE "RolMensajeChat" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "CategoriaDocumento" AS ENUM ('IDENTIDAD', 'INGRESOS', 'GARANTE', 'OTRO');

-- CreateEnum
CREATE TYPE "NivelHistorial" AS ENUM ('EXCELENTE', 'BUENO', 'REGULAR', 'NUEVO');

-- DropForeignKey
ALTER TABLE "otp_codes" DROP CONSTRAINT "otp_codes_inquilinoId_fkey";

-- DropIndex
DROP INDEX "inmobiliarias_slug_key";

-- DropIndex
DROP INDEX "inquilinos_email_key";

-- DropIndex
DROP INDEX "usuarios_email_key";

-- AlterTable
ALTER TABLE "inmobiliarias" DROP COLUMN "slug",
ADD COLUMN     "codigoReferido" TEXT NOT NULL,
ADD COLUMN     "cuit" TEXT NOT NULL,
ADD COLUMN     "direccionAltura" TEXT NOT NULL,
ADD COLUMN     "direccionCalle" TEXT NOT NULL,
ADD COLUMN     "direccionCiudad" TEXT NOT NULL,
ADD COLUMN     "direccionCp" TEXT NOT NULL,
ADD COLUMN     "direccionPiso" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "direccionProvincia" TEXT NOT NULL,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "esPiloto" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "matricula" TEXT NOT NULL,
ADD COLUMN     "mesesGratisGanados" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notasFiscales" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "telefono" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "inquilinos" ADD COLUMN     "apellido" TEXT,
ADD COLUMN     "contratoId" TEXT,
ADD COLUMN     "cuit" TEXT,
ADD COLUMN     "esInvitado" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "apellido" TEXT NOT NULL,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "pinBloqueadoHasta" TIMESTAMP(3),
ADD COLUMN     "pinIntentosFallidos" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "rol",
ADD COLUMN     "rol" "Rol" NOT NULL,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- DropTable
DROP TABLE "otp_codes";

-- DropEnum
DROP TYPE "RolUsuario";

-- CreateTable
CREATE TABLE "capacidades" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "roles" "Rol"[],
    "requierePin" BOOLEAN NOT NULL DEFAULT false,
    "rolesAprobacion" "Rol"[],
    "grupo" "GrupoCapacidad" NOT NULL,

    CONSTRAINT "capacidades_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "aprobaciones" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "tipo" "TipoAprobacion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(14,2),
    "entidadId" TEXT NOT NULL,
    "cargadoPorId" TEXT NOT NULL,
    "rolAutor" "RolAutorAprobacion" NOT NULL,
    "cargadoAt" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoAprobacion" NOT NULL DEFAULT 'PENDIENTE',
    "aprobadoPorId" TEXT,
    "aprobadoAt" TIMESTAMP(3),
    "comentarioAprobador" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aprobaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_auditoria" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "tipo" "TipoEventoAuditoria" NOT NULL,
    "autorId" TEXT NOT NULL,
    "rolAutor" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "entidadDescripcion" TEXT NOT NULL,
    "detalle" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_otp" (
    "id" TEXT NOT NULL,
    "inquilinoId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reportes_piloto" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "tipo" "TipoReporte" NOT NULL,
    "titulo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pantalla" TEXT NOT NULL,
    "urlCompleta" TEXT,
    "navegador" TEXT,
    "viewport" TEXT,
    "severidad" "SeveridadReporte",
    "ip" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "build" TEXT,
    "reportadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reportes_piloto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trials" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "tipo" "TipoTrial" NOT NULL,
    "motivo" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,
    "activadoPor" TEXT NOT NULL,

    CONSTRAINT "trials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sociedades" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreComercial" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "condicionFiscal" "CondicionFiscal" NOT NULL,
    "domicilioFiscal" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "cuentaCobranza" JSONB,
    "afip" JSONB,
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sociedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tramos_plan" (
    "id" TEXT NOT NULL,
    "key" "KeyTramoPlan" NOT NULL,
    "nombre" TEXT NOT NULL,
    "desde" INTEGER NOT NULL,
    "hasta" INTEGER,
    "precio" INTEGER NOT NULL,
    "rango" TEXT NOT NULL,

    CONSTRAINT "tramos_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tramos_plan_consorcios" (
    "id" TEXT NOT NULL,
    "key" "KeyTramoPlanConsorcios" NOT NULL,
    "nombre" TEXT NOT NULL,
    "desde" INTEGER NOT NULL,
    "hasta" INTEGER,
    "precio" INTEGER NOT NULL,
    "rango" TEXT NOT NULL,

    CONSTRAINT "tramos_plan_consorcios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "propiedadesEnPlan" INTEGER NOT NULL,
    "plan" "KeyTramoPlan" NOT NULL,
    "importeBase" INTEGER NOT NULL,
    "importeIva" INTEGER NOT NULL,
    "importeTotal" INTEGER NOT NULL,
    "estado" "EstadoFactura" NOT NULL,
    "fechaPago" TIMESTAMP(3),
    "metodoPago" "MetodoPagoFactura",
    "pdfUrl" TEXT NOT NULL,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suscripciones" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "forma" "FormaPago" NOT NULL,
    "ultimos4" TEXT,
    "marca" TEXT,
    "proximoCobro" TIMESTAMP(3) NOT NULL,
    "configuradaAt" TIMESTAMP(3) NOT NULL,
    "vencimientoUltimo" TIMESTAMP(3) NOT NULL,
    "ultimoCobroOk" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cupones" (
    "codigo" TEXT NOT NULL,
    "convenio" TEXT NOT NULL,
    "porcentaje" INTEGER NOT NULL,
    "vigenciaHasta" TIMESTAMP(3),
    "detalle" TEXT NOT NULL,
    "sigla" TEXT,
    "cobertura" TEXT,
    "descripcion" TEXT,
    "sitioWeb" TEXT,
    "estado" "EstadoConvenio",
    "matriculados" INTEGER,
    "beneficios" TEXT[],

    CONSTRAINT "cupones_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "cupones_aplicados" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "cuponCodigo" TEXT NOT NULL,
    "aplicadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origenSeed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cupones_aplicados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referidos" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "inmobiliariaNombre" TEXT,
    "estado" "EstadoReferido" NOT NULL DEFAULT 'INVITADO',
    "invitadoAt" TIMESTAMP(3) NOT NULL,
    "registradoAt" TIMESTAMP(3),
    "activoDesde" TIMESTAMP(3),

    CONSTRAINT "referidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metas_semestre" (
    "id" TEXT NOT NULL,
    "clientesActivos" INTEGER NOT NULL,
    "mrrArs" INTEGER NOT NULL,
    "inicio" TEXT NOT NULL,
    "cierre" TEXT NOT NULL,

    CONSTRAINT "metas_semestre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohortes_mes" (
    "id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "nuevos" INTEGER NOT NULL,
    "churn" INTEGER NOT NULL,
    "activos" INTEGER NOT NULL,
    "mrr" INTEGER NOT NULL,

    CONSTRAINT "cohortes_mes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_steps" (
    "id" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "etapa" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "conversion" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "funnel_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuentes_adquisicion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "clientes" INTEGER NOT NULL,
    "costoTotal" INTEGER NOT NULL,

    CONSTRAINT "fuentes_adquisicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueadores_objetivo" (
    "id" TEXT NOT NULL,
    "prioridad" "PrioridadBloqueador" NOT NULL,
    "titulo" TEXT NOT NULL,
    "responsable" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,

    CONSTRAINT "bloqueadores_objetivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propietarios" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "cbuAlias" TEXT,
    "comisionPct" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "propietarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arca_configs" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "propietarioId" TEXT NOT NULL,
    "conectado" BOOLEAN NOT NULL DEFAULT false,
    "condicionFiscal" "CondicionFiscal",
    "puntoVenta" TEXT,
    "tipoComprobante" "TipoComprobanteAfip",
    "conectadoDesde" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arca_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_cobranza_directa" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "propietarioId" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "titular" TEXT NOT NULL,
    "cbu" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_cobranza_directa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propiedades" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "tipo" "TipoPropiedad" NOT NULL,
    "ambientes" INTEGER,
    "m2" DOUBLE PRECISION,
    "fotoUrl" TEXT,
    "estado" "EstadoPropiedad" NOT NULL DEFAULT 'EN_EDICION',
    "contratoActualId" TEXT,
    "sociedadId" TEXT,
    "consorcioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "propiedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participaciones_propietario" (
    "inmobiliariaId" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "propietarioId" TEXT NOT NULL,
    "porcentaje" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "participaciones_propietario_pkey" PRIMARY KEY ("propiedadId","propietarioId")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "sociedadId" TEXT,
    "estado" "EstadoContrato" NOT NULL DEFAULT 'BORRADOR',
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "diaPago" INTEGER NOT NULL,
    "indiceAjuste" "IndiceAjuste" NOT NULL,
    "frecuenciaAjusteMeses" INTEGER NOT NULL,
    "proximoAjuste" TIMESTAMP(3),
    "tipoContrato" "TipoContrato" NOT NULL DEFAULT 'ALQUILER',
    "montoExpensas" DECIMAL(14,2),
    "cbuAlias" TEXT,
    "titularCuenta" TEXT,
    "comisionInmobiliaria" DOUBLE PRECISION,
    "depositoGarantia" DECIMAL(14,2),
    "tasaPunitorioDiaria" DOUBLE PRECISION,
    "modoCobranza" "ModoCobranza" NOT NULL DEFAULT 'INMOBILIARIA',
    "cobraDirectoPropietarioId" TEXT,
    "cargadoPor" TEXT,
    "cargadoRol" "Rol",
    "cargadoAt" TIMESTAMP(3),
    "pendienteAprobacion" BOOLEAN NOT NULL DEFAULT false,
    "aprobadoPor" TEXT,
    "aprobadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_drafts" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "contratoId" TEXT,
    "datos" JSONB NOT NULL,
    "creadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrato_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garantes" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "tipo" "TipoGarante" NOT NULL,
    "nombreProveedor" TEXT NOT NULL,
    "numeroPoliza" TEXT,
    "montoCobertura" DECIMAL(14,2) NOT NULL,
    "vigenciaHasta" TIMESTAMP(3) NOT NULL,
    "contactoNombre" TEXT NOT NULL,
    "contactoTelefono" TEXT NOT NULL,
    "contactoEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "co_inquilinos" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "dni" TEXT,
    "relacion" TEXT NOT NULL,
    "permiso" "PermisoCoInquilino" NOT NULL,
    "estado" "EstadoInvitacion" NOT NULL DEFAULT 'PENDIENTE',
    "invitadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aceptadoAt" TIMESTAMP(3),

    CONSTRAINT "co_inquilinos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screenings" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "estado" "EstadoScreening" NOT NULL DEFAULT 'EN_CURSO',
    "contratoId" TEXT,
    "cuit" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "fechaNacimiento" TIMESTAMP(3) NOT NULL,
    "sexo" "Sexo" NOT NULL,
    "domicilio" JSONB NOT NULL,
    "telefonos" JSONB NOT NULL,
    "email" TEXT,
    "bcra" JSONB NOT NULL,
    "cheques" JSONB NOT NULL,
    "familia" JSONB NOT NULL,
    "rangoIngresoFamiliar" "RangoIngreso" NOT NULL,
    "bcraFamiliar" JSONB NOT NULL,
    "inmuebles" JSONB NOT NULL,
    "vehiculos" JSONB NOT NULL,
    "ingresos" JSONB NOT NULL,
    "empleador" JSONB,
    "vecinos" JSONB NOT NULL,
    "huellaDigital" JSONB NOT NULL,
    "scoreNosis" INTEGER NOT NULL,
    "recomendacion" "Recomendacion" NOT NULL,
    "recomendacionRazon" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screenings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidaciones" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "montoAlquiler" DECIMAL(14,2) NOT NULL,
    "montoExpensas" DECIMAL(14,2),
    "montoPunitorio" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "montoTotal" DECIMAL(14,2) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "fechaPago" TIMESTAMP(3),
    "estado" "EstadoLiquidacion" NOT NULL DEFAULT 'PENDIENTE',
    "metodoPago" "MetodoPago",
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liquidaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "liquidacionId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "tipo" "TipoPago" NOT NULL DEFAULT 'TOTAL',
    "monto" DECIMAL(14,2) NOT NULL,
    "montoLiqTotal" DECIMAL(14,2),
    "metodo" "MetodoPagoInformado" NOT NULL,
    "nroOperacion" TEXT,
    "fechaTransferencia" TIMESTAMP(3) NOT NULL,
    "informadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comprobanteUrl" TEXT,
    "comprobanteFileName" TEXT,
    "comprobanteMime" TEXT,
    "comprobanteSize" INTEGER,
    "notaInquilino" TEXT,
    "extraccionIA" JSONB,
    "estado" "EstadoConciliacion" NOT NULL DEFAULT 'INFORMADO',
    "observacion" TEXT,
    "decididoPorId" TEXT,
    "decididoAt" TIMESTAMP(3),

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobantes" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "liquidacionId" TEXT,
    "periodo" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "fechaPago" TIMESTAMP(3) NOT NULL,
    "metodo" "MetodoComprobante" NOT NULL,
    "pdfUrl" TEXT NOT NULL,

    CONSTRAINT "comprobantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_contrato" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "tipo" "TipoEventoContrato" NOT NULL,
    "titulo" TEXT NOT NULL,
    "detalle" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "autor" TEXT NOT NULL,

    CONSTRAINT "eventos_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intenciones_renovacion" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "decision" "DecisionRenovacion" NOT NULL DEFAULT 'SIN_RESPUESTA',
    "comentario" TEXT,
    "decididoAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intenciones_renovacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_caja" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "contratoId" TEXT,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "categoria" "CategoriaGasto" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "proveedor" TEXT,
    "comprobanteUrl" TEXT,
    "cargadoPor" TEXT NOT NULL,
    "descontadoEnRendicion" BOOLEAN NOT NULL DEFAULT false,
    "rendicionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierres_caja" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "ingresos" DECIMAL(14,2) NOT NULL,
    "egresos" DECIMAL(14,2) NOT NULL,
    "balanceDia" DECIMAL(14,2) NOT NULL,
    "efectivoEnMano" DECIMAL(14,2) NOT NULL,
    "pendienteRendir" DECIMAL(14,2) NOT NULL,
    "movimientos" INTEGER NOT NULL,
    "cerradoAt" TIMESTAMP(3) NOT NULL,
    "cerradoPor" TEXT NOT NULL,

    CONSTRAINT "cierres_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rendiciones" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "propietarioId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "montoBruto" DECIMAL(14,2) NOT NULL,
    "comisionPct" DOUBLE PRECISION NOT NULL,
    "comisionMonto" DECIMAL(14,2) NOT NULL,
    "totalGastos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "montoNeto" DECIMAL(14,2) NOT NULL,
    "rendidoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metodo" "MetodoRendicion" NOT NULL,
    "notas" TEXT,

    CONSTRAINT "rendiciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos_rendidos" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "rendicionId" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "tipo" "TipoGastoRendido" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "proveedor" TEXT,
    "monto" DECIMAL(14,2) NOT NULL,
    "montoTotal" DECIMAL(14,2) NOT NULL,
    "participacion" DOUBLE PRECISION NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,

    CONSTRAINT "gastos_rendidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargos_pagados" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "reclamoId" TEXT NOT NULL,
    "contratoId" TEXT,
    "monto" DECIMAL(14,2) NOT NULL,
    "pagadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metodo" "MetodoCargoPagado" NOT NULL,

    CONSTRAINT "cargos_pagados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_feed" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "tipo" "MovimientoTipo" NOT NULL,
    "titulo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(14,2),
    "signo" "SignoMovimiento" NOT NULL,

    CONSTRAINT "movimientos_feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "datos_bancarios" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "tipoCuenta" TEXT NOT NULL,
    "titular" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "cbu" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "datos_bancarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proximos_cambios_bancarios" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "datosBancariosId" TEXT NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL,
    "cbu" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "motivo" TEXT,

    CONSTRAINT "proximos_cambios_bancarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumenes_bancarios" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "archivoUrl" TEXT,
    "subidoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subidoPor" TEXT NOT NULL,

    CONSTRAINT "resumenes_bancarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creditos_detectados" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "resumenBancarioId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "titularOrigen" TEXT NOT NULL,
    "cbuOrigen" TEXT,
    "nroOperacion" TEXT NOT NULL,
    "bancoOrigen" TEXT NOT NULL,

    CONSTRAINT "creditos_detectados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reclamos" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "propiedadId" TEXT,
    "categoria" "CategoriaReclamo" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "urgencia" "UrgenciaReclamo" NOT NULL,
    "estado" "EstadoReclamo" NOT NULL DEFAULT 'ABIERTO',
    "asignadoA" TEXT,
    "fotoUrl" TEXT,
    "resolucion" TEXT,
    "clasificacion" "ClasificacionReclamo",
    "profesionalId" TEXT,
    "costoTrabajo" DECIMAL(14,2),
    "costoTrabajoNotas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltoAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reclamos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reclamo_eventos" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "reclamoId" TEXT NOT NULL,
    "tipo" "TipoEventoReclamo" NOT NULL,
    "autor" TEXT NOT NULL,
    "contenido" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reclamo_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profesionales" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaProfesional" NOT NULL,
    "zona" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cantTrabajos" INTEGER NOT NULL DEFAULT 0,
    "ultimoTrabajo" TIMESTAMP(3),
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profesionales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitas_profesional" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "reclamoId" TEXT NOT NULL,
    "profesionalId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "fechaVisita" TIMESTAMP(3),
    "estado" "EstadoVisitaProfesional" NOT NULL DEFAULT 'ASIGNADO',
    "confirmadaAt" TIMESTAMP(3),
    "enCaminoAt" TIMESTAMP(3),
    "listoAt" TIMESTAMP(3),
    "notaFinal" TEXT,
    "montoCobrado" DECIMAL(14,2),
    "fotoAntes" TEXT,
    "fotoDespues" TEXT,

    CONSTRAINT "visitas_profesional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confirmaciones_reclamo" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "reclamoId" TEXT NOT NULL,
    "estado" "DecisionInquilino" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comentario" TEXT,

    CONSTRAINT "confirmaciones_reclamo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings_reclamo" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "reclamoId" TEXT NOT NULL,
    "estrellas" INTEGER NOT NULL,
    "comentario" TEXT,
    "enviadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_reclamo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consorcios" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "cantUf" INTEGER NOT NULL,
    "sociedadId" TEXT,
    "encargado" JSONB,
    "periodoActual" TEXT NOT NULL,
    "expensasPeriodoActual" DECIMAL(14,2) NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consorcios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades_funcionales" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "consorcioId" TEXT NOT NULL,
    "identificacion" TEXT NOT NULL,
    "titular" TEXT NOT NULL,
    "coeficiente" DOUBLE PRECISION NOT NULL,
    "telefono" TEXT NOT NULL,
    "estado" "EstadoUF" NOT NULL DEFAULT 'AL_DIA',
    "saldoDeudor" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cargoFijo" DECIMAL(14,2),
    "serviciosUf" JSONB,

    CONSTRAINT "unidades_funcionales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_consorcio" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "consorcioId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "categoria" "CategoriaMovimientoConsorcio" NOT NULL,

    CONSTRAINT "movimientos_consorcio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asambleas_consorcio" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "consorcioId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoAsamblea" NOT NULL,
    "asunto" TEXT NOT NULL,
    "asistentes" INTEGER NOT NULL,
    "acuerdoPrincipal" TEXT NOT NULL,

    CONSTRAINT "asambleas_consorcio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_inventario" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "consorcioId" TEXT NOT NULL,
    "categoria" "CategoriaInventario" NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "cantidadActual" INTEGER NOT NULL,
    "minimoStock" INTEGER NOT NULL,
    "costoUnitario" DECIMAL(14,2),
    "notas" TEXT,
    "actualizadoAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "consorcioId" TEXT NOT NULL,
    "tipo" "TipoMovimientoInventario" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "ufDestino" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cargadoPor" TEXT NOT NULL,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicios_comunes_consorcio" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "consorcioId" TEXT NOT NULL,
    "tipo" "TipoServicioConsorcio" NOT NULL,
    "proveedor" TEXT NOT NULL,
    "nis" TEXT NOT NULL,
    "numeroMedidor" TEXT,
    "costoPromedioMensual" DECIMAL(14,2),
    "observaciones" TEXT,
    "actualizadoAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicios_comunes_consorcio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_contrato" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "tipo" "TipoDocContrato" NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "garanteIndex" INTEGER,
    "periodoLiquidacion" TEXT,
    "nombreArchivo" TEXT NOT NULL,
    "tipoMime" TEXT NOT NULL,
    "tamanioBytes" INTEGER NOT NULL,
    "archivoUrl" TEXT NOT NULL,
    "subidoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subidoPor" TEXT NOT NULL,

    CONSTRAINT "documentos_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquilinos_invitados" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "contratoId" TEXT,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT,
    "dni" TEXT NOT NULL,
    "fechaNacimiento" TIMESTAMP(3),
    "estado" "EstadoInvitadoInquilino" NOT NULL DEFAULT 'PENDIENTE_ACTIVACION',
    "invitadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitadoPor" TEXT NOT NULL DEFAULT 'Equipo de la inmobiliaria',
    "activadoAt" TIMESTAMP(3),

    CONSTRAINT "inquilinos_invitados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "co_inquilinos_invitados" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "invitadoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "celular" TEXT NOT NULL,
    "email" TEXT,
    "relacion" TEXT NOT NULL,
    "permiso" "PermisoCoInquilino" NOT NULL,

    CONSTRAINT "co_inquilinos_invitados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_adjuntos_invitado" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "invitadoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoMime" TEXT NOT NULL,
    "tamanioBytes" INTEGER NOT NULL,
    "archivoUrl" TEXT NOT NULL,
    "subidoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_adjuntos_invitado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anuncios" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "prioridad" "PrioridadAnuncio" NOT NULL DEFAULT 'NORMAL',
    "audiencia" "AudienciaAnuncio" NOT NULL,
    "audienciaIds" TEXT[],
    "canales" "CanalAnuncio"[],
    "enviadoPor" TEXT NOT NULL,
    "enviadoAt" TIMESTAMP(3) NOT NULL,
    "destinatariosCount" INTEGER NOT NULL DEFAULT 0,
    "programadoPara" TIMESTAMP(3),

    CONSTRAINT "anuncios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anuncios_acuses" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "anuncioId" TEXT NOT NULL,
    "inquilinoId" TEXT NOT NULL,
    "leidoAt" TIMESTAMP(3),
    "confirmadoAt" TIMESTAMP(3),

    CONSTRAINT "anuncios_acuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boletas_servicio" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "tipo" "TipoServicio" NOT NULL,
    "periodo" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "vencimiento" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoBoleta" NOT NULL DEFAULT 'SUBIDA',
    "nombreArchivo" TEXT NOT NULL,
    "tipoMime" TEXT NOT NULL,
    "tamanioBytes" INTEGER NOT NULL,
    "archivoUrl" TEXT NOT NULL,
    "subidoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pagadoAt" TIMESTAMP(3),
    "notas" TEXT,

    CONSTRAINT "boletas_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicios_publicos" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "tipo" "TipoServicio" NOT NULL,
    "distribuidora" TEXT NOT NULL,
    "nis" TEXT NOT NULL,
    "numeroMedidor" TEXT,
    "titular" TEXT,
    "observaciones" TEXT,
    "consumoPromedioMensual" DECIMAL(14,2),
    "actualizadoAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicios_publicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_mensajes" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "rol" "RolMensajeChat" NOT NULL,
    "contenido" TEXT NOT NULL,
    "citas" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slots_documento" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "categoria" "CategoriaDocumento" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "requerido" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "slots_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "inquilinoId" TEXT NOT NULL,
    "categoria" "CategoriaDocumento" NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoMime" TEXT NOT NULL,
    "tamanioBytes" INTEGER NOT NULL,
    "archivoUrl" TEXT NOT NULL,
    "subidoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vencimiento" TIMESTAMP(3),
    "slotId" TEXT,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificados_inquilino" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "inquilinoId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "inquilinoData" JSONB NOT NULL,
    "contratoActual" JSONB NOT NULL,
    "historial" JSONB NOT NULL,
    "nivel" "NivelHistorial" NOT NULL,
    "nivelDetalle" TEXT NOT NULL,
    "generadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validoHasta" TIMESTAMP(3) NOT NULL,
    "urlVerificacion" TEXT NOT NULL,
    "revocadoAt" TIMESTAMP(3),

    CONSTRAINT "certificados_inquilino_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aprobaciones_inmobiliariaId_estado_idx" ON "aprobaciones"("inmobiliariaId", "estado");

-- CreateIndex
CREATE INDEX "aprobaciones_cargadoPorId_idx" ON "aprobaciones"("cargadoPorId");

-- CreateIndex
CREATE INDEX "aprobaciones_aprobadoPorId_idx" ON "aprobaciones"("aprobadoPorId");

-- CreateIndex
CREATE INDEX "eventos_auditoria_inmobiliariaId_fecha_idx" ON "eventos_auditoria"("inmobiliariaId", "fecha");

-- CreateIndex
CREATE INDEX "eventos_auditoria_inmobiliariaId_tipo_idx" ON "eventos_auditoria"("inmobiliariaId", "tipo");

-- CreateIndex
CREATE INDEX "eventos_auditoria_autorId_idx" ON "eventos_auditoria"("autorId");

-- CreateIndex
CREATE INDEX "codigos_otp_inquilinoId_idx" ON "codigos_otp"("inquilinoId");

-- CreateIndex
CREATE INDEX "reportes_piloto_inmobiliariaId_idx" ON "reportes_piloto"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "reportes_piloto_usuarioId_idx" ON "reportes_piloto"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "trials_inmobiliariaId_key" ON "trials"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "sociedades_inmobiliariaId_idx" ON "sociedades"("inmobiliariaId");

-- CreateIndex
CREATE UNIQUE INDEX "tramos_plan_key_key" ON "tramos_plan"("key");

-- CreateIndex
CREATE UNIQUE INDEX "tramos_plan_consorcios_key_key" ON "tramos_plan_consorcios"("key");

-- CreateIndex
CREATE INDEX "facturas_inmobiliariaId_periodo_idx" ON "facturas"("inmobiliariaId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "suscripciones_inmobiliariaId_key" ON "suscripciones"("inmobiliariaId");

-- CreateIndex
CREATE UNIQUE INDEX "cupones_aplicados_inmobiliariaId_key" ON "cupones_aplicados"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "cupones_aplicados_cuponCodigo_idx" ON "cupones_aplicados"("cuponCodigo");

-- CreateIndex
CREATE INDEX "referidos_inmobiliariaId_idx" ON "referidos"("inmobiliariaId");

-- CreateIndex
CREATE UNIQUE INDEX "cohortes_mes_periodo_key" ON "cohortes_mes"("periodo");

-- CreateIndex
CREATE INDEX "propietarios_inmobiliariaId_idx" ON "propietarios"("inmobiliariaId");

-- CreateIndex
CREATE UNIQUE INDEX "arca_configs_propietarioId_key" ON "arca_configs"("propietarioId");

-- CreateIndex
CREATE INDEX "arca_configs_inmobiliariaId_idx" ON "arca_configs"("inmobiliariaId");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_cobranza_directa_propietarioId_key" ON "cuentas_cobranza_directa"("propietarioId");

-- CreateIndex
CREATE INDEX "cuentas_cobranza_directa_inmobiliariaId_idx" ON "cuentas_cobranza_directa"("inmobiliariaId");

-- CreateIndex
CREATE UNIQUE INDEX "propiedades_contratoActualId_key" ON "propiedades"("contratoActualId");

-- CreateIndex
CREATE INDEX "propiedades_inmobiliariaId_idx" ON "propiedades"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "propiedades_sociedadId_idx" ON "propiedades"("sociedadId");

-- CreateIndex
CREATE INDEX "propiedades_consorcioId_idx" ON "propiedades"("consorcioId");

-- CreateIndex
CREATE INDEX "participaciones_propietario_inmobiliariaId_idx" ON "participaciones_propietario"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "participaciones_propietario_propietarioId_idx" ON "participaciones_propietario"("propietarioId");

-- CreateIndex
CREATE INDEX "contratos_inmobiliariaId_estado_idx" ON "contratos"("inmobiliariaId", "estado");

-- CreateIndex
CREATE INDEX "contratos_propiedadId_idx" ON "contratos"("propiedadId");

-- CreateIndex
CREATE INDEX "contratos_sociedadId_idx" ON "contratos"("sociedadId");

-- CreateIndex
CREATE INDEX "contratos_cobraDirectoPropietarioId_idx" ON "contratos"("cobraDirectoPropietarioId");

-- CreateIndex
CREATE INDEX "contrato_drafts_inmobiliariaId_idx" ON "contrato_drafts"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "contrato_drafts_contratoId_idx" ON "contrato_drafts"("contratoId");

-- CreateIndex
CREATE INDEX "garantes_inmobiliariaId_idx" ON "garantes"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "garantes_contratoId_idx" ON "garantes"("contratoId");

-- CreateIndex
CREATE INDEX "co_inquilinos_inmobiliariaId_idx" ON "co_inquilinos"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "co_inquilinos_contratoId_idx" ON "co_inquilinos"("contratoId");

-- CreateIndex
CREATE INDEX "screenings_inmobiliariaId_estado_idx" ON "screenings"("inmobiliariaId", "estado");

-- CreateIndex
CREATE INDEX "screenings_contratoId_idx" ON "screenings"("contratoId");

-- CreateIndex
CREATE INDEX "liquidaciones_inmobiliariaId_estado_idx" ON "liquidaciones"("inmobiliariaId", "estado");

-- CreateIndex
CREATE INDEX "liquidaciones_inmobiliariaId_periodo_idx" ON "liquidaciones"("inmobiliariaId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "liquidaciones_contratoId_periodo_key" ON "liquidaciones"("contratoId", "periodo");

-- CreateIndex
CREATE INDEX "pagos_inmobiliariaId_estado_idx" ON "pagos"("inmobiliariaId", "estado");

-- CreateIndex
CREATE INDEX "pagos_contratoId_idx" ON "pagos"("contratoId");

-- CreateIndex
CREATE INDEX "pagos_liquidacionId_idx" ON "pagos"("liquidacionId");

-- CreateIndex
CREATE INDEX "pagos_decididoPorId_idx" ON "pagos"("decididoPorId");

-- CreateIndex
CREATE INDEX "comprobantes_inmobiliariaId_idx" ON "comprobantes"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "comprobantes_contratoId_idx" ON "comprobantes"("contratoId");

-- CreateIndex
CREATE INDEX "comprobantes_liquidacionId_idx" ON "comprobantes"("liquidacionId");

-- CreateIndex
CREATE INDEX "eventos_contrato_inmobiliariaId_idx" ON "eventos_contrato"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "eventos_contrato_contratoId_fecha_idx" ON "eventos_contrato"("contratoId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "intenciones_renovacion_contratoId_key" ON "intenciones_renovacion"("contratoId");

-- CreateIndex
CREATE INDEX "intenciones_renovacion_inmobiliariaId_idx" ON "intenciones_renovacion"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "movimientos_caja_inmobiliariaId_fecha_idx" ON "movimientos_caja"("inmobiliariaId", "fecha");

-- CreateIndex
CREATE INDEX "movimientos_caja_propiedadId_idx" ON "movimientos_caja"("propiedadId");

-- CreateIndex
CREATE INDEX "movimientos_caja_contratoId_idx" ON "movimientos_caja"("contratoId");

-- CreateIndex
CREATE INDEX "movimientos_caja_rendicionId_idx" ON "movimientos_caja"("rendicionId");

-- CreateIndex
CREATE UNIQUE INDEX "cierres_caja_inmobiliariaId_fecha_key" ON "cierres_caja"("inmobiliariaId", "fecha");

-- CreateIndex
CREATE INDEX "rendiciones_inmobiliariaId_periodo_idx" ON "rendiciones"("inmobiliariaId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "rendiciones_propietarioId_periodo_key" ON "rendiciones"("propietarioId", "periodo");

-- CreateIndex
CREATE INDEX "gastos_rendidos_inmobiliariaId_idx" ON "gastos_rendidos"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "gastos_rendidos_rendicionId_idx" ON "gastos_rendidos"("rendicionId");

-- CreateIndex
CREATE UNIQUE INDEX "cargos_pagados_reclamoId_key" ON "cargos_pagados"("reclamoId");

-- CreateIndex
CREATE INDEX "cargos_pagados_inmobiliariaId_idx" ON "cargos_pagados"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "cargos_pagados_contratoId_idx" ON "cargos_pagados"("contratoId");

-- CreateIndex
CREATE INDEX "movimientos_feed_inmobiliariaId_idx" ON "movimientos_feed"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "movimientos_feed_contratoId_fecha_idx" ON "movimientos_feed"("contratoId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "datos_bancarios_inmobiliariaId_key" ON "datos_bancarios"("inmobiliariaId");

-- CreateIndex
CREATE UNIQUE INDEX "proximos_cambios_bancarios_datosBancariosId_key" ON "proximos_cambios_bancarios"("datosBancariosId");

-- CreateIndex
CREATE INDEX "proximos_cambios_bancarios_inmobiliariaId_idx" ON "proximos_cambios_bancarios"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "resumenes_bancarios_inmobiliariaId_idx" ON "resumenes_bancarios"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "creditos_detectados_inmobiliariaId_idx" ON "creditos_detectados"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "creditos_detectados_resumenBancarioId_idx" ON "creditos_detectados"("resumenBancarioId");

-- CreateIndex
CREATE INDEX "reclamos_inmobiliariaId_estado_idx" ON "reclamos"("inmobiliariaId", "estado");

-- CreateIndex
CREATE INDEX "reclamos_contratoId_idx" ON "reclamos"("contratoId");

-- CreateIndex
CREATE INDEX "reclamos_propiedadId_idx" ON "reclamos"("propiedadId");

-- CreateIndex
CREATE INDEX "reclamos_profesionalId_idx" ON "reclamos"("profesionalId");

-- CreateIndex
CREATE INDEX "reclamo_eventos_inmobiliariaId_idx" ON "reclamo_eventos"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "reclamo_eventos_reclamoId_fecha_idx" ON "reclamo_eventos"("reclamoId", "fecha");

-- CreateIndex
CREATE INDEX "profesionales_inmobiliariaId_idx" ON "profesionales"("inmobiliariaId");

-- CreateIndex
CREATE UNIQUE INDEX "visitas_profesional_reclamoId_key" ON "visitas_profesional"("reclamoId");

-- CreateIndex
CREATE UNIQUE INDEX "visitas_profesional_token_key" ON "visitas_profesional"("token");

-- CreateIndex
CREATE INDEX "visitas_profesional_inmobiliariaId_idx" ON "visitas_profesional"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "visitas_profesional_profesionalId_idx" ON "visitas_profesional"("profesionalId");

-- CreateIndex
CREATE UNIQUE INDEX "confirmaciones_reclamo_reclamoId_key" ON "confirmaciones_reclamo"("reclamoId");

-- CreateIndex
CREATE INDEX "confirmaciones_reclamo_inmobiliariaId_idx" ON "confirmaciones_reclamo"("inmobiliariaId");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_reclamo_reclamoId_key" ON "ratings_reclamo"("reclamoId");

-- CreateIndex
CREATE INDEX "ratings_reclamo_inmobiliariaId_idx" ON "ratings_reclamo"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "consorcios_inmobiliariaId_idx" ON "consorcios"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "consorcios_sociedadId_idx" ON "consorcios"("sociedadId");

-- CreateIndex
CREATE INDEX "unidades_funcionales_inmobiliariaId_idx" ON "unidades_funcionales"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "unidades_funcionales_consorcioId_idx" ON "unidades_funcionales"("consorcioId");

-- CreateIndex
CREATE INDEX "movimientos_consorcio_inmobiliariaId_idx" ON "movimientos_consorcio"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "movimientos_consorcio_consorcioId_fecha_idx" ON "movimientos_consorcio"("consorcioId", "fecha");

-- CreateIndex
CREATE INDEX "asambleas_consorcio_inmobiliariaId_idx" ON "asambleas_consorcio"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "asambleas_consorcio_consorcioId_idx" ON "asambleas_consorcio"("consorcioId");

-- CreateIndex
CREATE INDEX "items_inventario_inmobiliariaId_idx" ON "items_inventario"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "items_inventario_consorcioId_idx" ON "items_inventario"("consorcioId");

-- CreateIndex
CREATE INDEX "movimientos_inventario_inmobiliariaId_idx" ON "movimientos_inventario"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "movimientos_inventario_itemId_idx" ON "movimientos_inventario"("itemId");

-- CreateIndex
CREATE INDEX "movimientos_inventario_consorcioId_idx" ON "movimientos_inventario"("consorcioId");

-- CreateIndex
CREATE INDEX "servicios_comunes_consorcio_inmobiliariaId_idx" ON "servicios_comunes_consorcio"("inmobiliariaId");

-- CreateIndex
CREATE UNIQUE INDEX "servicios_comunes_consorcio_consorcioId_tipo_key" ON "servicios_comunes_consorcio"("consorcioId", "tipo");

-- CreateIndex
CREATE INDEX "documentos_contrato_inmobiliariaId_idx" ON "documentos_contrato"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "documentos_contrato_contratoId_idx" ON "documentos_contrato"("contratoId");

-- CreateIndex
CREATE INDEX "inquilinos_invitados_inmobiliariaId_idx" ON "inquilinos_invitados"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "inquilinos_invitados_propiedadId_idx" ON "inquilinos_invitados"("propiedadId");

-- CreateIndex
CREATE INDEX "inquilinos_invitados_contratoId_idx" ON "inquilinos_invitados"("contratoId");

-- CreateIndex
CREATE INDEX "co_inquilinos_invitados_inmobiliariaId_idx" ON "co_inquilinos_invitados"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "co_inquilinos_invitados_invitadoId_idx" ON "co_inquilinos_invitados"("invitadoId");

-- CreateIndex
CREATE INDEX "documentos_adjuntos_invitado_inmobiliariaId_idx" ON "documentos_adjuntos_invitado"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "documentos_adjuntos_invitado_invitadoId_idx" ON "documentos_adjuntos_invitado"("invitadoId");

-- CreateIndex
CREATE INDEX "anuncios_inmobiliariaId_enviadoAt_idx" ON "anuncios"("inmobiliariaId", "enviadoAt");

-- CreateIndex
CREATE INDEX "anuncios_acuses_inmobiliariaId_idx" ON "anuncios_acuses"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "anuncios_acuses_inquilinoId_idx" ON "anuncios_acuses"("inquilinoId");

-- CreateIndex
CREATE UNIQUE INDEX "anuncios_acuses_anuncioId_inquilinoId_key" ON "anuncios_acuses"("anuncioId", "inquilinoId");

-- CreateIndex
CREATE INDEX "boletas_servicio_inmobiliariaId_idx" ON "boletas_servicio"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "boletas_servicio_contratoId_periodo_idx" ON "boletas_servicio"("contratoId", "periodo");

-- CreateIndex
CREATE INDEX "servicios_publicos_inmobiliariaId_idx" ON "servicios_publicos"("inmobiliariaId");

-- CreateIndex
CREATE UNIQUE INDEX "servicios_publicos_propiedadId_tipo_key" ON "servicios_publicos"("propiedadId", "tipo");

-- CreateIndex
CREATE INDEX "chat_mensajes_inmobiliariaId_idx" ON "chat_mensajes"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "chat_mensajes_contratoId_createdAt_idx" ON "chat_mensajes"("contratoId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "slots_documento_inmobiliariaId_codigo_key" ON "slots_documento"("inmobiliariaId", "codigo");

-- CreateIndex
CREATE INDEX "documentos_inmobiliariaId_idx" ON "documentos"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "documentos_inquilinoId_idx" ON "documentos"("inquilinoId");

-- CreateIndex
CREATE INDEX "documentos_slotId_idx" ON "documentos"("slotId");

-- CreateIndex
CREATE UNIQUE INDEX "certificados_inquilino_hash_key" ON "certificados_inquilino"("hash");

-- CreateIndex
CREATE INDEX "certificados_inquilino_inmobiliariaId_idx" ON "certificados_inquilino"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "certificados_inquilino_inquilinoId_idx" ON "certificados_inquilino"("inquilinoId");

-- CreateIndex
CREATE INDEX "certificados_inquilino_contratoId_idx" ON "certificados_inquilino"("contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "inmobiliarias_codigoReferido_key" ON "inmobiliarias"("codigoReferido");

-- CreateIndex
CREATE UNIQUE INDEX "inquilinos_contratoId_key" ON "inquilinos"("contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "inquilinos_inmobiliariaId_email_key" ON "inquilinos"("inmobiliariaId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_inmobiliariaId_email_key" ON "usuarios"("inmobiliariaId", "email");

-- AddForeignKey
ALTER TABLE "aprobaciones" ADD CONSTRAINT "aprobaciones_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprobaciones" ADD CONSTRAINT "aprobaciones_cargadoPorId_fkey" FOREIGN KEY ("cargadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprobaciones" ADD CONSTRAINT "aprobaciones_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_auditoria" ADD CONSTRAINT "eventos_auditoria_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_auditoria" ADD CONSTRAINT "eventos_auditoria_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_otp" ADD CONSTRAINT "codigos_otp_inquilinoId_fkey" FOREIGN KEY ("inquilinoId") REFERENCES "inquilinos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_piloto" ADD CONSTRAINT "reportes_piloto_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_piloto" ADD CONSTRAINT "reportes_piloto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trials" ADD CONSTRAINT "trials_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sociedades" ADD CONSTRAINT "sociedades_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupones_aplicados" ADD CONSTRAINT "cupones_aplicados_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupones_aplicados" ADD CONSTRAINT "cupones_aplicados_cuponCodigo_fkey" FOREIGN KEY ("cuponCodigo") REFERENCES "cupones"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referidos" ADD CONSTRAINT "referidos_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propietarios" ADD CONSTRAINT "propietarios_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arca_configs" ADD CONSTRAINT "arca_configs_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arca_configs" ADD CONSTRAINT "arca_configs_propietarioId_fkey" FOREIGN KEY ("propietarioId") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_cobranza_directa" ADD CONSTRAINT "cuentas_cobranza_directa_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_cobranza_directa" ADD CONSTRAINT "cuentas_cobranza_directa_propietarioId_fkey" FOREIGN KEY ("propietarioId") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_contratoActualId_fkey" FOREIGN KEY ("contratoActualId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_sociedadId_fkey" FOREIGN KEY ("sociedadId") REFERENCES "sociedades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_consorcioId_fkey" FOREIGN KEY ("consorcioId") REFERENCES "consorcios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participaciones_propietario" ADD CONSTRAINT "participaciones_propietario_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participaciones_propietario" ADD CONSTRAINT "participaciones_propietario_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participaciones_propietario" ADD CONSTRAINT "participaciones_propietario_propietarioId_fkey" FOREIGN KEY ("propietarioId") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_sociedadId_fkey" FOREIGN KEY ("sociedadId") REFERENCES "sociedades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_cobraDirectoPropietarioId_fkey" FOREIGN KEY ("cobraDirectoPropietarioId") REFERENCES "propietarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_drafts" ADD CONSTRAINT "contrato_drafts_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_drafts" ADD CONSTRAINT "contrato_drafts_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquilinos" ADD CONSTRAINT "inquilinos_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garantes" ADD CONSTRAINT "garantes_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garantes" ADD CONSTRAINT "garantes_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co_inquilinos" ADD CONSTRAINT "co_inquilinos_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co_inquilinos" ADD CONSTRAINT "co_inquilinos_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screenings" ADD CONSTRAINT "screenings_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screenings" ADD CONSTRAINT "screenings_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "liquidaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_decididoPorId_fkey" FOREIGN KEY ("decididoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "liquidaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_contrato" ADD CONSTRAINT "eventos_contrato_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_contrato" ADD CONSTRAINT "eventos_contrato_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intenciones_renovacion" ADD CONSTRAINT "intenciones_renovacion_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intenciones_renovacion" ADD CONSTRAINT "intenciones_renovacion_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_rendicionId_fkey" FOREIGN KEY ("rendicionId") REFERENCES "rendiciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierres_caja" ADD CONSTRAINT "cierres_caja_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendiciones" ADD CONSTRAINT "rendiciones_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendiciones" ADD CONSTRAINT "rendiciones_propietarioId_fkey" FOREIGN KEY ("propietarioId") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_rendidos" ADD CONSTRAINT "gastos_rendidos_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_rendidos" ADD CONSTRAINT "gastos_rendidos_rendicionId_fkey" FOREIGN KEY ("rendicionId") REFERENCES "rendiciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos_pagados" ADD CONSTRAINT "cargos_pagados_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos_pagados" ADD CONSTRAINT "cargos_pagados_reclamoId_fkey" FOREIGN KEY ("reclamoId") REFERENCES "reclamos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos_pagados" ADD CONSTRAINT "cargos_pagados_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_feed" ADD CONSTRAINT "movimientos_feed_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_feed" ADD CONSTRAINT "movimientos_feed_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datos_bancarios" ADD CONSTRAINT "datos_bancarios_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proximos_cambios_bancarios" ADD CONSTRAINT "proximos_cambios_bancarios_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proximos_cambios_bancarios" ADD CONSTRAINT "proximos_cambios_bancarios_datosBancariosId_fkey" FOREIGN KEY ("datosBancariosId") REFERENCES "datos_bancarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumenes_bancarios" ADD CONSTRAINT "resumenes_bancarios_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_detectados" ADD CONSTRAINT "creditos_detectados_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_detectados" ADD CONSTRAINT "creditos_detectados_resumenBancarioId_fkey" FOREIGN KEY ("resumenBancarioId") REFERENCES "resumenes_bancarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesionales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamo_eventos" ADD CONSTRAINT "reclamo_eventos_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamo_eventos" ADD CONSTRAINT "reclamo_eventos_reclamoId_fkey" FOREIGN KEY ("reclamoId") REFERENCES "reclamos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profesionales" ADD CONSTRAINT "profesionales_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas_profesional" ADD CONSTRAINT "visitas_profesional_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas_profesional" ADD CONSTRAINT "visitas_profesional_reclamoId_fkey" FOREIGN KEY ("reclamoId") REFERENCES "reclamos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas_profesional" ADD CONSTRAINT "visitas_profesional_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesionales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confirmaciones_reclamo" ADD CONSTRAINT "confirmaciones_reclamo_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confirmaciones_reclamo" ADD CONSTRAINT "confirmaciones_reclamo_reclamoId_fkey" FOREIGN KEY ("reclamoId") REFERENCES "reclamos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings_reclamo" ADD CONSTRAINT "ratings_reclamo_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings_reclamo" ADD CONSTRAINT "ratings_reclamo_reclamoId_fkey" FOREIGN KEY ("reclamoId") REFERENCES "reclamos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consorcios" ADD CONSTRAINT "consorcios_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consorcios" ADD CONSTRAINT "consorcios_sociedadId_fkey" FOREIGN KEY ("sociedadId") REFERENCES "sociedades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_funcionales" ADD CONSTRAINT "unidades_funcionales_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_funcionales" ADD CONSTRAINT "unidades_funcionales_consorcioId_fkey" FOREIGN KEY ("consorcioId") REFERENCES "consorcios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_consorcio" ADD CONSTRAINT "movimientos_consorcio_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_consorcio" ADD CONSTRAINT "movimientos_consorcio_consorcioId_fkey" FOREIGN KEY ("consorcioId") REFERENCES "consorcios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asambleas_consorcio" ADD CONSTRAINT "asambleas_consorcio_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asambleas_consorcio" ADD CONSTRAINT "asambleas_consorcio_consorcioId_fkey" FOREIGN KEY ("consorcioId") REFERENCES "consorcios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_inventario" ADD CONSTRAINT "items_inventario_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_inventario" ADD CONSTRAINT "items_inventario_consorcioId_fkey" FOREIGN KEY ("consorcioId") REFERENCES "consorcios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items_inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_consorcioId_fkey" FOREIGN KEY ("consorcioId") REFERENCES "consorcios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_comunes_consorcio" ADD CONSTRAINT "servicios_comunes_consorcio_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_comunes_consorcio" ADD CONSTRAINT "servicios_comunes_consorcio_consorcioId_fkey" FOREIGN KEY ("consorcioId") REFERENCES "consorcios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_contrato" ADD CONSTRAINT "documentos_contrato_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_contrato" ADD CONSTRAINT "documentos_contrato_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquilinos_invitados" ADD CONSTRAINT "inquilinos_invitados_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquilinos_invitados" ADD CONSTRAINT "inquilinos_invitados_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquilinos_invitados" ADD CONSTRAINT "inquilinos_invitados_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co_inquilinos_invitados" ADD CONSTRAINT "co_inquilinos_invitados_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co_inquilinos_invitados" ADD CONSTRAINT "co_inquilinos_invitados_invitadoId_fkey" FOREIGN KEY ("invitadoId") REFERENCES "inquilinos_invitados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_adjuntos_invitado" ADD CONSTRAINT "documentos_adjuntos_invitado_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_adjuntos_invitado" ADD CONSTRAINT "documentos_adjuntos_invitado_invitadoId_fkey" FOREIGN KEY ("invitadoId") REFERENCES "inquilinos_invitados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anuncios" ADD CONSTRAINT "anuncios_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anuncios_acuses" ADD CONSTRAINT "anuncios_acuses_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anuncios_acuses" ADD CONSTRAINT "anuncios_acuses_anuncioId_fkey" FOREIGN KEY ("anuncioId") REFERENCES "anuncios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anuncios_acuses" ADD CONSTRAINT "anuncios_acuses_inquilinoId_fkey" FOREIGN KEY ("inquilinoId") REFERENCES "inquilinos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boletas_servicio" ADD CONSTRAINT "boletas_servicio_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boletas_servicio" ADD CONSTRAINT "boletas_servicio_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_publicos" ADD CONSTRAINT "servicios_publicos_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_publicos" ADD CONSTRAINT "servicios_publicos_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_mensajes" ADD CONSTRAINT "chat_mensajes_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_mensajes" ADD CONSTRAINT "chat_mensajes_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slots_documento" ADD CONSTRAINT "slots_documento_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_inquilinoId_fkey" FOREIGN KEY ("inquilinoId") REFERENCES "inquilinos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "slots_documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados_inquilino" ADD CONSTRAINT "certificados_inquilino_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados_inquilino" ADD CONSTRAINT "certificados_inquilino_inquilinoId_fkey" FOREIGN KEY ("inquilinoId") REFERENCES "inquilinos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados_inquilino" ADD CONSTRAINT "certificados_inquilino_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

