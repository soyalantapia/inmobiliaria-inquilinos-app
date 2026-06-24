// Log de auditoría: cada acción sensible deja un registro de quién, qué,
// cuándo y por qué. Sirve para que el jefe pueda revisar lo que hizo cada
// usuario y tener trazabilidad legal.
//
// En backend real es una tabla `AuditLog` append-only con FK al usuario.
// Acá lo guardamos en localStorage; en producción se respaldaría en DB.

const STORAGE_KEY = 'llave-inmo:auditoria:v1';
// Soportamos hasta 5000 eventos en localStorage. El feedback de pilotos
// habla de ~1000 acciones/mes — con 5000 entran cómodos 4-5 meses de
// historial sin pasar el techo de 5MB del storage (≈400b por evento).
const MAX_EVENTOS = 5000;

export type TipoEventoAuditoria =
  | 'PAGO_CONCILIADO'
  | 'PAGO_RECHAZADO'
  | 'PAGO_REVERTIDO'
  | 'PAGO_MANUAL_CARGADO'
  | 'CONTRATO_CARGADO'
  | 'CONTRATO_APROBADO'
  | 'CONTRATO_RECHAZADO'
  | 'PROPIEDAD_CARGADA'
  | 'GASTO_CAJA_CARGADO'
  | 'GASTO_CAJA_ELIMINADO'
  | 'RECLAMO_CLASIFICADO'
  | 'PROFESIONAL_ASIGNADO'
  | 'EQUIPO_INVITADO'
  | 'EQUIPO_REMOVIDO'
  | 'FACTURA_ARCA_EMITIDA'
  | 'PROPIETARIO_CONFIRMO_RECIBO'
  | 'PROPIETARIO_RENDIDO'
  | 'MODO_COBRANZA_CAMBIADO'
  | 'SOLICITUD_RECHAZADA';

export interface EventoAuditoria {
  id: string;
  tipo: TipoEventoAuditoria;
  autor: string;
  rolAutor: string;
  entidadId: string;
  entidadDescripcion: string;
  detalle: string | null;
  fecha: string;
}

// Tipos de evento agrupados por módulo, útil para filtros gruesos en la UI.
export type ModuloAuditoria =
  | 'pagos'
  | 'contratos'
  | 'caja'
  | 'reclamos'
  | 'equipo'
  | 'afip'
  | 'propietarios'
  | 'configuracion';

export const moduloDeTipo: Record<TipoEventoAuditoria, ModuloAuditoria> = {
  PAGO_CONCILIADO: 'pagos',
  PAGO_RECHAZADO: 'pagos',
  PAGO_REVERTIDO: 'pagos',
  PAGO_MANUAL_CARGADO: 'pagos',
  CONTRATO_CARGADO: 'contratos',
  CONTRATO_APROBADO: 'contratos',
  CONTRATO_RECHAZADO: 'contratos',
  PROPIEDAD_CARGADA: 'contratos',
  GASTO_CAJA_CARGADO: 'caja',
  GASTO_CAJA_ELIMINADO: 'caja',
  RECLAMO_CLASIFICADO: 'reclamos',
  PROFESIONAL_ASIGNADO: 'reclamos',
  EQUIPO_INVITADO: 'equipo',
  EQUIPO_REMOVIDO: 'equipo',
  FACTURA_ARCA_EMITIDA: 'afip',
  PROPIETARIO_CONFIRMO_RECIBO: 'propietarios',
  PROPIETARIO_RENDIDO: 'propietarios',
  MODO_COBRANZA_CAMBIADO: 'configuracion',
  SOLICITUD_RECHAZADA: 'configuracion',
};

export const MODULO_LABEL: Record<ModuloAuditoria, string> = {
  pagos: 'Pagos',
  contratos: 'Contratos',
  caja: 'Caja diaria',
  reclamos: 'Reclamos',
  equipo: 'Equipo',
  afip: 'AFIP',
  propietarios: 'Propietarios',
  configuracion: 'Configuración',
};

