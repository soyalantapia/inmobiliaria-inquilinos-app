/**
 * Seeds Fase 6 — Mundo inquilino. Upserts idempotentes con los IDS EXACTOS
 * de los mocks del front:
 *   - BoletaServicio: bol-seed-1/2/3 (apps/inquilino/src/lib/boletas-servicios-storage.ts)
 *   - ServicioPublico: prp_001 LUZ/GAS/AGUA/ABL (apps/inmobiliaria/src/lib/servicios-publicos-storage.ts,
 *     sin ids en el mock → upsert por la unique [propiedadId, tipo])
 *   - SlotDocumento: los 7 slots de SLOTS_DOCUMENTOS (apps/inquilino/src/lib/documentos-storage.ts,
 *     el id del mock es el `codigo` del modelo → upsert por [inmobiliariaId, codigo])
 *   - Screening: scr_001 = screeningMock (Carlos Eduardo Méndez) de
 *     apps/inmobiliaria/src/lib/mock-data.ts (el mock no tiene id; scr_001 es decisión nuestra)
 * Co-inquilinos, certificados y reportes piloto NO se seedean: sus stores mock
 * arrancan vacíos / se generan on-demand.
 */
import type { PrismaClient } from '@prisma/client';

const PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export async function seedInquilinoMundo(prisma: PrismaClient, tid: string) {
  // ===== Boletas de servicios (contrato de Mariela) =====
  const boletas = [
    {
      id: 'bol-seed-1', contratoId: 'cnt_001', tipo: 'LUZ' as const, periodo: '2026-04',
      monto: 32400, vencimiento: '2026-05-08', estado: 'PAGADA' as const,
      nombreArchivo: 'Edesur-Abril-2026.pdf', tipoMime: 'application/pdf', tamanioBytes: 184230,
      subidoAt: '2026-04-30T11:24:00.000Z', pagadoAt: '2026-05-07T09:00:00.000Z',
    },
    {
      id: 'bol-seed-2', contratoId: 'cnt_001', tipo: 'GAS' as const, periodo: '2026-04',
      monto: 18900, vencimiento: '2026-05-12', estado: 'PAGADA' as const,
      nombreArchivo: 'Metrogas-Abr.pdf', tipoMime: 'application/pdf', tamanioBytes: 142100,
      subidoAt: '2026-04-28T15:11:00.000Z', pagadoAt: '2026-05-05T10:30:00.000Z',
    },
    {
      id: 'bol-seed-3', contratoId: 'cnt_001', tipo: 'LUZ' as const, periodo: '2026-05',
      monto: 34200, vencimiento: '2026-06-08', estado: 'SUBIDA' as const,
      nombreArchivo: 'Edesur-mayo.jpg', tipoMime: 'image/jpeg', tamanioBytes: 421120,
      subidoAt: '2026-05-20T14:08:00.000Z', pagadoAt: null,
    },
  ];
  for (const b of boletas) {
    const { vencimiento, subidoAt, pagadoAt, ...resto } = b;
    await prisma.boletaServicio.upsert({
      where: { id: b.id },
      update: {},
      create: {
        ...resto,
        inmobiliariaId: tid,
        vencimiento: new Date(vencimiento),
        subidoAt: new Date(subidoAt),
        pagadoAt: pagadoAt ? new Date(pagadoAt) : null,
        archivoUrl: PLACEHOLDER,
      },
    });
  }

  // ===== Servicios públicos de prp_001 (Gorriti 4521, 3°B) =====
  const servicios = [
    {
      tipo: 'LUZ' as const, distribuidora: 'Edesur', nis: '7841029-3', numeroMedidor: 'A21458732',
      titular: 'Mariela Sosa', consumoPromedioMensual: 28000,
      observaciones: 'Tarifa residencial categoría N2 · sin tarifa social.',
    },
    {
      tipo: 'GAS' as const, distribuidora: 'Metrogas', nis: '07-1234567-0', numeroMedidor: 'M0099812',
      titular: 'Mariela Sosa', consumoPromedioMensual: 12500, observaciones: null,
    },
    {
      tipo: 'AGUA' as const, distribuidora: 'AySA', nis: '8801244-001', numeroMedidor: null,
      titular: 'Consorcio Gorriti 4521', consumoPromedioMensual: null,
      observaciones: 'Va por expensas — no se factura al inquilino.',
    },
    {
      tipo: 'ABL' as const, distribuidora: 'GCBA · Rentas CABA', nis: '021-456789-012', numeroMedidor: null,
      titular: 'Roberto Iglesias', consumoPromedioMensual: null, observaciones: 'A cargo del propietario.',
    },
  ];
  for (const s of servicios) {
    await prisma.servicioPublico.upsert({
      where: { propiedadId_tipo: { propiedadId: 'prp_001', tipo: s.tipo } },
      update: {},
      create: { ...s, inmobiliariaId: tid, propiedadId: 'prp_001' },
    });
  }

  // ===== Slots de documentos (checklist que la inmo espera del inquilino) =====
  const slots = [
    { codigo: 'dni-frente', categoria: 'IDENTIDAD' as const, titulo: 'DNI · frente', descripcion: 'Foto del frente del DNI, legible y vigente.', requerido: true },
    { codigo: 'dni-dorso', categoria: 'IDENTIDAD' as const, titulo: 'DNI · dorso', descripcion: 'Foto del dorso del DNI, con código de barras visible.', requerido: true },
    { codigo: 'recibo-1', categoria: 'INGRESOS' as const, titulo: 'Recibo de sueldo · último mes', descripcion: 'PDF firmado o foto del recibo más reciente.', requerido: true },
    { codigo: 'recibo-2', categoria: 'INGRESOS' as const, titulo: 'Recibo de sueldo · anterior', descripcion: 'El del mes inmediatamente anterior.', requerido: true },
    { codigo: 'cert-laboral', categoria: 'INGRESOS' as const, titulo: 'Certificación laboral', descripcion: 'Carta de RR.HH. con antigüedad y remuneración.', requerido: false },
    { codigo: 'garante-escritura', categoria: 'GARANTE' as const, titulo: 'Escritura del garante', descripcion: 'Copia simple del título de propiedad.', requerido: true },
    { codigo: 'garante-recibo', categoria: 'GARANTE' as const, titulo: 'Recibo de sueldo del garante', descripcion: 'El último recibo del garante.', requerido: true },
  ];
  for (const slot of slots) {
    await prisma.slotDocumento.upsert({
      where: { inmobiliariaId_codigo: { inmobiliariaId: tid, codigo: slot.codigo } },
      update: { titulo: slot.titulo, descripcion: slot.descripcion, requerido: slot.requerido },
      create: { ...slot, inmobiliariaId: tid },
    });
  }

  // ===== Screening completo (screeningMock: Carlos Eduardo Méndez) =====
  await prisma.screening.upsert({
    where: { id: 'scr_001' },
    update: {},
    create: {
      id: 'scr_001',
      inmobiliariaId: tid,
      estado: 'COMPLETO',
      cuit: '20-31256789-0',
      dni: '31.256.789',
      nombre: 'Carlos Eduardo',
      apellido: 'Méndez',
      fechaNacimiento: new Date('1985-04-22'),
      sexo: 'M',
      domicilio: {
        calle: 'Av. Rivadavia', altura: '6420', pisoDpto: '8°C', codigoPostal: '1406',
        localidad: 'Caballito', partido: 'CABA', provincia: 'Buenos Aires',
      },
      telefonos: [
        { numero: '+54 11 4631 5870', tipo: 'FIJO', whatsappActivo: false },
        { numero: '+54 9 11 5234 7891', tipo: 'CELULAR', whatsappActivo: true },
        { numero: '+54 9 11 6789 1234', tipo: 'CELULAR', whatsappActivo: true },
        { numero: '+54 9 11 3456 7890', tipo: 'CELULAR', whatsappActivo: false },
      ],
      email: 'carlos.mendez@gmail.com',
      bcra: {
        entidadesCount: 4, deudaTomada: 1850000, deudaEnMora: 0, riesgo: 'bajo',
        situaciones: { 1: 4 },
        entidades: [
          { codigo: '0007', nombre: 'Banco Galicia', deuda: 980000 },
          { codigo: '0011', nombre: 'Banco Nación', deuda: 520000 },
          { codigo: '0017', nombre: 'BBVA Argentina', deuda: 240000 },
          { codigo: '0072', nombre: 'Banco Patagonia', deuda: 110000 },
        ],
        deudaUltimos24m: true,
      },
      cheques: { rechazadosCount: 0, rechazadosMonto: 0, levantadosCount: 2, levantadosMonto: 350000 },
      familia: [
        { vinculo: 'CONYUGE', nombreCompleto: 'María Laura Fernández', telefonos: [{ numero: '+54 9 11 5678 1234', tipo: 'CELULAR', whatsappActivo: true }], email: 'mlaura.fernandez@gmail.com' },
        { vinculo: 'HIJO', nombreCompleto: 'Tomás Méndez', telefonos: [], email: null },
        { vinculo: 'HIJO', nombreCompleto: 'Sofía Méndez', telefonos: [], email: null },
        { vinculo: 'PADRE_MADRE', nombreCompleto: 'Roberto Méndez', telefonos: [{ numero: '+54 11 4234 5678', tipo: 'FIJO', whatsappActivo: false }, { numero: '+54 9 11 4111 2222', tipo: 'CELULAR', whatsappActivo: true }], email: 'roberto.mendez@yahoo.com.ar' },
        { vinculo: 'HERMANO', nombreCompleto: 'Mariana Méndez', telefonos: [{ numero: '+54 9 11 3322 1144', tipo: 'CELULAR', whatsappActivo: true }], email: 'mariana.mendez@hotmail.com' },
      ],
      rangoIngresoFamiliar: 'A5',
      bcraFamiliar: {
        entidadesCount: 7, deudaTomada: 2840000, deudaEnMora: 180000, riesgo: 'medio',
        situaciones: { 1: 5, 2: 2 },
        entidades: [
          { codigo: '0007', nombre: 'Banco Galicia', deuda: 1450000 },
          { codigo: '0072', nombre: 'Banco Patagonia', deuda: 620000 },
          { codigo: '0011', nombre: 'Banco Nación', deuda: 580000 },
          { codigo: '0044', nombre: 'Banco Hipotecario', deuda: 190000 },
        ],
        deudaUltimos24m: true,
      },
      inmuebles: [
        { partidoCatastral: 'CABA 12-23-4', ubicacion: 'Av. Rivadavia 6420 8°C — Caballito, CABA', tipo: 'DEPARTAMENTO', fechaAdquisicion: '2018-03-15' },
        { partidoCatastral: 'BA 053-12-89', ubicacion: 'Lote 12 — Country Las Praderas, Pilar', tipo: 'TERRENO', fechaAdquisicion: '2021-11-08' },
      ],
      vehiculos: [
        { marca: 'Toyota', modelo: 'Corolla Cross XEI', anio: 2023, fechaCompra: '2023-06-10', patente: 'AC842PQ' },
        { marca: 'Renault', modelo: 'Sandero 1.6', anio: 2017, fechaCompra: '2017-09-22', patente: 'AB129XR' },
      ],
      ingresos: {
        categoriaArca: 'RELACION_DEPENDENCIA', impuestoGanancias: 'AC', impuestoIva: 'NA',
        integranteSocietario: false, empleador: false, ciiu: '620100',
        actividadDescripcion: 'Servicios de consultores en informática y suministros de programas',
        obraSocialCodigo: '203500', obraSocialNombre: 'OSDE — Organización de Servicios Directos Empresarios',
        nominaUltimos6m: [
          { periodo: '2026-04', rangoIngreso: 'A6', fechaPago: '2026-05-05' },
          { periodo: '2026-03', rangoIngreso: 'A6', fechaPago: '2026-04-05' },
          { periodo: '2026-02', rangoIngreso: 'A6', fechaPago: '2026-03-05' },
          { periodo: '2026-01', rangoIngreso: 'A5', fechaPago: '2026-02-05' },
          { periodo: '2025-12', rangoIngreso: 'A6', fechaPago: '2026-01-05' },
          { periodo: '2025-11', rangoIngreso: 'A5', fechaPago: '2025-12-05' },
        ],
      },
      empleador: {
        cuit: '30-71234567-9', razonSocial: 'Globant Argentina S.A.', ciiu: '620100',
        actividad: 'Servicios de consultores en informática',
        telefonos: ['+54 11 4014 4040', '+54 11 4014 4041'],
        email: 'rrhh@globant.com', paginaWeb: 'https://www.globant.com',
        tipoEmpresa: 'Sociedad Anónima', artVigente: true,
        bcra: {
          entidadesCount: 6, deudaTomada: 145000000, deudaEnMora: 0, riesgo: 'bajo',
          situaciones: { 1: 6 },
          entidades: [
            { codigo: '0007', nombre: 'Banco Galicia', deuda: 65000000 },
            { codigo: '0017', nombre: 'BBVA Argentina', deuda: 42000000 },
            { codigo: '0027', nombre: 'Banco Supervielle', deuda: 28000000 },
          ],
          deudaUltimos24m: true,
        },
      },
      vecinos: [
        { nombreCompleto: 'Andrea Pérez', telefono: '+54 9 11 5555 7890', direccion: 'Av. Rivadavia 6420 8°B' },
        { nombreCompleto: 'Diego Romano', telefono: '+54 9 11 4422 3311', direccion: 'Av. Rivadavia 6420 8°D' },
        { nombreCompleto: 'Encargado del edificio', telefono: '+54 9 11 3344 5566', direccion: 'Portería · Av. Rivadavia 6420' },
      ],
      huellaDigital: {
        scoreCoherencia: 'alta', antiguedadAnios: 14, mencionesGoogle: 12, emailEnSitios: 23,
        perfiles: [
          { plataforma: 'LINKEDIN', handle: 'carlos-mendez-globant', url: 'https://linkedin.com/in/carlos-mendez-globant', verificado: true, estado: 'ACTIVO', seguidores: 1840, ultimaActividad: '2026-05-08T14:32:00-03:00', notas: 'Senior Software Engineer en Globant desde 2019. Historial laboral coherente con la declaración. 6 recomendaciones.' },
          { plataforma: 'INSTAGRAM', handle: '@carlos.mendez85', url: 'https://instagram.com/carlos.mendez85', verificado: false, estado: 'ACTIVO', seguidores: 1247, ultimaActividad: '2026-05-09T20:14:00-03:00', notas: 'Cuenta personal. Fotos de viajes, familia y deporte. Sin contenido marcado.' },
          { plataforma: 'FACEBOOK', handle: 'carlos.mendez.eduardo', url: 'https://facebook.com/carlos.mendez.eduardo', verificado: false, estado: 'INACTIVO', seguidores: 432, ultimaActividad: '2024-08-12T10:00:00-03:00', notas: 'Cuenta vieja, sin actividad reciente. Foto de perfil pública.' },
          { plataforma: 'X', handle: '@cmendez_dev', url: 'https://x.com/cmendez_dev', verificado: false, estado: 'ACTIVO', seguidores: 320, ultimaActividad: '2026-04-22T11:05:00-03:00', notas: 'Comparte contenido técnico. Tono profesional.' },
          { plataforma: 'THREADS', handle: '@carlos.mendez85', url: 'https://threads.net/@carlos.mendez85', verificado: false, estado: 'INACTIVO', seguidores: 89, ultimaActividad: '2024-12-10T19:00:00-03:00', notas: null },
          { plataforma: 'TIKTOK', handle: null, url: null, verificado: false, estado: 'NO_ENCONTRADO', seguidores: null, ultimaActividad: null, notas: null },
          { plataforma: 'YOUTUBE', handle: null, url: null, verificado: false, estado: 'NO_ENCONTRADO', seguidores: null, ultimaActividad: null, notas: null },
          { plataforma: 'GOOGLE', handle: null, url: 'https://www.google.com/search?q=Carlos+Mendez+Globant', verificado: false, estado: 'ACTIVO', seguidores: null, ultimaActividad: null, notas: '12 menciones: 8 técnicas (charlas, blogs, repos GitHub), 4 de eventos comunitarios.' },
        ],
        hallazgos: [
          { tipo: 'positivo', texto: 'Identidad coherente cross-plataforma. LinkedIn confirma empleador y antigüedad declarados.' },
          { tipo: 'positivo', texto: 'Sin menciones a deshaucios, juicios o conflictos contractuales previos.' },
          { tipo: 'positivo', texto: 'Email aparece en 23 sitios públicos (GitHub, Meetup, Eventbrite) — patrón típico de perfil técnico profesional.' },
          { tipo: 'neutro', texto: 'Sin cuentas en TikTok o YouTube. Coherente con perfil profesional 40+.' },
        ],
      },
      scoreNosis: 742,
      recomendacion: 'APTO',
      recomendacionRazon:
        'Score Nosis 742 (alto). BCRA categoría 1 con 4 entidades, sin mora ni deuda en riesgo. Patrimonio sólido (2 inmuebles + 2 vehículos), antigüedad laboral en empresa grande con ART vigente. Ingresos formales estables últimos 6 meses (rango A5-A6). Grupo familiar con leve atraso (Sit 2) pero sin impacto material. Apto sin garantía adicional.',
    },
  });
}
