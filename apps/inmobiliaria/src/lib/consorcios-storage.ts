/**
 * Consorcios (administración de edificios bajo propiedad horizontal).
 *
 * Es un módulo paralelo al de alquileres: la inmobiliaria también
 * puede administrar consorcios. Cada consorcio agrupa N unidades
 * funcionales (UF) cuyos titulares pagan expensas comunes cada mes.
 * La inmo emite la liquidación, cobra a cada UF y rinde al consorcio
 * (sueldo del encargado, mantenimiento, etc.).
 *
 * En backend real esto es un dominio aparte (tablas Consorcio,
 * UnidadFuncional, ExpensaPeriodo, Movimiento, Asamblea). Acá lo
 * mockeamos con seeds.
 */

export type EstadoUF = 'AL_DIA' | 'PENDIENTE' | 'VENCIDO' | 'CON_PLAN_PAGO';

export interface UnidadFuncional {
  id: string;
  /** Identificación interna ("1°A", "PB 3", "Local 1"). */
  identificacion: string;
  titular: string;
  /** Coeficiente de copropiedad (suma de todos debe dar 100). */
  coeficiente: number;
  /** Teléfono del titular (WhatsApp). */
  telefono: string;
  estado: EstadoUF;
  /** Saldo deudor actual en $ (0 si está al día). */
  saldoDeudor: number;
  /**
   * Cargo fijo mensual de expensas. Si está presente sobreescribe el
   * cálculo por coeficiente. Pedido del feedback: "algunas unidades
   * pagan monto fijo, no porcentaje de la liquidación".
   */
  cargoFijo?: number;
  /** Datos técnicos de servicios por unidad (medidores y NIS). */
  serviciosUf?: {
    luz?: { nis: string; medidor?: string };
    gas?: { nis: string; medidor?: string };
    agua?: { nis: string; medidor?: string };
  };
}

export interface MovimientoConsorcio {
  id: string;
  fecha: string;
  concepto: string;
  /** Si es positivo es ingreso (cobranza UF), negativo es egreso. */
  monto: number;
  categoria:
    | 'COBRANZA'
    | 'SUELDO'
    | 'MANTENIMIENTO'
    | 'SERVICIO'
    | 'IMPUESTO'
    | 'OTRO';
}

export interface AsambleaConsorcio {
  id: string;
  fecha: string;
  tipo: 'ORDINARIA' | 'EXTRAORDINARIA';
  asunto: string;
  asistentes: number;
  acuerdoPrincipal: string;
}

export interface Consorcio {
  id: string;
  nombre: string;
  direccion: string;
  /** Cantidad de unidades funcionales. */
  cantUf: number;
  /** Sociedad de la inmo que lo administra. */
  sociedadId?: string;
  /** Encargado contratado. */
  encargado: { nombre: string; sueldo: number } | null;
  /** Periodo actual liquidado (YYYY-MM). */
  periodoActual: string;
  /** Total de expensas del periodo actual. */
  expensasPeriodoActual: number;
  /** Unidades funcionales del edificio. */
  unidades: UnidadFuncional[];
  movimientos: MovimientoConsorcio[];
  asambleas: AsambleaConsorcio[];
  /** Fecha de incorporación a la administración. */
  desde: string;
}

/* ============================================================
 * Seeds
 * ============================================================ */