// Eventos de ejemplo para que la demo tenga historial al entrar
const SEED: EventoAuditoria[] = [
  {
    id: 'evt_seed_1',
    tipo: 'PAGO_CONCILIADO',
    autor: 'Luciana Vidal',
    rolAutor: 'OPERADOR',
    entidadId: 'pag_seed_juan_abr',
    entidadDescripcion: 'Pago de Juan Pérez · abril 2026',
    detalle: '$620.000 · Mercado Pago',
    fecha: '2026-04-10T15:32:00-03:00',
  },
  {
    id: 'evt_seed_2',
    tipo: 'CONTRATO_CARGADO',
    autor: 'Camila Acosta',
    rolAutor: 'CARGA',
    entidadId: 'cnt_007',
    entidadDescripcion: 'Consorcio Sucre 1450',
    detalle: 'Cargado como BORRADOR · pendiente aprobación',
    fecha: '2026-05-08T10:14:00-03:00',
  },
  {
    id: 'evt_seed_3',
    tipo: 'CONTRATO_APROBADO',
    autor: 'Roberto Tapia',
    rolAutor: 'ADMIN',
    entidadId: 'cnt_007',
    entidadDescripcion: 'Consorcio Sucre 1450',
    detalle: 'Revisado y aprobado',
    fecha: '2026-05-08T12:40:00-03:00',
  },
  {
    id: 'evt_seed_4',
    tipo: 'GASTO_CAJA_CARGADO',
    autor: 'Roberto Tapia',
    rolAutor: 'ADMIN',
    entidadId: 'mov_seed_1',
    entidadDescripcion: 'Plomería · Gorriti 4521',
    detalle: '$45.000 · Sergio Almeida',
    fecha: '2026-04-30T17:05:00-03:00',
  },
  {
    id: 'evt_seed_5',
    tipo: 'PROFESIONAL_ASIGNADO',
    autor: 'Roberto Tapia',
    rolAutor: 'ADMIN',
    entidadId: 'rec_006',
    entidadDescripcion: 'Reclamo de plomería · Gorriti 4521',
    detalle: 'Asignado a Sergio Almeida',
    fecha: '2026-04-28T15:05:00-03:00',
  },
];

function leer(): EventoAuditoria[] {
  if (typeof window === 'undefined') return SEED_EXTENDIDO;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_EXTENDIDO;
    return JSON.parse(raw) as EventoAuditoria[];
  } catch {
    return SEED_EXTENDIDO;
  }
}

/**
 * Genera ~150 eventos sintéticos repartidos en los últimos 90 días.
 * Sirve para demostrar el panel de auditoría con volumen real (paginación
 * + búsqueda + filtros) sin pegarle a producción.
 */
