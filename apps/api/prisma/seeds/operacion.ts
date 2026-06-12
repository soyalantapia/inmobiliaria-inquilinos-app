/**
 * Seeds Fase 4 — Operación: reclamos + timeline, red de profesionales,
 * consorcios (con unidades funcionales, movimientos y asambleas) e
 * intenciones de renovación.
 *
 * Porta los mocks del front con IDS EXACTOS (rec_*, prof_*, cnsr_*, uf_*,
 * mvc_*, asm_*) para que la demo se vea idéntica con datos reales:
 *   - apps/inmobiliaria/src/lib/mock-data.ts (reclamosMock, profesionalesAdminMock, intencionesRenovacionMock)
 *   - apps/inmobiliaria/src/lib/consorcios-storage.ts (consorciosMock)
 *
 * Idempotente (upserts). Requiere seedBase corrido antes (contratos cnt_*,
 * propiedades prp_*, sociedades soc_*).
 */
import type { PrismaClient } from '@prisma/client';

export async function seedOperacion(prisma: PrismaClient, tid: string) {
  // ===== Profesionales (profesionalesAdminMock) =====
  const profesionales = [
    { id: 'prof_001', nombre: 'Sergio Almeida', categoria: 'PLOMERO' as const, zona: 'Palermo, Villa Crespo', telefono: '+54 9 11 4421 8830', email: 'sergio.almeida@plomeria.ar', rating: 4.8, cantTrabajos: 24, ultimoTrabajo: '2026-04-30', verificado: true, notas: 'Llega en el día, factura A', activo: true },
    { id: 'prof_002', nombre: 'Diego Ferrari', categoria: 'ELECTRICISTA' as const, zona: 'Palermo, Recoleta', telefono: '+54 9 11 6502 7714', email: 'diego@ferrari-elec.com.ar', rating: 4.9, cantTrabajos: 31, ultimoTrabajo: '2026-05-02', verificado: true, notas: 'Matriculado, presupuesto sin cargo', activo: true },
    { id: 'prof_003', nombre: 'Luciana Pérez', categoria: 'GASISTA' as const, zona: 'CABA', telefono: '+54 9 11 5567 2118', email: null, rating: 4.7, cantTrabajos: 18, ultimoTrabajo: '2026-03-14', verificado: true, notas: 'Matriculada ENARGAS', activo: true },
    { id: 'prof_004', nombre: 'Pablo Cerrajería 24hs', categoria: 'CERRAJERO' as const, zona: 'CABA, GBA Norte', telefono: '+54 9 11 3399 4422', email: null, rating: 4.6, cantTrabajos: 12, ultimoTrabajo: '2026-02-21', verificado: true, notas: null, activo: true },
    { id: 'prof_005', nombre: 'Camila Torres', categoria: 'PINTOR' as const, zona: 'Palermo, Belgrano', telefono: '+54 9 11 4488 1107', email: 'camila.t@gmail.com', rating: 4.5, cantTrabajos: 9, ultimoTrabajo: '2026-01-18', verificado: false, notas: 'Especializada en interiores', activo: true },
    { id: 'prof_006', nombre: 'Frío Pro AA', categoria: 'TECNICO_AC' as const, zona: 'CABA', telefono: '+54 9 11 6678 9921', email: 'contacto@friopro.com.ar', rating: 4.7, cantTrabajos: 22, ultimoTrabajo: '2026-04-12', verificado: true, notas: 'Service split y central', activo: true },
    { id: 'prof_007', nombre: 'Mudanzas Soto', categoria: 'FLETE' as const, zona: 'AMBA', telefono: '+54 9 11 5432 1198', email: null, rating: 4.4, cantTrabajos: 7, ultimoTrabajo: '2025-12-08', verificado: false, notas: 'Camión chico y mediano', activo: true },
  ];
  for (const p of profesionales) {
    const { ultimoTrabajo, ...resto } = p;
    await prisma.profesional.upsert({
      where: { id: p.id },
      update: {},
      create: { ...resto, inmobiliariaId: tid, ultimoTrabajo: ultimoTrabajo ? new Date(ultimoTrabajo) : null },
    });
  }

  // ===== Reclamos + timeline (reclamosMock) =====
  // `inquilino` y `direccion` del mock eran denormalizados: acá salen de
  // contrato.inquilinoTitular y propiedad. propiedadId se deriva del contrato.
  const reclamos = [
    {
      id: 'rec_001', contratoId: 'cnt_001', propiedadId: 'prp_001', categoria: 'PLOMERIA' as const,
      descripcion: 'Pierde la canilla del baño desde anoche. Goteo constante.',
      urgencia: 'MEDIA' as const, estado: 'ABIERTO' as const, asignadoA: null, fotoUrl: null,
      resolucion: null, createdAt: '2026-05-09T14:32:00-03:00', resueltoAt: null,
      eventos: [
        { id: 'ev_001_1', tipo: 'CREADO' as const, autor: 'Mariela Sosa', contenido: null, fecha: '2026-05-09T14:32:00-03:00' },
      ],
    },
    {
      id: 'rec_002', contratoId: 'cnt_003', propiedadId: 'prp_003', categoria: 'CALEFACCION' as const,
      descripcion: 'No prende la caldera. Hace 2 días sin agua caliente.',
      urgencia: 'ALTA' as const, estado: 'EN_CURSO' as const, asignadoA: 'Sergio Almeida', fotoUrl: null,
      resolucion: null, createdAt: '2026-05-08T09:15:00-03:00', resueltoAt: null,
      eventos: [
        { id: 'ev_002_1', tipo: 'CREADO' as const, autor: 'Laura Giménez', contenido: null, fecha: '2026-05-08T09:15:00-03:00' },
        { id: 'ev_002_2', tipo: 'ASIGNADO' as const, autor: 'Roberto Tapia', contenido: 'Sergio Almeida', fecha: '2026-05-08T11:20:00-03:00' },
        { id: 'ev_002_3', tipo: 'MENSAJE_INMO' as const, autor: 'Sergio Almeida', contenido: 'Hola Laura, te paso a visitar mañana entre 10 y 12 con el gasista. ¿Estás?', fecha: '2026-05-08T11:35:00-03:00' },
        { id: 'ev_002_4', tipo: 'MENSAJE_INQUILINO' as const, autor: 'Laura Giménez', contenido: 'Sí, te espero. Gracias!', fecha: '2026-05-08T12:10:00-03:00' },
        { id: 'ev_002_5', tipo: 'EN_CURSO' as const, autor: 'Sergio Almeida', contenido: 'Pasó el gasista, hay que cambiar termocupla. Volvemos mañana.', fecha: '2026-05-09T13:00:00-03:00' },
      ],
    },
    {
      // Carlos Romero — EMERGENCIA Electricidad, SLA 6h vencido hace rato.
      id: 'rec_003', contratoId: 'cnt_004', propiedadId: 'prp_004', categoria: 'ELECTRICIDAD' as const,
      descripcion: 'Saltó el térmico de la cocina. Probé reset y no anda.',
      urgencia: 'EMERGENCIA' as const, estado: 'ABIERTO' as const, asignadoA: null, fotoUrl: null,
      resolucion: null, createdAt: '2026-05-09T18:42:00-03:00', resueltoAt: null,
      eventos: [
        { id: 'ev_003_1', tipo: 'CREADO' as const, autor: 'Carlos Romero', contenido: null, fecha: '2026-05-09T18:42:00-03:00' },
      ],
    },
    {
      id: 'rec_004', contratoId: 'cnt_005', propiedadId: 'prp_005', categoria: 'CERRADURA' as const,
      descripcion: 'La cerradura del balcón está dura. Dificultad para abrir.',
      urgencia: 'BAJA' as const, estado: 'EN_CURSO' as const, asignadoA: 'Luciana Vidal', fotoUrl: null,
      resolucion: null, createdAt: '2026-05-06T11:00:00-03:00', resueltoAt: null,
      eventos: [
        { id: 'ev_004_1', tipo: 'CREADO' as const, autor: 'Ana Pereyra', contenido: null, fecha: '2026-05-06T11:00:00-03:00' },
        { id: 'ev_004_2', tipo: 'ASIGNADO' as const, autor: 'Roberto Tapia', contenido: 'Luciana Vidal', fecha: '2026-05-07T09:00:00-03:00' },
      ],
    },
    {
      id: 'rec_005', contratoId: 'cnt_002', propiedadId: 'prp_002', categoria: 'OTRO' as const,
      descripcion: 'El portero eléctrico tiene interferencia.',
      urgencia: 'BAJA' as const, estado: 'RESUELTO' as const, asignadoA: 'Sergio Almeida', fotoUrl: null,
      resolucion: 'Se cambió el módulo del portero. Funciona OK.',
      createdAt: '2026-05-03T16:20:00-03:00', resueltoAt: '2026-05-05T10:30:00-03:00',
      eventos: [
        { id: 'ev_005_1', tipo: 'CREADO' as const, autor: 'Juan Pérez', contenido: null, fecha: '2026-05-03T16:20:00-03:00' },
        { id: 'ev_005_2', tipo: 'ASIGNADO' as const, autor: 'Roberto Tapia', contenido: 'Sergio Almeida', fecha: '2026-05-04T08:30:00-03:00' },
        { id: 'ev_005_3', tipo: 'RESUELTO' as const, autor: 'Sergio Almeida', contenido: 'Se cambió el módulo del portero. Funciona OK.', fecha: '2026-05-05T10:30:00-03:00' },
      ],
    },
    {
      id: 'rec_006', contratoId: 'cnt_001', propiedadId: 'prp_001', categoria: 'PLOMERIA' as const,
      descripcion: 'Inodoro con pérdida en la base.',
      urgencia: 'MEDIA' as const, estado: 'RESUELTO' as const, asignadoA: 'Sergio Almeida', fotoUrl: null,
      resolucion: 'Cambio de empaque y silicona perimetral. Sin filtraciones.',
      createdAt: '2026-04-28T13:00:00-03:00', resueltoAt: '2026-04-30T17:00:00-03:00',
      eventos: [
        { id: 'ev_006_1', tipo: 'CREADO' as const, autor: 'Mariela Sosa', contenido: null, fecha: '2026-04-28T13:00:00-03:00' },
        { id: 'ev_006_2', tipo: 'ASIGNADO' as const, autor: 'Roberto Tapia', contenido: 'Sergio Almeida', fecha: '2026-04-28T15:00:00-03:00' },
        { id: 'ev_006_3', tipo: 'EN_CURSO' as const, autor: 'Sergio Almeida', contenido: 'Voy mañana 10am con plomero.', fecha: '2026-04-29T18:00:00-03:00' },
        { id: 'ev_006_4', tipo: 'RESUELTO' as const, autor: 'Sergio Almeida', contenido: 'Cambio de empaque y silicona perimetral. Sin filtraciones.', fecha: '2026-04-30T17:00:00-03:00' },
      ],
    },
  ];
  for (const r of reclamos) {
    const { eventos, createdAt, resueltoAt, ...resto } = r;
    await prisma.reclamo.upsert({
      where: { id: r.id },
      update: {},
      create: {
        ...resto,
        inmobiliariaId: tid,
        createdAt: new Date(createdAt),
        resueltoAt: resueltoAt ? new Date(resueltoAt) : null,
      },
    });
    for (const ev of eventos) {
      const { fecha, ...evResto } = ev;
      await prisma.reclamoEvento.upsert({
        where: { id: ev.id },
        update: {},
        create: { ...evResto, inmobiliariaId: tid, reclamoId: r.id, fecha: new Date(fecha) },
      });
    }
  }

  // ===== Consorcios (consorciosMock) =====
  const consorcios = [
    {
      id: 'cnsr_001', nombre: 'Consorcio Gorriti 4521', direccion: 'Gorriti 4521, Palermo, CABA',
      cantUf: 12, sociedadId: 'soc_001', encargado: { nombre: 'Carlos Domínguez', sueldo: 480000 },
      periodoActual: '2026-05', expensasPeriodoActual: 2840000, desde: '2022-03-10',
    },
    {
      id: 'cnsr_002', nombre: 'Consorcio Cabildo 2890', direccion: 'Av. Cabildo 2890, Belgrano, CABA',
      // V2b-01 del front: cantUf alineado a las unidades reales (4).
      cantUf: 4, sociedadId: 'soc_002', encargado: { nombre: 'Roberto Sosa', sueldo: 520000 },
      periodoActual: '2026-05', expensasPeriodoActual: 5180000, desde: '2020-11-05',
    },
  ];
  for (const c of consorcios) {
    const { desde, ...resto } = c;
    await prisma.consorcio.upsert({
      where: { id: c.id },
      update: {},
      create: { ...resto, inmobiliariaId: tid, desde: new Date(desde) },
    });
  }

  // Unidades funcionales
  const unidades = [
    // cnsr_001 — Gorriti 4521
    { id: 'uf_001', consorcioId: 'cnsr_001', identificacion: '1° A', titular: 'Mariana Vega', coeficiente: 8.2, telefono: '+54 9 11 4567 8901', estado: 'AL_DIA' as const, saldoDeudor: 0, cargoFijo: null, serviciosUf: { luz: { nis: '7821990-4', medidor: 'E0012387' }, gas: { nis: '07-9981234-1', medidor: 'M0021908' } } },
    { id: 'uf_002', consorcioId: 'cnsr_001', identificacion: '1° B', titular: 'Eduardo Castro', coeficiente: 7.8, telefono: '+54 9 11 4567 8902', estado: 'AL_DIA' as const, saldoDeudor: 0, cargoFijo: 185000, serviciosUf: { luz: { nis: '7821990-5', medidor: 'E0012388' } } },
    { id: 'uf_003', consorcioId: 'cnsr_001', identificacion: '2° A', titular: 'Silvana Morales', coeficiente: 9.0, telefono: '+54 9 11 4567 8903', estado: 'PENDIENTE' as const, saldoDeudor: 245000, cargoFijo: null, serviciosUf: null },
    { id: 'uf_004', consorcioId: 'cnsr_001', identificacion: '2° B', titular: 'Federico López', coeficiente: 8.5, telefono: '+54 9 11 4567 8904', estado: 'VENCIDO' as const, saldoDeudor: 540000, cargoFijo: null, serviciosUf: null },
    { id: 'uf_005', consorcioId: 'cnsr_001', identificacion: '3° A', titular: 'Patricia Iglesias', coeficiente: 9.0, telefono: '+54 9 351 4321 9876', estado: 'CON_PLAN_PAGO' as const, saldoDeudor: 380000, cargoFijo: null, serviciosUf: null },
    { id: 'uf_006', consorcioId: 'cnsr_001', identificacion: '3° B', titular: 'Martín Bravo', coeficiente: 8.4, telefono: '+54 9 11 4567 8906', estado: 'AL_DIA' as const, saldoDeudor: 0, cargoFijo: null, serviciosUf: null },
    { id: 'uf_007', consorcioId: 'cnsr_001', identificacion: '4° A', titular: 'Roberto Tapia', coeficiente: 9.2, telefono: '+54 9 11 4567 8907', estado: 'AL_DIA' as const, saldoDeudor: 0, cargoFijo: null, serviciosUf: null },
    { id: 'uf_008', consorcioId: 'cnsr_001', identificacion: '4° B', titular: 'Laura Giménez', coeficiente: 8.8, telefono: '+54 9 11 4567 8908', estado: 'AL_DIA' as const, saldoDeudor: 0, cargoFijo: null, serviciosUf: null },
    { id: 'uf_009', consorcioId: 'cnsr_001', identificacion: '5° A', titular: 'Diego Pereyra', coeficiente: 9.0, telefono: '+54 9 11 4567 8909', estado: 'PENDIENTE' as const, saldoDeudor: 232000, cargoFijo: null, serviciosUf: null },
    { id: 'uf_010', consorcioId: 'cnsr_001', identificacion: '5° B', titular: 'Carla Rossi', coeficiente: 8.6, telefono: '+54 9 11 4567 8910', estado: 'AL_DIA' as const, saldoDeudor: 0, cargoFijo: null, serviciosUf: null },
    { id: 'uf_011', consorcioId: 'cnsr_001', identificacion: 'PB', titular: 'Comercial Casona SRL', coeficiente: 7.5, telefono: '+54 11 4123 5678', estado: 'AL_DIA' as const, saldoDeudor: 0, cargoFijo: null, serviciosUf: null },
    { id: 'uf_012', consorcioId: 'cnsr_001', identificacion: 'Local 1', titular: 'Almacén Don Pepe', coeficiente: 6.0, telefono: '+54 11 4123 5679', estado: 'AL_DIA' as const, saldoDeudor: 0, cargoFijo: null, serviciosUf: null },
    // cnsr_002 — Cabildo 2890
    { id: 'uf_101', consorcioId: 'cnsr_002', identificacion: '1° A', titular: 'Juan Pérez', coeficiente: 4.1, telefono: '+54 9 11 5511 2233', estado: 'AL_DIA' as const, saldoDeudor: 0, cargoFijo: null, serviciosUf: null },
    { id: 'uf_102', consorcioId: 'cnsr_002', identificacion: '1° B', titular: 'Lucía Méndez', coeficiente: 4.0, telefono: '+54 9 11 5511 2234', estado: 'AL_DIA' as const, saldoDeudor: 0, cargoFijo: null, serviciosUf: null },
    { id: 'uf_103', consorcioId: 'cnsr_002', identificacion: '2° A', titular: 'Mario Russo', coeficiente: 4.3, telefono: '+54 9 11 5511 2235', estado: 'VENCIDO' as const, saldoDeudor: 712000, cargoFijo: null, serviciosUf: null },
    { id: 'uf_104', consorcioId: 'cnsr_002', identificacion: '2° B', titular: 'Inversiones del Plata SA', coeficiente: 4.5, telefono: '+54 11 4567 8901', estado: 'AL_DIA' as const, saldoDeudor: 0, cargoFijo: null, serviciosUf: null },
  ];
  for (const uf of unidades) {
    const { serviciosUf, ...resto } = uf;
    await prisma.unidadFuncional.upsert({
      where: { id: uf.id },
      update: {},
      create: { ...resto, inmobiliariaId: tid, serviciosUf: serviciosUf ?? undefined },
    });
  }

  // Movimientos (positivo = cobranza, negativo = egreso)
  const movimientos = [
    { id: 'mvc_001', consorcioId: 'cnsr_001', fecha: '2026-05-05', concepto: 'Cobranza expensas mayo · UF 1°A', monto: 232880, categoria: 'COBRANZA' as const },
    { id: 'mvc_002', consorcioId: 'cnsr_001', fecha: '2026-05-06', concepto: 'Cobranza expensas mayo · UF 1°B', monto: 221520, categoria: 'COBRANZA' as const },
    { id: 'mvc_003', consorcioId: 'cnsr_001', fecha: '2026-05-08', concepto: 'Sueldo encargado · Carlos D. · mayo', monto: -480000, categoria: 'SUELDO' as const },
    { id: 'mvc_004', consorcioId: 'cnsr_001', fecha: '2026-05-09', concepto: 'Service ascensor Otis · mantenimiento mensual', monto: -68000, categoria: 'MANTENIMIENTO' as const },
    { id: 'mvc_005', consorcioId: 'cnsr_001', fecha: '2026-05-10', concepto: 'Edenor · febrero', monto: -135000, categoria: 'SERVICIO' as const },
    { id: 'mvc_006', consorcioId: 'cnsr_001', fecha: '2026-05-12', concepto: 'Cobranza expensas mayo · UF 3°B', monto: 238560, categoria: 'COBRANZA' as const },
    { id: 'mvc_007', consorcioId: 'cnsr_001', fecha: '2026-05-15', concepto: 'Limpieza por contrato · Pulpis SRL', monto: -180000, categoria: 'MANTENIMIENTO' as const },
    { id: 'mvc_201', consorcioId: 'cnsr_002', fecha: '2026-05-08', concepto: 'Sueldo encargado · Roberto S. · mayo', monto: -520000, categoria: 'SUELDO' as const },
    { id: 'mvc_202', consorcioId: 'cnsr_002', fecha: '2026-05-10', concepto: 'AySA · marzo', monto: -210000, categoria: 'SERVICIO' as const },
    { id: 'mvc_203', consorcioId: 'cnsr_002', fecha: '2026-05-12', concepto: 'Pintura escaleras · obra menor', monto: -380000, categoria: 'MANTENIMIENTO' as const },
    { id: 'mvc_204', consorcioId: 'cnsr_002', fecha: '2026-05-15', concepto: 'Cobranza expensas mayo · varios UFs', monto: 3140000, categoria: 'COBRANZA' as const },
  ];
  for (const m of movimientos) {
    const { fecha, ...resto } = m;
    await prisma.movimientoConsorcio.upsert({
      where: { id: m.id },
      update: {},
      create: { ...resto, inmobiliariaId: tid, fecha: new Date(fecha) },
    });
  }

  // Asambleas
  const asambleas = [
    { id: 'asm_001', consorcioId: 'cnsr_001', fecha: '2026-04-15', tipo: 'ORDINARIA' as const, asunto: 'Aprobación balance anual + presupuesto 2026', asistentes: 9, acuerdoPrincipal: 'Se aprobó el balance del ejercicio. Aumento de 25% en expensas a partir de mayo.' },
    { id: 'asm_002', consorcioId: 'cnsr_001', fecha: '2026-02-20', tipo: 'EXTRAORDINARIA' as const, asunto: 'Reparación de techo + obra de impermeabilización', asistentes: 11, acuerdoPrincipal: 'Se contrata a Impermeable SRL por $4.200.000. Pago en 4 cuotas con cuota extraordinaria a las UF.' },
    { id: 'asm_201', consorcioId: 'cnsr_002', fecha: '2026-03-22', tipo: 'ORDINARIA' as const, asunto: 'Plan anual + renovación administración', asistentes: 18, acuerdoPrincipal: 'Se renueva el contrato de administración con Inmobiliaria del Sol por 2 años más.' },
  ];
  for (const a of asambleas) {
    const { fecha, ...resto } = a;
    await prisma.asambleaConsorcio.upsert({
      where: { id: a.id },
      update: {},
      create: { ...resto, inmobiliariaId: tid, fecha: new Date(fecha) },
    });
  }

  // ===== Intenciones de renovación (intencionesRenovacionMock) =====
  const intenciones = [
    { id: 'intr_001', contratoId: 'cnt_001', decision: 'SIN_RESPUESTA' as const, comentario: null, decididoAt: null },
    { id: 'intr_002', contratoId: 'cnt_002', decision: 'RENOVAR' as const, comentario: 'Quiero el mismo plazo y discutir el monto con la inmobiliaria.', decididoAt: '2026-04-22T10:00:00-03:00' },
    { id: 'intr_003', contratoId: 'cnt_003', decision: 'PENSANDO' as const, comentario: 'Tengo que ver con mi pareja si nos mudamos a un depto más grande.', decididoAt: '2026-05-02T18:30:00-03:00' },
    { id: 'intr_004', contratoId: 'cnt_004', decision: 'NO_RENOVAR' as const, comentario: 'Nos compramos casa, gracias por estos años.', decididoAt: '2026-03-15T09:15:00-03:00' },
    { id: 'intr_005', contratoId: 'cnt_005', decision: 'SIN_RESPUESTA' as const, comentario: null, decididoAt: null },
  ];
  for (const i of intenciones) {
    const { decididoAt, ...resto } = i;
    await prisma.intencionRenovacion.upsert({
      where: { contratoId: i.contratoId },
      update: {},
      create: { ...resto, inmobiliariaId: tid, decididoAt: decididoAt ? new Date(decididoAt) : null },
    });
  }
}
