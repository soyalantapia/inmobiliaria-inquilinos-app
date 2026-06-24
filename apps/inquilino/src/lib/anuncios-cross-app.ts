'use client';

/**
 * Lectura cross-app de los anuncios masivos que mandó la inmobiliaria.
 * Comparten origin con la app del inmo, así que leemos directo del
 * localStorage del lado opuesto.
 *
 * Filtramos solo los que aplican al inquilino actual: ALL_INQUILINOS,
 * el de su consorcio o uno específico para su contrato.
 */

const INMO_KEY = 'llave-inmo:anuncios:v1';

export type AudienciaAnuncio =
  | 'TODOS_INQUILINOS'
  | 'TODOS_PROPIETARIOS'
  | 'TODOS_CONSORCIOS'
  | 'INQUILINOS_CONSORCIO'
  | 'INQUILINOS_MOROSOS'
  | 'INQUILINOS_PENDIENTES'
  | 'CONTRATOS_ESPECIFICOS';

export type PrioridadAnuncio = 'NORMAL' | 'IMPORTANTE' | 'URGENTE';

export interface AnuncioInquilino {
  id: string;
  titulo: string;
  cuerpo: string;
  prioridad: PrioridadAnuncio;
  audiencia: AudienciaAnuncio;
  audienciaIds?: string[];
  canales: Array<'APP' | 'WHATSAPP' | 'EMAIL'>;
  enviadoPor: string;
  enviadoAt: string;
  destinatariosCount: number;
}

interface SeedDatos {
  contratoId: string;
  consorcioId?: string;
}

/** Estos son los datos del inquilino logueado en el demo (Mariela Sosa,
 * cnt_001, consorcio Gorriti 4521 cnsr_001). En backend real vendrían
 * del JWT del usuario. */
const INQUILINO_ACTUAL: SeedDatos = {
  contratoId: 'cnt_001',
  consorcioId: 'cnsr_001',
};

export function listarAnunciosParaInquilino(): AnuncioInquilino[] {
  if (typeof window === 'undefined') return [];
  let lista: AnuncioInquilino[] = [];
  try {
    const raw = window.localStorage.getItem(INMO_KEY);
    if (raw) lista = JSON.parse(raw) as AnuncioInquilino[];
  } catch {
    lista = [];
  }
  if (lista.length === 0) lista = SEEDS_FALLBACK;
  const aplican = lista.filter((a) => {
    switch (a.audiencia) {
      case 'TODOS_INQUILINOS':
        return true;
      case 'INQUILINOS_CONSORCIO':
        return (
          INQUILINO_ACTUAL.consorcioId !== undefined &&
          (a.audienciaIds ?? []).includes(INQUILINO_ACTUAL.consorcioId)
        );
      case 'CONTRATOS_ESPECIFICOS':
        return (a.audienciaIds ?? []).includes(INQUILINO_ACTUAL.contratoId);
      // La inmobiliaria ya resolvió la pertenencia (morosos/pendientes) al crear
      // el anuncio; acá el inquilino no tiene su propio estado de pago, así que si
      // recibió el anuncio es porque corresponde (igual que TODOS_INQUILINOS).
      case 'INQUILINOS_MOROSOS':
      case 'INQUILINOS_PENDIENTES':
        return true;
      default:
        return false;
    }
  });
  return aplican.sort((a, b) => b.enviadoAt.localeCompare(a.enviadoAt));
}

/* ============================================================
 * Si el inmo no escribió nunca (caso dev, distinto puerto), seed local
 * para que la sección del inquilino tenga algo que mostrar en la demo.
 * ============================================================ */
const SEEDS_FALLBACK: AnuncioInquilino[] = [
  {
    id: 'anu_seed_1',
    titulo: 'Corte programado de agua · Gorriti 4521',
    cuerpo:
      'AySA confirmó que el viernes 30/05 entre 9 y 13 hs hay corte de agua en toda la cuadra. Llené el bidón el jueves a la noche y ojo con el termo.',
    prioridad: 'IMPORTANTE',
    audiencia: 'INQUILINOS_CONSORCIO',
    audienciaIds: ['cnsr_001'],
    canales: ['APP', 'WHATSAPP'],
    enviadoPor: 'Roberto Tapia',
    enviadoAt: '2026-05-21T10:00:00-03:00',
    destinatariosCount: 12,
  },
  {
    id: 'anu_seed_2',
    titulo: 'Nuevo CBU para cobranzas · vigente desde 01/06',
    cuerpo:
      'Cambiamos a Banco Galicia. CBU 0070100120000018273645 · Alias delsol.cobranzas. Por favor reemplazá el de junio en adelante.',
    prioridad: 'IMPORTANTE',
    audiencia: 'TODOS_INQUILINOS',
    canales: ['APP', 'EMAIL'],
    enviadoPor: 'Luciana Vidal',
    enviadoAt: '2026-05-15T15:30:00-03:00',
    destinatariosCount: 6,
  },
];