function generarSeedSinteticos(): EventoAuditoria[] {
  // V2b-02: "Eugenia Rinaldi" no estaba en el equipo (configuracion/page.tsx)
  // — autora fantasma. La lista ahora son los 5 miembros reales del equipo
  // (el contador, rol LECTURA, no genera eventos porque sólo lee).
  const usuarios: Array<{ nombre: string; rol: string }> = [
    { nombre: 'Roberto Tapia', rol: 'ADMIN' },
    { nombre: 'Luciana Vidal', rol: 'OPERADOR' },
    { nombre: 'Sergio Almeida', rol: 'OPERADOR' },
    { nombre: 'Camila Acosta', rol: 'CARGA' },
  ];

  // V2b-05: qué roles pueden generar cada tipo de evento, en línea con
  // permisos.ts. Antes el autor se elegía al azar y aparecían incoherencias
  // como "Camila (Carga) cargó un pago manual" — algo que su rol no permite.
  // CARGA sólo puede dar de alta contratos/propiedades; el resto es ADMIN/OPERADOR.
  const rolesPorTipo: Partial<Record<TipoEventoAuditoria, string[]>> = {
    CONTRATO_CARGADO: ['ADMIN', 'OPERADOR', 'CARGA'],
    PROPIEDAD_CARGADA: ['ADMIN', 'OPERADOR', 'CARGA'],
    EQUIPO_INVITADO: ['ADMIN'],
    EQUIPO_REMOVIDO: ['ADMIN'],
    MODO_COBRANZA_CAMBIADO: ['ADMIN'],
  };
  // Por defecto (pagos, caja, reclamos, rendiciones, ARCA, aprobaciones):
  // sólo ADMIN y OPERADOR.
  const rolesDefault = ['ADMIN', 'OPERADOR'];
  const inquilinos = [
    'Mariela Sosa',
    'Juan Pérez',
    'Laura Giménez',
    'Carlos Romero',
    'Ana Pereyra',
    'Tomás Bravo',
    'Federico Luján',
    'Paula Espósito',
  ];
  const direcciones = [
    'Gorriti 4521, 3°B',
    'Av. Cabildo 2890, 7°A',
    'Jorge Newbery 1820',
    'Honduras 4490, PB',
    'Salguero 2240, 12°D',
    'Olleros 3920',
  ];
  const propietarios = [
    'Roberto Iglesias',
    'Familia Castro',
    'María Romano',
    'Daniel Pereyra',
  ];
  // Reparto realista: 38% pagos, 17% contratos, 14% caja, 12% reclamos,
  // 9% propietarios, 5% equipo, 3% AFIP, 2% configuración.
  const tipos: Array<{ tipo: TipoEventoAuditoria; peso: number }> = [
    { tipo: 'PAGO_CONCILIADO', peso: 22 },
    { tipo: 'PAGO_MANUAL_CARGADO', peso: 10 },
    { tipo: 'PAGO_RECHAZADO', peso: 4 },
    { tipo: 'PAGO_REVERTIDO', peso: 2 },
    { tipo: 'CONTRATO_CARGADO', peso: 8 },
    { tipo: 'CONTRATO_APROBADO', peso: 7 },
    { tipo: 'CONTRATO_RECHAZADO', peso: 2 },
    { tipo: 'PROPIEDAD_CARGADA', peso: 4 },
    { tipo: 'GASTO_CAJA_CARGADO', peso: 11 },
    { tipo: 'GASTO_CAJA_ELIMINADO', peso: 3 },
    { tipo: 'RECLAMO_CLASIFICADO', peso: 6 },
    { tipo: 'PROFESIONAL_ASIGNADO', peso: 6 },
    { tipo: 'PROPIETARIO_RENDIDO', peso: 5 },
    { tipo: 'PROPIETARIO_CONFIRMO_RECIBO', peso: 4 },
    { tipo: 'FACTURA_ARCA_EMITIDA', peso: 3 },
    { tipo: 'EQUIPO_INVITADO', peso: 1 },
    { tipo: 'EQUIPO_REMOVIDO', peso: 1 },
    { tipo: 'MODO_COBRANZA_CAMBIADO', peso: 1 },
  ];
  const bag: TipoEventoAuditoria[] = [];
  for (const t of tipos) {
    for (let i = 0; i < t.peso; i++) bag.push(t.tipo);
  }

  // PRNG determinístico (mulberry32)
  let s = 0x6d2b79f5;
  const rnd = () => {
    s = Math.imul(s + 0x6d2b79f5, 1);
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]!;
  const montoAleatorio = () =>
    Math.round((150_000 + rnd() * 1_700_000) / 1000) * 1000;

  const eventos: EventoAuditoria[] = [];
  const hoy = Date.now();
  // Repartimos 150 eventos en los últimos 90 días, con horas de oficina.
  for (let i = 0; i < 150; i++) {
    const diasAtras = Math.floor(rnd() * 90);
    const hora = 8 + Math.floor(rnd() * 12); // 08-19
    const min = Math.floor(rnd() * 60);
    const fecha = new Date(hoy - diasAtras * 86400_000);
    fecha.setHours(hora, min, 0, 0);
    const tipo = pick(bag);
    // V2b-05: el autor se elige sólo entre los roles habilitados para ese
    // tipo de evento (fallback a la lista completa por si algún tipo no
    // tuviera candidatos, aunque siempre hay un ADMIN).
    const rolesOk = rolesPorTipo[tipo] ?? rolesDefault;
    const candidatos = usuarios.filter((u) => rolesOk.includes(u.rol));
    const usuario = pick(candidatos.length > 0 ? candidatos : usuarios);
    const inquilino = pick(inquilinos);
    const direccion = pick(direcciones);
    const propietario = pick(propietarios);
    let entidadDescripcion = '';
    let detalle: string | null = null;
    const monto = montoAleatorio();
    switch (tipo) {
      case 'PAGO_CONCILIADO':
        entidadDescripcion = `Pago ${inquilino} · ${direccion}`;
        detalle = `${monto.toLocaleString('es-AR')} · Mercado Pago`;
        break;
      case 'PAGO_MANUAL_CARGADO':
        entidadDescripcion = `Pago manual ${inquilino}`;
        detalle = `Transferencia · ${monto.toLocaleString('es-AR')}`;
        break;
      case 'PAGO_RECHAZADO':
        entidadDescripcion = `Pago rechazado ${inquilino}`;
        detalle = 'CBU no coincide con titular del contrato';
        break;
      case 'PAGO_REVERTIDO':
        entidadDescripcion = `Conciliación revertida ${inquilino}`;
        detalle = `${monto.toLocaleString('es-AR')} · error en monto`;
        break;
      case 'CONTRATO_CARGADO':
        entidadDescripcion = `Contrato nuevo · ${direccion}`;
        detalle = `Cargado como BORRADOR para revisión`;
        break;
      case 'CONTRATO_APROBADO':
        entidadDescripcion = `Contrato ${inquilino} · ${direccion}`;
        detalle = 'Revisado y aprobado para activación';
        break;
      case 'CONTRATO_RECHAZADO':
        entidadDescripcion = `Contrato rechazado · ${direccion}`;
        detalle = 'Falta documentación del garante';
        break;
      case 'PROPIEDAD_CARGADA':
        entidadDescripcion = `Propiedad ${direccion}`;
        detalle = `Alta de propiedad`;
        break;
      case 'GASTO_CAJA_CARGADO':
        entidadDescripcion = `Gasto caja · ${direccion}`;
        detalle = `${monto.toLocaleString('es-AR')} · plomería`;
        break;
      case 'GASTO_CAJA_ELIMINADO':
        entidadDescripcion = `Gasto eliminado · ${direccion}`;
        detalle = 'Cargado por error · $' + monto.toLocaleString('es-AR');
        break;
      case 'RECLAMO_CLASIFICADO':
        entidadDescripcion = `Reclamo · ${direccion}`;
        detalle = pick(['USO_Y_GOCE', 'DESPERFECTO']);
        break;
      case 'PROFESIONAL_ASIGNADO':
        entidadDescripcion = `Reclamo · ${direccion}`;
        detalle = `Asignado a ${pick(['Sergio Almeida', 'Pablo Iturbide', 'Luis Rovira'])}`;
        break;
      case 'PROPIETARIO_RENDIDO':
        entidadDescripcion = `Rendición a ${propietario}`;
        detalle = `${monto.toLocaleString('es-AR')} · transferencia`;
        break;
      case 'PROPIETARIO_CONFIRMO_RECIBO':
        entidadDescripcion = `${propietario} confirmó recibo`;
        detalle = `Monto ${monto.toLocaleString('es-AR')}`;
        break;
      case 'FACTURA_ARCA_EMITIDA':
        entidadDescripcion = `Factura B · ${inquilino}`;
        detalle = `Honorarios · ${monto.toLocaleString('es-AR')}`;
        break;
      case 'EQUIPO_INVITADO':
        entidadDescripcion = `Invitación · ${pick([
          'martin@inmosol.com.ar',
          'ana.lopez@inmosol.com.ar',
          'cristian@inmosol.com.ar',
        ])}`;
        detalle = 'Rol OPERADOR';
        break;
      case 'EQUIPO_REMOVIDO':
        entidadDescripcion = `Removido del equipo`;
        detalle = 'Renuncia';
        break;
      case 'MODO_COBRANZA_CAMBIADO':
        entidadDescripcion = `Contrato ${inquilino}`;
        detalle = 'Cambiado a PROPIETARIO_DIRECTO';
        break;
    }
    eventos.push({
      id: `evt_seed_synthetic_${i}`,
      tipo,
      autor: usuario.nombre,
      rolAutor: usuario.rol,
      entidadId: `ent_${i}`,
      entidadDescripcion,
      detalle,
      fecha: fecha.toISOString(),
    });
  }
  return eventos.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

const SEED_SINTETICO = generarSeedSinteticos();
const SEED_EXTENDIDO: EventoAuditoria[] = [...SEED, ...SEED_SINTETICO];

function guardar(lista: EventoAuditoria[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Recortamos a MAX_EVENTOS más recientes
    const recortada = lista.slice(0, MAX_EVENTOS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recortada));
  } catch {
    // ignore
  }
}

