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

/**
 * CAJA se agregó por pedido explícito de la administradora en la prueba del 03/08:
 * "hay uno solo que se tiene que llamar caja y tiene que ser el usuario del cajero,
 * nada más. Y yo como administradora. Los demás, nadie puede autorizar un pago."
 *
 * Antes OPERADOR tenía `pago.conciliar` y `pago.rechazar`, así que cualquiera del día
 * a día podía dar por cobrada plata. Ahora esas dos capacidades son de ADMIN + CAJA.
 */
export type Rol = 'ADMIN' | 'CAJA' | 'OPERADOR' | 'CARGA' | 'LECTURA';

export const ROLES_ORDEN: Rol[] = ['ADMIN', 'CAJA', 'OPERADOR', 'CARGA', 'LECTURA'];

// V2b-04: estos labels son la fuente de verdad para los badges de rol en
// toda la app (auditoría, etc.). Antes decían "Carga"/"Lectura" pero Equipo
// y permisos usa "Carga limitada"/"Solo lectura" — el mismo rol salía con
// dos nombres. Unificados a los descriptivos.
// Los nombres salen del vocabulario de la inmobiliaria, no del nuestro: en la prueba
// del 03/08 la administradora dijo "no sé por qué usaste esos nombres" y "operador…
// no tiene sentido". Los VALORES del enum se mantienen (son datos en producción);
// lo que cambia es cómo se llaman en pantalla.
export const ROL_LABEL: Record<Rol, string> = {
  ADMIN: 'Administradora',
  CAJA: 'Caja',
  OPERADOR: 'Operador',
  CARGA: 'Carga limitada',
  LECTURA: 'Consulta',
};

