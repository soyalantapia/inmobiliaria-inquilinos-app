/**
 * Seeds idempotentes: portan los mocks del front (ids EXACTOS: cnt_001,
 * prp_001, own_001…) para que la demo se vea idéntica con datos reales.
 * Corre con `pnpm --filter api seed`, tras `migrate reset`, y desde tests.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedOperacion } from './seeds/operacion.js';
import { seedAnuncios } from './seeds/anuncios.js';
import { seedInquilinoMundo } from './seeds/inquilinoMundo.js';

const PASSWORD_DEV = 'delsol123';
const PIN_DEV = '1234';

export async function seedBase(prisma: PrismaClient) {
  // ===== Tenant =====
  const existente = await prisma.inmobiliaria.findFirst({ where: { nombre: 'Inmobiliaria del Sol' } });
  const inmobiliaria =
    existente ??
    (await prisma.inmobiliaria.create({
      data: {
        nombre: 'Inmobiliaria del Sol',
        cuit: '30-71234567-1',
        email: 'contacto@inmosol.com.ar',
        telefono: '+54 11 4532 1100',
        matricula: 'CUCICBA 5872',
        direccionCalle: 'Av. Santa Fe',
        direccionAltura: '2890',
        direccionPiso: '5°B',
        direccionCiudad: 'CABA',
        direccionProvincia: 'Buenos Aires',
        direccionCp: '1425',
        esPiloto: true,
        codigoReferido: 'DELSOL-2026',
      },
    }));
  const tid = inmobiliaria.id;

  // ===== Usuarios del panel =====
  const passwordHash = bcrypt.hashSync(PASSWORD_DEV, 10);
  const pinHash = bcrypt.hashSync(PIN_DEV, 10);
  const usuarios = [
    { email: 'roberto@delsol.com', nombre: 'Roberto', apellido: 'Tapia', rol: 'ADMIN' as const },
    { email: 'luciana@delsol.com', nombre: 'Luciana', apellido: 'Vidal', rol: 'OPERADOR' as const },
    { email: 'camila@delsol.com', nombre: 'Camila', apellido: 'Acosta', rol: 'CARGA' as const },
  ];
  await Promise.all(usuarios.map((u) =>
    prisma.usuario.upsert({
      where: { inmobiliariaId_email: { inmobiliariaId: tid, email: u.email } },
      update: { nombre: u.nombre, apellido: u.apellido, rol: u.rol },
      create: { ...u, inmobiliariaId: tid, passwordHash, pinHash },
    }),
  ));

  // ===== Sociedades =====
  const sociedades = [
    {
      id: 'soc_001', razonSocial: 'Inmobiliaria del Sol S.R.L.', nombreComercial: 'Inmobiliaria del Sol',
      cuit: '30-71234567-8', condicionFiscal: 'RESPONSABLE_INSCRIPTO' as const,
      domicilioFiscal: 'Av. Santa Fe 2890, 5°B, CABA', email: 'contacto@inmosol.com.ar', telefono: '+54 11 4532 1100',
      cuentaCobranza: { banco: 'Banco Galicia', titular: 'Inmobiliaria del Sol S.R.L.', cbu: '0070100120000018273645', alias: 'delsol.cobranzas', cuit: '30-71234567-8' },
      afip: { conectado: true, puntoVenta: '0003', tipoComprobante: 'FACTURA_B', conectadoDesde: '2025-03-12' },
      esPrincipal: true,
    },
    {
      id: 'soc_002', razonSocial: 'Sol Comercial S.A.', nombreComercial: 'Sol Comercial',
      cuit: '30-72345678-9', condicionFiscal: 'RESPONSABLE_INSCRIPTO' as const,
      domicilioFiscal: 'Av. Santa Fe 2890, 5°B, CABA', email: 'admin@solcomercial.com.ar', telefono: '+54 11 4532 1100',
      cuentaCobranza: { banco: 'Banco Macro', titular: 'Sol Comercial S.A.', cbu: '2850001230094523456789', alias: 'solcomercial.cob', cuit: '30-72345678-9' },
      afip: { conectado: true, puntoVenta: '0001', tipoComprobante: 'FACTURA_A', conectadoDesde: '2025-06-20' },
      esPrincipal: false,
    },
    {
      id: 'soc_003', razonSocial: 'Fideicomiso Iglesias - Castro', nombreComercial: 'Fideicomiso I-C',
      cuit: '33-71456789-2', condicionFiscal: 'EXENTO' as const,
      domicilioFiscal: 'Av. Santa Fe 2890, 5°B, CABA', email: 'fideicomiso@inmosol.com.ar', telefono: '+54 11 4532 1100',
      cuentaCobranza: undefined, afip: { conectado: false }, esPrincipal: false,
    },
  ];
  await Promise.all(sociedades.map((s) =>
    prisma.sociedad.upsert({ where: { id: s.id }, update: {}, create: { ...s, inmobiliariaId: tid } }),
  ));

  // ===== Propietarios =====
  const propietarios = [
    { id: 'own_001', nombre: 'Eduardo', apellido: 'Castro', cuit: '20-12345678-2', email: 'eduardo.castro@gmail.com', telefono: '+54 11 4789 1234', cbuAlias: 'castro.eduardo.cuenta', comisionPct: 8, notas: 'Pide rendición los días 10 de cada mes. Prefiere WhatsApp.' },
    { id: 'own_002', nombre: 'Silvana', apellido: 'Morales', cuit: '27-23456789-3', email: 'silvana.morales@hotmail.com', telefono: '+54 11 5234 8765', cbuAlias: 'morales.silvana.mp', comisionPct: 7, notas: null },
    { id: 'own_003', nombre: 'Federico', apellido: 'López Vega', cuit: '20-34567890-4', email: 'fedelopezvega@gmail.com', telefono: '+54 11 6677 2211', cbuAlias: null, comisionPct: 8, notas: 'Sin CBU cargado — no podemos rendirle hasta que lo pase.' },
    { id: 'own_004', nombre: 'Patricia', apellido: 'Iglesias', cuit: '27-45678901-5', email: 'patricia.iglesias@yahoo.com', telefono: '+54 11 4455 9988', cbuAlias: 'iglesias.cobro', comisionPct: 6.5, notas: 'Cobra directo (fideicomiso familiar).' },
    { id: 'own_005', nombre: 'Martín', apellido: 'Bravo', cuit: '20-56789012-6', email: 'martin.bravo@gmail.com', telefono: '+54 11 3322 1144', cbuAlias: 'bravo.martin.usd', comisionPct: 8, notas: 'Inmueble en USD; cobra en pesos al MEP.' },
  ];
  await Promise.all(propietarios.map((p) =>
    prisma.propietario.upsert({ where: { id: p.id }, update: {}, create: { ...p, inmobiliariaId: tid } }),
  ));

  // ===== Propiedades =====
  const propiedades = [
    { id: 'prp_001', direccion: 'Gorriti 4521, 3°B', ciudad: 'Palermo, CABA', provincia: 'Buenos Aires', tipo: 'DEPARTAMENTO' as const, ambientes: 2, m2: 48, estado: 'ALQUILADA' as const, sociedadId: 'soc_001' },
    { id: 'prp_002', direccion: 'Av. Cabildo 2890, 7°A', ciudad: 'Belgrano, CABA', provincia: 'Buenos Aires', tipo: 'DEPARTAMENTO' as const, ambientes: 3, m2: 72, estado: 'ALQUILADA' as const, sociedadId: 'soc_001' },
    { id: 'prp_003', direccion: 'Jorge Newbery 1820', ciudad: 'Colegiales, CABA', provincia: 'Buenos Aires', tipo: 'CASA' as const, ambientes: 4, m2: 130, estado: 'ALQUILADA' as const, sociedadId: 'soc_001' },
    { id: 'prp_004', direccion: 'Honduras 4490, PB', ciudad: 'Palermo, CABA', provincia: 'Buenos Aires', tipo: 'LOCAL' as const, ambientes: null, m2: 95, estado: 'ALQUILADA' as const, sociedadId: 'soc_002' },
    { id: 'prp_005', direccion: 'Salguero 2240, 12°D', ciudad: 'Palermo, CABA', provincia: 'Buenos Aires', tipo: 'DEPARTAMENTO' as const, ambientes: 3, m2: 80, estado: 'ALQUILADA' as const, sociedadId: 'soc_003' },
    { id: 'prp_006', direccion: 'Olleros 3920', ciudad: 'Las Cañitas, CABA', provincia: 'Buenos Aires', tipo: 'DEPARTAMENTO' as const, ambientes: 2, m2: 55, estado: 'EN_EDICION' as const, sociedadId: 'soc_001' },
  ];
  await Promise.all(propiedades.map((p) =>
    prisma.propiedad.upsert({ where: { id: p.id }, update: {}, create: { ...p, inmobiliariaId: tid } }),
  ));

  // Participaciones (cotitularidad)
  const participaciones = [
    { propiedadId: 'prp_001', propietarioId: 'own_001', porcentaje: 60 },
    { propiedadId: 'prp_001', propietarioId: 'own_002', porcentaje: 40 },
    { propiedadId: 'prp_002', propietarioId: 'own_002', porcentaje: 100 },
    { propiedadId: 'prp_003', propietarioId: 'own_003', porcentaje: 100 },
    { propiedadId: 'prp_004', propietarioId: 'own_002', porcentaje: 100 },
    { propiedadId: 'prp_005', propietarioId: 'own_004', porcentaje: 100 },
    { propiedadId: 'prp_006', propietarioId: 'own_005', porcentaje: 100 },
  ];
  for (const pp of participaciones) {
    const ya = await prisma.participacionPropietario.findFirst({
      where: { propiedadId: pp.propiedadId, propietarioId: pp.propietarioId },
    });
    if (!ya) await prisma.participacionPropietario.create({ data: { ...pp, inmobiliariaId: tid } });
  }

  // ===== Contratos (ids exactos del mock) =====
  const contratos = [
    { id: 'cnt_001', propiedadId: 'prp_001', estado: 'ACTIVO' as const, monto: 480000, moneda: 'ARS' as const, fechaInicio: '2025-09-01', fechaFin: '2028-08-31', diaPago: 5, indiceAjuste: 'ICL' as const, frecuenciaAjusteMeses: 12, proximoAjuste: '2026-06-01', tipoContrato: 'ALQUILER' as const, cbuAlias: 'eduardo.lopez.gorriti', titularCuenta: 'Eduardo López Vega', comisionInmobiliaria: 4.17, depositoGarantia: 480000, tasaPunitorioDiaria: 0.001 },
    { id: 'cnt_002', propiedadId: 'prp_002', estado: 'ACTIVO' as const, monto: 620000, moneda: 'ARS' as const, fechaInicio: '2025-03-01', fechaFin: '2027-02-28', diaPago: 10, indiceAjuste: 'IPC' as const, frecuenciaAjusteMeses: 6, proximoAjuste: '2026-09-01', tipoContrato: 'ALQUILER' as const },
    { id: 'cnt_003', propiedadId: 'prp_003', estado: 'ACTIVO' as const, monto: 510000, moneda: 'ARS' as const, fechaInicio: '2024-11-01', fechaFin: '2026-10-31', diaPago: 5, indiceAjuste: 'ICL' as const, frecuenciaAjusteMeses: 12, proximoAjuste: '2026-11-01', tipoContrato: 'ALQUILER' as const },
    { id: 'cnt_004', propiedadId: 'prp_004', estado: 'ACTIVO' as const, monto: 720000, moneda: 'ARS' as const, fechaInicio: '2025-06-01', fechaFin: '2028-05-31', diaPago: 1, indiceAjuste: 'IPC' as const, frecuenciaAjusteMeses: 4, proximoAjuste: '2026-10-01', tipoContrato: 'ALQUILER' as const },
    { id: 'cnt_005', propiedadId: 'prp_005', estado: 'ACTIVO' as const, monto: 850000, moneda: 'ARS' as const, fechaInicio: '2025-12-01', fechaFin: '2027-11-30', diaPago: 5, indiceAjuste: 'CASA_PROPIA' as const, frecuenciaAjusteMeses: 6, proximoAjuste: '2026-12-01', tipoContrato: 'ALQUILER' as const, modoCobranza: 'PROPIETARIO_DIRECTO' as const, cobraDirectoPropietarioId: 'own_004' },
    { id: 'cnt_006', propiedadId: 'prp_006', estado: 'BORRADOR' as const, monto: 1200, moneda: 'USD' as const, fechaInicio: '2026-07-01', fechaFin: '2029-06-30', diaPago: 5, indiceAjuste: 'FIJO' as const, frecuenciaAjusteMeses: 12, tipoContrato: 'ALQUILER' as const, cargadoPor: 'Camila Acosta', cargadoRol: 'CARGA' as const, cargadoAt: '2026-05-22', pendienteAprobacion: true },
    { id: 'cnt_007', propiedadId: 'prp_002', estado: 'ACTIVO' as const, monto: 0, moneda: 'ARS' as const, fechaInicio: '2026-01-01', fechaFin: '2027-12-31', diaPago: 10, indiceAjuste: 'FIJO' as const, frecuenciaAjusteMeses: 12, tipoContrato: 'SOLO_EXPENSAS' as const, montoExpensas: 285000, cargadoPor: 'Camila Acosta', cargadoRol: 'CARGA' as const, aprobadoPor: 'Roberto Tapia' },
    { id: 'cnt_008', propiedadId: 'prp_006', estado: 'BORRADOR' as const, monto: 540000, moneda: 'ARS' as const, fechaInicio: '2026-07-01', fechaFin: '2028-06-30', diaPago: 5, indiceAjuste: 'ICL' as const, frecuenciaAjusteMeses: 12, tipoContrato: 'ALQUILER_Y_EXPENSAS' as const, montoExpensas: 110000, cargadoPor: 'Camila Acosta', cargadoRol: 'CARGA' as const, pendienteAprobacion: true },
  ];
  for (const c of contratos) {
    const { fechaInicio, fechaFin, proximoAjuste, cargadoAt, ...resto } = c;
    await prisma.contrato.upsert({
      where: { id: c.id },
      update: {},
      create: {
        ...resto,
        inmobiliariaId: tid,
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        proximoAjuste: proximoAjuste ? new Date(proximoAjuste) : null,
        cargadoAt: cargadoAt ? new Date(cargadoAt) : null,
      },
    });
  }
  // Puntero contratoActual de cada propiedad alquilada
  const punteros: Array<[string, string]> = [
    ['prp_001', 'cnt_001'], ['prp_002', 'cnt_002'], ['prp_003', 'cnt_003'],
    ['prp_004', 'cnt_004'], ['prp_005', 'cnt_005'],
  ];
  for (const [prp, cnt] of punteros) {
    await prisma.propiedad.update({ where: { id: prp }, data: { contratoActualId: cnt } });
  }

  // ===== Inquilinos (titulares 1:1 con su contrato) =====
  const inquilinos = [
    { email: 'mariela.sosa@gmail.com', nombre: 'Mariela', apellido: 'Sosa', telefono: '+5491145678900', dni: '32456789', contratoId: 'cnt_001' },
    { email: 'juan.perez@inquilino.demo', nombre: 'Juan', apellido: 'Pérez', contratoId: 'cnt_002' },
    { email: 'laura.gimenez@inquilino.demo', nombre: 'Laura', apellido: 'Giménez', contratoId: 'cnt_003' },
    { email: 'carlos.romero@inquilino.demo', nombre: 'Carlos', apellido: 'Romero', contratoId: 'cnt_004' },
    { email: 'ana.pereyra@inquilino.demo', nombre: 'Ana', apellido: 'Pereyra', contratoId: 'cnt_005' },
    { email: 'tomas.bravo@inquilino.demo', nombre: 'Tomás', apellido: 'Bravo', contratoId: 'cnt_006' },
    { email: 'lucia.fernandez@inquilino.demo', nombre: 'Lucía', apellido: 'Fernández', contratoId: 'cnt_008' },
  ];
  for (const i of inquilinos) {
    await prisma.inquilino.upsert({
      where: { inmobiliariaId_email: { inmobiliariaId: tid, email: i.email } },
      update: { nombre: i.nombre, apellido: i.apellido, contratoId: i.contratoId },
      create: { ...i, inmobiliariaId: tid },
    });
  }

  // ===== Fase 3 — La plata =====

  // Liquidaciones (estado del mock: Mariela y Laura vencidas, resto al día)
  const liqs = [
    { id: 'liq_001', contratoId: 'cnt_001', periodo: '2026-05', montoAlquiler: 480000, montoExpensas: 92000, montoTotal: 572000, fechaVencimiento: '2026-05-05', estado: 'VENCIDO' as const },
    { id: 'liq_002', contratoId: 'cnt_002', periodo: '2026-06', montoAlquiler: 620000, montoExpensas: null, montoTotal: 620000, fechaVencimiento: '2026-06-10', estado: 'PAGADO' as const, fechaPago: '2026-06-08', metodoPago: 'TRANSFERENCIA' as const },
    { id: 'liq_003', contratoId: 'cnt_003', periodo: '2026-06', montoAlquiler: 510000, montoExpensas: null, montoTotal: 510000, fechaVencimiento: '2026-06-02', estado: 'VENCIDO' as const },
    { id: 'liq_004', contratoId: 'cnt_004', periodo: '2026-06', montoAlquiler: 720000, montoExpensas: null, montoTotal: 720000, fechaVencimiento: '2026-06-01', estado: 'PAGADO' as const, fechaPago: '2026-06-01', metodoPago: 'TRANSFERENCIA' as const },
    { id: 'liq_005', contratoId: 'cnt_005', periodo: '2026-06', montoAlquiler: 850000, montoExpensas: null, montoTotal: 850000, fechaVencimiento: '2026-07-05', estado: 'PENDIENTE' as const },
    { id: 'liq_007', contratoId: 'cnt_007', periodo: '2026-06', montoAlquiler: 0, montoExpensas: 285000, montoTotal: 285000, fechaVencimiento: '2026-06-10', estado: 'PAGADO' as const, fechaPago: '2026-06-09', metodoPago: 'TRANSFERENCIA' as const },
  ];
  for (const l of liqs) {
    const { fechaVencimiento, fechaPago, ...resto } = l as typeof l & { fechaPago?: string };
    await prisma.liquidacion.upsert({
      where: { id: l.id },
      update: {},
      create: {
        ...resto,
        inmobiliariaId: tid,
        fechaVencimiento: new Date(fechaVencimiento),
        fechaPago: fechaPago ? new Date(fechaPago) : null,
      },
    });
  }

  // Pagos informados por inquilinos — la bandeja "a validar" del panel
  const pagos = [
    { id: 'pag_001', contratoId: 'cnt_005', liquidacionId: 'liq_005', periodo: '2026-06', monto: 850000, metodo: 'TRANSFERENCIA' as const, nroOperacion: 'TRF-882341', fechaTransferencia: '2026-06-10', notaInquilino: 'Transferí desde mi cuenta del Galicia.' },
    { id: 'pag_002', contratoId: 'cnt_001', liquidacionId: 'liq_001', periodo: '2026-05', monto: 572000, metodo: 'TRANSFERENCIA' as const, nroOperacion: 'TRF-901122', fechaTransferencia: '2026-06-11', notaInquilino: 'Pago de mayo completo, perdón la demora.' },
  ];
  for (const p of pagos) {
    const { fechaTransferencia, ...resto } = p;
    await prisma.pago.upsert({
      where: { id: p.id },
      update: {},
      create: { ...resto, inmobiliariaId: tid, fechaTransferencia: new Date(fechaTransferencia), montoLiqTotal: p.monto },
    });
  }

  // Caja de gastos (mock de /caja: 2 pendientes + 1 ya descontado en rendición)
  const rendicion = await prisma.rendicion.upsert({
    where: { propietarioId_periodo: { propietarioId: 'own_001', periodo: '2026-05' } },
    update: {},
    create: {
      id: 'ren_001',
      inmobiliariaId: tid,
      propietarioId: 'own_001',
      periodo: '2026-05',
      montoBruto: 288000, // 60% de $480.000 (participación en prp_001)
      comisionPct: 8,
      comisionMonto: 23040,
      totalGastos: 27000, // 60% de $45.000 (plomería)
      montoNeto: 237960,
      metodo: 'TRANSFERENCIA',
      notas: 'Rendición de mayo · Gorriti 4521 (60%)',
      rendidoAt: new Date('2026-05-10'),
    },
  });

  const movimientos = [
    { id: 'mov_001', propiedadId: 'prp_001', contratoId: 'cnt_001', categoria: 'PLOMERIA' as const, descripcion: 'Reparación pérdida cocina', monto: 45000, fecha: '2026-04-30', proveedor: 'Sergio Almeida (plomero)', cargadoPor: 'Roberto Tapia', descontadoEnRendicion: true, rendicionId: rendicion.id },
    { id: 'mov_002', propiedadId: 'prp_004', contratoId: 'cnt_004', categoria: 'EXPENSAS' as const, descripcion: 'Expensa extraordinaria — fachada', monto: 62000, fecha: '2026-05-02', proveedor: 'Consorcio', cargadoPor: 'Roberto Tapia', descontadoEnRendicion: false },
    { id: 'mov_003', propiedadId: 'prp_002', contratoId: 'cnt_002', categoria: 'ELECTRICIDAD' as const, descripcion: 'Cambio de térmica del tablero', monto: 28500, fecha: '2026-05-04', proveedor: 'Diego Ferrari (electricista)', cargadoPor: 'Luciana Vidal', descontadoEnRendicion: false },
  ];
  for (const m of movimientos) {
    const { fecha, ...resto } = m;
    await prisma.movimientoCaja.upsert({
      where: { id: m.id },
      update: {},
      create: { ...resto, inmobiliariaId: tid, tipo: 'GASTO', fecha: new Date(fecha) },
    });
  }

  // GastoRendido snapshot de la rendición seed
  const yaGasto = await prisma.gastoRendido.findFirst({ where: { rendicionId: rendicion.id } });
  if (!yaGasto) {
    await prisma.gastoRendido.create({
      data: {
        inmobiliariaId: tid,
        rendicionId: rendicion.id,
        refId: 'mov_001',
        tipo: 'CAJA',
        fecha: new Date('2026-04-30'),
        descripcion: 'Reparación pérdida cocina',
        proveedor: 'Sergio Almeida (plomero)',
        monto: 27000,
        montoTotal: 45000,
        participacion: 60,
        propiedadId: 'prp_001',
        direccion: 'Gorriti 4521, 3°B',
      },
    });
  }

  // Aprobaciones pendientes (NO-monetarias; sin PAGO_MANUAL por diseño)
  const camila = await prisma.usuario.findFirst({ where: { inmobiliariaId: tid, email: 'camila@delsol.com' } });
  const luciana = await prisma.usuario.findFirst({ where: { inmobiliariaId: tid, email: 'luciana@delsol.com' } });
  if (camila && luciana) {
    const aprobaciones = [
      { id: 'apr_seed_1', tipo: 'CONTRATO_CARGADO' as const, titulo: 'Tomás Bravo · Olleros 3920', descripcion: 'Contrato en dólares · 36 meses · cargado para revisión', entidadId: 'cnt_006', cargadoPorId: camila.id, rolAutor: 'CARGA' as const, cargadoAt: '2026-05-22T16:18:00-03:00', notas: 'Verificá las cláusulas 4ª y 7ª (firmadas hoy a la mañana con el propietario).' },
      { id: 'apr_seed_3', tipo: 'DEVOLUCION_DEPOSITO' as const, titulo: 'Devolución depósito · Laura Giménez', descripcion: 'Cierre de contrato anticipado · contrato cnt_003', monto: 510000, entidadId: 'cnt_003', cargadoPorId: luciana.id, rolAutor: 'OPERADOR' as const, cargadoAt: '2026-05-23T11:05:00-03:00', notas: 'Acta de inspección OK · descontamos $42.000 por pintura.' },
    ];
    for (const a of aprobaciones) {
      const { cargadoAt, ...resto } = a;
      await prisma.aprobacion.upsert({
        where: { id: a.id },
        update: {},
        create: { ...resto, inmobiliariaId: tid, cargadoAt: new Date(cargadoAt) },
      });
    }
  }

  // ===== Dominios (Fases 4-6) =====
  await seedOperacion(prisma, tid);
  await seedAnuncios(prisma, tid);
  await seedInquilinoMundo(prisma, tid);

  return { inmobiliariaId: tid };
}

// Runner CLI
const esRunner = process.argv[1]?.endsWith('seed.ts');
if (esRunner) {
  // El seed demo (Inmobiliaria del Sol) NO debe correr en producción. Para una
  // inmobiliaria real usar scripts/onboarding-real.mjs. (Belt & suspenders: el
  // Dockerfile sólo corre `migrate deploy`, no este seed.)
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    console.error('✗ seed demo bloqueado en NODE_ENV=production. Usá scripts/onboarding-real.mjs para datos reales (o --force si de verdad querés sembrar la demo).');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  seedBase(prisma)
    .then(({ inmobiliariaId }) => {
      console.log(`✓ seeds aplicados (tenant ${inmobiliariaId})`);
      return prisma.$disconnect();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
