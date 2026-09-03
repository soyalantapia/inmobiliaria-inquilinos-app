/**
 * Ninguna pantalla de la PWA le muestra «Alquiler» a alguien que no alquila.
 *
 * EL DEFECTO, Y POR QUÉ VUELVE. Hay ocupantes que **no pagan alquiler**: el canon lo arregla el
 * propietario por fuera y la inmobiliaria sólo administra el consorcio. Camila lo pidió el 03/08
 * `[30:04]`. El backend lo modela (`Contrato.tipoContrato = SOLO_EXPENSAS`, el único caso en que
 * el alta acepta `monto === 0`) y `lib/tipo-contrato.ts` tiene los helpers, con sus tests.
 *
 * Y aun así el defecto reapareció **dos veces más**, en dos pantallas que la tanda original no
 * tocó: la card destacada de `/comprobantes` imprimía «Alquiler $0», y el contrato descargable
 * decía «Alquiler mensual: $0» y debajo el índice y la fecha del próximo ajuste — el ajuste de
 * un canon que no existe.
 *
 * Ése es el patrón: **la regla está bien y una pantalla nueva no se entera.** Los tests de
 * `tipo-contrato.test.ts` cuidan los helpers; éste cuida que las pantallas los usen.
 *
 * CÓMO FUNCIONA. Busca en la PWA todo archivo que rotule el importe mensual y exige que decida
 * por `tipoContrato` — importando el módulo, o declarándose acá abajo con su motivo. Agregar una
 * excepción es una decisión, no un trámite.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

/** Los rótulos con los que una pantalla nombra el importe mensual del contrato. */
const ROTULOS = [/>Alquiler</, /Alquiler mensual/, /Alquiler actual/];

/**
 * Pantallas que rotulan el alquiler y NO importan el módulo, a propósito. Cada una con su
 * motivo — si mañana una tercera aparece acá sin razón, es que alguien la agregó para callar
 * el test.
 */
const DECLARADAS: Record<string, string> = {
  'app/(app)/certificado/imprimible.tsx':
    'decide inline por `tipoContrato` y su dato ya viene resuelto del server (`montoMensual`), ' +
    'con otra forma que la del helper',
  'app/garantes/[token]/page.tsx':
    'vista de DEMO: no hay endpoint que resuelva un contrato por token de garante, así que en ' +
    'producción no muestra datos reales — lo dice su propio comentario y usa `contratoMock`',
};

function archivosTsx(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules' || entrada === '.next') continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) archivosTsx(ruta, acc);
    else if (entrada.endsWith('.tsx')) acc.push(ruta);
  }
  return acc;
}

const relativo = (ruta: string) => ruta.slice(RAIZ.length).replace(/\\/g, '/');

describe('ninguna pantalla de la PWA inventa un alquiler', () => {
  const rotulan = archivosTsx(RAIZ)
    .map((ruta) => ({ ruta, src: readFileSync(ruta, 'utf8') }))
    .filter(({ src }) => ROTULOS.some((r) => r.test(src)));

  it('el barrido encuentra pantallas: si no, el test no está midiendo nada', () => {
    // Sin esto, un cambio de rótulo dejaría la lista vacía y el archivo pasaría en verde
    // sin mirar una sola pantalla — que es la forma en que un guard deja de avisar.
    expect(rotulan.length).toBeGreaterThanOrEqual(3);
  });

  it('🔴 todas deciden por `tipoContrato`, o están declaradas con su motivo', () => {
    const sinDecidir = rotulan
      .filter(({ src }) => !src.includes('@/lib/tipo-contrato'))
      .map(({ ruta }) => relativo(ruta))
      .filter((r) => !(r in DECLARADAS));

    expect(
      sinDecidir,
      'Estas pantallas rotulan el importe mensual sin mirar `tipoContrato`. Un ocupante de ' +
        'SOLO_EXPENSAS va a leer «Alquiler $0» —o peor, el ajuste de un canon que no existe—. ' +
        'Usá los helpers de `lib/tipo-contrato.ts`, o agregala a DECLARADAS con el motivo.',
    ).toEqual([]);
  });

  it('las excepciones declaradas siguen existiendo: una lista con archivos muertos miente', () => {
    const presentes = new Set(rotulan.map(({ ruta }) => relativo(ruta)));
    const fantasmas = Object.keys(DECLARADAS).filter((r) => !presentes.has(r));
    expect(fantasmas, 'estas excepciones ya no corresponden a ninguna pantalla que rotule alquiler').toEqual([]);
  });
});
