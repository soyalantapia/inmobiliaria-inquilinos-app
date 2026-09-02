/**
 * T-31 · La cola de envío de mails.
 *
 * El caso real: Camila ajusta veinte alquileres el mismo día. Cada ajuste dispara un mail
 * al inquilino desde la MISMA cuenta SMTP. Si salen los veinte en ráfaga, el proveedor los
 * marca como spam o corta la conexión, y no se entera NADIE del aumento.
 *
 * Estos tests son sobre `crearColaDeEnvio`, que es pura: no toca SMTP ni red.
 */
import { describe, it, expect } from 'vitest';
import { crearColaDeEnvio } from '../src/mailer.js';

/** Registra cuándo empezó y terminó cada envío para poder detectar solapamiento. */
function espia(duracionMs = 5) {
  const tramos: Array<{ mail: string; inicio: number; fin: number }> = [];
  let enVuelo = 0;
  let maxEnVuelo = 0;
  const enviar = async (mail: string) => {
    enVuelo++;
    maxEnVuelo = Math.max(maxEnVuelo, enVuelo);
    const inicio = Date.now();
    await new Promise((r) => setTimeout(r, duracionMs));
    tramos.push({ mail, inicio, fin: Date.now() });
    enVuelo--;
    return `ok:${mail}`;
  };
  return { enviar, tramos, get maxEnVuelo() { return maxEnVuelo; } };
}

describe('cola de envío de mails (T-31)', () => {
  it('nunca manda dos mails a la vez, aunque se encolen todos de golpe', async () => {
    const s = espia(10);
    const cola = crearColaDeEnvio(s.enviar, 0);

    // Los 20 ajustes se disparan sin esperar uno al otro: así los encola el server.
    await Promise.all(Array.from({ length: 20 }, (_, i) => cola(`m${i}`)));

    expect(s.maxEnVuelo).toBe(1);
    expect(s.tramos).toHaveLength(20);
  });

  it('respeta el orden en que se encolaron', async () => {
    const s = espia(1);
    const cola = crearColaDeEnvio(s.enviar, 0);
    await Promise.all(Array.from({ length: 10 }, (_, i) => cola(`m${i}`)));
    expect(s.tramos.map((t) => t.mail)).toEqual(
      Array.from({ length: 10 }, (_, i) => `m${i}`),
    );
  });

  it('deja pasar el gap entre un envío y el siguiente (no es ráfaga)', async () => {
    const s = espia(0);
    const GAP = 30;
    const cola = crearColaDeEnvio(s.enviar, GAP);

    const t0 = Date.now();
    await Promise.all([cola('a'), cola('b'), cola('c')]);
    const total = Date.now() - t0;

    // 3 mails ⇒ 2 gaps entre ellos. Margen amplio: el test mide reloj real.
    expect(total).toBeGreaterThanOrEqual(GAP * 2 * 0.8);
    expect(s.tramos).toHaveLength(3);
  });

  it('si un mail falla, los que vienen atrás se mandan igual', async () => {
    const enviados: string[] = [];
    const cola = crearColaDeEnvio(async (mail: string) => {
      if (mail === 'malo') throw new Error('mailbox unavailable');
      enviados.push(mail);
      return null;
    }, 0);

    const rs = await Promise.allSettled([cola('a'), cola('malo'), cola('b'), cola('c')]);

    // La cola no se corta: 'b' y 'c' salieron después del rebote de 'malo'.
    expect(enviados).toEqual(['a', 'b', 'c']);
    // Y el error NO se traga: el caller del mail que falló se entera. Eso es lo que
    // permite que `avisarAjusteAlInquilino` registre el fallo en el historial del contrato.
    expect(rs.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled', 'fulfilled']);
  });
});
