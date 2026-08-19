/**
 * Datos de la demo del portal del propietario.
 *
 * POR QUÉ EXISTE ESTO, SI `api.ts` DECÍA QUE NO DEBÍA EXISTIR. El comentario original de
 * `api.ts` argumentaba que un portal de plata rendida no puede tener versión "de mentira"
 * porque sólo serviría para confundir. El argumento es bueno y NO se descartó: se acotó.
 * Vale para una app desplegada a la que le falta el servidor —ahí mentir es grave y hay que
 * decir "no está conectado"—, pero no para el sitio estático de GitHub Pages, que es una
 * demo entera, sin base y sin API, donde el panel ya muestra caja falsa y la PWA alquiler
 * falso.
 *
 * Por eso la demo NO se activa con `!apiEnabled`, que es justo el caso que el comentario
 * protegía. Se activa con `NEXT_PUBLIC_DEMO=1`, que sólo escribe `scripts/build-static.sh`.
 * Una app de producción a la que se le olvidó `NEXT_PUBLIC_API_URL` sigue mostrando el
 * mensaje honesto de siempre — hay un test que lo fija.
 *
 * LA HISTORIA ES LA MISMA QUE LA DEL RESTO DE LA DEMO, a propósito. La protagonista es
 * Silvana Morales (`own_002` en `apps/inmobiliaria/src/lib/mock-data.ts`), y sus tres
 * unidades, sus inquilinos y sus montos son los que el panel ya muestra del otro lado del
 * mostrador. El depto de Gorriti lo alquila Mariela Sosa, que es la identidad demo de la
 * PWA. Quien mira las puertas del sitio ve un solo alquiler contado desde los tres lados, no
 * tres invenciones sueltas.
 *
 * Si alguien cambia los montos de `mock-data.ts` esto NO se entera solo: son dos apps que no
 * comparten paquete. Es una deuda conocida y barata de pagar a mano; lo que sí está atado es
 * la ARITMÉTICA de cada rendición, que la verifica un test.
 */
import type {
  MiCartera,
  PropiedadPortal,
  ReclamoPortal,
  RendicionDetalle,
  RendicionPortal,
  SesionPropietario,
} from './api';

/** El token es decorativo: en demo nadie lo valida, pero el resto del código espera uno. */
export const TOKEN_DEMO = 'demo-propietario-sin-servidor';

const INMOBILIARIA = 'Inmobiliaria del Sol';

export const SESION_DEMO: SesionPropietario = {
  nombre: 'Silvana Morales',
  inmobiliaria: INMOBILIARIA,
  // Una sola cartera: el selector se oculta solo con menos de dos, y fabricar una segunda
  // inmobiliaria sería inventar una historia que el resto de la demo no cuenta.
  carteras: [{ propietarioId: 'own_002', nombre: 'Silvana Morales', inmobiliaria: INMOBILIARIA, actual: true }],
};

export const CARTERA_DEMO: MiCartera = {
  nombre: 'Silvana Morales',
  email: 'silvanamorales@gmail.com',
  telefono: '+54 9 11 5432 6789',
  cuit: '27-23456789-3',
  comisionPct: 7,
  inmobiliaria: { nombre: INMOBILIARIA, telefono: '+54 11 4788 9900', email: 'hola@inmobiliariadelsol.com.ar' },
};

