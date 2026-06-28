import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Envío de emails por SMTP. Configura con variables de entorno:
 *   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * Si no está configurado, las funciones devuelven false y el caller
 * loguea el código (útil en dev/prueba).
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

// ─── Helpers HTML email-safe (tablas + estilos inline) ───────────────────────

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Texto invisible de preview — aparece en la bandeja de entrada antes de abrir. */
const preheader = (t: string) =>
  `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;height:0;width:0;">${esc(t)}${'&#8199;&#65279;&nbsp;'.repeat(40)}</div>`;

/** Shell My Alquiler — tema CLARO (fondo blanco, acento violeta), email-safe
 *  (tablas + estilos inline). Logo "My" recreado como badge violeta (sin imagen
 *  hosteada), wordmark tipográfico, franja de marca, cuerpo y footer. */
function shell(opts: { preview: string; inner: string }): string {
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>My Alquiler</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f2fb;">
${preheader(opts.preview)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f2fb;">
  <tr><td align="center" style="padding:36px 14px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="max-width:480px;width:100%;background-color:#ffffff;border:1px solid #e9e6f2;border-radius:20px;overflow:hidden;">

      <!-- Header: badge "My" + wordmark sobre blanco -->
      <tr><td align="center" bgcolor="#ffffff" style="background-color:#ffffff;padding:30px 28px 22px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="middle" style="padding-right:10px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td align="center" valign="middle" width="40" height="40"
                  bgcolor="#7c3aed" style="width:40px;height:40px;background-color:#7c3aed;border-radius:11px;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:800;line-height:40px;">My</td>
            </tr></table>
          </td>
          <td valign="middle" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:800;letter-spacing:-0.4px;color:#1c1726;">My&nbsp;Alquiler</td>
        </tr></table>
      </td></tr>

      <!-- Franja de marca violeta -->
      <tr><td height="3" bgcolor="#7c3aed" style="height:3px;line-height:3px;font-size:0;background-color:#7c3aed;">&nbsp;</td></tr>

      <!-- Cuerpo -->
      <tr><td style="padding:34px 32px 32px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        ${opts.inner}
      </td></tr>

      <!-- Footer -->
      <tr><td bgcolor="#faf9fd" style="background-color:#faf9fd;border-top:1px solid #eeebf6;padding:20px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="middle" style="color:#8a85a0;font-size:11px;line-height:1.5;">
            <strong style="color:#5b556e;">My Alquiler</strong> &middot; admin.myalquiler.com<br>
            Gestión de alquileres. Si no pediste este código, podés ignorar este email.
          </td>
        </tr></table>
      </td></tr>

    </table>
    <div style="max-width:480px;margin:12px auto 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#b3aec6;font-size:10px;line-height:1.5;text-align:center;">
      Recibís este email porque alguien lo solicitó para tu dirección. Si no fuiste vos, podés ignorarlo.
    </div>
  </td></tr>
</table>
</body></html>`;
}

// ─── Templates específicos ────────────────────────────────────────────────────

/**
 * Email OTP (lo usan tanto el inquilino como el panel admin).
 * Código grande, carta clara (fondo blanco) con franja violeta.
 */
function otpHtml(opts: { code: string; ttlMin: number }): string {
  const digits = esc(opts.code);
  const inner = `
    <h1 style="margin:0 0 10px;color:#1c1726;font-size:22px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;">Tu código de acceso</h1>
    <p style="margin:0 0 22px;color:#6b6577;font-size:15px;line-height:1.65;">Usá este código de un solo uso para ingresar al panel de My Alquiler.</p>

    <!-- Bloque del código -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr>
        <td align="center" bgcolor="#f6f4fe" style="background-color:#f6f4fe;border:1px solid #e4dcfb;border-radius:16px;padding:26px 16px;">
          <div style="color:#7c3aed;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin:0 0 14px;">Código de verificación</div>
          <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:44px;line-height:1;font-weight:800;letter-spacing:16px;color:#5b21b6;padding-left:16px;">${digits}</div>
        </td>
      </tr>
    </table>

    <!-- Vencimiento -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px;">
      <tr>
        <td bgcolor="#faf9fd" style="background-color:#faf9fd;border:1px solid #ece8f7;border-radius:10px;padding:12px 16px;">
          <p style="margin:0;color:#6b6577;font-size:13px;line-height:1.5;">
            ⏱&nbsp; Este código vence en <strong style="color:#1c1726;">${opts.ttlMin} minutos</strong> y es de un solo uso.
          </p>
        </td>
      </tr>
    </table>`;

  return shell({
    preview: `${opts.code} — tu código de acceso a My Alquiler (${opts.ttlMin} min)`,
    inner,
  });
}

// ─── Exports públicos ─────────────────────────────────────────────────────────

/** OTP para el inquilino (app.myalquiler.com) — mismo diseño. */
export async function enviarOtp(email: string, code: string): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  await t.sendMail({
    from,
    to: email,
    subject: `${code} es tu código de acceso a My Alquiler`,
    text: `Tu código de acceso a My Alquiler es ${code}.\nVence en 10 minutos. Si no lo pediste, ignorá este mail.`,
    html: otpHtml({ code, ttlMin: 10 }),
  });
  return true;
}

/** OTP para el panel admin (admin.myalquiler.com) — mismo template. */
export async function enviarOtpAdmin(email: string, code: string): Promise<boolean> {
  return enviarOtp(email, code); // mismo canal SMTP, mismo diseño
}