export const consorciosMock: Consorcio[] = [
  {
    id: 'cnsr_001',
    nombre: 'Consorcio Gorriti 4521',
    direccion: 'Gorriti 4521, Palermo, CABA',
    cantUf: 12,
    sociedadId: 'soc_001',
    encargado: { nombre: 'Carlos Domínguez', sueldo: 480000 },
    periodoActual: '2026-05',
    expensasPeriodoActual: 2840000,
    unidades: [
      {
        id: 'uf_001',
        identificacion: '1° A',
        titular: 'Mariana Vega',
        coeficiente: 8.2,
        telefono: '+54 9 11 4567 8901',
        estado: 'AL_DIA',
        saldoDeudor: 0,
        serviciosUf: {
          luz: { nis: '7821990-4', medidor: 'E0012387' },
          gas: { nis: '07-9981234-1', medidor: 'M0021908' },
        },
      },
      {
        id: 'uf_002',
        identificacion: '1° B',
        titular: 'Eduardo Castro',
        coeficiente: 7.8,
        telefono: '+54 9 11 4567 8902',
        estado: 'AL_DIA',
        saldoDeudor: 0,
        // Caso de monto fijo (acuerdo especial con el propietario).
        cargoFijo: 185000,
        serviciosUf: {
          luz: { nis: '7821990-5', medidor: 'E0012388' },
        },
      },
      {
        id: 'uf_003',
        identificacion: '2° A',
        titular: 'Silvana Morales',
        coeficiente: 9.0,
        telefono: '+54 9 11 4567 8903',
        estado: 'PENDIENTE',
        saldoDeudor: 245000,
      },
      {
        id: 'uf_004',
        identificacion: '2° B',
        titular: 'Federico López',
        coeficiente: 8.5,
        telefono: '+54 9 11 4567 8904',
        estado: 'VENCIDO',
        saldoDeudor: 540000,
      },
      {
        id: 'uf_005',
        identificacion: '3° A',
        titular: 'Patricia Iglesias',
        coeficiente: 9.0,
        telefono: '+54 9 351 4321 9876',
        estado: 'CON_PLAN_PAGO',
        saldoDeudor: 380000,
      },
      {
        id: 'uf_006',
        identificacion: '3° B',
        titular: 'Martín Bravo',
        coeficiente: 8.4,
        telefono: '+54 9 11 4567 8906',
        estado: 'AL_DIA',
        saldoDeudor: 0,
      },
      {
        id: 'uf_007',
        identificacion: '4° A',
        titular: 'Roberto Tapia',
        coeficiente: 9.2,
        telefono: '+54 9 11 4567 8907',
        estado: 'AL_DIA',
        saldoDeudor: 0,
      },
      {
        id: 'uf_008',
        identificacion: '4° B',
        titular: 'Laura Giménez',
        coeficiente: 8.8,
        telefono: '+54 9 11 4567 8908',
        estado: 'AL_DIA',
        saldoDeudor: 0,
      },
      {
        id: 'uf_009',
        identificacion: '5° A',
        titular: 'Diego Pereyra',
        coeficiente: 9.0,
        telefono: '+54 9 11 4567 8909',
        estado: 'PENDIENTE',
        saldoDeudor: 232000,
      },
      {
        id: 'uf_010',
        identificacion: '5° B',
        titular: 'Carla Rossi',
        coeficiente: 8.6,
        telefono: '+54 9 11 4567 8910',
        estado: 'AL_DIA',
        saldoDeudor: 0,
      },
      {
        id: 'uf_011',
        identificacion: 'PB',
        titular: 'Comercial Casona SRL',
        coeficiente: 7.5,
        telefono: '+54 11 4123 5678',
        estado: 'AL_DIA',
        saldoDeudor: 0,
      },
      {
        id: 'uf_012',
        identificacion: 'Local 1',
        titular: 'Almacén Don Pepe',
        coeficiente: 6.0,
        telefono: '+54 11 4123 5679',
        estado: 'AL_DIA',
        saldoDeudor: 0,
      },
    ],
    movimientos: [
      {
        id: 'mvc_001',
        fecha: '2026-05-05',
        concepto: 'Cobranza expensas mayo · UF 1°A',
        monto: 232880,
        categoria: 'COBRANZA',
      },
      {
        id: 'mvc_002',
        fecha: '2026-05-06',
        concepto: 'Cobranza expensas mayo · UF 1°B',
        monto: 221520,
        categoria: 'COBRANZA',
      },
      {
        id: 'mvc_003',
        fecha: '2026-05-08',
        concepto: 'Sueldo encargado · Carlos D. · mayo',
        monto: -480000,
        categoria: 'SUELDO',
      },
      {
        id: 'mvc_004',
        fecha: '2026-05-09',
        concepto: 'Service ascensor Otis · mantenimiento mensual',
        monto: -68000,
        categoria: 'MANTENIMIENTO',
      },
      {
        id: 'mvc_005',
        fecha: '2026-05-10',
        concepto: 'Edenor · febrero',
        monto: -135000,
        categoria: 'SERVICIO',
      },
      {
        id: 'mvc_006',
        fecha: '2026-05-12',
        concepto: 'Cobranza expensas mayo · UF 3°B',
        monto: 238560,
        categoria: 'COBRANZA',
      },
      {
        id: 'mvc_007',
        fecha: '2026-05-15',
        concepto: 'Limpieza por contrato · Pulpis SRL',
        monto: -180000,
        categoria: 'MANTENIMIENTO',
      },
    ],
    asambleas: [
      {
        id: 'asm_001',
        fecha: '2026-04-15',
        tipo: 'ORDINARIA',
        asunto: 'Aprobación balance anual + presupuesto 2026',
        asistentes: 9,
        acuerdoPrincipal:
          'Se aprobó el balance del ejercicio. Aumento de 25% en expensas a partir de mayo.',
      },
      {
        id: 'asm_002',
        fecha: '2026-02-20',
        tipo: 'EXTRAORDINARIA',
        asunto: 'Reparación de techo + obra de impermeabilización',
        asistentes: 11,
        acuerdoPrincipal:
          'Se contrata a Impermeable SRL por $4.200.000. Pago en 4 cuotas con cuota extraordinaria a las UF.',
      },
    ],
    desde: '2022-03-10',
  },
  {
    id: 'cnsr_002',
    nombre: 'Consorcio Cabildo 2890',
    direccion: 'Av. Cabildo 2890, Belgrano, CABA',
    // V2b-01: antes 24, pero el array `unidades` tiene 4 entradas reales —
    // el badge decía "24 UF" mientras el ratio "al día" y la deuda se
    // calculaban sobre 4 ("3/4", "1 con deuda"). Alineado a las unidades
    // reales para que todos los números del consorcio cuadren.
    cantUf: 4,
    sociedadId: 'soc_002',
    encargado: { nombre: 'Roberto Sosa', sueldo: 520000 },
    periodoActual: '2026-05',
    expensasPeriodoActual: 5180000,
    unidades: [
      {
        id: 'uf_101',
        identificacion: '1° A',
        titular: 'Juan Pérez',
        coeficiente: 4.1,
        telefono: '+54 9 11 5511 2233',
        estado: 'AL_DIA',
        saldoDeudor: 0,
      },
      {
        id: 'uf_102',
        identificacion: '1° B',
        titular: 'Lucía Méndez',
        coeficiente: 4.0,
        telefono: '+54 9 11 5511 2234',
        estado: 'AL_DIA',
        saldoDeudor: 0,
      },
      {
        id: 'uf_103',
        identificacion: '2° A',
        titular: 'Mario Russo',
        coeficiente: 4.3,
        telefono: '+54 9 11 5511 2235',
        estado: 'VENCIDO',
        saldoDeudor: 712000,
      },
      {
        id: 'uf_104',
        identificacion: '2° B',
        titular: 'Inversiones del Plata SA',
        coeficiente: 4.5,
        telefono: '+54 11 4567 8901',
        estado: 'AL_DIA',
        saldoDeudor: 0,
      },
    ],
    movimientos: [
      {
        id: 'mvc_201',
        fecha: '2026-05-08',
        concepto: 'Sueldo encargado · Roberto S. · mayo',
        monto: -520000,
        categoria: 'SUELDO',
      },
      {
        id: 'mvc_202',
        fecha: '2026-05-10',
        concepto: 'AySA · marzo',
        monto: -210000,
        categoria: 'SERVICIO',
      },
      {
        id: 'mvc_203',
        fecha: '2026-05-12',
        concepto: 'Pintura escaleras · obra menor',
        monto: -380000,
        categoria: 'MANTENIMIENTO',
      },
      {
        id: 'mvc_204',
        fecha: '2026-05-15',
        concepto: 'Cobranza expensas mayo · varios UFs',
        monto: 3140000,
        categoria: 'COBRANZA',
      },
    ],
    asambleas: [
      {
        id: 'asm_201',
        fecha: '2026-03-22',
        tipo: 'ORDINARIA',
        asunto: 'Plan anual + renovación administración',
        asistentes: 18,
        acuerdoPrincipal:
          'Se renueva el contrato de administración con Inmobiliaria del Sol por 2 años más.',
      },
    ],
    desde: '2020-11-05',
  },
];

