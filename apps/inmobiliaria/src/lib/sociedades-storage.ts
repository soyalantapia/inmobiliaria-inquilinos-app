/**
 * Sociedades de la inmobiliaria.
 *
 * Las inmobiliarias medianas suelen operar bajo VARIAS sociedades en
 * paralelo: una SRL para alquileres residenciales, una S.A. para
 * comerciales, un fideicomiso para proyectos puntuales, etc. Cada
 * sociedad tiene su propio CUIT, su condición fiscal, su CBU para
 * cobrar y su punto de venta en ARCA.
 *
 * Acá guardamos el catálogo. Cada propiedad / contrato se asocia a una
 * sociedad (`sociedadId`); los reportes (rendiciones, facturas, PDF de
 * morosos por sociedad) usan los datos de esa sociedad como emisor.
 *
 * En backend real esto vive en la tabla `Sociedad` con FK desde
 * `Propiedad.sociedadId` y `Contrato.sociedadId`.
 */

const STORAGE_KEY = 'llave-inmo:sociedades:v1';

export type CondicionFiscalSociedad =
  | 'MONOTRIBUTO'
  | 'RESPONSABLE_INSCRIPTO'
  | 'EXENTO';

export type TipoComprobanteARCA =
  | 'FACTURA_A'
  | 'FACTURA_B'
  | 'FACTURA_C'
  | 'RECIBO_X';

export interface CuentaCobranzaSociedad {
  banco: string;
  titular: string;
  cbu: string;
  alias: string;
  cuit: string;
}

export interface AfipSociedad {
  conectado: boolean;
  puntoVenta?: string;
  tipoComprobante?: TipoComprobanteARCA;
  conectadoDesde?: string;
}

export interface Sociedad {
  id: string;
  /** Razón social legal (figura en facturas y contratos). */
  razonSocial: string;
  /** Nombre comercial (lo que se muestra en topbar y emails). */
  nombreComercial: string;
  cuit: string;
  condicionFiscal: CondicionFiscalSociedad;
  domicilioFiscal: string;
  email: string;
  telefono: string;
  cuentaCobranza?: CuentaCobranzaSociedad;
  afip?: AfipSociedad;
  /**
   * La sociedad principal es la que se usa por default cuando se da de
   * alta una propiedad. Sólo puede haber 1 a la vez.
   */
  esPrincipal: boolean;
  activa: boolean;
  createdAt: string;
}

/* ============================================================
 * Seeds: una sociedad por defecto + dos extras para mostrar el
 * caso multi-sociedad en la demo (la inmo gestiona también una S.A.
 * comercial y un fideicomiso de una familia).
 * ============================================================ */

const SEEDS: Sociedad[] = [
  {
    id: 'soc_001',
    razonSocial: 'Inmobiliaria del Sol S.R.L.',
    nombreComercial: 'Inmobiliaria del Sol',
    cuit: '30-71234567-8',
    condicionFiscal: 'RESPONSABLE_INSCRIPTO',
    domicilioFiscal: 'Av. Santa Fe 1234, CABA',
    email: 'info@delsol.com.ar',
    telefono: '+54 11 4789 1234',
    cuentaCobranza: {
      banco: 'Banco Galicia',
      titular: 'Inmobiliaria del Sol SRL',
      cbu: '0070100120000018273645',
      alias: 'delsol.cobranzas',
      cuit: '30-71234567-8',
    },
    afip: {
      conectado: true,
      puntoVenta: '0003',
      tipoComprobante: 'FACTURA_B',
      conectadoDesde: '2025-03-12',
    },
    esPrincipal: true,
    activa: true,
    createdAt: '2024-08-15',
  },
  {
    id: 'soc_002',
    razonSocial: 'Sol Comercial S.A.',
    nombreComercial: 'Sol Comercial',
    cuit: '30-72345678-9',
    condicionFiscal: 'RESPONSABLE_INSCRIPTO',
    domicilioFiscal: 'Av. Santa Fe 1234, 4° A, CABA',
    email: 'comercial@delsol.com.ar',
    telefono: '+54 11 4789 1234',
    cuentaCobranza: {
      banco: 'Banco Macro',
      titular: 'Sol Comercial SA',
      cbu: '2850001230094523456789',
      alias: 'solcomercial.cob',
      cuit: '30-72345678-9',
    },
    afip: {
      conectado: true,
      puntoVenta: '0001',
      tipoComprobante: 'FACTURA_A',
      conectadoDesde: '2025-06-20',
    },
    esPrincipal: false,
    activa: true,
    createdAt: '2025-05-10',
  },
  {
    id: 'soc_003',
    razonSocial: 'Fideicomiso Iglesias - Castro',
    nombreComercial: 'Fideicomiso I-C',
    cuit: '33-71456789-2',
    condicionFiscal: 'EXENTO',
    domicilioFiscal: 'Av. Santa Fe 1234, CABA',
    email: 'fideicomiso.ic@delsol.com.ar',
    telefono: '+54 11 4789 1234',
    afip: {
      conectado: false,
    },
    esPrincipal: false,
    activa: true,
    createdAt: '2025-11-04',
  },
];

