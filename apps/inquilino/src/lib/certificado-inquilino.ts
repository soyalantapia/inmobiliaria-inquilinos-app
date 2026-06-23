/**
 * Certificado de inquilino · "reemplazo del garante".
 *
 * Idea de Ramiro en el meeting:
 *   "Yo lo pagué a través de la aplicación. Acá está, voy lo presento
 *    en inmobiliaria y no me va a pedir garantes si tengo esto."
 *
 * El inquilino que está al día puede generar un certificado con su
 * historial de pagos verificable. Lo lleva a OTRA inmobiliaria cuando
 * va a alquilar otro inmueble — la inmo de destino entra a
 * /verificar/[hash] y constata que el inquilino tiene historial limpio.
 *
 * En producción esto se firma con la clave privada de My Alquiler y la
 * verificación valida la firma + chequea contra el datawarehouse que
 * el certificado no haya sido revocado. En la demo es determinístico
 * por hash de los datos.
 */

import { liquidacionesMock, contratoMock } from './mock-data';

export type NivelHistorial = 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'NUEVO';

export interface CertificadoInquilino {
  /** Hash único del certificado (firma simbólica). */
  hash: string;
  /** Datos del inquilino. */
  inquilino: {
    nombre: string;
    dni: string;
    email: string;
    telefono: string;
  };
  /** Resumen del contrato vigente. */
  contratoActual: {
    direccion: string;
    inmobiliaria: string;
    fechaInicio: string;
    montoMensual: number;
    moneda: 'ARS' | 'USD';
    /** Meses cumplidos en el contrato actual. */
    mesesCumplidos: number;
  };
  /** Métricas del historial de pagos. */
  historial: {
    /** Total de cuotas vencidas hasta la fecha. */
    cuotasTotales: number;
    /** Cuotas pagadas. */
    cuotasPagadas: number;
    /** Cuotas pagadas al día (sin atraso). */
    cuotasAlDia: number;
    /** Atraso promedio en días (0 si nunca atrasó). */
    atrasoPromedioDias: number;
    /** Cantidad de pagos rechazados / problemáticos. */
    pagosRechazados: number;
    /** Ratings recibidos a profesionales (proxy de "cuida la propiedad"). */
    ratingPromedio: number;
  };
  /** Nivel global del historial — lo que ve de un vistazo la inmo destino. */
  nivel: NivelHistorial;
  /** Texto descriptivo del nivel. */
  nivelDetalle: string;
  /** Cuándo se generó el certificado. */
  generadoAt: string;
  /** Hasta cuándo es válido (30 días por defecto). */
  validoHasta: string;
  /** URL pública de verificación. */
  urlVerificacion: string;
}

/* ============================================================
 * Hash determinístico
 *
 * No es críptico — sólo da una "firma" reproducible para la demo.
 * En backend real esto se reemplaza por HMAC-SHA256 con la key
 * privada de My Alquiler.
 * ============================================================ */
function hashCertificado(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Mezclamos un segundo paso para llegar a algo legible
  let h2 = 5381;
  for (let i = 0; i < input.length; i++) {
    h2 = (h2 * 33) ^ input.charCodeAt(i);
  }
  // 12 caracteres alfanuméricos en mayúsculas, separados por guion en bloques
  // de 4: e.g. "X9KP-MNZ4-7BHF". Es lo que va en el verificador.
  const combined = ((h >>> 0).toString(36) + (h2 >>> 0).toString(36))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .padEnd(12, '0')
    .slice(0, 12);
  return `${combined.slice(0, 4)}-${combined.slice(4, 8)}-${combined.slice(8, 12)}`;
}

/* ============================================================
 * Métricas del historial — calculadas sobre los mocks que ya
 * existen. En producción, vienen del datawarehouse.
 * ============================================================ */
function calcularHistorial(): CertificadoInquilino['historial'] {
  // Tomamos las liquidaciones del mock. Cuotas totales = todas las que
  // vencieron hasta hoy. Pagadas = las que están con estado PAGADO.
  const ahora = Date.now();
  const liqsVencidas = liquidacionesMock.filter(
    (l) => new Date(l.fechaVencimiento).getTime() <= ahora,
  );
  const cuotasTotales = liqsVencidas.length;
  const pagadas = liqsVencidas.filter((l) => l.estado === 'PAGADO').length;

  // Asumimos que en la demo el inquilino siempre estuvo "casi al día"
  // (1 atraso menor de promedio). En backend real esto se calcula sobre
  // historial real.
  const cuotasAlDia = Math.max(0, pagadas - 1);
  const atrasoPromedio = pagadas > 0 ? Math.round(((pagadas - cuotasAlDia) / pagadas) * 4) : 0;

  return {
    cuotasTotales,
    cuotasPagadas: pagadas,
    cuotasAlDia,
    atrasoPromedioDias: atrasoPromedio,
    pagosRechazados: 0,
    ratingPromedio: 4.7,
  };
}

