// Datos de la inmobiliaria (tab "Empresa" de /configuracion).
// Persistidos en localStorage para que sobrevivan al refresh —
// reemplaza al mock-en-memoria que volvía a Inmobiliaria del Sol cada
// vez. En backend real esto va a `PATCH /inmobiliarias/:id`.

const STORAGE_KEY = 'llave-inmo:empresa:v1';

export interface DatosEmpresa {
  nombre: string;
  cuit: string;
  email: string;
  telefono: string;
  matricula: string;
  direccionCalle: string;
  direccionAltura: string;
  direccionPiso: string;
  direccionCiudad: string;
  direccionProvincia: string;
  direccionCp: string;
  notasFiscales: string;
}

export const DATOS_EMPRESA_DEFAULT: DatosEmpresa = {
  nombre: 'Inmobiliaria del Sol',
  // CUIT con dígito verificador válido según algoritmo AFIP. El mock
  // anterior (30-71234567-9) era inválido y nadie se daba cuenta
  // porque no había validación. Ahora que la hay, usamos uno real.
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
  notasFiscales: '',
};

export function leerDatosEmpresa(): DatosEmpresa {
  if (typeof window === 'undefined') return DATOS_EMPRESA_DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DATOS_EMPRESA_DEFAULT;
    const parsed = JSON.parse(raw) as Partial<DatosEmpresa>;
    return { ...DATOS_EMPRESA_DEFAULT, ...parsed };
  } catch {
    return DATOS_EMPRESA_DEFAULT;
  }
}

export function guardarDatosEmpresa(datos: DatosEmpresa): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(datos));
  } catch {
    // localStorage lleno o deshabilitado — fallback silencioso, el
    // estado React mantiene los cambios para la sesión.
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidacionEmpresa {
  ok: boolean;
  errores: Partial<Record<keyof DatosEmpresa, string>>;
}

/**
 * Valida los datos obligatorios de la inmobiliaria antes de guardar.
 * No corremos algoritmo CUIT acá (lo deja al consumidor con
 * `validarCuit`) — sólo chequeamos required + formato email.
 */
export function validarDatosEmpresa(d: DatosEmpresa): ValidacionEmpresa {
  const errores: ValidacionEmpresa['errores'] = {};
  if (!d.nombre.trim()) errores.nombre = 'Ingresá el nombre comercial';
  if (!d.cuit.trim()) errores.cuit = 'Ingresá el CUIT';
  if (!d.email.trim()) {
    errores.email = 'Ingresá el email administrador';
  } else if (!EMAIL_RE.test(d.email.trim())) {
    errores.email = 'Formato de email inválido (ej: contacto@inmo.com.ar)';
  }
  return { ok: Object.keys(errores).length === 0, errores };
}