export function registrarEvento(input: {
  tipo: TipoEventoAuditoria;
  autor: string;
  rolAutor?: string;
  entidadId: string;
  entidadDescripcion: string;
  detalle?: string | null;
}): EventoAuditoria {
  const nuevo: EventoAuditoria = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    rolAutor: input.rolAutor ?? 'ADMIN',
    detalle: input.detalle ?? null,
    fecha: new Date().toISOString(),
    ...input,
  };
  guardar([nuevo, ...leer()]);
  return nuevo;
}

export function listarAuditoria(): EventoAuditoria[] {
  return [...leer()].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export const tipoEventoLabel: Record<TipoEventoAuditoria, string> = {
  PAGO_CONCILIADO: 'Pago conciliado',
  PAGO_RECHAZADO: 'Pago rechazado',
  PAGO_REVERTIDO: 'Conciliación revertida',
  PAGO_MANUAL_CARGADO: 'Pago manual cargado',
  CONTRATO_CARGADO: 'Contrato cargado',
  CONTRATO_APROBADO: 'Contrato aprobado',
  CONTRATO_RECHAZADO: 'Contrato rechazado',
  PROPIEDAD_CARGADA: 'Propiedad cargada',
  GASTO_CAJA_CARGADO: 'Gasto de caja cargado',
  GASTO_CAJA_ELIMINADO: 'Gasto de caja eliminado',
  RECLAMO_CLASIFICADO: 'Reclamo clasificado',
  PROFESIONAL_ASIGNADO: 'Profesional asignado',
  EQUIPO_INVITADO: 'Miembro de equipo invitado',
  EQUIPO_REMOVIDO: 'Miembro de equipo removido',
  FACTURA_ARCA_EMITIDA: 'Factura ARCA emitida',
  PROPIETARIO_CONFIRMO_RECIBO: 'Propietario confirmó recibo del pago',
  PROPIETARIO_RENDIDO: 'Rendición a propietario',
  MODO_COBRANZA_CAMBIADO: 'Modo de cobranza cambiado',
  SOLICITUD_RECHAZADA: 'Solicitud rechazada',
};
