// Token del link de garante — SÓLO PARA EL BUILD DEMO DE GITHUB PAGES.
//
// ⚠️ ESTO NO VALIDA NADA. Es `base64url(JSON)` con un prefijo constante que está escrito acá
// abajo en texto plano. Cualquiera arma uno para cualquier `contratoId` en dos líneas. Existe
// para que la página pública del garante funcione en la demo estática, que no tiene backend ni
// base: el "token" sólo transporta qué contrato mostrar de los mocks.
//
// Por eso las funciones se llaman `...TokenDemo...`: en producción NO se llaman nunca (la
// página corta antes, ver `garantes/[token]/page.tsx`), y el nombre está puesto para que nadie
// las importe por accidente creyendo que autentican. Antes se llamaban `generarGaranteToken` y
// `leerGaranteToken`, que se leían exactamente como si validaran algo.
//
// EL DÍA QUE HAYA BACKEND DE GARANTES, esto no se "mejora": se tira y se usa el patrón que el
// repo ya tiene escrito tres veces —token opaco de `randomBytes(24).toString('base64url')`
// persistido en una fila, y resolución pública por `findUnique({ where: { token } })` con 404
// si no existe—: `apps/api/src/routes/operacion.ts:18` y
// `apps/api/src/routes/visitas-publicas.ts:35`. El docblock de
// `apps/api/src/routes/portal-propietario.ts:31-34` ya nombra JUSTAMENTE a este token como el
// precedente que no hay que repetir.

export interface TokenDemoGarantePayload {
  contratoId: string;
  exp: number; // unix ms
}

/** Prefijo constante, no un secreto: sirve para descartar strings que no son de acá. */
const PREFIJO_DEMO = 'llave-garante-v1';

export function generarTokenDemoGarante(contratoId: string, diasValido = 30): string {
  const exp = Date.now() + diasValido * 24 * 60 * 60 * 1000;
  const payload: TokenDemoGarantePayload = { contratoId, exp };
  const raw = `${PREFIJO_DEMO}:${JSON.stringify(payload)}`;
  // base64url
  if (typeof window === 'undefined') {
    return Buffer.from(raw).toString('base64url');
  }
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function leerTokenDemoGarante(token: string): TokenDemoGarantePayload | null {
  try {
    let decoded: string;
    if (typeof window === 'undefined') {
      decoded = Buffer.from(token, 'base64url').toString('utf8');
    } else {
      const padded = token.replace(/-/g, '+').replace(/_/g, '/');
      decoded = atob(padded);
    }
    if (!decoded.startsWith(`${PREFIJO_DEMO}:`)) return null;
    const payload = JSON.parse(decoded.slice(PREFIJO_DEMO.length + 1)) as TokenDemoGarantePayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
