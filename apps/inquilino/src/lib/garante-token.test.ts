/**
 * T-69 · El token de garante no valida nada, y su nombre decía lo contrario.
 *
 * Es `base64url(JSON)` con un prefijo constante escrito en texto plano en el mismo archivo.
 * Cualquiera fabrica uno para cualquier `contratoId` en dos líneas. Existe para que la página
 * pública del garante funcione en la demo estática de GitHub Pages, que no tiene backend.
 *
 * EL RIESGO NO ES CRIPTOGRÁFICO, ES DE LECTURA. Mientras se llamaba `leerGaranteToken` y estaba
 * en el camino de producción, era exactamente la línea que un dev futuro copia para "resolver el
 * contrato acá", creyendo que el token ya se validó. El docblock de
 * `apps/api/src/routes/portal-propietario.ts:31-34` ya lo nombra como el precedente a no repetir.
 *
 * Estos tests fijan las dos propiedades que lo mantienen inofensivo:
 *  1. Es falsificable — se afirma explícitamente, para que nadie lo confunda con autenticación.
 *  2. En producción no se abre nunca (eso lo garantiza el orden de `garantes/[token]/page.tsx`).
 */
import { describe, it, expect } from 'vitest';
import { generarTokenDemoGarante, leerTokenDemoGarante } from './garante-token';

const PREFIJO = 'llave-garante-v1';

describe('T-69 — el token de la demo es falsificable, y está bien que se sepa', () => {
  it('ida y vuelta: transporta el contratoId, nada más', () => {
    const t = generarTokenDemoGarante('cnt_123', 30);
    expect(leerTokenDemoGarante(t)?.contratoId).toBe('cnt_123');
  });

  it('CUALQUIERA fabrica uno válido para cualquier contrato, sin la función', () => {
    // Tres líneas y el "secreto" está en el propio archivo. Esto NO es un hallazgo: es la
    // razón por la que las funciones se llaman `...Demo...` y por la que producción no las usa.
    const falsificado = Buffer.from(
      `${PREFIJO}:${JSON.stringify({ contratoId: 'cnt_de_otra_persona', exp: Date.now() + 1000 })}`,
    ).toString('base64url');

    expect(leerTokenDemoGarante(falsificado)?.contratoId).toBe('cnt_de_otra_persona');
  });

  it('un token vencido no se acepta', () => {
    const vencido = Buffer.from(
      `${PREFIJO}:${JSON.stringify({ contratoId: 'cnt_1', exp: Date.now() - 1 })}`,
    ).toString('base64url');
    expect(leerTokenDemoGarante(vencido)).toBeNull();
  });

  it('basura o prefijo ajeno devuelven null en vez de romper', () => {
    for (const t of ['', 'no-es-base64!!', Buffer.from('otro-prefijo:{}').toString('base64url')]) {
      expect(leerTokenDemoGarante(t)).toBeNull();
    }
  });
});