/* ============================================================
 * Helpers
 * ============================================================ */

export function listarConsorcios(): Consorcio[] {
  return consorciosMock;
}

export function consorcioPorId(id: string): Consorcio | null {
  return consorciosMock.find((c) => c.id === id) ?? null;
}

export function morosidadConsorcio(c: Consorcio): {
  totalDeuda: number;
  ufsMorosas: number;
  ufsAlDia: number;
  porcentajeAlDia: number;
} {
  const totalDeuda = c.unidades.reduce((s, u) => s + u.saldoDeudor, 0);
  const ufsMorosas = c.unidades.filter((u) => u.saldoDeudor > 0).length;
  const ufsAlDia = c.unidades.length - ufsMorosas;
  return {
    totalDeuda,
    ufsMorosas,
    ufsAlDia,
    porcentajeAlDia: Math.round((ufsAlDia / Math.max(c.unidades.length, 1)) * 100),
  };
}

export function balanceConsorcio(c: Consorcio): {
  ingresos: number;
  egresos: number;
  saldoMes: number;
} {
  let ingresos = 0;
  let egresos = 0;
  for (const m of c.movimientos) {
    if (m.monto >= 0) ingresos += m.monto;
    else egresos += Math.abs(m.monto);
  }
  return { ingresos, egresos, saldoMes: ingresos - egresos };
}

export const ESTADO_UF_LABEL: Record<EstadoUF, string> = {
  AL_DIA: 'Al día',
  PENDIENTE: 'Pendiente',
  VENCIDO: 'Vencido',
  CON_PLAN_PAGO: 'Plan de pago',
};

export const ESTADO_UF_COLOR: Record<EstadoUF, string> = {
  AL_DIA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  PENDIENTE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  VENCIDO: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  CON_PLAN_PAGO: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
};

export const CATEGORIA_MOVIMIENTO_LABEL: Record<MovimientoConsorcio['categoria'], string> = {
  COBRANZA: 'Cobranza',
  SUELDO: 'Sueldo',
  MANTENIMIENTO: 'Mantenimiento',
  SERVICIO: 'Servicio',
  IMPUESTO: 'Impuesto',
  OTRO: 'Otro',
};