function calcularNivel(historial: CertificadoInquilino['historial']): {
  nivel: NivelHistorial;
  detalle: string;
} {
  if (historial.cuotasTotales === 0) {
    return {
      nivel: 'NUEVO',
      detalle: 'Sin historial verificable todavía — contrato recién iniciado.',
    };
  }
  const ratio = historial.cuotasAlDia / Math.max(historial.cuotasTotales, 1);
  if (ratio >= 0.95 && historial.pagosRechazados === 0) {
    return {
      nivel: 'EXCELENTE',
      detalle:
        `Pagó ${historial.cuotasAlDia} de ${historial.cuotasTotales} cuotas perfectas al día. Cero rechazos.`,
    };
  }
  if (ratio >= 0.80) {
    return {
      nivel: 'BUENO',
      detalle:
        `Pagó ${historial.cuotasAlDia}/${historial.cuotasTotales} al día (${historial.atrasoPromedioDias} día${historial.atrasoPromedioDias === 1 ? '' : 's'} de atraso promedio en las demoradas).`,
    };
  }
  return {
    nivel: 'REGULAR',
    detalle:
      `${historial.cuotasPagadas}/${historial.cuotasTotales} pagadas pero con atrasos recurrentes (promedio ${historial.atrasoPromedioDias} días).`,
  };
}

/* ============================================================
 * Generación
 * ============================================================ */

/**
 * Construye el certificado del inquilino actual basado en los mocks.
 * Se llama desde la página /certificado del inquilino y desde
 * /verificar/[hash] (cuando la otra inmo carga el link).
 */
export function generarCertificado(): CertificadoInquilino {
  const inquilino = {
    nombre: 'Mariela Sosa',
    dni: '38.421.567',
    email: 'mariela.sosa@gmail.com',
    telefono: '+54 9 11 4321 9876',
  };
  const inicio = new Date(contratoMock.fechaInicio);
  const meses =
    (new Date().getFullYear() - inicio.getFullYear()) * 12 +
    (new Date().getMonth() - inicio.getMonth());

  const historial = calcularHistorial();
  const { nivel, detalle: nivelDetalle } = calcularNivel(historial);

  // Hash basado SOLO en datos inmutables (DNI + contrato + inmo). Antes
  // incluía historial.cuotasPagadas en la semilla, pero ese valor crece con
  // el tiempo (calcularHistorial usa new Date() para contar meses), así que
  // el hash cambiaba mes a mes y entre deploys → un link de certificado
  // compartido a otra inmobiliaria se rompía con 404 (dynamicParams=false
  // sólo pre-renderiza el hash del momento del build). Sacando cuotasPagadas,
  // el hash de un inquilino es estable para siempre, que es lo que el caso
  // "certificado social" necesita: el link compartido sigue vivo.
  const semilla = [
    inquilino.dni,
    contratoMock.id,
    contratoMock.inmobiliaria,
  ].join('|');
  const hash = hashCertificado(semilla);

  const ahora = new Date();
  const validoHasta = new Date(ahora.getTime() + 30 * 86400000); // 30 días

  // URL pública: en demo apunta al mismo origin para que se pueda
  // probar local + GH Pages. En producción es myalquiler.com.ar/verificar.
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://myalquiler.com.ar';
  // En el export estático (GH Pages) la app vive bajo un basePath que origin NO
  // incluye → el link compartido daba 404. NEXT_PUBLIC_BASE_PATH se setea solo en
  // ese build (vacío en dev/Railway, así que el link queda igual que antes).
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const urlVerificacion = `${origin}${basePath}/verificar/${hash}`;

  return {
    hash,
    inquilino,
    contratoActual: {
      direccion: contratoMock.direccion,
      inmobiliaria: contratoMock.inmobiliaria,
      fechaInicio: contratoMock.fechaInicio,
      montoMensual: contratoMock.montoActual,
      moneda: contratoMock.moneda,
      mesesCumplidos: Math.max(0, meses),
    },
    historial,
    nivel,
    nivelDetalle,
    generadoAt: ahora.toISOString(),
    validoHasta: validoHasta.toISOString(),
    urlVerificacion,
  };
}

/**
 * Reconstruye un certificado a partir de su hash. En backend real
 * esto consulta el datawarehouse; en demo regeneramos siempre el del
 * inquilino mock porque sólo hay uno.
 */
export function buscarCertificadoPorHash(hash: string): CertificadoInquilino | null {
  const c = generarCertificado();
  // En demo, cualquier hash con el formato correcto matchea con el
  // inquilino actual. En producción esto valida contra la DB.
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(hash)) return null;
  // Forzamos el hash recibido (para que la página pública muestre el
  // hash que el otro inmo escaneó, no el regenerado).
  return { ...c, hash };
}

export const NIVEL_LABEL: Record<NivelHistorial, string> = {
  EXCELENTE: 'Excelente',
  BUENO: 'Bueno',
  REGULAR: 'Regular',
  NUEVO: 'Sin historial',
};

export const NIVEL_COLOR: Record<NivelHistorial, string> = {
  EXCELENTE: 'bg-emerald-500 text-white',
  BUENO: 'bg-primary text-primary-foreground',
  REGULAR: 'bg-amber-500 text-white',
  NUEVO: 'bg-muted text-muted-foreground',
};
