import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Envío de email por SMTP (OTP del inquilino). Se configura por entorno:
 *   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_FROM
 * Si no está configurado, `mailerConfigured` es false y `enviarOtp` devuelve
 * false: el caller cae al fallback de loguear el código (útil en dev/prueba).
 */
const host = process.env.SMTP_HOST;
// || (no ??): un SMTP_PORT='' (string vacío) pasaba el ?? y daba Number('')=0,
// puerto inválido → el OTP fallaba en silencio (el inquilino no podía entrar).
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM ?? 'My Alquiler <no-reply@myalquiler.app>';

export const mailerConfigured = Boolean(host && user && pass);

let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!mailerConfigured) return null;
  transporter ??= nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = TLS implícito; 587 = STARTTLS
    auth: { user: user!, pass: pass! },
  });
  return transporter;
}

export async function enviarOtp(email: string, code: string): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  await t.sendMail({
    from,
    to: email,
    subject: `Tu código de acceso a My Alquiler: ${code}`,
    text: `Tu código de acceso es ${code}. Vence en 10 minutos. Si no lo pediste, ignorá este mail.`,
    html:
      `<p>Tu código de acceso a <strong>My Alquiler</strong> es:</p>` +
      `<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:12px 0">${code}</p>` +
      `<p style="color:#666;font-size:13px">Vence en 10 minutos. Si no lo pediste, ignorá este mail.</p>`,
  });
  return true;
}
