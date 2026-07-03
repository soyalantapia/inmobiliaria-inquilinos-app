import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { rolTienePermiso } from '@llave/shared';
import { resolverEsquemaMora } from '../lib/punitorios.js';
import { prisma } from '../db.js';
import { urlEsDelTenant } from './uploads.js';
import {
  exigirContratoActivo,
  requireAuth,
  requireContratoAcceso,
  requireInquilino,
  requireUsuario,
} from '../auth/guards.js';

/**
 * Fase 6 — Mundo inquilino: certificado del inquilino (el "reemplazo del
 * garante", calculado server-side desde las liquidaciones REALES), screening
 * simulado coherente, co-inquilinos con permisos, boletas de servicios y
 * reportes piloto con tracking server-side completo (el TODO explícito de
 * piloto-storage.ts).
 */

/* ============================================================
 * Certificado — port de calcularHistorial / calcularNivel del mock
 * (apps/inquilino/src/lib/certificado-inquilino.ts), pero alimentado
 * por las liquidaciones reales del contrato en vez de asumir "casi
 * al día".
 * ============================================================ */

type NivelHistorial = 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'NUEVO';

// type (no interface): los type alias tienen index signature implícita y
// entran directo como Prisma.InputJsonValue al persistir el snapshot.
type HistorialCertificado = {
  cuotasTotales: number;
  cuotasPagadas: number;
  cuotasAlDia: number;
  atrasoPromedioDias: number;
  pagosRechazados: number;
  ratingPromedio: number;
};

interface LiqHistorial {
  fechaVencimiento: Date;
  fechaPago: Date | null;
  estado: string;
}

const DIA_MS = 86_400_000;

function calcularHistorial(
  liqs: LiqHistorial[],
  pagosRechazados: number,
  ratingPromedio: number,
): HistorialCertificado {
  const ahora = Date.now();
  // Comparamos por DÍA (no por timestamp): un pago conciliado el mismo día del
  // vencimiento pero más tarde (fechaPago 14:00 vs vencimiento 00:00 UTC) caía
  // como "demorado". Normalizamos ambos al inicio del día UTC.
  const startOfDayUTC = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  // Cuotas totales = todas las que vencieron hasta hoy. Pagadas = PAGADO.
  const vencidas = liqs.filter((l) => l.fechaVencimiento.getTime() <= ahora);
  const cuotasTotales = vencidas.length;
  const pagadas = vencidas.filter((l) => l.estado === 'PAGADO');
  // Al día = pagadas en o antes del vencimiento (sin fechaPago asumimos al día).
  const alDia = pagadas.filter(
    (l) => !l.fechaPago || startOfDayUTC(l.fechaPago) <= startOfDayUTC(l.fechaVencimiento),
  );
  const demoradas = pagadas.filter(
    (l) => l.fechaPago && startOfDayUTC(l.fechaPago) > startOfDayUTC(l.fechaVencimiento),
  );
  const atrasoPromedioDias =
    demoradas.length > 0
      ? Math.round(
          demoradas.reduce(
            (acc, l) => acc + (startOfDayUTC(l.fechaPago!) - startOfDayUTC(l.fechaVencimiento)) / DIA_MS,
            0,
          ) / demoradas.length,
        )
      : 0;

  return {
    cuotasTotales,
    cuotasPagadas: pagadas.length,
    cuotasAlDia: alDia.length,
    atrasoPromedioDias,
    pagosRechazados,
    ratingPromedio,
  };
}

function calcularNivel(historial: HistorialCertificado): { nivel: NivelHistorial; detalle: string } {
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
      detalle: `Pagó ${historial.cuotasAlDia} de ${historial.cuotasTotales} cuotas perfectas al día. Cero rechazos.`,
    };
  }
  if (ratio >= 0.8) {
    return {
      nivel: 'BUENO',
      detalle: `Pagó ${historial.cuotasAlDia}/${historial.cuotasTotales} al día (${historial.atrasoPromedioDias} día${historial.atrasoPromedioDias === 1 ? '' : 's'} de atraso promedio en las demoradas).`,
    };
  }
  return {
    nivel: 'REGULAR',
    detalle: `${historial.cuotasPagadas}/${historial.cuotasTotales} pagadas pero con atrasos recurrentes (promedio ${historial.atrasoPromedioDias} días).`,
  };
}

/**
 * Hash determinístico XXXX-XXXX-XXXX (port del mock). Basado SOLO en datos
 * inmutables (DNI + contrato + inmobiliaria) para que el link compartido a
 * otra inmobiliaria siga vivo aunque el historial crezca.
 */
function hashCertificado(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let h2 = 5381;
  for (let i = 0; i < input.length; i++) {
    h2 = (h2 * 33) ^ input.charCodeAt(i);
  }
  const combined = ((h >>> 0).toString(36) + (h2 >>> 0).toString(36))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .padEnd(12, '0')
    .slice(0, 12);
  return `${combined.slice(0, 4)}-${combined.slice(4, 8)}-${combined.slice(8, 12)}`;
}

/* ============================================================
 * Screening simulado coherente — la identidad del informe es
 * EXACTAMENTE la solicitada (cuit + nombre); el resto se deriva
 * determinísticamente del CUIT para que el mismo CUIT dé siempre
 * el mismo perfil.
 * ============================================================ */

/** FNV-1a → uint32, semilla determinística por CUIT. */
function semillaNumerica(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], n: number): T {
  return arr[n % arr.length]!;
}