function leerLista(): Sociedad[] {
  if (typeof window === 'undefined') return SEEDS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Primera vez: persistimos los seeds para que después se puedan editar.
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEEDS));
      return SEEDS;
    }
    return JSON.parse(raw) as Sociedad[];
  } catch {
    return SEEDS;
  }
}

function persistir(lista: Sociedad[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch {
    // ignore
  }
}

export function listarSociedades(opts: { incluirInactivas?: boolean } = {}): Sociedad[] {
  const lista = leerLista();
  return opts.incluirInactivas ? lista : lista.filter((s) => s.activa);
}

export function sociedadById(id: string | null | undefined): Sociedad | null {
  if (!id) return null;
  return leerLista().find((s) => s.id === id) ?? null;
}

/** Sociedad por default (la que se usa cuando una propiedad no especifica). */
export function sociedadPrincipal(): Sociedad {
  const lista = leerLista().filter((s) => s.activa);
  return lista.find((s) => s.esPrincipal) ?? lista[0] ?? SEEDS[0]!;
}

export interface NuevaSociedadInput {
  razonSocial: string;
  nombreComercial: string;
  cuit: string;
  condicionFiscal: CondicionFiscalSociedad;
  domicilioFiscal?: string;
  email?: string;
  telefono?: string;
  cuentaCobranza?: CuentaCobranzaSociedad;
  afip?: AfipSociedad;
}

export function agregarSociedad(input: NuevaSociedadInput): Sociedad {
  const nueva: Sociedad = {
    id: `soc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    razonSocial: input.razonSocial.trim(),
    nombreComercial: input.nombreComercial.trim() || input.razonSocial.trim(),
    cuit: input.cuit.trim(),
    condicionFiscal: input.condicionFiscal,
    domicilioFiscal: input.domicilioFiscal?.trim() ?? '',
    email: input.email?.trim() ?? '',
    telefono: input.telefono?.trim() ?? '',
    cuentaCobranza: input.cuentaCobranza,
    afip: input.afip ?? { conectado: false },
    esPrincipal: false,
    activa: true,
    createdAt: new Date().toISOString(),
  };
  const lista = leerLista();
  lista.push(nueva);
  persistir(lista);
  return nueva;
}

export function actualizarSociedad(
  id: string,
  cambios: Partial<NuevaSociedadInput>,
): Sociedad | null {
  const lista = leerLista();
  const idx = lista.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const previa = lista[idx]!;
  const actualizada: Sociedad = {
    ...previa,
    ...cambios,
  };
  lista[idx] = actualizada;
  persistir(lista);
  return actualizada;
}

/** Marca una sociedad como principal. Despinea las demás. */
export function marcarComoPrincipal(id: string): void {
  const lista = leerLista();
  for (const s of lista) {
    s.esPrincipal = s.id === id;
  }
  persistir(lista);
}

/** "Dar de baja": deja la sociedad inactiva pero conservada para historial. */
export function desactivarSociedad(id: string): void {
  const lista = leerLista();
  const s = lista.find((x) => x.id === id);
  if (!s) return;
  s.activa = false;
  // Si era principal y queda otra activa, promovemos a la primera.
  if (s.esPrincipal) {
    const reemplazo = lista.find((x) => x.activa && x.id !== id);
    if (reemplazo) reemplazo.esPrincipal = true;
    s.esPrincipal = false;
  }
  persistir(lista);
}

export function reactivarSociedad(id: string): void {
  const lista = leerLista();
  const s = lista.find((x) => x.id === id);
  if (!s) return;
  s.activa = true;
  persistir(lista);
}

export const CONDICION_FISCAL_LABEL: Record<CondicionFiscalSociedad, string> = {
  MONOTRIBUTO: 'Monotributo',
  RESPONSABLE_INSCRIPTO: 'Resp. inscripto',
  EXENTO: 'Exento',
};
