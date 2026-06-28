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

/** Shell premium My Alquiler: fondo oscuro, card violeta, wordmark tipográfico,
 *  franja de marca, cuerpo y footer. Mismo patrón que Speed Hub pero marca propia. */
function shell(opts: { preview: string; inner: string }): string {
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>My Alquiler</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0f;">
${preheader(opts.preview)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0f;">
  <tr><td align="center" style="padding:36px 14px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="max-width:480px;width:100%;background-color:#111118;border:1px solid #222230;border-radius:20px;overflow:hidden;">

      <!-- Header: wordmark tipográfico sobre fondo muy oscuro -->
      <tr><td align="center" bgcolor="#0d0d14" style="background-color:#0d0d14;padding:30px 28px 26px 28px;">
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">
          <span style="color:#7c3aed;">●</span>&nbsp;My Alquiler
        </div>
      </td></tr>

      <!-- Franja de marca violeta -->
      <tr><td height="4" bgcolor="#7c3aed" style="height:4px;line-height:4px;font-size:0;background-color:#7c3aed;">&nbsp;</td></tr>
      <tr><td height="1" bgcolor="#5b21b6" style="height:1px;line-height:1px;font-size:0;background-color:#5b21b6;">&nbsp;</td></tr>

      <!-- Cuerpo -->
      <tr><td style="padding:36px 32px 32px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        ${opts.inner}
      </td></tr>

      <!-- Footer -->
      <tr><td bgcolor="#0d0d14" style="background-color:#0d0d14;border-top:1px solid #1e1e2e;padding:20px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="middle" style="color:#4a4a6a;font-size:11px;line-height:1.5;">
            <strong style="color:#8b8baa;">My Alquiler</strong> &middot; admin.myalquiler.com<br>
            Gestión de alquileres. Si no pediste este código, podés ignorar este email.
          </td>
        </tr></table>
      </td></tr>

    </table>
    <div style="max-width:480px;margin:12px auto 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2a2a3a;font-size:10px;line-height:1.5;text-align:center;">
      Recibís este email porque alguien lo solicitó para tu dirección. Si no fuiste vos, podés ignorarlo.
    </div>
  </td></tr>
</table>
</body></html>`;
}

// ─── Templates específicos ────────────────────────────────────────────────────

/**
 * Email OTP para el panel admin (usuarios/inmobiliarias).
 * Código grande, carta oscura con franja violeta.
 */
function otpHtml(opts: { code: string; ttlMin: number }): string {
  const digits = esc(opts.code);
  const inner = `
    <h1 style="margin:0 0 10px;color:#ffffff;font-size:22px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;">Tu código de acceso</h1>
    <p style="margin:0 0 22px;color:#8888aa;font-size:15px;line-height:1.65;">Usá este código de un solo uso para ingresar al panel de My Alquiler.</p>

    <!-- Bloque del código -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
      <tr>
        <td align="center" bgcolor="#0d0d14" style="background-color:#0d0d14;border:1px solid #2a2a40;border-radius:16px;padding:28px 16px;">
          <div style="color:#7c3aed;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin:0 0 14px;">Código de verificación</div>
          <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:44px;line-height:1;font-weight:800;letter-spacing:16px;color:#ffffff;padding-left:16px;">${digits}</div>
        </td>
      </tr>
    </table>

    <!-- Vencimiento -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px;">
      <tr>
        <td bgcolor="#1a0d2e" style="background-color:#1a0d2e;border:1px solid #3d1f6e;border-radius:10px;padding:12px 16px;">
          <p style="margin:0;color:#c4b5fd;font-size:13px;line-height:1.5;">
            ⏱&nbsp; Este código vence en <strong style="color:#ffffff;">${opts.ttlMin} minutos</strong> y es de un solo uso.
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