export const PROPIEDADES_DEMO: PropiedadPortal[] = [
  {
    id: 'prp_001',
    direccion: 'Gorriti 4521, 3°B',
    ciudad: 'CABA',
    complejo: 'Complejo Lourdes',
    // Copropiedad real: el otro 60% es de Eduardo Castro. La demo tiene que mostrar que el
    // portal reparte por participación y no asume dueño único.
    participacionPct: 40,
    contrato: {
      estado: 'ACTIVO',
      tipoContrato: 'ALQUILER',
      monto: 480000,
      moneda: 'ARS',
      desde: '2025-09-01',
      hasta: '2028-08-31',
      inquilino: 'Mariela Sosa',
      periodos: [
        { periodo: '2026-08', estado: 'PAGADO', monto: 480000, vence: '2026-08-05', pagoAt: '2026-08-11', condonada: false },
        { periodo: '2026-07', estado: 'PAGADO', monto: 480000, vence: '2026-07-05', pagoAt: '2026-07-04', condonada: false },
        { periodo: '2026-06', estado: 'PAGADO', monto: 480000, vence: '2026-06-05', pagoAt: '2026-06-03', condonada: false },
      ],
    },
  },
  {
    id: 'prp_002',
    direccion: 'Av. Cabildo 2890, 7°A',
    ciudad: 'CABA',
    complejo: null,
    participacionPct: 100,
    contrato: {
      estado: 'ACTIVO',
      tipoContrato: 'ALQUILER',
      monto: 620000,
      moneda: 'ARS',
      desde: '2023-09-01',
      hasta: '2026-08-31',
      inquilino: 'Juan Pérez',
      periodos: [
        // Agosto sin pagar y ya vencido. La demo necesita mostrar el caso incómodo: es
        // exactamente lo que el propietario entra a mirar cuando no le llegó la plata.
        { periodo: '2026-08', estado: 'VENCIDO', monto: 620000, vence: '2026-08-05', pagoAt: null, condonada: false },
        { periodo: '2026-07', estado: 'PAGADO', monto: 620000, vence: '2026-07-05', pagoAt: '2026-07-07', condonada: false },
        { periodo: '2026-06', estado: 'PAGADO', monto: 620000, vence: '2026-06-05', pagoAt: '2026-06-05', condonada: false },
      ],
    },
  },
  {
    id: 'prp_004',
    direccion: 'Honduras 4490, PB',
    ciudad: 'CABA',
    complejo: 'Complejo Lourdes',
    participacionPct: 100,
    contrato: {
      estado: 'ACTIVO',
      tipoContrato: 'ALQUILER',
      monto: 720000,
      moneda: 'ARS',
      desde: '2024-11-01',
      hasta: '2027-10-31',
      inquilino: 'Carlos Romero',
      periodos: [
        { periodo: '2026-08', estado: 'PAGADO', monto: 720000, vence: '2026-08-05', pagoAt: '2026-08-04', condonada: false },
        { periodo: '2026-07', estado: 'PAGADO', monto: 720000, vence: '2026-07-05', pagoAt: '2026-07-03', condonada: false },
        { periodo: '2026-06', estado: 'PAGADO', monto: 720000, vence: '2026-06-05', pagoAt: '2026-06-04', condonada: false },
      ],
    },
  },
];

/**
 * Las rendiciones, con su detalle. La lista que devuelve `/portal/rendiciones` se DERIVA de
 * acá (ver `resumenDeRendicion`) en vez de escribirse aparte: si se escribieran las dos, un
 * día el total de la lista y el del detalle iban a dejar de coincidir, que es la peor cosa
 * que puede pasar en una pantalla de plata.
 *
 * Gorriti entra al 40% —es lo que le toca a Silvana—, Cabildo y Honduras al 100%. En mayo el
 * alquiler de Gorriti todavía era $410.000: el ajuste por ICL corrió el 1/6, y el mock de la
 * PWA lo dice.
 */
export const RENDICIONES_DEMO: RendicionDetalle[] = [
  {
    id: 'ren_2026_07',
    periodo: '2026-07',
    cobrado: 1532000,
    comisionPct: 7,
    comision: 107240,
    gastos: 109000,
    otrosIngresos: 45000,
    teDepositamos: 1360760,
    moneda: 'ARS',
    rendidoAt: '2026-08-10T13:20:00.000Z',
    metodo: 'TRANSFERENCIA',
    detalleAlquileres: [
      { periodo: '2026-07', direccion: 'Gorriti 4521, 3°B', participacionPct: 40, monto: 192000 },
      { periodo: '2026-07', direccion: 'Av. Cabildo 2890, 7°A', participacionPct: 100, monto: 620000 },
      { periodo: '2026-07', direccion: 'Honduras 4490, PB', participacionPct: 100, monto: 720000 },
    ],
    detalleGastos: [
      {
        fecha: '2026-07-05',
        tipo: 'CAJA',
        descripcion: 'Recarga de matafuegos — Complejo Lourdes',
        proveedor: 'Segurimax',
        monto: 24000,
      },
      {
        // Este gasto es el mismo reclamo de abajo (rec_002), que lo paga el propietario. Se
        // cuenta UNA vez y acá: el reclamo del propietario va por la rendición y no genera
        // cargo aparte (ver work-agent/05-DECISIONES.md).
        fecha: '2026-07-18',
        tipo: 'TRABAJO',
        descripcion: 'Destapación de cañería de cocina — Av. Cabildo 2890, 7°A',
        proveedor: 'Plomería Rivas',
        monto: 85000,
      },
    ],
    detalleIngresos: [
      {
        fecha: '2026-07-22',
        descripcion: 'Alquiler de cochera — Honduras 4490',
        participacionPct: 100,
        monto: 45000,
      },
    ],
  },
  {
    id: 'ren_2026_06',
    periodo: '2026-06',
    cobrado: 1532000,
    comisionPct: 7,
    comision: 107240,
    gastos: 0,
    otrosIngresos: 0,
    teDepositamos: 1424760,
    moneda: 'ARS',
    rendidoAt: '2026-07-10T12:05:00.000Z',
    metodo: 'TRANSFERENCIA',
    detalleAlquileres: [
      { periodo: '2026-06', direccion: 'Gorriti 4521, 3°B', participacionPct: 40, monto: 192000 },
      { periodo: '2026-06', direccion: 'Av. Cabildo 2890, 7°A', participacionPct: 100, monto: 620000 },
      { periodo: '2026-06', direccion: 'Honduras 4490, PB', participacionPct: 100, monto: 720000 },
    ],
    detalleGastos: [],
    detalleIngresos: [],
  },
  {
    id: 'ren_2026_05',
    periodo: '2026-05',
    cobrado: 1504000,
    comisionPct: 7,
    comision: 105280,
    gastos: 0,
    otrosIngresos: 0,
    teDepositamos: 1398720,
    moneda: 'ARS',
    rendidoAt: '2026-06-10T11:40:00.000Z',
    metodo: 'TRANSFERENCIA',
    detalleAlquileres: [
      { periodo: '2026-05', direccion: 'Gorriti 4521, 3°B', participacionPct: 40, monto: 164000 },
      { periodo: '2026-05', direccion: 'Av. Cabildo 2890, 7°A', participacionPct: 100, monto: 620000 },
      { periodo: '2026-05', direccion: 'Honduras 4490, PB', participacionPct: 100, monto: 720000 },
    ],
    detalleGastos: [],
    detalleIngresos: [],
  },
];

