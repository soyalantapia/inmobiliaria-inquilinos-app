/**
 * Matriz central de roles + permisos del panel inmo.
 *
 * Pedido del feedback: "necesitamos que Camila (asistente) pueda cargar
 * cosas pero no aprobar pagos; las aprobaciones las hace Roberto o
 * Eugenia". Lo que históricamente tenían como una columna de "rol" en
 * Excel pasa a ser una matriz de capacidades chequeable.
 *
 * Hay tres niveles de capacidades:
 *
 *   - PERMISOS:    qué módulos puede ver y editar cada rol.
 *   - APROBACIONES: qué acciones requieren que un ADMIN apruebe lo cargado
 *     por un rol menor (Operador / Carga).
 *   - PIN_REQUERIDO: qué acciones, además de tener el rol correcto,
 *     requieren la clave especial de seguridad (PIN del usuario).
 *
 * En backend real esto vive en una tabla `Permission` + bind a `Role`.
 * Acá lo tipamos en TS para que la app pueda usarlo directo.
 */

export type Rol = 'ADMIN' | 'OPERADOR' | 'CARGA' | 'LECTURA';

export const ROLES_ORDEN: Rol[] = ['ADMIN', 'OPERADOR', 'CARGA', 'LECTURA'];

// V2b-04: estos labels son la fuente de verdad para los badges de rol en
// toda la app (auditoría, etc.). Antes decían "Carga"/"Lectura" pero Equipo
// y permisos usa "Carga limitada"/"Solo lectura" — el mismo rol salía con
// dos nombres. Unificados a los descriptivos.
export const ROL_LABEL: Record<Rol, string> = {
  ADMIN: 'Admin',
  OPERADOR: 'Operador',
  CARGA: 'Carga limitada',
  LECTURA: 'Solo lectura',
};

export const ROL_DESCRIPCION: Record<Rol, string> = {
  ADMIN:
    'Acceso completo: contratos, pagos, rendiciones, equipo, plan y facturación. Aprueba lo cargado por otros.',
  OPERADOR:
    'Día a día del panel: contratos, pagos, conciliación, reclamos, caja, screening. No toca equipo ni plan.',
  CARGA:
    'Solo carga inicial: contratos, propietarios, propiedades. Lo cargado queda pendiente de aprobación.',
  LECTURA: 'Solo lectura — contadores y propietarios que quieren ver sin tocar.',
};

export type Capacidad =
  /* Módulos de lectura */
  | 'home.ver'
  | 'propiedades.ver'
  | 'contratos.ver'
  | 'pagos.ver'
  | 'reclamos.ver'
  | 'screening.ver'
  | 'caja.ver'
  | 'propietarios.ver'
  | 'profesionales.ver'
  | 'auditoria.ver'
  | 'metricas.ver'
  /* Carga de datos (no aprobada) */
  | 'contratos.crear'
  | 'propiedades.crear'
  | 'propietarios.crear'
  | 'pago.manual.cargar'
  | 'gasto.caja.cargar'
  /* Acciones operativas */
  | 'reclamos.gestionar'
  | 'profesional.asignar'
  | 'comunicaciones.enviar'
  /* Acciones sensibles — requieren ADMIN + PIN */
  | 'pago.conciliar'
  | 'pago.rechazar'
  | 'pago.revertir'
  | 'contrato.aprobar'
  | 'rendicion.confirmar'
  | 'deposito.devolver'
  | 'caja.eliminar'
  | 'plan.upgrade'
  | 'equipo.gestionar'
  | 'sociedades.gestionar';

export interface DefinicionCapacidad {
  key: Capacidad;
  label: string;
  /** Roles que tienen la capacidad directamente (sin necesidad de PIN). */
  roles: Rol[];
  /** Si requiere PIN extra para confirmarse. */
  requierePin?: boolean;
  /** Roles cuya acción queda pendiente de aprobación por un ADMIN. */
  rolesAprobacion?: Rol[];
  /** Agrupador visible en la matriz. */
  grupo: 'lectura' | 'carga' | 'operativa' | 'sensible';
}

