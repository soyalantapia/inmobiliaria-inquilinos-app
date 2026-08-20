/**
 * El aviso al propietario ahora tiene a dónde ir.
 *
 * El portal del propietario está en producción (`admin.myalquiler.com/propietario`, servido
 * como export estático desde el panel), pero ningún mail lo linkeaba: `enviarAnuncioEmail`
 * tenía la bandera `paraInquilino` y el comentario decía textual *"false (propietarios) → sin
 * CTA"*. Era cierto mientras el portal no existía en ningún lado; después quedó como un aviso
 * que el dueño lee una vez y, si lo borra, no tiene dónde volver a buscar.
 *
 * Estos tests no tocan SMTP: interceptan `sendMail` y miran el sobre. Cuidan las dos mitades,
 * que tienen que moverse juntas: que al propietario le llegue SU puerta —no la app del
 * inquilino, donde no puede entrar— y que el inquilino siga recibiendo la suya.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

interface MailEnviado {
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
}

const enviados: MailEnviado[] = [];

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: async (m: MailEnviado) => {
        enviados.push(m);
        return { messageId: 'test' };
      },
    }),
  },
}));

let mailer: typeof import('../src/mailer');

beforeAll(async () => {
  // El módulo lee la config SMTP al importarse: hay que setearla antes del import.
  process.env.SMTP_HOST = 'smtp.test';
  process.env.SMTP_USER = 'u';
  process.env.SMTP_PASS = 'p';
  process.env.SMTP_GAP_MS = '0'; // sin espaciado: acá no se mide tiempo
  // Sin APP_PROPIETARIO_URL a propósito: lo que se prueba es el default que sale a producción.
  delete process.env.APP_PROPIETARIO_URL;
  mailer = await import('../src/mailer');
});

function ultimo(): MailEnviado {
  const m = enviados[enviados.length - 1];
  if (!m) throw new Error('no se envió ningún mail');
  return m;
}

/** Todo el contenido visible del mail: da igual si está en el html o en el plano. */
function cuerpoCompleto(m: MailEnviado): string {
  return `${m.text ?? ''}\n${m.html ?? ''}`;
}

const ANUNCIO = {
  titulo: 'Se rindió agosto',
  cuerpo: 'Ya te depositamos lo de agosto.',
  prioridad: 'NORMAL',
  inmobiliariaNombre: 'Tapia Propiedades',
  inmobiliariaEmail: 'hola@tapia.com',
};

describe('el anuncio al propietario', () => {
  it('linkea al portal del propietario', async () => {
    await mailer.enviarAnuncioEmail({ ...ANUNCIO, email: 'dueno@test.com', paraInquilino: false });
    const cuerpo = cuerpoCompleto(ultimo());
    expect(cuerpo).toContain('https://admin.myalquiler.com/propietario');
    // El link va también en el texto plano: hay clientes que no muestran el html, y el
    // propietario tiene que poder copiarlo.
    expect(ultimo().text).toContain('https://admin.myalquiler.com/propietario');
  });

  it('NO lo manda a la app del inquilino, donde no puede entrar', async () => {
    await mailer.enviarAnuncioEmail({ ...ANUNCIO, email: 'dueno@test.com', paraInquilino: false });
    expect(cuerpoCompleto(ultimo())).not.toContain('app.myalquiler.com');
  });

  it('usa su propio copy: el del inquilino ("Ver en la app") no le dice nada', async () => {
    await mailer.enviarAnuncioEmail({ ...ANUNCIO, email: 'dueno@test.com', paraInquilino: false });
    const cuerpo = cuerpoCompleto(ultimo());
    expect(cuerpo).toContain('Ver mis rendiciones');
    expect(cuerpo).toContain('Entrá a ver tus rendiciones');
    expect(cuerpo).not.toContain('Ver en la app');
    expect(cuerpo).not.toContain('Velo en la app');
  });
});

describe('el anuncio al inquilino sigue igual', () => {
  it('linkea a su app y no al portal del propietario', async () => {
    await mailer.enviarAnuncioEmail({ ...ANUNCIO, email: 'inquilino@test.com', paraInquilino: true });
    const cuerpo = cuerpoCompleto(ultimo());
    expect(cuerpo).toContain('https://app.myalquiler.com');
    expect(cuerpo).toContain('Ver en la app');
    expect(cuerpo).not.toContain('/propietario');
  });
});

describe('APP_PROPIETARIO_URL', () => {
  it('se puede sobreescribir por entorno y se le saca la barra final', async () => {
    // El default es el host del PANEL con /propietario porque el portal NO tiene servicio
    // propio (work-agent/02-DEPLOY.md). Si alguien la setea en Railway, tiene que conservar
    // esa forma — este test sólo cuida que el override llegue al mail sin barra duplicada.
    vi.resetModules();
    process.env.APP_PROPIETARIO_URL = 'https://panel.otrodominio.com/propietario/';
    const otro = await import('../src/mailer');
    await otro.enviarAnuncioEmail({ ...ANUNCIO, email: 'dueno@test.com', paraInquilino: false });
    const cuerpo = cuerpoCompleto(ultimo());
    expect(cuerpo).toContain('https://panel.otrodominio.com/propietario');
    expect(cuerpo).not.toContain('/propietario/');
    delete process.env.APP_PROPIETARIO_URL;
  });
});