/** Recorta el detalle a lo que devuelve la lista, con los mismos campos que el endpoint real. */
export function resumenDeRendicion(r: RendicionDetalle): RendicionPortal {
  return {
    id: r.id,
    periodo: r.periodo,
    cobrado: r.cobrado,
    comisionPct: r.comisionPct,
    comision: r.comision,
    gastos: r.gastos,
    otrosIngresos: r.otrosIngresos,
    teDepositamos: r.teDepositamos,
    moneda: r.moneda,
    rendidoAt: r.rendidoAt,
    metodo: r.metodo,
  };
}

export const RECLAMOS_DEMO: ReclamoPortal[] = [
  {
    id: 'rec_001',
    descripcion: 'La luz del palier del 3° se corta cada vez que llueve.',
    categoria: 'ELECTRICIDAD',
    urgencia: 'MEDIA',
    estado: 'EN_CURSO',
    creadoAt: '2026-08-12T09:30:00.000Z',
    resueltoAt: null,
    // Todavía sin costo: el electricista no pasó el presupuesto. `null` es el caso que la UI
    // tiene que saber mostrar sin poner "$0", que sería otra cosa.
    costo: null,

    monedaCosto: 'ARS',
    pagador: null,
    direccion: 'Gorriti 4521, 3°B',
    complejo: 'Complejo Lourdes',
  },
  {
    id: 'rec_002',
    descripcion: 'Cañería de la cocina tapada, el agua no baja.',
    categoria: 'PLOMERIA',
    urgencia: 'ALTA',
    estado: 'RESUELTO',
    creadoAt: '2026-07-16T18:05:00.000Z',
    resueltoAt: '2026-07-18T16:40:00.000Z',
    costo: 85000,

    monedaCosto: 'ARS',
    pagador: 'PROPIETARIO',
    direccion: 'Av. Cabildo 2890, 7°A',
    complejo: null,
  },
];

/**
 * Resuelve una ruta del portal contra los datos de la demo.
 *
 * Es el reemplazo de `fetch` cuando la demo está prendida, y a propósito NO tiene un `default`
 * que devuelva algo vacío: una ruta que nadie mockeó TIRA. Si mañana alguien agrega un
 * endpoint al portal y se olvida de la demo, la pantalla se rompe fuerte en el sitio estático
 * —que es donde queremos enterarnos— en vez de mostrar una lista vacía que se lee como "no
 * tenés nada rendido", que es exactamente la mentira que este portal no puede permitirse.
 *
 * Devuelve `unknown` porque el llamador ya declaró el tipo que espera (`apiFetch<T>`); acá no
 * hay forma honesta de probar que coinciden, y fingir que sí con un genérico sería peor.
 */
export function resolverDemo(path: string): unknown {
  // Sin querystring: hoy ninguna ruta del portal la usa, pero si mañana llega no queremos que
  // "/portal/reclamos?x=1" caiga en el error de ruta desconocida por una diferencia boba.
  const ruta = path.split('?')[0] ?? path;

  if (ruta === '/portal/mi-cartera') return CARTERA_DEMO;
  if (ruta === '/portal/propiedades') return PROPIEDADES_DEMO;
  if (ruta === '/portal/reclamos') return RECLAMOS_DEMO;
  if (ruta === '/portal/rendiciones') return RENDICIONES_DEMO.map(resumenDeRendicion);

  const detalle = /^\/portal\/rendiciones\/([^/]+)$/.exec(ruta);
  if (detalle) {
    const r = RENDICIONES_DEMO.find((x) => x.id === detalle[1]);
    if (r) return r;
    // Mismo comportamiento que el server: una rendición que no es tuya no existe.
    throw new Error('No encontramos esa rendición');
  }

  throw new Error(`La demo no tiene datos para ${ruta}. Agregalos en demo-data.ts.`);
}
