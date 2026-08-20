/**
 * T-30-N1 · Quién figura como remitente.
 * T-30-N2 · La invitación al equipo no escapaba el HTML.
 *
 * Los dos salieron del mismo archivo y del mismo role play: el que recibe el mail mira primero
 * QUIÉN se lo manda, y hasta ahora leía "My Alquiler" —una marca que no conoce— avisándole que
 * le suben el alquiler. Y el único template que armaba su HTML a mano se rompía solo con una
 * razón social que tuviera un `&`.
 *
 * No tocan SMTP: interceptan `sendMail` y miran el sobre.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

interface MailEnviado {
  from?: string;
  to?: string;
  replyTo?: string;
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

function envSmtp() {
  process.env.SMTP_HOST = 'smtp.test';
  process.env.SMTP_USER = 'u';
  process.env.SMTP_PASS = 'p';
  process.env.SMTP_GAP_MS = '0';
  process.env.SMTP_FROM = 'My Alquiler <no-reply@myalquiler.app>';
}

let mailer: typeof import('../src/mailer');

beforeAll(async () => {
  envSmtp();
  delete process.env.EMAIL_FROM_CON_INMOBILIARIA; // default: apagado
  mailer = await import('../src/mailer');
});

function ultimo(): MailEnviado {
  const m = enviados[enviados.length - 1];
  if (!m) throw new Error('no se envió ningún mail');
  return m;
}

const INVITACION = {
  email: 'nuevo@tapia.com.ar',
  nombre: 'Luciana',
  rol: 'OPERADOR',
  inmobiliariaNombre: 'Tapia Propiedades',
  inmobiliariaEmail: 'hola@tapia.com.ar',
};

// ─── T-30-N2 ────────────────────────────────────────────────────────────────

describe('T-30-N2 — la invitación al equipo escapa el HTML', () => {
  it('una razón social con & y <> no se cuela cruda en el HTML', async () => {
    await mailer.enviarInvitacionEquipo({
      ...INVITACION,
      inmobiliariaNombre: 'Suárez & Cía <Córdoba>',
    });
    const html = ultimo().html ?? '';

    // Lo que rompía el mail: el `<Córdoba>` lo comía el navegador como si fuera una etiqueta.
    expect(html).not.toContain('<Córdoba>');
    expect(html).toContain('Suárez &amp; Cía &lt;Córdoba&gt;');
  });

  it('el email del invitado también se escapa', async () => {
    await mailer.enviarInvitacionEquipo({
      ...INVITACION,
      email: 'a<b>@tapia.com.ar',
    });
    const html = ultimo().html ?? '';
    expect(html).not.toContain('a<b>@');
    expect(html).toContain('a&lt;b&gt;@');
  });

  it('ahora pasa por el shell de marca, como el resto de los templates', async () => {
    await mailer.enviarInvitacionEquipo(INVITACION);
    const html = ultimo().html ?? '';
    expect(html).toContain('<!doctype html>');
    // El pie de T-30: dice a dónde cae un "Responder".
    expect(html).toContain('Tapia Propiedades');
    expect(html.toLowerCase()).toContain('podés responder');
  });

  it('sin email de la inmobiliaria, el pie NO promete que se puede responder', async () => {
    await mailer.enviarInvitacionEquipo({ ...INVITACION, inmobiliariaEmail: null });
    const html = (ultimo().html ?? '').toLowerCase();
    expect(html).not.toContain('podés responder');
    expect(html).toContain('no recibe respuestas');
  });
});

// ─── T-30-N1 ────────────────────────────────────────────────────────────────

describe('T-30-N1 — remitente, con el flag APAGADO (default)', () => {
  it('no cambia nada: sigue saliendo como My Alquiler', () => {
    expect(mailer.remitente('Tapia Propiedades')).toBe('My Alquiler <no-reply@myalquiler.app>');
  });

  it('el aviso de aumento sale con el remitente de siempre', async () => {
    await mailer.enviarAvisoAjusteAlquiler({
      email: 'inquilino@test.com',
      inquilinoNombre: 'Mariela',
      inmobiliariaNombre: 'Tapia Propiedades',
      direccion: 'Artigas 1234',
      montoAnterior: 300000,
      montoNuevo: 360000,
      moneda: 'ARS',
      periodoDesde: '2026-09',
      motivo: 'ICL',
    });
    expect(ultimo().from).toBe('My Alquiler <no-reply@myalquiler.app>');
  });
});

describe('T-30-N1 — remitente, con el flag PRENDIDO', () => {
  let conFlag: typeof import('../src/mailer');

  beforeAll(async () => {
    vi.resetModules();
    envSmtp();
    process.env.EMAIL_FROM_CON_INMOBILIARIA = '1';
    conFlag = await import('../src/mailer');
  });

  it('el inquilino ve el nombre de SU inmobiliaria en la bandeja', () => {
    expect(conFlag.remitente('Tapia Propiedades')).toBe(
      '"Tapia Propiedades vía My Alquiler" <no-reply@myalquiler.app>',
    );
  });

  it('la DIRECCIÓN no cambia — SPF/DKIM siguen firmando el mismo dominio', () => {
    expect(conFlag.remitente('Tapia Propiedades')).toContain('<no-reply@myalquiler.app>');
  });

  it('un nombre con comillas, comas o saltos no puede inyectar cabeceras', () => {
    const sucio = conFlag.remitente('Evil",\r\nBcc: victima@ajeno.com <x@y.com>');
    expect(sucio).not.toContain('\r');
    expect(sucio).not.toContain('\n');
    // Una sola dirección, la nuestra: nada de destinatarios de contrabando.
    expect(sucio.match(/</g)?.length).toBe(1);
    expect(sucio).toContain('<no-reply@myalquiler.app>');
  });

  it('sin nombre de inmobiliaria cae al remitente de siempre', () => {
    expect(conFlag.remitente(null)).toBe('My Alquiler <no-reply@myalquiler.app>');
    expect(conFlag.remitente('   ')).toBe('My Alquiler <no-reply@myalquiler.app>');
  });

  it('el OTP NO cambia de remitente: es de la plataforma, y es el mail más sensible a spam', async () => {
    await conFlag.enviarOtp('alguien@test.com', '123456');
    expect(ultimo().from).toBe('My Alquiler <no-reply@myalquiler.app>');
  });

  it('el aviso de aumento SÍ sale a nombre de la inmobiliaria', async () => {
    await conFlag.enviarAvisoAjusteAlquiler({
      email: 'inquilino@test.com',
      inquilinoNombre: 'Mariela',
      inmobiliariaNombre: 'Tapia Propiedades',
      direccion: 'Artigas 1234',
      montoAnterior: 300000,
      montoNuevo: 360000,
      moneda: 'ARS',
      periodoDesde: '2026-09',
      motivo: 'ICL',
    });
    expect(ultimo().from).toBe('"Tapia Propiedades vía My Alquiler" <no-reply@myalquiler.app>');
  });
});
