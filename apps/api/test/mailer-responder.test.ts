/**
 * T-30 · A dónde va a parar el "Responder".
 *
 * El caso real: el aviso de aumento le decía al inquilino "respondele a tu inmobiliaria",
 * pero salía de un `no-reply@`. El inquilino apretaba Responder —porque el propio mail se lo
 * pedía— y esa respuesta no llegaba a ningún lado. Camila: *"¿Responderle a dónde? Si el mail
 * sale de no-reply, me van a contestar ahí y no me va a llegar nunca."*
 *
 * Estos tests no tocan SMTP: interceptan `sendMail` y miran el sobre. Verifican las dos
 * mitades del arreglo, que tienen que moverse juntas —el header `replyTo` y el texto que
 * invita a responder—, porque el bug es justamente que una prometía lo que la otra no daba.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

interface MailEnviado {
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

let mailer: typeof import('../src/mailer.js');

beforeAll(async () => {
  // El módulo lee la config SMTP al importarse: hay que setearla antes del import.
  process.env.SMTP_HOST = 'smtp.test';
  process.env.SMTP_USER = 'u';
  process.env.SMTP_PASS = 'p';
  process.env.SMTP_GAP_MS = '0'; // sin espaciado: acá no se mide tiempo
  mailer = await import('../src/mailer.js');
});

/** El último mail que salió por el transport. */
function ultimo(): MailEnviado {
  const m = enviados[enviados.length - 1];
  if (!m) throw new Error('no se envió ningún mail');
  return m;
}

/** Todo el contenido visible del mail: da igual si el texto está en el html o en el plano. */
function cuerpoCompleto(m: MailEnviado): string {
  return `${m.text ?? ''}\n${m.html ?? ''}`.toLowerCase();
}

const AJUSTE = {
  email: 'inquilino@test.com',
  inquilinoNombre: 'Mariela',
  inmobiliariaNombre: 'Tapia Propiedades',
  direccion: 'Artigas 1234',
  montoAnterior: 300000,
  montoNuevo: 360000,
  moneda: 'ARS',
  periodoDesde: '2026-09',
  motivo: 'ICL',
};

describe('emailDeRespuesta — a quién se le puede contestar', () => {
  it('acepta una dirección normal', () => {
    expect(mailer.emailDeRespuesta('hola@tapia.com.ar')).toBe('hola@tapia.com.ar');
  });

  it('le saca los espacios de los costados (el campo se carga a mano)', () => {
    expect(mailer.emailDeRespuesta('  hola@tapia.com  ')).toBe('hola@tapia.com');
  });

  it('rechaza vacío, null y undefined', () => {
    expect(mailer.emailDeRespuesta('')).toBeNull();
    expect(mailer.emailDeRespuesta('   ')).toBeNull();
    expect(mailer.emailDeRespuesta(null)).toBeNull();
    expect(mailer.emailDeRespuesta(undefined)).toBeNull();
  });

  it('rechaza lo que no es una dirección', () => {
    expect(mailer.emailDeRespuesta('no tengo mail')).toBeNull();
    expect(mailer.emailDeRespuesta('tapia.com.ar')).toBeNull();
    expect(mailer.emailDeRespuesta('hola@tapia')).toBeNull();
  });

  it('rechaza DOS direcciones en un campo — no queremos armar una lista sin querer', () => {
    expect(mailer.emailDeRespuesta('a@x.com, b@y.com')).toBeNull();
    expect(mailer.emailDeRespuesta('Tapia <hola@tapia.com>')).toBeNull();
  });
});

