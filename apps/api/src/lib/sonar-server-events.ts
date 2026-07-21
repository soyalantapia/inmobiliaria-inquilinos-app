// Emisor de la "dimensión F" de Sonar: POST /v1/server-events.
//
// Es el sentido INVERSO a `lib/sonar.ts`. Aquel LEE tickets (proxy del panel de Soporte);
// éste EMPUJA nuestras excepciones para que, cuando un usuario reporta un bug desde el
// browser, el ticket ya traiga el stack del backend correlacionado por `correlationId`.
//
// Reglas de diseño (son la razón de que esto viva en un archivo aparte):
//  1. NO reusa `sonarFetch()` de `lib/sonar.ts`. Aquel tira errores `expose:true` con
//     statusCode → si lo llamáramos DESDE el setErrorHandler podríamos volver a entrar al
//     propio error-handler. Acá nada se propaga jamás: la función no puede tirar.
//  2. Fire-and-forget: no bloquea la respuesta al cliente. El error-handler no la awaitea.
//  3. Inerte y en SILENCIO si falta `SONAR_SERVER_KEY` o `SONAR_API_URL` (local y tests):
//     ni un console.error por request.
//  4. Auth con `x-sonar-server-key` (server_secret del proyecto), NO con el login del panel.

import type { Env } from '../env.js';