export const CAPACIDADES: DefinicionCapacidad[] = [
  /* Lectura */
  { key: 'home.ver', label: 'Ver home y bandeja del día', roles: ['ADMIN', 'OPERADOR', 'CARGA', 'LECTURA'], grupo: 'lectura' },
  { key: 'propiedades.ver', label: 'Ver propiedades', roles: ['ADMIN', 'OPERADOR', 'CARGA', 'LECTURA'], grupo: 'lectura' },
  { key: 'contratos.ver', label: 'Ver contratos', roles: ['ADMIN', 'OPERADOR', 'CARGA', 'LECTURA'], grupo: 'lectura' },
  { key: 'pagos.ver', label: 'Ver pagos y rendiciones', roles: ['ADMIN', 'OPERADOR', 'LECTURA'], grupo: 'lectura' },
  { key: 'reclamos.ver', label: 'Ver reclamos', roles: ['ADMIN', 'OPERADOR', 'LECTURA'], grupo: 'lectura' },
  { key: 'screening.ver', label: 'Ver screening', roles: ['ADMIN', 'OPERADOR'], grupo: 'lectura' },
  { key: 'caja.ver', label: 'Ver caja diaria', roles: ['ADMIN', 'OPERADOR', 'LECTURA'], grupo: 'lectura' },
  { key: 'propietarios.ver', label: 'Ver propietarios', roles: ['ADMIN', 'OPERADOR', 'CARGA', 'LECTURA'], grupo: 'lectura' },
  { key: 'profesionales.ver', label: 'Ver profesionales', roles: ['ADMIN', 'OPERADOR'], grupo: 'lectura' },
  { key: 'auditoria.ver', label: 'Ver auditoría', roles: ['ADMIN', 'LECTURA'], grupo: 'lectura' },
  { key: 'metricas.ver', label: 'Ver estadisticas', roles: ['ADMIN'], grupo: 'lectura' },

  /* Carga */
  { key: 'contratos.crear', label: 'Cargar contrato', roles: ['ADMIN', 'OPERADOR', 'CARGA'], rolesAprobacion: ['CARGA'], grupo: 'carga' },
  { key: 'propiedades.crear', label: 'Cargar propiedad', roles: ['ADMIN', 'OPERADOR', 'CARGA'], grupo: 'carga' },
  { key: 'propietarios.crear', label: 'Cargar propietario', roles: ['ADMIN', 'OPERADOR', 'CARGA'], grupo: 'carga' },
  { key: 'pago.manual.cargar', label: 'Cargar pago manual', roles: ['ADMIN', 'OPERADOR'], rolesAprobacion: ['OPERADOR'], grupo: 'carga' },
  { key: 'gasto.caja.cargar', label: 'Cargar gasto de caja', roles: ['ADMIN', 'OPERADOR'], grupo: 'carga' },

  /* Operativa */
  { key: 'reclamos.gestionar', label: 'Gestionar reclamos', roles: ['ADMIN', 'OPERADOR'], grupo: 'operativa' },
  { key: 'profesional.asignar', label: 'Asignar profesional', roles: ['ADMIN', 'OPERADOR'], grupo: 'operativa' },
  { key: 'comunicaciones.enviar', label: 'Enviar comunicaciones (WhatsApp, mail)', roles: ['ADMIN', 'OPERADOR'], grupo: 'operativa' },

  /* Sensibles — requieren ADMIN + PIN */
  { key: 'pago.conciliar', label: 'Conciliar pago', roles: ['ADMIN', 'OPERADOR'], requierePin: true, grupo: 'sensible' },
  { key: 'pago.rechazar', label: 'Rechazar pago', roles: ['ADMIN', 'OPERADOR'], requierePin: true, grupo: 'sensible' },
  { key: 'pago.revertir', label: 'Revertir conciliación', roles: ['ADMIN'], requierePin: true, grupo: 'sensible' },
  { key: 'contrato.aprobar', label: 'Aprobar contrato cargado', roles: ['ADMIN'], requierePin: true, grupo: 'sensible' },
  { key: 'rendicion.confirmar', label: 'Rendir a propietario', roles: ['ADMIN'], requierePin: true, grupo: 'sensible' },
  { key: 'deposito.devolver', label: 'Devolver depósito', roles: ['ADMIN'], requierePin: true, grupo: 'sensible' },
  { key: 'caja.eliminar', label: 'Eliminar gasto de caja', roles: ['ADMIN'], requierePin: true, grupo: 'sensible' },
  { key: 'plan.upgrade', label: 'Cambiar plan / facturación', roles: ['ADMIN'], grupo: 'sensible' },
  { key: 'equipo.gestionar', label: 'Gestionar equipo y permisos', roles: ['ADMIN'], grupo: 'sensible' },
  { key: 'sociedades.gestionar', label: 'Gestionar sociedades', roles: ['ADMIN'], grupo: 'sensible' },
];

export function rolTienePermiso(rol: Rol, capacidad: Capacidad): boolean {
  const def = CAPACIDADES.find((c) => c.key === capacidad);
  if (!def) return false;
  return def.roles.includes(rol);
}

export function requierePinPara(capacidad: Capacidad): boolean {
  const def = CAPACIDADES.find((c) => c.key === capacidad);
  return def?.requierePin ?? false;
}

export function requiereAprobacion(rol: Rol, capacidad: Capacidad): boolean {
  const def = CAPACIDADES.find((c) => c.key === capacidad);
  if (!def?.rolesAprobacion) return false;
  return def.rolesAprobacion.includes(rol);
}

export const GRUPO_LABEL: Record<DefinicionCapacidad['grupo'], string> = {
  lectura: 'Lectura · qué módulos ve',
  carga: 'Carga · qué puede cargar (queda pendiente si no es Admin)',
  operativa: 'Operativa · día a día sin firmar plata',
  sensible: 'Sensibles · requieren PIN del usuario',
};