describe('el aviso de aumento (T-30)', () => {
  it('con email de la inmobiliaria: manda replyTo Y pide responder el mail', async () => {
    await mailer.enviarAvisoAjusteAlquiler({ ...AJUSTE, inmobiliariaEmail: 'hola@tapia.com' });
    const m = ultimo();
    expect(m.replyTo).toBe('hola@tapia.com');
    expect(cuerpoCompleto(m)).toContain('respondé este mail');
    // Y lo dice también en el pie, que es donde el que recibe lo busca.
    expect(cuerpoCompleto(m)).toContain('le llega a tapia propiedades');
  });

  it('sin email: no manda replyTo y NO invita a responder', async () => {
    await mailer.enviarAvisoAjusteAlquiler({ ...AJUSTE, inmobiliariaEmail: null });
    const m = ultimo();
    expect(m.replyTo).toBeUndefined();
    expect(cuerpoCompleto(m)).not.toContain('respond');
    expect(cuerpoCompleto(m)).toContain('no recibe respuestas');
    // Pero sigue diciéndole a dónde ir: no lo deja sin salida.
    expect(cuerpoCompleto(m)).toContain('hablá con tapia propiedades');
  });

  it('con un email mal cargado: degrada a "sin responder", NO se cae el envío', async () => {
    // Es la parte cara: este envío es best-effort y el caller se traga los errores. Si una
    // dirección basura hiciera fallar el sendMail, el inquilino se quedaría sin aviso del
    // aumento y sin ningún rastro de por qué.
    const antes = enviados.length;
    await mailer.enviarAvisoAjusteAlquiler({ ...AJUSTE, inmobiliariaEmail: 'no tengo mail' });
    expect(enviados.length).toBe(antes + 1);
    expect(ultimo().replyTo).toBeUndefined();
    expect(cuerpoCompleto(ultimo())).not.toContain('respond');
  });

  it('no habla de ningún "código" — ese pie era del OTP y salía en todos los mails', async () => {
    await mailer.enviarAvisoAjusteAlquiler({ ...AJUSTE, inmobiliariaEmail: 'hola@tapia.com' });
    expect(cuerpoCompleto(ultimo())).not.toContain('código');
  });
});

describe('el resto de los mails de la inmobiliaria', () => {
  it('el anuncio contesta a la inmobiliaria', async () => {
    await mailer.enviarAnuncioEmail({
      email: 'inquilino@test.com',
      titulo: 'Corte de agua',
      cuerpo: 'Mañana de 9 a 13.',
      prioridad: 'NORMAL',
      inmobiliariaNombre: 'Tapia Propiedades',
      inmobiliariaEmail: 'hola@tapia.com',
      paraInquilino: true,
    });
    expect(ultimo().replyTo).toBe('hola@tapia.com');
  });

  it('el anuncio sin email de la inmo no promete respuesta', async () => {
    await mailer.enviarAnuncioEmail({
      email: 'inquilino@test.com',
      titulo: 'Corte de agua',
      cuerpo: 'Mañana de 9 a 13.',
      prioridad: 'NORMAL',
      inmobiliariaNombre: 'Tapia Propiedades',
      paraInquilino: true,
    });
    expect(ultimo().replyTo).toBeUndefined();
    expect(cuerpoCompleto(ultimo())).toContain('no recibe respuestas');
  });

  it('la bienvenida al inquilino contesta a la inmobiliaria', async () => {
    await mailer.enviarInvitacionInquilino({
      email: 'inquilino@test.com',
      inquilinoNombre: 'Mariela',
      inmobiliaria: { nombre: 'Tapia Propiedades', email: 'hola@tapia.com', telefono: '351...' },
    });
    expect(ultimo().replyTo).toBe('hola@tapia.com');
  });

  it('la invitación al equipo contesta a la inmobiliaria', async () => {
    await mailer.enviarInvitacionEquipo({
      email: 'operadora@test.com',
      nombre: 'Camila',
      rol: 'ADMIN',
      inmobiliariaNombre: 'Tapia Propiedades',
      inmobiliariaEmail: 'hola@tapia.com',
    });
    expect(ultimo().replyTo).toBe('hola@tapia.com');
  });
});

describe('los mails de la plataforma NO se contestan a la inmobiliaria', () => {
  it('el OTP del inquilino sale sin replyTo y conserva su aviso del código', async () => {
    await mailer.enviarOtp('login@test.com', '123456');
    const m = ultimo();
    expect(m.replyTo).toBeUndefined();
    expect(cuerpoCompleto(m)).toContain('si no pediste este código');
  });

  it('el OTP del panel sale sin replyTo', async () => {
    await mailer.enviarOtpAdmin('admin@test.com', '654321');
    expect(ultimo().replyTo).toBeUndefined();
  });

  it('la bienvenida a la inmobiliaria no la manda a escribirse a sí misma', async () => {
    await mailer.enviarBienvenidaInmobiliaria('admin@tapia.com', 'Camila', 'Tapia Propiedades');
    expect(ultimo().replyTo).toBeUndefined();
  });
});