export const ROL_DESCRIPCION: Record<Rol, string> = {
  ADMIN:
    'Acceso completo: contratos, pagos, rendiciones, depósitos, equipo, plan y facturación. Aprueba lo que cargan los demás.',
  CAJA:
    'El mostrador: confirma o rechaza los pagos que informan los inquilinos, carga cobros en efectivo y mueve la caja. No carga contratos ni rinde a propietarios.',
  OPERADOR:
    'Día a día del panel: contratos, propiedades, reclamos, comunicaciones, gastos de caja. NO autoriza pagos.',
  CARGA:
    'Solo carga inicial: contratos, propietarios, propiedades. Lo que carga queda pendiente de aprobación.',
  LECTURA:
    'Ve todo sin modificar nada — contadores, auditoría y propietarios que quieren mirar.',
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
  | 'cuentas.ver'
  | 'propietarios.ver'
  | 'profesionales.ver'
  | 'auditoria.ver'
  | 'configuracion.ver'
  | 'metricas.ver'
  /* Carga de datos (no aprobada) */
  | 'contratos.crear'
  | 'propiedades.crear'
  | 'propietarios.crear'
  | 'pago.manual.cargar'
  | 'gasto.caja.cargar'
  | 'cuentas.gestionar'
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
  { key: 'home.ver', label: 'Ver home y bandeja del día', roles: ['ADMIN', 'CAJA', 'OPERADOR', 'CARGA', 'LECTURA'], grupo: 'lectura' },
  { key: 'propiedades.ver', label: 'Ver propiedades', roles: ['ADMIN', 'OPERADOR', 'CARGA', 'LECTURA'], grupo: 'lectura' },
  // CAJA necesita abrir el contrato para validar un pago (de quién es, cuánto debía).
  { key: 'contratos.ver', label: 'Ver contratos', roles: ['ADMIN', 'CAJA', 'OPERADOR', 'CARGA', 'LECTURA'], grupo: 'lectura' },
  { key: 'pagos.ver', label: 'Ver pagos y rendiciones', roles: ['ADMIN', 'CAJA', 'OPERADOR', 'LECTURA'], grupo: 'lectura' },
  { key: 'reclamos.ver', label: 'Ver reclamos', roles: ['ADMIN', 'OPERADOR', 'LECTURA'], grupo: 'lectura' },
  { key: 'screening.ver', label: 'Ver screening', roles: ['ADMIN', 'OPERADOR'], grupo: 'lectura' },
  { key: 'caja.ver', label: 'Ver caja diaria', roles: ['ADMIN', 'CAJA', 'OPERADOR', 'LECTURA'], grupo: 'lectura' },
  { key: 'cuentas.ver', label: 'Ver cuentas de caja', roles: ['ADMIN', 'CAJA', 'OPERADOR', 'LECTURA'], grupo: 'lectura' },
  { key: 'propietarios.ver', label: 'Ver propietarios', roles: ['ADMIN', 'OPERADOR', 'CARGA', 'LECTURA'], grupo: 'lectura' },
  { key: 'profesionales.ver', label: 'Ver profesionales', roles: ['ADMIN', 'OPERADOR'], grupo: 'lectura' },
  { key: 'auditoria.ver', label: 'Ver auditoría', roles: ['ADMIN', 'LECTURA'], grupo: 'lectura' },
  // Configuración en prod es ADMIN y nada más (ver ConfiguracionProd: los demás roles
  // comen una card 'Solo Admin'). Era el ÚNICO ítem del sidebar sin capacidad, así que
  // los 4 roles lo veían y 3 chocaban con esa pared.
  { key: 'configuracion.ver', label: 'Ver configuración', roles: ['ADMIN'], grupo: 'lectura' },
  { key: 'metricas.ver', label: 'Ver estadisticas', roles: ['ADMIN'], grupo: 'lectura' },

  /* Carga */
  { key: 'contratos.crear', label: 'Cargar contrato', roles: ['ADMIN', 'OPERADOR', 'CARGA'], rolesAprobacion: ['CARGA'], grupo: 'carga' },
  { key: 'propiedades.crear', label: 'Cargar propiedad', roles: ['ADMIN', 'OPERADOR', 'CARGA'], grupo: 'carga' },
  { key: 'propietarios.crear', label: 'Cargar propietario', roles: ['ADMIN', 'OPERADOR', 'CARGA'], grupo: 'carga' },
  // T-37 — El cobro en efectivo en el mostrador es tarea de CAJA (es la que lo recibe).
  //
  // Acá decía además ['ADMIN','CAJA','OPERADOR'] con rolesAprobacion:['OPERADOR'], describiendo
  // un circuito —el OPERADOR carga y queda pendiente de aprobación— que NUNCA se construyó:
  // `requiereAprobacion` no se llama en ningún lado de apps/api (para contratos sí existe el
  // equivalente, `contratoQuedaPendiente`; para pagos no). Mientras tanto POST /pagos/manual
  // exige `pago.conciliar`, así que un OPERADOR que lo intentaba se comía un 403 — pero la
  // pantalla Configuración → Equipo le mostraba a la administradora que sí podía, y ella
  // asignaba ese rol al que cobra en el mostrador.
  //
  // Se alinea la matriz con lo que el sistema hace de verdad. NO le quita nada a nadie: hoy
  // OPERADOR ya no puede. Quien cobra en mostrador va con rol CAJA, que existe exactamente
  // para eso. Construir el circuito de aprobación de pagos es otra cosa y está en T-37-N1.
  { key: 'pago.manual.cargar', label: 'Cargar pago manual (efectivo)', roles: ['ADMIN', 'CAJA'], grupo: 'carga' },
  { key: 'gasto.caja.cargar', label: 'Cargar gasto de caja', roles: ['ADMIN', 'CAJA', 'OPERADOR'], grupo: 'carga' },
  { key: 'cuentas.gestionar', label: 'Definir cuentas de caja', roles: ['ADMIN'], grupo: 'sensible' },

  /* Operativa */
  { key: 'reclamos.gestionar', label: 'Gestionar reclamos', roles: ['ADMIN', 'OPERADOR'], grupo: 'operativa' },
  { key: 'profesional.asignar', label: 'Asignar profesional', roles: ['ADMIN', 'OPERADOR'], grupo: 'operativa' },
  { key: 'comunicaciones.enviar', label: 'Enviar comunicaciones (WhatsApp, mail)', roles: ['ADMIN', 'OPERADOR'], grupo: 'operativa' },

  /* Sensibles — requieren ADMIN + PIN */
  // SOLO ADMIN + CAJA. Antes también OPERADOR, y era lo que la administradora marcó
  // como mal: "operador y carga limitada me está dando que puede pagar" → "nadie
  // puede autorizar un pago" salvo la caja y ella.
  { key: 'pago.conciliar', label: 'Confirmar pago', roles: ['ADMIN', 'CAJA'], requierePin: true, grupo: 'sensible' },
  { key: 'pago.rechazar', label: 'Rechazar pago', roles: ['ADMIN', 'CAJA'], requierePin: true, grupo: 'sensible' },
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

/**
 * ¿El contrato que carga este rol queda PENDIENTE de aprobación?
 *
 * Precondición esperada del caller: que `rol` ya tenga el permiso base
 * `contratos.crear` (el flujo de alta lo valida antes de llegar acá). Si un
 * bug futuro rompiera esa precondición, esta función falla CERRADO: un rol
 * sin permiso para crear contratos no tiene ninguna razón para activar uno
 * solo, así que se lo trata como pendiente en vez de asumir que está bien.
 *
 * Con la precondición cumplida, dos fuentes se suman:
 *  1. El baseline del catálogo (`rolesAprobacion` de `contratos.crear` — hoy: CARGA).
 *  2. El switch de la inmobiliaria: si lo prendió, queda pendiente todo el que NO
 *     pueda aprobar. Derivar del permiso (y no de una lista de roles suelta) evita
 *     que la regla se desincronice de la matriz.
 *
 * Garantía real: quien puede aprobar (`contrato.aprobar`) queda exento, así que
 * quien prende el switch no se bloquea a sí mismo. Esto NO garantiza que el
 * lockout sea imposible en general — una inmobiliaria sin ningún ADMIN activo
 * y el flag prendido deja los contratos de OPERADOR pendientes para siempre;
 * eso es un problema operativo de la inmobiliaria, no algo que esta función
 * pueda resolver.
 */
export function contratoQuedaPendiente(rol: Rol, contratosRequierenAprobacion: boolean): boolean {
  if (!rolTienePermiso(rol, 'contratos.crear')) return true;
  if (requiereAprobacion(rol, 'contratos.crear')) return true;
  return contratosRequierenAprobacion && !rolTienePermiso(rol, 'contrato.aprobar');
}

export const GRUPO_LABEL: Record<DefinicionCapacidad['grupo'], string> = {
  lectura: 'Lectura · qué módulos ve',
  carga: 'Carga · qué puede cargar (queda pendiente si no es Admin)',
  operativa: 'Operativa · día a día sin firmar plata',
  // Decía "requieren PIN del usuario" y era falso desde el 05/07: el PIN se eliminó de
  // toda la plataforma (05-DECISIONES §7) y `verificarPinUsuario` aprueba siempre. Lo
  // que protege estas acciones es el ROL, no un PIN.
  sensible: 'Sensibles · mueven plata o tocan la configuración',
};
