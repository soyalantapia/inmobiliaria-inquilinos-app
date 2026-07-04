/**
 * Migración de cartera: parseo + validación de un Excel/CSV de contratos con
 * MAPEO FLEXIBLE de columnas (el admin sube su propia planilla, con sus propios
 * nombres/orden de columnas, y elige cuál columna es cuál). Todo determinístico
 * — sin IA. Auto-sugerimos el mapeo por sinónimos de header, pero el admin lo
 * confirma/corrige.
 */

export type TipoPropiedadImport = 'DEPARTAMENTO' | 'CASA' | 'LOCAL' | 'GALPON';

export interface CampoImportacion {
  key: string;
  label: string;
  requerido: boolean;
  /** Headers habituales (normalizados) que mapean a este campo. */
  sinonimos: string[];
}

/** Campos destino de la importación. El admin mapea columnas de su planilla a estos. */
export const CAMPOS_IMPORTACION: CampoImportacion[] = [
  { key: 'direccion', label: 'Dirección', requerido: true, sinonimos: ['direccion', 'domicilio', 'propiedad', 'inmueble', 'direccion propiedad'] },
  { key: 'ciudad', label: 'Ciudad', requerido: false, sinonimos: ['ciudad', 'localidad', 'partido'] },
  { key: 'provincia', label: 'Provincia', requerido: false, sinonimos: ['provincia', 'pcia'] },
  { key: 'tipo', label: 'Tipo de propiedad', requerido: false, sinonimos: ['tipo', 'tipo propiedad', 'tipo de propiedad'] },
  { key: 'inquilinoNombre', label: 'Inquilino (nombre)', requerido: true, sinonimos: ['inquilino', 'nombre inquilino', 'locatario', 'nombre', 'inquilino nombre'] },
  { key: 'inquilinoApellido', label: 'Inquilino (apellido)', requerido: false, sinonimos: ['apellido', 'apellido inquilino'] },
  { key: 'inquilinoEmail', label: 'Inquilino (email)', requerido: false, sinonimos: ['email', 'correo', 'mail', 'e-mail'] },
  { key: 'inquilinoTelefono', label: 'Inquilino (teléfono)', requerido: false, sinonimos: ['telefono', 'celular', 'tel', 'cel', 'telefono inquilino'] },
  { key: 'inquilinoDni', label: 'Inquilino (DNI)', requerido: false, sinonimos: ['dni', 'documento', 'cuit', 'cuil'] },
  { key: 'propietarioNombre', label: 'Propietario', requerido: false, sinonimos: ['propietario', 'dueno', 'dueño', 'locador', 'nombre propietario'] },
  { key: 'monto', label: 'Monto del alquiler', requerido: true, sinonimos: ['monto', 'alquiler', 'importe', 'valor', 'precio', 'monto alquiler', 'canon'] },
  { key: 'moneda', label: 'Moneda', requerido: false, sinonimos: ['moneda'] },
  { key: 'fechaInicio', label: 'Fecha de inicio', requerido: true, sinonimos: ['inicio', 'fecha inicio', 'desde', 'fecha desde', 'inicio contrato'] },
  { key: 'fechaFin', label: 'Fecha de fin', requerido: false, sinonimos: ['fin', 'fecha fin', 'hasta', 'vencimiento', 'fin contrato'] },
  { key: 'diaPago', label: 'Día de pago', requerido: false, sinonimos: ['dia pago', 'dia de pago', 'vencimiento pago', 'dia'] },
];

