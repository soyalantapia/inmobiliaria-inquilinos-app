// Token de compartir con garante. En backend real esto sería un JWT firmado
// con expiración corta (ej. 30 días). Acá lo simplificamos a un base64 con
// payload { contratoId, exp } para que el link público funcione sin DB.

export interface GaranteTokenPayload {
  contratoId: string;
  exp: number; // unix ms
}

const SECRET = 'llave-garante-v1'; // no-secret: es solo ofuscación visual

export function generarGaranteToken(contratoId: string, diasValido = 30): string {
  const exp = Date.now() + diasValido * 24 * 60 * 60 * 1000;
  const payload: GaranteTokenPayload = { contratoId, exp };
  const raw = `${SECRET}:${JSON.stringify(payload)}`;
  // base64url
  if (typeof window === 'undefined') {
    return Buffer.from(raw).toString('base64url');
  }
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function leerGaranteToken(token: string): GaranteTokenPayload | null {
  try {
    let decoded: string;
    if (typeof window === 'undefined') {
      decoded = Buffer.from(token, 'base64url').toString('utf8');
    } else {
      const padded = token.replace(/-/g, '+').replace(/_/g, '/');
      decoded = atob(padded);
    }
    if (!decoded.startsWith(`${SECRET}:`)) return null;
    const payload = JSON.parse(decoded.slice(SECRET.length + 1)) as GaranteTokenPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