/** Limpia env vars: comillas de más y espacios (mismo tratamiento que `lib/sonar.ts`). */
function envClean(v?: string): string {
  return (v ?? '').trim().replace(/^["']+|["']+$/g, '').trim();
}

// Sonar valida largos con zod y devuelve 400 si nos pasamos. Recortamos acá para que un
// stack gigante no se pierda entero por un rechazo de validación del otro lado.
const MAX_MESSAGE = 4_000;
const MAX_STACK = 20_000;
const MAX_ROUTE = 500;
const TIMEOUT_MS = 4_000;

// Tope anti-tormenta: si el backend entra en un loop de 500s no queremos convertirlo en un
// loop de requests salientes. Sonar deduplica del lado servidor, pero la red es nuestra.
const MAX_POR_VENTANA = 30;
const VENTANA_MS = 60_000;
let ventanaDesde = 0;
let enviadosEnVentana = 0;

function permitidoPorRate(): boolean {
  const ahora = Date.now();
  if (ahora - ventanaDesde > VENTANA_MS) {
    ventanaDesde = ahora;
    enviadosEnVentana = 0;
  }
  if (enviadosEnVentana >= MAX_POR_VENTANA) return false;
  enviadosEnVentana += 1;
  return true;
}

export interface SonarServerError {
  errorType?: string;
  message?: string;
  stack?: string;
  route?: string;
  statusCode?: number;
}

export interface ReportarInput {
  correlationId?: string;
  serverError: SonarServerError;
  /** Metadata acotada (método HTTP, etc.). NUNCA el body del request ni objetos de dominio:
   *  MyAlquiler maneja datos de inquilinos (DNI, montos, emails). Sonar scrubea, pero no le
   *  mandamos PII "por las nuestras". */
  context?: Record<string, unknown>;
}

/** Config mínima que necesita el emisor. Se le pasa `app.env` (no lee process.env directo,
 *  así los tests pueden configurarlo/desconfigurarlo vía `buildApp({...})`). */
type SonarEnv = Pick<Env, 'SONAR_API_URL' | 'SONAR_SERVER_KEY' | 'SONAR_SERVICE_NAME'>;

export function sonarServerEventsConfigurado(env: SonarEnv): boolean {
  return !!(envClean(env.SONAR_API_URL) && envClean(env.SONAR_SERVER_KEY));
}

function recortar(v: string | undefined, max: number): string | undefined {
  if (typeof v !== 'string' || v.length === 0) return undefined;
  return v.length > max ? v.slice(0, max) : v;
}

/**
 * Saca los ARGUMENTOS de un error de Prisma dejando la causa.
 *
 * Prisma serializa el `data`/`where` COMPLETO —con los valores literales— dentro del
 * `message` (y por lo tanto del `stack`). En MyAlquiler eso es el payload de dominio:
 * nombre del inquilino, DNI adentro del path del archivo, ids de tenant, montos. Ejemplo real:
 *
 *   Invalid `prisma.documento.create()` invocation:
 *   {  data: { nombre: "DNI frente - Marta Gonzalez.pdf", archivoUrl: "/uploads/…", … }  }
 *   Argument `vencimiento`: Invalid value provided. Expected DateTime or Null, provided String.
 *
 * El scrub de Sonar NO alcanza acá: su defensa fuerte es por NOMBRE de clave (dni, nombre,
 * telefono…) y esto viaja embebido en un string bajo la clave `message`, que no es sensible.
 * Un DNI suelto de 8 dígitos y un nombre propio le pasan por al lado.
 *
 * Nos quedamos con la invocación y con la causa, que es lo que sirve para depurar, y tiramos
 * el bloque de argumentos, que es donde están los datos de la persona.
 */
export function sanitizarMensajePrisma(msg: string | undefined): string | undefined {
  if (typeof msg !== 'string' || !msg.includes('Invalid `prisma.')) return msg;
  const abre = msg.indexOf('{');
  const cierra = msg.lastIndexOf('}');
  if (abre === -1 || cierra === -1 || cierra < abre) return msg;
  const cabeza = msg.slice(0, abre).trimEnd();
  const causa = msg.slice(cierra + 1).trim();
  return [cabeza, '{ … argumentos omitidos: pueden contener datos del inquilino … }', causa]
    .filter(Boolean)
    .join('\n');
}

// Promesas en vuelo: solo para que los tests puedan esperar el fire-and-forget sin sleeps.
// En producción nadie las awaitea.
const enVuelo = new Set<Promise<void>>();

/** Espera a que terminen los envíos en vuelo. USO: tests. */
export async function flushSonarServerEvents(): Promise<void> {
  await Promise.allSettled([...enVuelo]);
}

/**
 * Reporta una excepción del servidor a Sonar. **Nunca tira, nunca bloquea.**
 * Devuelve void a propósito: quien la llama (el setErrorHandler) no debe awaitear.
 */
export function reportarErrorAlSonar(env: SonarEnv, input: ReportarInput): void {
  try {
    const apiUrl = envClean(env.SONAR_API_URL).replace(/\/$/, '');
    const serverKey = envClean(env.SONAR_SERVER_KEY);
    if (!apiUrl || !serverKey) return; // inerte y en silencio
    if (!permitidoPorRate()) return;

    // El saneado va ACÁ y no en el error-handler a propósito: así protege a cualquier
    // llamador futuro (un catch de ruta, el cron) y no solo al camino del 500 global.
    const msgLimpio = sanitizarMensajePrisma(input.serverError.message);
    const stackLimpio = sanitizarMensajePrisma(input.serverError.stack);

    const body = {
      // Recortado: Sonar valida largos con zod y rechaza con 400 si nos pasamos.
      service: recortar(envClean(env.SONAR_SERVICE_NAME), 120) || 'myalquiler-api',
      ...(input.correlationId ? { correlationId: input.correlationId } : {}),
      serverError: {
        ...(input.serverError.errorType ? { errorType: recortar(input.serverError.errorType, 200) } : {}),
        ...(msgLimpio ? { message: recortar(msgLimpio, MAX_MESSAGE) } : {}),
        ...(stackLimpio ? { stack: recortar(stackLimpio, MAX_STACK) } : {}),
        ...(input.serverError.route ? { route: recortar(input.serverError.route, MAX_ROUTE) } : {}),
        ...(typeof input.serverError.statusCode === 'number'
          ? { statusCode: input.serverError.statusCode }
          : {}),
      },
      ...(input.context ? { context: input.context } : {}),
    };

    const p = (async () => {
      // Timeout propio: sin esto un Sonar colgado deja sockets abiertos acumulándose.
      const res = await fetch(`${apiUrl}/v1/server-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sonar-server-key': serverKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // Drenamos el body: si no, el socket queda a medio leer y el agente HTTP no lo
      // devuelve al pool. El status NO nos importa — si Sonar rechaza, silencio.
      await res?.text?.();
    })()
      .catch(() => undefined)
      .finally(() => {
        enVuelo.delete(p);
      });
    enVuelo.add(p);
  } catch {
    // Silencio absoluto: esto corre dentro del error-handler global. Si tirara acá,
    // rompería el manejo de errores de TODA la app.
  }
}

/** Reinicia el tope anti-tormenta. USO: tests. */
export function _resetRateLimitSonarServerEvents(): void {
  ventanaDesde = 0;
  enviadosEnVentana = 0;
}