function slugDe(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

const BANCOS = [
  { codigo: '0007', nombre: 'Banco Galicia' },
  { codigo: '0011', nombre: 'Banco Nación' },
  { codigo: '0017', nombre: 'BBVA Argentina' },
  { codigo: '0072', nombre: 'Banco Patagonia' },
  { codigo: '0027', nombre: 'Banco Supervielle' },
  { codigo: '0044', nombre: 'Banco Hipotecario' },
] as const;

const CALLES = [
  { calle: 'Av. Rivadavia', localidad: 'Caballito', partido: 'CABA', codigoPostal: '1406' },
  { calle: 'Av. Corrientes', localidad: 'Almagro', partido: 'CABA', codigoPostal: '1194' },
  { calle: 'Humboldt', localidad: 'Palermo', partido: 'CABA', codigoPostal: '1414' },
  { calle: 'Av. Maipú', localidad: 'Vicente López', partido: 'Vicente López', codigoPostal: '1602' },
  { calle: 'Castro Barros', localidad: 'Boedo', partido: 'CABA', codigoPostal: '1217' },
] as const;

const EMPLEADORES = [
  { cuit: '30-71234567-9', razonSocial: 'Globant Argentina S.A.', ciiu: '620100', actividad: 'Servicios de consultores en informática', paginaWeb: 'https://www.globant.com' },
  { cuit: '30-50000661-3', razonSocial: 'Banco de Galicia y Buenos Aires S.A.U.', ciiu: '641920', actividad: 'Servicios bancarios', paginaWeb: 'https://www.galicia.ar' },
  { cuit: '30-68731043-4', razonSocial: 'MercadoLibre S.R.L.', ciiu: '479900', actividad: 'Comercio electrónico', paginaWeb: 'https://www.mercadolibre.com.ar' },
  { cuit: '30-54668997-9', razonSocial: 'Techint Compañía Técnica Internacional S.A.', ciiu: '711003', actividad: 'Servicios de ingeniería', paginaWeb: 'https://www.techint.com' },
] as const;

const NOMBRES_F = ['María Laura', 'Carolina', 'Verónica', 'Silvina', 'Andrea'] as const;
const NOMBRES_M = ['Martín', 'Gustavo', 'Pablo', 'Diego', 'Hernán'] as const;
const APELLIDOS_NEUTROS = ['Fernández', 'Romano', 'Gutiérrez', 'Paz', 'Aguirre'] as const;
const VEHICULOS = [
  { marca: 'Toyota', modelo: 'Corolla Cross XEI', anio: 2023 },
  { marca: 'Volkswagen', modelo: 'Amarok V6', anio: 2022 },
  { marca: 'Renault', modelo: 'Sandero 1.6', anio: 2017 },
  { marca: 'Fiat', modelo: 'Cronos Drive', anio: 2021 },
] as const;

function ultimosPeriodos(n: number): string[] {
  const out: string[] = [];
  const hoy = new Date();
  for (let i = 1; i <= n; i++) {
    const p = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    out.push(`${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function generarInformeScreening(cuit: string, nombre: string, apellido: string) {
  const digitos = cuit.replace(/\D/g, '');
  const sed = semillaNumerica(digitos);
  const telefono = (off: number) =>
    `+54 9 11 ${String(3000 + ((sed + off * 911) % 6999)).padStart(4, '0')} ${String(1000 + ((sed * 7 + off * 137) % 8999)).padStart(4, '0')}`;

  // Identidad EXACTA a lo solicitado: cuit y nombre tal cual; DNI = los 8 del medio.
  const dniDigitos = digitos.slice(2, 10);
  const dni = `${dniDigitos.slice(0, 2)}.${dniDigitos.slice(2, 5)}.${dniDigitos.slice(5, 8)}`;
  const prefijo = digitos.slice(0, 2);
  const sexo: 'F' | 'M' = prefijo === '27' ? 'F' : prefijo === '20' ? 'M' : sed % 2 === 0 ? 'M' : 'F';
  const email = `${slugDe(`${nombre} ${apellido}`)}@gmail.com`;
  const fechaNacimiento = new Date(Date.UTC(1962 + (sed % 38), sed % 12, 1 + (sed % 28)));

  const scoreNosis = 480 + (sed % 470); // 480-949
  const recomendacion: 'APTO' | 'APTO_CON_GARANTIA' | 'NO_APTO' =
    scoreNosis >= 700 ? 'APTO' : scoreNosis >= 580 ? 'APTO_CON_GARANTIA' : 'NO_APTO';
  const riesgo = recomendacion === 'APTO' ? 'bajo' : recomendacion === 'APTO_CON_GARANTIA' ? 'medio' : 'alto';

  // BCRA coherente con el riesgo
  const entidadesCount = 2 + (sed % 3);
  const entidades = Array.from({ length: entidadesCount }, (_, i) => {
    const banco = pick(BANCOS, sed + i);
    return { ...banco, deuda: 120_000 + ((sed * 31 + i * 977) % 880_000) };
  });
  const deudaTomada = entidades.reduce((acc, e) => acc + e.deuda, 0);
  const deudaEnMora =
    riesgo === 'bajo' ? 0 : riesgo === 'medio' ? Math.round(deudaTomada * 0.08) : Math.round(deudaTomada * 0.35);
  const situaciones =
    riesgo === 'bajo'
      ? { 1: entidadesCount }
      : riesgo === 'medio'
        ? { 1: Math.max(1, entidadesCount - 1), 2: 1 }
        : { 2: 1, 3: Math.max(1, entidadesCount - 1) };
  const bcra = { entidadesCount, deudaTomada, deudaEnMora, riesgo, situaciones, entidades, deudaUltimos24m: true };

  const cheques =
    riesgo === 'alto'
      ? { rechazadosCount: 2 + (sed % 2), rechazadosMonto: 180_000 + (sed % 400_000), levantadosCount: 1, levantadosMonto: 90_000 + (sed % 120_000) }
      : riesgo === 'medio'
        ? { rechazadosCount: 1, rechazadosMonto: 60_000 + (sed % 150_000), levantadosCount: 1, levantadosMonto: 60_000 + (sed % 150_000) }
        : { rechazadosCount: 0, rechazadosMonto: 0, levantadosCount: sed % 3, levantadosMonto: sed % 3 === 0 ? 0 : 150_000 + (sed % 250_000) };

  // Familia: el grupo lleva el apellido SOLICITADO (nada de otra persona)
  const nombreConyuge = sexo === 'M' ? pick(NOMBRES_F, sed) : pick(NOMBRES_M, sed);
  const familia = [
    {
      vinculo: 'CONYUGE',
      nombreCompleto: `${nombreConyuge} ${pick(APELLIDOS_NEUTROS, sed)}`,
      telefonos: [{ numero: telefono(3), tipo: 'CELULAR', whatsappActivo: true }],
      email: `${slugDe(nombreConyuge)}.${slugDe(pick(APELLIDOS_NEUTROS, sed))}@gmail.com`,
    },
    {
      vinculo: 'PADRE_MADRE',
      nombreCompleto: `${sexo === 'M' ? pick(NOMBRES_M, sed + 2) : pick(NOMBRES_F, sed + 2)} ${apellido}`,
      telefonos: [{ numero: telefono(4), tipo: 'FIJO', whatsappActivo: false }],
      email: null,
    },
    {
      vinculo: 'HERMANO',
      nombreCompleto: `${sexo === 'M' ? pick(NOMBRES_F, sed + 4) : pick(NOMBRES_M, sed + 4)} ${apellido}`,
      telefonos: [],
      email: null,
    },
  ];

  const dom = pick(CALLES, sed);
  const domicilio = {
    calle: dom.calle,
    altura: String(800 + (sed % 5600)),
    pisoDpto: sed % 3 === 0 ? null : `${1 + (sed % 11)}°${'ABCD'.charAt(sed % 4)}`,
    codigoPostal: dom.codigoPostal,
    localidad: dom.localidad,
    partido: dom.partido,
    provincia: 'Buenos Aires',
  };

  const relacionDependencia = recomendacion !== 'NO_APTO';
  const rangoBase = recomendacion === 'APTO' ? 5 : recomendacion === 'APTO_CON_GARANTIA' ? 4 : 2;
  const nominaUltimos6m = ultimosPeriodos(6).map((periodo, i) => ({
    periodo,
    rangoIngreso: `A${rangoBase + ((sed + i) % 2)}`,
    fechaPago: `${periodo}-0${5 + (i % 3)}`,
  }));
  const ingresos = {
    categoriaArca: relacionDependencia ? 'RELACION_DEPENDENCIA' : 'MONOTRIBUTO',
    impuestoGanancias: relacionDependencia ? 'AC' : 'NI',
    impuestoIva: relacionDependencia ? 'NA' : 'AC',
    integranteSocietario: false,
    empleador: false,
    ciiu: relacionDependencia ? pick(EMPLEADORES, sed).ciiu : '477190',
    actividadDescripcion: relacionDependencia ? pick(EMPLEADORES, sed).actividad : 'Venta al por menor — monotributo',
    obraSocialCodigo: relacionDependencia ? '203500' : null,
    obraSocialNombre: relacionDependencia ? 'OSDE — Organización de Servicios Directos Empresarios' : null,
    nominaUltimos6m: relacionDependencia ? nominaUltimos6m : [],
  };

  const emp = pick(EMPLEADORES, sed);
  const empleador = relacionDependencia
    ? {
        cuit: emp.cuit,
        razonSocial: emp.razonSocial,
        ciiu: emp.ciiu,
        actividad: emp.actividad,
        telefonos: [telefono(5)],
        email: `rrhh@${slugDe(emp.razonSocial).split('.')[0]}.com`,
        paginaWeb: emp.paginaWeb,
        tipoEmpresa: 'Sociedad Anónima',
        artVigente: true,
        bcra: { entidadesCount: 4, deudaTomada: 80_000_000 + (sed % 90_000_000), deudaEnMora: 0, riesgo: 'bajo', situaciones: { 1: 4 }, entidades: [], deudaUltimos24m: true },
      }
    : null;

  const inmuebles =
    recomendacion === 'APTO'
      ? [{ partidoCatastral: `CABA ${10 + (sed % 20)}-${sed % 90}-${sed % 9}`, ubicacion: `${dom.calle} ${domicilio.altura} — ${dom.localidad}`, tipo: 'DEPARTAMENTO', fechaAdquisicion: `${2008 + (sed % 14)}-0${1 + (sed % 9)}-15` }]
      : [];
  const vehiculos =
    recomendacion === 'NO_APTO'
      ? []
      : [{ ...pick(VEHICULOS, sed), fechaCompra: `${2017 + (sed % 7)}-0${1 + (sed % 9)}-10`, patente: `A${'BCDE'.charAt(sed % 4)}${100 + (sed % 899)}${'PQRS'.charAt(sed % 4)}${'TUVW'.charAt((sed >> 3) % 4)}` }];

  const vecinos = [
    { nombreCompleto: `${pick(NOMBRES_F, sed + 1)} ${pick(APELLIDOS_NEUTROS, sed + 1)}`, telefono: telefono(6), direccion: `${dom.calle} ${domicilio.altura} ${1 + (sed % 11)}°${'BCDA'.charAt(sed % 4)}` },
    { nombreCompleto: 'Encargado del edificio', telefono: telefono(7), direccion: `Portería · ${dom.calle} ${domicilio.altura}` },
  ];

  const slugPersona = slugDe(`${nombre} ${apellido}`);
  const huellaDigital = {
    scoreCoherencia: recomendacion === 'APTO' ? 'alta' : recomendacion === 'APTO_CON_GARANTIA' ? 'media' : 'baja',
    antiguedadAnios: 4 + (sed % 14),
    mencionesGoogle: sed % 18,
    emailEnSitios: sed % 25,
    perfiles: [
      { plataforma: 'LINKEDIN', handle: slugPersona.replace(/\./g, '-'), url: `https://linkedin.com/in/${slugPersona.replace(/\./g, '-')}`, verificado: recomendacion === 'APTO', estado: 'ACTIVO', seguidores: 200 + (sed % 2200), ultimaActividad: null, notas: relacionDependencia ? `Perfil laboral coherente con empleo declarado en ${emp.razonSocial}.` : 'Perfil con actividad comercial independiente.' },
      { plataforma: 'INSTAGRAM', handle: `@${slugPersona}`, url: `https://instagram.com/${slugPersona}`, verificado: false, estado: sed % 4 === 0 ? 'INACTIVO' : 'ACTIVO', seguidores: 100 + (sed % 1800), ultimaActividad: null, notas: 'Cuenta personal. Sin contenido marcado.' },
      { plataforma: 'GOOGLE', handle: null, url: `https://www.google.com/search?q=${encodeURIComponent(`${nombre} ${apellido}`)}`, verificado: false, estado: 'ACTIVO', seguidores: null, ultimaActividad: null, notas: `${sed % 18} menciones públicas encontradas.` },
    ],
    hallazgos:
      recomendacion === 'APTO'
        ? [
            { tipo: 'positivo', texto: 'Identidad coherente cross-plataforma. Sin menciones a desalojos, juicios o conflictos contractuales previos.' },
            { tipo: 'positivo', texto: 'Empleo declarado verificable en LinkedIn.' },
          ]
        : recomendacion === 'APTO_CON_GARANTIA'
          ? [
              { tipo: 'neutro', texto: 'Identidad consistente pero con baja presencia pública — verificación parcial.' },
              { tipo: 'alerta', texto: 'Situación BCRA 2 en una entidad: atraso leve reciente.' },
            ]
          : [
              { tipo: 'alerta', texto: `Deuda en mora por $${deudaEnMora.toLocaleString('es-AR')} y cheques rechazados en los últimos 12 meses.` },
              { tipo: 'alerta', texto: 'Ingresos informales o no verificables — no alcanzan para acreditar capacidad de pago.' },
            ],
  };

  const recomendacionRazon =
    recomendacion === 'APTO'
      ? `Score Nosis ${scoreNosis} (alto). BCRA situación 1 en ${entidadesCount} entidades, sin mora. Ingresos formales estables (rango A${rangoBase}-A${rangoBase + 1}) y patrimonio verificable. Apto sin garantía adicional.`
      : recomendacion === 'APTO_CON_GARANTIA'
        ? `Score Nosis ${scoreNosis} (medio). Registra situación 2 en BCRA con mora menor ($${deudaEnMora.toLocaleString('es-AR')}) y ${cheques.rechazadosCount} cheque rechazado luego levantado. Ingresos formales pero justos: se recomienda garantía adicional (garante propietario o seguro de caución).`
        : `Score Nosis ${scoreNosis} (bajo). Deuda en mora por $${deudaEnMora.toLocaleString('es-AR')} (situación 3 en BCRA), ${cheques.rechazadosCount} cheques rechazados vigentes e ingresos no verificables. No se recomienda avanzar.`;

  return {
    cuit,
    dni,
    nombre,
    apellido,
    fechaNacimiento,
    sexo,
    domicilio,
    telefonos: [
      { numero: telefono(1), tipo: 'CELULAR', whatsappActivo: true },
      { numero: telefono(2), tipo: 'FIJO', whatsappActivo: false },
    ],
    email,
    bcra,
    cheques,
    familia,
    rangoIngresoFamiliar: `A${Math.min(7, rangoBase + 1)}` as 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7',
    bcraFamiliar: {
      entidadesCount: entidadesCount + 2,
      deudaTomada: Math.round(deudaTomada * 1.6),
      deudaEnMora: riesgo === 'bajo' ? 0 : Math.round(deudaEnMora * 0.5),
      riesgo: riesgo === 'alto' ? 'alto' : riesgo === 'medio' ? 'medio' : 'bajo',
      situaciones,
      entidades: entidades.slice(0, 2),
      deudaUltimos24m: true,
    },
    inmuebles,
    vehiculos,
    ingresos,
    empleador,
    vecinos,
    huellaDigital,
    scoreNosis,
    recomendacion,
    recomendacionRazon,
  };
}

/* ============================================================
 * Reportes piloto — helpers de tracking (port de piloto-storage.ts)
 * ============================================================ */

/** Deduce un nombre de navegador legible desde el userAgent. */
function detectarNavegador(ua: string): string {
  // El orden importa: Edge/Opera incluyen "Chrome" en su UA.
  if (/\bEdg\//.test(ua)) return 'Edge';
  if (/\bOPR\//.test(ua) || /\bOpera\//.test(ua)) return 'Opera';
  if (/\bChrome\//.test(ua)) return 'Chrome';
  if (/\bFirefox\//.test(ua)) return 'Firefox';
  if (/\bSafari\//.test(ua)) return 'Safari';
  return 'Navegador';
}

function pantallaDesdeUrl(url: string): string {
  const partes = url.split('?')[0]!.split('/').filter(Boolean);
  if (partes.length === 0) return 'Home';
  const PANTALLAS: Record<string, string> = {
    propiedades: 'Propiedades',
    propietarios: 'Propietarios',
    pagos: 'Pagos',
    caja: 'Caja',
    contratos: 'Contratos',
    renovaciones: 'Renovaciones',
    consorcios: 'Consorcios',
    reclamos: 'Reclamos',
    profesionales: 'Profesionales',
    screening: 'Verificación inquilino',
    configuracion: 'Configuración',
    admin: 'Panel interno',
    // pantallas de la app inquilino
    certificado: 'Certificado',
    boletas: 'Boletas de servicios',
    'co-inquilinos': 'Co-inquilinos',
    documentos: 'Documentos',
  };
  return PANTALLAS[partes[0]!] ?? partes[0]!;
}

/** Prefijo con el que conservamos la autoría real de reportes de inquilinos. */
const SESSION_INQUILINO_PREFIX = 'inquilino:';
const SESSION_COINQUILINO_PREFIX = 'co-inquilino:';

/* ============================================================
 * Rutas
 * ============================================================ */

export async function inquilinoMundoRoutes(app: FastifyInstance) {
  // ===== Contrato del inquilino logueado (alimenta home + /contrato) =====
  app.get('/mi-contrato', async (request, reply) => {
    const inq = await requireContratoAcceso(request, reply);
    if (!inq) return;
    if (!inq.contratoId) {
      return reply.code(404).send({ message: 'No tenés un contrato activo' });
    }
    const contrato = await prisma.contrato.findFirst({
      where: { id: inq.contratoId, inmobiliariaId: inq.inmobiliariaId },
      include: {
        propiedad: { select: { direccion: true, ciudad: true } },
        inmobiliaria: {
          select: { nombre: true, telefono: true, moraTipoDefault: true, moraValorDefault: true },
        },
        sociedad: { select: { cuentaCobranza: true } },
        cobraDirectoPropietario: { include: { cuentaCobranza: true } },
      },
    });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });

    // Cuenta de cobranza REAL (de la DB) que el inquilino usa para transferir.
    // NUNCA un dato inventado: si no hay cuenta cargada devolvemos null y la app
    // le pide al inquilino que la solicite a la inmobiliaria.
    //  - PROPIETARIO_DIRECTO => cuenta del propietario (CuentaCobranzaDirecta).
    //  - INMOBILIARIA        => cuenta de la sociedad del contrato (o la principal).
    type CuentaJson = { banco?: string; titular?: string; cbu?: string; alias?: string; cuit?: string };
    let datosCobranza:
      | { modo: 'PROPIETARIO_DIRECTO' | 'INMOBILIARIA'; titular: string; cuit: string; banco: string | null; cbu: string; alias: string }
      | null = null;

    if (contrato.modoCobranza === 'PROPIETARIO_DIRECTO' && contrato.cobraDirectoPropietario?.cuentaCobranza) {
      const c = contrato.cobraDirectoPropietario.cuentaCobranza;
      datosCobranza = { modo: 'PROPIETARIO_DIRECTO', titular: c.titular, cuit: c.cuit, banco: c.banco, cbu: c.cbu, alias: c.alias };
    } else {
      let cuenta = (contrato.sociedad?.cuentaCobranza as CuentaJson | null) ?? null;
      if (!cuenta) {
        const principal = await prisma.sociedad.findFirst({
          where: { inmobiliariaId: inq.inmobiliariaId, esPrincipal: true, activa: true },
          select: { cuentaCobranza: true },
        });
        cuenta = (principal?.cuentaCobranza as CuentaJson | null) ?? null;
      }
      if (cuenta?.cbu && cuenta.titular) {
        datosCobranza = {
          modo: 'INMOBILIARIA',
          titular: cuenta.titular,
          cuit: cuenta.cuit ?? '',
          banco: cuenta.banco ?? null,
          cbu: cuenta.cbu,
          alias: cuenta.alias ?? '',
        };
      }
    }

    return {
      id: contrato.id,
      direccion: contrato.propiedad.direccion,
      ciudad: contrato.propiedad.ciudad,
      inmobiliaria: contrato.inmobiliaria.nombre,
      inmobiliariaTelefono: contrato.inmobiliaria.telefono ?? null,
      fechaInicio: contrato.fechaInicio.toISOString().slice(0, 10),
      fechaFin: contrato.fechaFin.toISOString().slice(0, 10),
      diaPago: contrato.diaPago,
      indiceAjuste: contrato.indiceAjuste,
      proximoAjuste: contrato.proximoAjuste ? contrato.proximoAjuste.toISOString().slice(0, 10) : null,
      montoActual: Number(contrato.monto),
      montoExpensas: contrato.montoExpensas != null ? Number(contrato.montoExpensas) : null,
      tipoContrato: contrato.tipoContrato,
      // Esquema de mora RESUELTO (cascada contrato → default inmobiliaria) para
      // que la app pueda explicar "cómo se calcula el recargo". El campo legacy
      // se mantiene mapeado (solo % diario) por compat de shape.
      mora: (() => {
        const e = resolverEsquemaMora(contrato, contrato.inmobiliaria);
        return { tipo: e.tipo, valor: e.valor };
      })(),
      tasaPunitorioDiaria: (() => {
        const e = resolverEsquemaMora(contrato, contrato.inmobiliaria);
        return e.tipo === 'PORCENTAJE_DIARIO' ? e.valor : null;
      })(),
      moneda: contrato.moneda,
      datosCobranza,
    };
  });

  // ===== Certificado del inquilino (el "reemplazo del garante") =====
  app.get('/certificado', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) {
      return reply.code(400).send({ message: 'No tenés un contrato activo para certificar' });
    }

    const inquilino = await prisma.inquilino.findUnique({ where: { id: inq.inquilinoId } });
    if (!inquilino) return reply.code(404).send({ message: 'Inquilino inexistente' });
    const contrato = await prisma.contrato.findFirst({
      where: { id: inq.contratoId, inmobiliariaId: inq.inmobiliariaId },
      include: {
        propiedad: { select: { direccion: true } },
        inmobiliaria: { select: { nombre: true } },
      },
    });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });

    // Historial desde las liquidaciones REALES del contrato — si da REGULAR,
    // se devuelve honesto.
    const liqs = await prisma.liquidacion.findMany({ where: { contratoId: contrato.id } });
    const pagosRechazados = await prisma.pago.count({
      where: { contratoId: contrato.id, estado: 'RECHAZADO' },
    });
    const ratings = await prisma.ratingReclamo.aggregate({
      where: { reclamo: { contratoId: contrato.id } },
      _avg: { estrellas: true },
    });
    const ratingPromedio = ratings._avg.estrellas
      ? Math.round(ratings._avg.estrellas * 10) / 10
      : 0;

    const historial = calcularHistorial(liqs, pagosRechazados, ratingPromedio);
    const { nivel, detalle: nivelDetalle } = calcularNivel(historial);

    const ahora = new Date();
    const mesesCumplidos = Math.max(
      0,
      (ahora.getFullYear() - contrato.fechaInicio.getFullYear()) * 12 +
        (ahora.getMonth() - contrato.fechaInicio.getMonth()),
    );

    const semilla = [inquilino.dni ?? inquilino.id, contrato.id, contrato.inmobiliaria.nombre].join('|');
    const hash = hashCertificado(semilla);
    const urlVerificacion = `https://myalquiler.com.ar/verificar/${hash}`;
    const validoHasta = new Date(ahora.getTime() + 30 * DIA_MS);

    const inquilinoData = {
      nombre: `${inquilino.nombre} ${inquilino.apellido ?? ''}`.trim(),
      dni: inquilino.dni,
      email: inquilino.email,
      telefono: inquilino.telefono,
    };
    const contratoActual = {
      direccion: contrato.propiedad.direccion,
      inmobiliaria: contrato.inmobiliaria.nombre,
      fechaInicio: contrato.fechaInicio.toISOString().slice(0, 10),
      montoMensual: Number(contrato.monto),
      moneda: contrato.moneda,
      mesesCumplidos,
    };

    const cert = await prisma.certificadoInquilino.upsert({
      where: { hash },
      update: {
        inquilinoData,
        contratoActual,
        historial,
        nivel,
        nivelDetalle,
        generadoAt: ahora,
        validoHasta,
        urlVerificacion,
      },
      create: {
        inmobiliariaId: inq.inmobiliariaId,
        hash,
        inquilinoId: inquilino.id,
        contratoId: contrato.id,
        inquilinoData,
        contratoActual,
        historial,
        nivel,
        nivelDetalle,
        validoHasta,
        urlVerificacion,
      },
    });

    return {
      id: cert.id,
      hash: cert.hash,
      inquilino: inquilinoData,
      contratoActual,
      historial,
      nivel: cert.nivel,
      nivelDetalle: cert.nivelDetalle,
      generadoAt: cert.generadoAt,
      validoHasta: cert.validoHasta,
      urlVerificacion: cert.urlVerificacion,
      revocadoAt: cert.revocadoAt,
    };
  });

  // ===== Screening (panel) =====
  app.post('/screening', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'screening.ver');
    if (!u) return;
    const body = z
      .object({
        cuit: z.string().regex(/^\d{2}-?\d{8}-?\d{1}$/),
        nombre: z.string().trim().min(3),
      })
      .safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({ message: 'CUIT (formato XX-XXXXXXXX-X) y nombre completo requeridos' });
    }

    const digitos = body.data.cuit.replace(/\D/g, '');
    const cuit = `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`;
    const partes = body.data.nombre.replace(/\s+/g, ' ').trim().split(' ');
    const apellido = partes.length > 1 ? partes[partes.length - 1]! : partes[0]!;
    const nombre = partes.length > 1 ? partes.slice(0, -1).join(' ') : partes[0]!;

    const informe = generarInformeScreening(cuit, nombre, apellido);
    const screening = await prisma.screening.create({
      data: {
        inmobiliariaId: u.inmobiliariaId,
        estado: 'COMPLETO',
        cuit: informe.cuit,
        dni: informe.dni,
        nombre: informe.nombre,
        apellido: informe.apellido,
        fechaNacimiento: informe.fechaNacimiento,
        sexo: informe.sexo,
        domicilio: informe.domicilio,
        telefonos: informe.telefonos,
        email: informe.email,
        bcra: informe.bcra,
        cheques: informe.cheques,
        familia: informe.familia,
        rangoIngresoFamiliar: informe.rangoIngresoFamiliar,
        bcraFamiliar: informe.bcraFamiliar,
        inmuebles: informe.inmuebles,
        vehiculos: informe.vehiculos,
        ingresos: informe.ingresos,
        empleador: informe.empleador ?? Prisma.JsonNull,
        vecinos: informe.vecinos,
        huellaDigital: informe.huellaDigital,
        scoreNosis: informe.scoreNosis,
        recomendacion: informe.recomendacion,
        recomendacionRazon: informe.recomendacionRazon,
      },
    });
    return reply.code(201).send(screening);
  });

  app.get('/screenings', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'screening.ver');
    if (!u) return;
    return prisma.screening.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      orderBy: { createdAt: 'desc' },
    });
  });

  // ===== Co-inquilinos (los del contrato del inquilino logueado) =====
  app.get('/co-inquilinos', async (request, reply) => {
    const inq = await requireContratoAcceso(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return [];
    return prisma.coInquilino.findMany({
      where: { contratoId: inq.contratoId },
      orderBy: { invitadoAt: 'desc' },
    });
  });

  app.post('/co-inquilinos', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return reply.code(400).send({ message: 'No tenés un contrato activo' });
    // P10: no se gestionan co-inquilinos sobre un contrato finalizado/borrador.
    if (!(await exigirContratoActivo(inq.contratoId, inq.inmobiliariaId, reply))) return;
    const body = z
      .object({
        nombre: z.string().trim().min(3),
        dni: z.string().optional(),
        email: z.string().email(),
        telefono: z.string().optional(),
        relacion: z.string().trim().min(2),
        permiso: z.enum(['VER', 'PAGAR', 'COMPLETO']),
      })
      .safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({ message: 'Datos del co-inquilino incompletos (nombre, email, relación y permiso)' });
    }

    const email = body.data.email.toLowerCase();
    const yaInvitado = await prisma.coInquilino.findFirst({
      where: { contratoId: inq.contratoId, email },
    });
    if (yaInvitado) return reply.code(409).send({ message: 'Ya invitaste a alguien con ese email' });

    let co;
    try {
      co = await prisma.coInquilino.create({
        data: {
          inmobiliariaId: inq.inmobiliariaId,
          contratoId: inq.contratoId,
          nombre: body.data.nombre,
          dni: body.data.dni,
          email,
          telefono: body.data.telefono,
          relacion: body.data.relacion,
          permiso: body.data.permiso,
        },
      });
    } catch (e) {
      // Carrera de doble-invitación concurrente (dos requests pasan el findFirst de
      // arriba): el @@unique([contratoId, email]) la corta con P2002 → mismo 409.
      if (e && typeof e === 'object' && (e as { code?: string }).code === 'P2002') {
        return reply.code(409).send({ message: 'Ya invitaste a alguien con ese email' });
      }
      throw e;
    }
    // El modelo no persiste el token: lo firmamos al vuelo (JWT con el id de
    // la invitación) — es lo que iría en el link/WhatsApp de invitación.
    const tokenInvitacion = app.jwt.sign(
      { kind: 'co-invitacion', coInquilinoId: co.id, contratoId: inq.contratoId },
      { expiresIn: '7d' },
    );
    return reply.code(201).send({ ...co, tokenInvitacion });
  });

  // Regenera el link de invitación de un co-inquilino existente (el titular lo
  // perdió o quiere reenviarlo). Solo el titular del contrato.
  app.post('/co-inquilinos/:id/link', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return reply.code(400).send({ message: 'No tenés un contrato activo' });
    // P10: no se regenera el link de invitación sobre un contrato finalizado/borrador.
    if (!(await exigirContratoActivo(inq.contratoId, inq.inmobiliariaId, reply))) return;
    const { id } = request.params as { id: string };
    const co = await prisma.coInquilino.findFirst({ where: { id, contratoId: inq.contratoId ?? '' } });
    if (!co) return reply.code(404).send({ message: 'Co-inquilino inexistente' });
    // Regenerar el link re-arma la invitación: como la aceptación es de un solo uso
    // (ver /co-invitacion/:token/aceptar en auth.ts), volvemos la invitación a
    // PENDIENTE para que el link NUEVO se pueda aceptar. Esto además revoca la sesión
    // vigente del co-inquilino (requireContratoAcceso exige estado=ACEPTADO) →
    // rotación de credencial: reenviar el link invalida el acceso anterior.
    if (co.estado === 'ACEPTADO') {
      await prisma.coInquilino.update({
        where: { id: co.id },
        data: { estado: 'PENDIENTE', aceptadoAt: null },
      });
    }
    const tokenInvitacion = app.jwt.sign(
      { kind: 'co-invitacion', coInquilinoId: co.id, contratoId: co.contratoId },
      { expiresIn: '7d' },
    );
    return { tokenInvitacion };
  });

  app.post('/co-inquilinos/:id/aceptar', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    const { id } = request.params as { id: string };
    const co = await prisma.coInquilino.findFirst({ where: { id, contratoId: inq.contratoId ?? '' } });
    if (!co) return reply.code(404).send({ message: 'Invitación inexistente' });
    if (co.estado === 'ACEPTADO') return reply.code(409).send({ message: 'La invitación ya fue aceptada' });
    if (!app.env.DEMO_MODE) {
      return reply.code(403).send({ message: 'La aceptación real llega por el link de invitación — esto solo se simula en modo demo' });
    }
    return prisma.coInquilino.update({
      where: { id: co.id },
      data: { estado: 'ACEPTADO', aceptadoAt: new Date() },
    });
  });

  app.patch('/co-inquilinos/:id/permiso', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return reply.code(400).send({ message: 'No tenés un contrato activo' });
    // P10: no se cambia el permiso de un co-inquilino sobre un contrato finalizado/borrador.
    if (!(await exigirContratoActivo(inq.contratoId, inq.inmobiliariaId, reply))) return;
    const { id } = request.params as { id: string };
    const body = z
      .object({ permiso: z.enum(['VER', 'PAGAR', 'COMPLETO']) })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Permiso inválido (VER, PAGAR o COMPLETO)' });
    const co = await prisma.coInquilino.findFirst({ where: { id, contratoId: inq.contratoId ?? '' } });
    if (!co) return reply.code(404).send({ message: 'Co-inquilino inexistente' });
    return prisma.coInquilino.update({ where: { id: co.id }, data: { permiso: body.data.permiso } });
  });

  app.delete('/co-inquilinos/:id', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    const { id } = request.params as { id: string };
    const co = await prisma.coInquilino.findFirst({ where: { id, contratoId: inq.contratoId ?? '' } });
    if (!co) return reply.code(404).send({ message: 'Co-inquilino inexistente' });
    await prisma.coInquilino.delete({ where: { id: co.id } });
    return { ok: true };
  });

  // ===== Boletas de servicios =====
  app.get('/boletas', async (request, reply) => {
    const inq = await requireContratoAcceso(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return [];
    return prisma.boletaServicio.findMany({
      where: { contratoId: inq.contratoId },
      orderBy: [{ periodo: 'desc' }, { subidoAt: 'desc' }],
    });
  });

  app.post('/boletas', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return reply.code(400).send({ message: 'No tenés un contrato activo' });
    // P10: no se cargan boletas sobre un contrato finalizado/borrador.
    if (!(await exigirContratoActivo(inq.contratoId, inq.inmobiliariaId, reply))) return;
    const body = z
      .object({
        servicio: z.enum(['LUZ', 'GAS', 'AGUA', 'INTERNET', 'ABL', 'CABLE']),
        periodo: z.string().regex(/^\d{4}-\d{2}$/),
        monto: z.number().positive().optional(),
        vencimiento: z.string().optional(),
        nombreArchivo: z.string().optional(),
        tipoMime: z.string().optional(),
        tamanioBytes: z.number().int().nonnegative().optional(),
        archivoUrl: z.string().optional(),
        notas: z.string().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({ message: 'Datos de la boleta incompletos (servicio y período YYYY-MM)' });
    }
    const TAMANIO_MAX = 2 * 1024 * 1024;
    if ((body.data.tamanioBytes ?? 0) > TAMANIO_MAX) {
      return reply.code(400).send({ message: 'La boleta no puede superar los 2 MB' });
    }
    // La boleta, si trae archivo, tiene que ser un /uploads de ESTA inmobiliaria.
    if (body.data.archivoUrl && !urlEsDelTenant(body.data.archivoUrl, inq.inmobiliariaId)) {
      return reply.code(400).send({ message: 'Archivo de boleta inválido' });
    }
    // No se cargan boletas de períodos futuros.
    const [anioBol = 0, mesBol = 0] = body.data.periodo.split('-').map(Number);
    const hoyBol = new Date();
    if (anioBol > hoyBol.getFullYear() || (anioBol === hoyBol.getFullYear() && mesBol > hoyBol.getMonth() + 1)) {
      return reply.code(400).send({ message: 'No podés cargar boletas de períodos futuros' });
    }

    // monto default: consumo promedio del servicio de la propiedad (si está cargado)
    let monto = body.data.monto;
    if (monto === undefined) {
      const contrato = await prisma.contrato.findUnique({
        where: { id: inq.contratoId },
        select: { propiedadId: true },
      });
      const servicio = contrato
        ? await prisma.servicioPublico.findUnique({
            where: { propiedadId_tipo: { propiedadId: contrato.propiedadId, tipo: body.data.servicio } },
          })
        : null;
      monto = servicio?.consumoPromedioMensual ? Number(servicio.consumoPromedioMensual) : 0;
    }

    // vencimiento default: día 10 del mes siguiente al período
    let vencimiento: Date;
    if (body.data.vencimiento) {
      vencimiento = new Date(body.data.vencimiento);
      if (Number.isNaN(vencimiento.getTime())) {
        return reply.code(400).send({ message: 'Fecha de vencimiento inválida' });
      }
    } else {
      const [anio, mes] = body.data.periodo.split('-').map(Number) as [number, number];
      vencimiento = new Date(anio, mes, 10); // mes es 1-based → Date 0-based = mes siguiente
    }

    const PLACEHOLDER =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const boleta = await prisma.boletaServicio.create({
      data: {
        inmobiliariaId: inq.inmobiliariaId,
        contratoId: inq.contratoId,
        tipo: body.data.servicio,
        periodo: body.data.periodo,
        monto,
        vencimiento,
        nombreArchivo: body.data.nombreArchivo ?? `boleta-${body.data.servicio.toLowerCase()}-${body.data.periodo}.pdf`,
        tipoMime: body.data.tipoMime ?? 'application/pdf',
        tamanioBytes: body.data.tamanioBytes ?? 0,
        archivoUrl: body.data.archivoUrl ?? PLACEHOLDER,
        notas: body.data.notas,
      },
    });
    return reply.code(201).send(boleta);
  });

  // Datos de servicios públicos de la propiedad del inquilino (NIS,
  // distribuidora, medidor) — lo que necesita ver para saber qué boleta subir.
  app.get('/servicios', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return [];
    const contrato = await prisma.contrato.findUnique({
      where: { id: inq.contratoId },
      select: { propiedadId: true },
    });
    if (!contrato) return [];
    return prisma.servicioPublico.findMany({
      where: { propiedadId: contrato.propiedadId },
      orderBy: { tipo: 'asc' },
    });
  });

  // Feed de notificaciones del inquilino — DERIVADO del estado real (liquidaciones,
  // pagos, reclamos). Antes la campana era un no-op en prod (if(apiEnabled) return [])
  // → el inquilino nunca recibía alertas (pago rechazado, alquiler vencido, respuesta
  // a reclamo, profesional asignado). El `unread` lo resuelve el cliente (localStorage
  // de leídas); acá devolvemos los eventos accionables ya ordenados por severidad.
  app.get('/mis-notificaciones', async (request, reply) => {
    const inq = await requireContratoAcceso(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return [];
    const contratoId = inq.contratoId;
    const ahora = Date.now();
    const relativo = (d: Date | string): string => {
      const min = Math.floor((ahora - new Date(d).getTime()) / 60000);
      if (min < 60) return `hace ${Math.max(min, 0)} min`;
      const h = Math.floor(min / 60);
      if (h < 24) return `hace ${h} h`;
      const dd = Math.floor(h / 24);
      return `hace ${dd} día${dd === 1 ? '' : 's'}`;
    };
    const diasHasta = (d: Date | string): number =>
      Math.ceil((new Date(d).getTime() - ahora) / 86400000);

    type Notif = {
      id: string;
      titulo: string;
      detalle: string;
      href: string;
      cuando: string;
      icono: string;
      severidad: 'critica' | 'alta' | 'media' | 'baja';
    };
    const out: Notif[] = [];

    // 1) Liquidaciones impagas: en revisión / vencidas / próximas a vencer.
    const liqs = await prisma.liquidacion.findMany({
      where: { contratoId, estado: { in: ['PENDIENTE', 'VENCIDO', 'PARCIAL'] } },
      orderBy: { fechaVencimiento: 'asc' },
    });
    for (const liq of liqs) {
      const informado = await prisma.pago.findFirst({
        where: { liquidacionId: liq.id, estado: 'INFORMADO' },
        orderBy: { informadoAt: 'desc' },
      });
      if (informado) {
        out.push({
          id: `pago-val-${liq.id}`,
          titulo: 'Comprobante en revisión',
          detalle: 'Te avisamos cuando la inmobiliaria lo valide (24-48 hs).',
          href: `/pago/${liq.id}`,
          cuando: relativo(informado.informadoAt),
          icono: 'pago_validacion',
          severidad: 'media',
        });
        continue;
      }
      const dias = diasHasta(liq.fechaVencimiento);
      if (liq.estado === 'VENCIDO' || dias < 0) {
        out.push({
          id: `pago-venc-${liq.id}`,
          titulo: 'Tu alquiler está atrasado',
          detalle: `Período ${liq.periodo} · pagá cuanto antes para no sumar punitorios.`,
          href: `/pago/${liq.id}`,
          cuando: `venció ${new Date(liq.fechaVencimiento).toLocaleDateString('es-AR')}`,
          icono: 'pago_vencido',
          severidad: 'critica',
        });
      } else if (dias <= 5) {
        out.push({
          id: `pago-prox-${liq.id}`,
          titulo: dias === 0 ? 'Tu alquiler vence hoy' : `Tu alquiler vence en ${dias} día${dias === 1 ? '' : 's'}`,
          detalle: `Período ${liq.periodo}.`,
          href: `/pago/${liq.id}`,
          cuando: dias === 0 ? 'hoy' : `en ${dias}d`,
          icono: 'pago_pendiente',
          severidad: 'alta',
        });
      }
    }

    // 2) Pagos decididos en los últimos 30 días: rechazado / confirmado.
    const hace30 = new Date(ahora - 30 * 86400000);
    const decididos = await prisma.pago.findMany({
      where: { contratoId, estado: { in: ['RECHAZADO', 'CONCILIADO'] }, decididoAt: { gte: hace30 } },
      orderBy: { decididoAt: 'desc' },
      take: 10,
    });
    for (const p of decididos) {
      if (p.estado === 'RECHAZADO') {
        out.push({
          id: `pago-rech-${p.id}`,
          titulo: 'Tu pago fue rechazado',
          detalle: p.observacion ? p.observacion.slice(0, 80) : 'Volvé a mandar el comprobante.',
          href: `/pago/${p.liquidacionId}`,
          cuando: p.decididoAt ? relativo(p.decididoAt) : 'reciente',
          icono: 'pago_rechazado',
          severidad: 'critica',
        });
      } else {
        out.push({
          id: `pago-ok-${p.id}`,
          titulo: 'Tu pago fue confirmado',
          detalle: `$${Math.round(Number(p.monto)).toLocaleString('es-AR')} acreditado.`,
          href: `/pago/${p.liquidacionId}`,
          cuando: p.decididoAt ? relativo(p.decididoAt) : 'reciente',
          icono: 'pago_confirmado',
          severidad: 'media',
        });
      }
    }

    // 3) Reclamos: respondidos por la inmo / profesional asignado / a calificar.
    const reclamos = await prisma.reclamo.findMany({
      where: { contratoId },
      include: { eventos: { orderBy: { fecha: 'asc' } }, profesional: true, visita: true, rating: true },
    });
    const CERRADOS = ['RESUELTO', 'CERRADO', 'RECHAZADO'];
    for (const r of reclamos) {
      if (!CERRADOS.includes(r.estado)) {
        // El último mensaje del timeline es de la inmo y el inquilino no respondió.
        let mensajeInmo: { contenido: string; fecha: Date } | null = null;
        for (let i = r.eventos.length - 1; i >= 0; i--) {
          const ev = r.eventos[i]!;
          if (ev.tipo === 'MENSAJE_INMO' && ev.contenido) {
            mensajeInmo = { contenido: ev.contenido, fecha: ev.fecha };
            break;
          }
          if (ev.tipo === 'MENSAJE_INQUILINO') break;
        }
        if (mensajeInmo) {
          out.push({
            id: `inmo-${r.id}-${mensajeInmo.fecha.toISOString()}`,
            titulo: 'Te respondieron tu reclamo',
            detalle: mensajeInmo.contenido.slice(0, 70),
            href: `/reclamos/${r.id}`,
            cuando: relativo(mensajeInmo.fecha),
            icono: 'reclamo_inmo',
            severidad: 'alta',
          });
        }
        if (r.profesional && (!r.visita || r.visita.estado === 'ASIGNADO')) {
          out.push({
            id: `prof-${r.id}-${r.profesional.id}`,
            titulo: `Te asignaron a ${r.profesional.nombre}`,
            detalle: 'Coordiná día y hora para que pase a tu propiedad.',
            href: `/reclamos/${r.id}`,
            cuando: 'reciente',
            icono: 'profesional',
            severidad: 'alta',
          });
        }
      }
      if (r.estado === 'RESUELTO' && !r.rating) {
        out.push({
          id: `rating-${r.id}`,
          titulo: 'Calificá tu última reparación',
          detalle: `${r.categoria.toLowerCase()} · contanos cómo fue.`,
          href: `/reclamos/${r.id}`,
          cuando: r.resueltoAt ? relativo(r.resueltoAt) : 'hace poco',
          icono: 'rating',
          severidad: 'baja',
        });
      }
    }

    const sev = { critica: 4, alta: 3, media: 2, baja: 1 } as const;
    out.sort((a, b) => sev[b.severidad] - sev[a.severidad]);
    return out.slice(0, 8);
  });

  // ===== Reportes piloto — tracking ABSOLUTO server-side =====
  app.post('/reportes', async (request, reply) => {
    // Cualquier autenticado: usuario del panel O inquilino.
    const payload = await requireAuth(request, reply);
    if (!payload) return;
    const body = z
      .object({
        tipo: z.enum(['BUG', 'IDEA']),
        titulo: z.string().trim().min(3),
        detalle: z.string().optional(),
        severidad: z.enum(['BLOQUEA', 'MOLESTO', 'MENOR']).optional(),
        url: z.string().optional(),
        urlCompleta: z.string().optional(),
        viewport: z.string().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({ message: 'Tipo (BUG o IDEA) y título (mínimo 3 caracteres) requeridos' });
    }

    // Tracking capturado AUTOMÁTICAMENTE del lado servidor (el TODO de
    // piloto-storage.ts): nada de esto viene del cliente.
    const ip = request.ip;
    const uaHeader = request.headers['user-agent'];
    const userAgent = typeof uaHeader === 'string' ? uaHeader : null;
    const sessionHeader = request.headers['x-session-id'];
    const buildHeader = request.headers['x-app-build'];
    const url = body.data.url ?? '/';

    let usuarioId: string;
    let rol: string;
    let sessionId: string | null =
      typeof sessionHeader === 'string' && sessionHeader.length > 0 ? sessionHeader : null;
    if (payload.kind === 'usuario') {
      usuarioId = payload.userId;
      rol = payload.rol;
    } else {
      // Limitación del schema: ReportePiloto.usuarioId es obligatorio con FK a
      // Usuario. Para reportes de inquilinos lo atribuimos al ADMIN del tenant
      // como receptor, y conservamos la autoría REAL en rol + sessionId.
      rol = 'INQUILINO';
      // Prefijo distinto por tipo: el id de un co-inquilino vive en la tabla
      // CoInquilino, no en Inquilino → con el prefijo de inquilino su nombre nunca
      // resolvía en GET /reportes (caía al fallback 'Inquilino').
      sessionId =
        payload.kind === 'co-inquilino'
          ? `${SESSION_COINQUILINO_PREFIX}${payload.coInquilinoId}`
          : `${SESSION_INQUILINO_PREFIX}${payload.inquilinoId}`;
      const receptor = await prisma.usuario.findFirst({
        where: { inmobiliariaId: payload.inmobiliariaId, rol: 'ADMIN', activo: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!receptor) {
        return reply
          .code(409)
          .send({ message: 'La inmobiliaria no tiene un administrador activo — contactala directamente.' });
      }
      usuarioId = receptor.id;
    }

    const reporte = await prisma.reportePiloto.create({
      data: {
        inmobiliariaId: payload.inmobiliariaId,
        usuarioId,
        rol,
        tipo: body.data.tipo,
        titulo: body.data.titulo,
        detalle: body.data.detalle?.trim() ?? '',
        url,
        pantalla: pantallaDesdeUrl(url),
        urlCompleta: body.data.urlCompleta,
        navegador: userAgent ? detectarNavegador(userAgent) : null,
        viewport: body.data.viewport,
        severidad: body.data.tipo === 'BUG' ? body.data.severidad : null,
        ip,
        userAgent,
        sessionId,
        build: typeof buildHeader === 'string' ? buildHeader : null,
      },
    });
    return reply.code(201).send(reporte);
  });

  app.get('/reportes', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    // auditoria.ver o ADMIN (hoy ADMIN ya tiene auditoria.ver; el OR queda
    // explícito por si la matriz cambia)
    if (u.rol !== 'ADMIN' && !rolTienePermiso(u.rol, 'auditoria.ver')) {
      return reply.code(403).send({ message: 'Tu rol no permite ver los reportes del piloto' });
    }
    const reportes = await prisma.reportePiloto.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      include: { usuario: { select: { nombre: true, apellido: true, rol: true } } },
      orderBy: { reportadoAt: 'desc' },
    });

    // Resolver la autoría real de los reportes hechos por inquilinos Y co-inquilinos
    // (cada uno con su prefijo; el id de un co-inquilino vive en otra tabla).
    const idsConPrefijo = (prefijo: string) => [
      ...new Set(
        reportes
          .filter((r) => r.sessionId?.startsWith(prefijo))
          .map((r) => r.sessionId!.slice(prefijo.length)),
      ),
    ];
    const inquilinoIds = idsConPrefijo(SESSION_INQUILINO_PREFIX);
    const coInquilinoIds = idsConPrefijo(SESSION_COINQUILINO_PREFIX);
    const [inquilinos, coInquilinos] = await Promise.all([
      inquilinoIds.length ? prisma.inquilino.findMany({ where: { id: { in: inquilinoIds } } }) : [],
      coInquilinoIds.length ? prisma.coInquilino.findMany({ where: { id: { in: coInquilinoIds } } }) : [],
    ]);
    const nombrePorId = new Map<string, string>();
    for (const i of inquilinos) nombrePorId.set(i.id, `${i.nombre} ${i.apellido ?? ''}`.trim());
    for (const c of coInquilinos) nombrePorId.set(c.id, c.nombre.trim());

    const nombreAutor = (sessionId: string | null): string => {
      if (sessionId?.startsWith(SESSION_COINQUILINO_PREFIX))
        return `${nombrePorId.get(sessionId.slice(SESSION_COINQUILINO_PREFIX.length)) ?? 'Co-inquilino'} (co-inquilino)`;
      return `${nombrePorId.get(sessionId?.slice(SESSION_INQUILINO_PREFIX.length) ?? '') ?? 'Inquilino'} (inquilino)`;
    };

    return reportes.map((r) => ({
      ...r,
      reportadoPor: r.rol === 'INQUILINO' ? nombreAutor(r.sessionId) : `${r.usuario.nombre} ${r.usuario.apellido}`.trim(),
    }));
  });
}
