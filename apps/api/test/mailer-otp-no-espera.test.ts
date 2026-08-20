/**
 * T-31 · El OTP no puede quedar atrás de un envío masivo.
 *
 * Regresión que introdujo la propia cola de T-31: al mandar TODO por una FIFO compartida,
 * un anuncio a 200 inquilinos dejaba el código de login del próximo que quisiera entrar
 * detrás de esos 200 → 200 × GAP_MS de espera. Un mail demorado es tolerable; un login
 * que tarda 80 segundos no.
 *
 * Este test fija el contrato: los masivos se espacian, el OTP sale derecho.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

const enviados: string[] = [];

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: async (m: { to?: string; subject?: string }) => {
        await new Promise((r) => setTimeout(r, 2));
        enviados.push(String(m.to));
        return { messageId: 'test' };
      },
    }),
  },
}));

const GAP = 40;
let mailer: typeof import('../src/mailer');

beforeAll(async () => {
  // El módulo lee la config SMTP al importarse: hay que setearla antes del import.
  process.env.SMTP_HOST = 'smtp.test';
  process.env.SMTP_USER = 'u';
  process.env.SMTP_PASS = 'p';
  process.env.SMTP_GAP_MS = String(GAP);
  mailer = await import('../src/mailer');
});

describe('el OTP no espera detrás de los masivos (T-31)', () => {
  it('sale mientras 10 anuncios siguen encolados, no después', async () => {
    expect(mailer.mailerConfigured).toBe(true);

    // La inmobiliaria dispara un anuncio a 10 destinatarios (en la vida real, 200).
    const anuncios = Array.from({ length: 10 }, (_, i) =>
      mailer.enviarAnuncioEmail({
        email: `masivo${i}@test.com`,
        titulo: 'Corte de agua',
        cuerpo: 'Mañana de 9 a 13.',
        prioridad: 'NORMAL',
        inmobiliariaNombre: 'Tapia',
        paraInquilino: true,
      }),
    );

    // Justo en ese momento alguien intenta entrar a la app.
    const t0 = Date.now();
    await mailer.enviarOtp('login@test.com', '123456');
    const esperaDelOtp = Date.now() - t0;

    // Si el OTP compartiera la cola, habría esperado ~10 × GAP.
    expect(esperaDelOtp).toBeLessThan(GAP * 3);
    // Y salió antes de que la cola masiva terminara: quedan anuncios sin mandar.
    expect(enviados).toContain('login@test.com');
    expect(enviados.filter((e) => e.startsWith('masivo')).length).toBeLessThan(10);

    await Promise.all(anuncios);
    expect(enviados.filter((e) => e.startsWith('masivo')).length).toBe(10);
  });
});