export function normalizarHeader(h: string): string {
  return h
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sugiere { campoKey: columnaIndex } matcheando headers por sinónimo exacto (normalizado). */
export function sugerirMapeo(headers: string[]): Record<string, number> {
  const norm = headers.map(normalizarHeader);
  const mapeo: Record<string, number> = {};
  for (const campo of CAMPOS_IMPORTACION) {
    const idx = norm.findIndex((h) => campo.sinonimos.includes(h));
    if (idx >= 0) mapeo[campo.key] = idx;
  }
  return mapeo;
}

export interface FilaMapeada {
  direccion: string;
  ciudad: string;
  provincia: string;
  tipo: TipoPropiedadImport;
  inquilinoNombre: string;
  inquilinoApellido: string | null;
  inquilinoEmail: string | null;
  inquilinoTelefono: string | null;
  inquilinoDni: string | null;
  propietarioNombre: string | null;
  monto: number;
  moneda: 'ARS' | 'USD';
  fechaInicio: Date | null;
  fechaFin: Date | null;
  diaPago: number;
}

function celda(fila: unknown[], mapeo: Record<string, number>, key: string): unknown {
  const idx = mapeo[key];
  return idx === undefined ? undefined : fila[idx];
}

function texto(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

export function parsearFecha(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const ms = Math.round((v - 25569) * 86400 * 1000); // serial Excel → ms
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  const ar = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  if (ar) {
    let [, d, m, y] = ar.map(Number) as unknown as [never, number, number, number];
    if (y < 100) y += 2000;
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parsearTipo(v: unknown): TipoPropiedadImport {
  const s = normalizarHeader(texto(v));
  if (s.includes('casa')) return 'CASA';
  if (s.includes('local')) return 'LOCAL';
  if (s.includes('galpon')) return 'GALPON';
  return 'DEPARTAMENTO';
}

export function parsearFilaMapeada(fila: unknown[], mapeo: Record<string, number>): FilaMapeada {
  const nombreRaw = texto(celda(fila, mapeo, 'inquilinoNombre'));
  let nombre = nombreRaw;
  let apellido = texto(celda(fila, mapeo, 'inquilinoApellido')) || null;
  // Si no hay columna de apellido pero el nombre trae 2+ palabras, partimos.
  if (!apellido && mapeo.inquilinoApellido === undefined && nombreRaw.includes(' ')) {
    const partes = nombreRaw.split(/\s+/);
    nombre = partes[0]!;
    apellido = partes.slice(1).join(' ');
  }
  const monto = Number(texto(celda(fila, mapeo, 'monto')).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  const monedaRaw = normalizarHeader(texto(celda(fila, mapeo, 'moneda')));
  const moneda: 'ARS' | 'USD' = monedaRaw.includes('usd') || monedaRaw.includes('dolar') || monedaRaw.includes('u$s') ? 'USD' : 'ARS';
  const diaPagoRaw = Number(texto(celda(fila, mapeo, 'diaPago')));
  const diaPago = Number.isInteger(diaPagoRaw) && diaPagoRaw >= 1 && diaPagoRaw <= 31 ? diaPagoRaw : 10;

  return {
    direccion: texto(celda(fila, mapeo, 'direccion')),
    ciudad: texto(celda(fila, mapeo, 'ciudad')),
    provincia: texto(celda(fila, mapeo, 'provincia')),
    tipo: parsearTipo(celda(fila, mapeo, 'tipo')),
    inquilinoNombre: nombre,
    inquilinoApellido: apellido,
    inquilinoEmail: texto(celda(fila, mapeo, 'inquilinoEmail')).toLowerCase() || null,
    inquilinoTelefono: texto(celda(fila, mapeo, 'inquilinoTelefono')) || null,
    inquilinoDni: texto(celda(fila, mapeo, 'inquilinoDni')) || null,
    propietarioNombre: texto(celda(fila, mapeo, 'propietarioNombre')) || null,
    monto: Number.isFinite(monto) ? monto : NaN,
    moneda,
    fechaInicio: parsearFecha(celda(fila, mapeo, 'fechaInicio')),
    fechaFin: parsearFecha(celda(fila, mapeo, 'fechaFin')),
    diaPago,
  };
}

export type EstadoFilaImport = 'OK' | 'ADVERTENCIA' | 'ERROR' | 'DUPLICADO';

export interface ValidacionFila {
  estado: EstadoFilaImport;
  motivo: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida una fila mapeada. `emailsExistentes` = emails de inquilinos ya en la cartera. */
export function validarFila(d: FilaMapeada, emailsExistentes: Set<string>): ValidacionFila {
  if (!d.direccion) return { estado: 'ERROR', motivo: 'Falta la dirección de la propiedad' };
  if (!d.inquilinoNombre) return { estado: 'ERROR', motivo: 'Falta el nombre del inquilino' };
  if (!Number.isFinite(d.monto) || d.monto <= 0) return { estado: 'ERROR', motivo: 'Monto del alquiler inválido' };
  if (!d.fechaInicio) return { estado: 'ERROR', motivo: 'Fecha de inicio inválida o vacía' };
  if (d.inquilinoEmail && !EMAIL_RE.test(d.inquilinoEmail)) return { estado: 'ERROR', motivo: 'Email del inquilino con formato inválido' };
  if (d.inquilinoEmail && emailsExistentes.has(d.inquilinoEmail)) {
    return { estado: 'DUPLICADO', motivo: 'Ya existe un inquilino con ese email en tu cartera' };
  }
  const faltantes: string[] = [];
  if (!d.inquilinoDni) faltantes.push('DNI');
  if (!d.inquilinoEmail) faltantes.push('email');
  if (faltantes.length > 0) return { estado: 'ADVERTENCIA', motivo: `Se importa sin ${faltantes.join(' ni ')}` };
  return { estado: 'OK', motivo: null };
}

/** fechaFin por defecto: +24 meses desde el inicio (si la planilla no la trae). */
export function fechaFinPorDefecto(inicio: Date): Date {
  const d = new Date(inicio);
  d.setMonth(d.getMonth() + 24);
  return d;
}
