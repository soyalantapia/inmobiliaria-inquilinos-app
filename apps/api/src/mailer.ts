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

/** URL de la app del inquilino (para los CTAs del email). */
const APP_INQUILINO_URL = (process.env.APP_INQUILINO_URL ?? 'https://app.myalquiler.com').replace(/\/$/, '');

/** Datos de contacto de la inmobiliaria que se muestran en el email al inquilino. */
export interface InmobiliariaContacto {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
}

/** Fila de contacto "ícono · valor" para el bloque "Tu inmobiliaria". */
function filaContacto(icono: string, valor: string): string {
  return `<p style="margin:0 0 4px;color:#6b6577;font-size:13px;line-height:1.5;">${icono}&nbsp; ${esc(valor)}</p>`;
}

/** Cuerpo del email de bienvenida/onboarding del inquilino (tema claro). */
function invitacionHtml(opts: {
  inquilinoNombre?: string | null;
  inmobiliaria: InmobiliariaContacto;
  propiedadDireccion?: string | null;
  email: string;
  appUrl: string;
}): string {
  const inmoNombre = esc(opts.inmobiliaria.nombre);
  const primerNombre = opts.inquilinoNombre?.trim().split(/\s+/)[0];
  const saludo = primerNombre ? `¡Bienvenido/a, ${esc(primerNombre)}! 🎉` : '¡Bienvenido/a a My Alquiler! 🎉';

  // Bloque de contacto de la inmobiliaria (sólo las filas que existen).
  const contacto = [
    opts.inmobiliaria.telefono ? filaContacto('📞', opts.inmobiliaria.telefono) : '',
    opts.inmobiliaria.email ? filaContacto('✉️', opts.inmobiliaria.email) : '',
    opts.inmobiliaria.direccion ? filaContacto('📍', opts.inmobiliaria.direccion) : '',
  ].join('');

  const inner = `
    <h1 style="margin:0 0 10px;color:#1c1726;font-size:22px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;">${saludo}</h1>
    <p style="margin:0 0 16px;color:#6b6577;font-size:15px;line-height:1.65;"><strong style="color:#1c1726;">${inmoNombre}</strong> está muy contenta de sumarte a <strong style="color:#1c1726;">My Alquiler</strong> — la app donde vas a gestionar todo tu alquiler desde el celular, sin papeles ni llamados a deshora.</p>
    ${
      opts.propiedadDireccion
        ? `<p style="margin:0 0 18px;color:#6b6577;font-size:14px;line-height:1.5;">Tu alquiler: <strong style="color:#1c1726;">${esc(opts.propiedadDireccion)}</strong></p>`
        : ''
    }

    <!-- Botón -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;"><tr>
      <td align="center" bgcolor="#7c3aed" style="background-color:#7c3aed;border-radius:12px;">
        <a href="${opts.appUrl}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">Entrar a My Alquiler &rarr;</a>
      </td>
    </tr></table>

    <!-- Cómo entrás -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
      <tr>
        <td bgcolor="#faf9fd" style="background-color:#faf9fd;border:1px solid #ece8f7;border-radius:10px;padding:12px 16px;">
          <p style="margin:0;color:#6b6577;font-size:13px;line-height:1.5;">
            <strong style="color:#1c1726;">Cómo entrás:</strong> con tu email (<strong style="color:#1c1726;">${esc(opts.email)}</strong>) y un código de 6 dígitos que te mandamos al mail. <strong style="color:#1c1726;">Sin contraseñas.</strong>
          </p>
        </td>
      </tr>
    </table>

    <!-- Qué vas a poder hacer -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
      <tr>
        <td bgcolor="#faf9fd" style="background-color:#faf9fd;border:1px solid #ece8f7;border-radius:10px;padding:14px 16px;">
          <p style="margin:0 0 8px;color:#1c1726;font-size:13px;font-weight:700;">Con My Alquiler vas a poder:</p>
          <p style="margin:0 0 4px;color:#6b6577;font-size:13px;line-height:1.6;">✅&nbsp; Pagar el alquiler y subir el comprobante en un toque.</p>
          <p style="margin:0 0 4px;color:#6b6577;font-size:13px;line-height:1.6;">📄&nbsp; Ver tu contrato, vencimientos, ajustes y descargar tus recibos.</p>
          <p style="margin:0 0 4px;color:#6b6577;font-size:13px;line-height:1.6;">🛠️&nbsp; Hacer reclamos con foto y seguir la conversación por dentro.</p>
          <p style="margin:0;color:#6b6577;font-size:13px;line-height:1.6;">💬&nbsp; Chatear con tu inmobiliaria cuando lo necesites.</p>
        </td>
      </tr>
    </table>

    <!-- Tu inmobiliaria (datos de contacto) -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px;">
      <tr>
        <td bgcolor="#f6f4fe" style="background-color:#f6f4fe;border:1px solid #e4dcfb;border-radius:10px;padding:14px 16px;">
          <p style="margin:0 0 8px;color:#1c1726;font-size:13px;font-weight:700;">Tu inmobiliaria</p>
          <p style="margin:0 0 4px;color:#1c1726;font-size:14px;font-weight:600;">${inmoNombre}</p>
          ${contacto || '<p style="margin:0;color:#6b6577;font-size:13px;line-height:1.5;">Cualquier duda, respondé este mail.</p>'}
        </td>
      </tr>
    </table>`;

  return shell({
    preview: `${opts.inmobiliaria.nombre} te da la bienvenida a My Alquiler — entrá con tu email`,
    inner,
  });
}

/**
 * Email de bienvenida/onboarding al inquilino: la inmobiliaria lo sumó a My
 * Alquiler. Incluye saludo, datos de contacto de la inmobiliaria, cómo ingresar
 * (email + OTP) y qué puede hacer en la app. Best-effort (el caller no debe
 * romper el alta si el SMTP falla).
 */
export async function enviarInvitacionInquilino(opts: {
  email: string;
  inquilinoNombre?: string | null;
  inmobiliaria: InmobiliariaContacto;
  propiedadDireccion?: string | null;
  appUrl?: string;
}): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  const appUrl = opts.appUrl ?? APP_INQUILINO_URL;
  const inmoNombre = opts.inmobiliaria.nombre;
  const contactoTxt = [
    opts.inmobiliaria.telefono ? `Tel: ${opts.inmobiliaria.telefono}` : '',
    opts.inmobiliaria.email ? `Email: ${opts.inmobiliaria.email}` : '',
    opts.inmobiliaria.direccion ? `Dirección: ${opts.inmobiliaria.direccion}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  await t.sendMail({
    from,
    to: opts.email,
    subject: `${inmoNombre} te da la bienvenida a My Alquiler`,
    text: `${inmoNombre} está contenta de sumarte a My Alquiler, la app para pagar el alquiler, ver tu contrato y hacer reclamos.\nEntrás con tu email (${opts.email}) y un código que te mandamos. Sin contraseñas.\nEntrá acá: ${appUrl}\n${contactoTxt ? `\nTu inmobiliaria: ${inmoNombre} · ${contactoTxt}` : ''}`,
    html: invitacionHtml({
      inquilinoNombre: opts.inquilinoNombre,
      inmobiliaria: opts.inmobiliaria,
      propiedadDireccion: opts.propiedadDireccion,
      email: opts.email,
      appUrl,
    }),
  });
  return true;
}

/** URL del panel de la inmobiliaria (para el CTA del email de bienvenida). */
const APP_ADMIN_URL = (process.env.APP_ADMIN_URL ?? 'https://admin.myalquiler.com').replace(/\/$/, '');

/** Cuerpo del email de bienvenida que recibe la inmobiliaria al registrarse. */
function bienvenidaInmoHtml(opts: {
  adminNombre: string;
  inmobiliaria: string;
  email: string;
  panelUrl: string;
}): string {
  const inmo = esc(opts.inmobiliaria);
  const admin = esc(opts.adminNombre);
  const inner = `
    <h1 style="margin:0 0 10px;color:#1c1726;font-size:22px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;">¡Tu cuenta está lista, ${admin}! 🎉</h1>
    <p style="margin:0 0 18px;color:#6b6577;font-size:15px;line-height:1.65;">Creaste la cuenta de <strong style="color:#1c1726;">${inmo}</strong> en <strong style="color:#1c1726;">My Alquiler</strong>. Desde tu panel vas a gestionar contratos, cobros, reclamos y rendiciones — y tus inquilinos pagan y reclaman desde su propia app.</p>

    <!-- Botón -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;"><tr>
      <td align="center" bgcolor="#7c3aed" style="background-color:#7c3aed;border-radius:12px;">
        <a href="${opts.panelUrl}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">Entrar a mi panel &rarr;</a>
      </td>
    </tr></table>

    <!-- Primeros pasos -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
      <tr>
        <td bgcolor="#faf9fd" style="background-color:#faf9fd;border:1px solid #ece8f7;border-radius:10px;padding:14px 16px;">
          <p style="margin:0 0 8px;color:#1c1726;font-size:13px;font-weight:700;">Para arrancar:</p>
          <p style="margin:0 0 4px;color:#6b6577;font-size:13px;line-height:1.6;">1. Cargá tu primera propiedad y su contrato.</p>
          <p style="margin:0 0 4px;color:#6b6577;font-size:13px;line-height:1.6;">2. Invitá al inquilino — le llega su acceso por mail.</p>
          <p style="margin:0;color:#6b6577;font-size:13px;line-height:1.6;">3. Mirá tu tablero: cobros, mora y agenda del mes.</p>
        </td>
      </tr>
    </table>

    <!-- Cómo entra -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px;">
      <tr>
        <td bgcolor="#f6f4fe" style="background-color:#f6f4fe;border:1px solid #e4dcfb;border-radius:10px;padding:12px 16px;">
          <p style="margin:0;color:#6b6577;font-size:13px;line-height:1.5;">
            Entrás con tu email (<strong style="color:#1c1726;">${esc(opts.email)}</strong>) y un código de 6 dígitos que te mandamos. <strong style="color:#1c1726;">Sin contraseñas.</strong> Es gratis hasta el lanzamiento.
          </p>
        </td>
      </tr>
    </table>`;

  return shell({
    preview: `Tu cuenta de ${opts.inmobiliaria} en My Alquiler está lista — entrá a tu panel`,
    inner,
  });
}

/**
 * Email de bienvenida a la inmobiliaria recién registrada: confirma el alta,
 * da los primeros pasos y el link al panel. Best-effort (el caller no debe
 * romper el alta si el SMTP falla).
 */
export async function enviarBienvenidaInmobiliaria(
  email: string,
  adminNombre: string,
  inmobiliariaNombre: string,
  panelUrl: string = APP_ADMIN_URL,
): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  await t.sendMail({
    from,
    to: email,
    subject: `Tu cuenta de ${inmobiliariaNombre} en My Alquiler está lista`,
    text: `¡Hola ${adminNombre}! Creaste la cuenta de ${inmobiliariaNombre} en My Alquiler.\nEntrá a tu panel: ${panelUrl}\nIngresás con tu email (${email}) y un código que te mandamos. Sin contraseñas. Gratis hasta el lanzamiento.`,
    html: bienvenidaInmoHtml({ adminNombre, inmobiliaria: inmobiliariaNombre, email, panelUrl }),
  });
  return true;
}

const ROL_LABEL_EQUIPO: Record<string, string> = {
  ADMIN: 'Administrador',
  OPERADOR: 'Operador',
  CARGA: 'Carga',
  LECTURA: 'Solo lectura',
};

/**
 * Aviso a un miembro que fue sumado al equipo de una inmobiliaria. Entra con su
 * email por OTP (código al mail) — sin contraseña. Best-effort.
 */
export async function enviarInvitacionEquipo(opts: {
  email: string;
  nombre: string;
  rol: string;
  inmobiliariaNombre: string;
  panelUrl?: string;
}): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  const panelUrl = opts.panelUrl ?? APP_ADMIN_URL;
  const rolTxt = ROL_LABEL_EQUIPO[opts.rol] ?? opts.rol;
  await t.sendMail({
    from,
    to: opts.email,
    subject: `Te sumaron al equipo de ${opts.inmobiliariaNombre} en My Alquiler`,
    text: `¡Hola ${opts.nombre}! ${opts.inmobiliariaNombre} te sumó a su equipo en My Alquiler con el rol de ${rolTxt}.\nEntrá al panel: ${panelUrl}\nIngresás con tu email (${opts.email}) — te mandamos un código por mail para entrar. No hace falta contraseña.`,
    html: `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
      <h2 style="font-size:18px">Te sumaron al equipo 🎉</h2>
      <p><strong>${opts.inmobiliariaNombre}</strong> te dio acceso a su panel de My Alquiler con el rol de <strong>${rolTxt}</strong>.</p>
      <p style="margin:20px 0">
        <a href="${panelUrl}" style="background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Entrar al panel</a>
      </p>
      <p style="font-size:13px;color:#475569">Ingresás con tu email (<strong>${opts.email}</strong>). Te mandamos un código de 6 dígitos por mail para entrar — sin contraseñas.</p>
    </div>`,
  });
  return true;
}

// ─── Anuncios (canal EMAIL) ───────────────────────────────────────────────────

/** Chip de prioridad para el email del anuncio (solo IMPORTANTE/URGENTE). */
const PRIORIDAD_CHIP: Record<string, string> = {
  IMPORTANTE:
    '<span style="display:inline-block;background:#fef3c7;color:#92400e;border:1px solid #fde68a;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;letter-spacing:0.4px;">IMPORTANTE</span>',
  URGENTE:
    '<span style="display:inline-block;background:#fee2e2;color:#991b1b;border:1px solid #fecaca;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;letter-spacing:0.4px;">URGENTE</span>',
};

function anuncioHtml(opts: {
  titulo: string;
  cuerpo: string;
  prioridad: string;
  inmobiliariaNombre: string;
  ctaUrl: string | null;
}): string {
  const chip = PRIORIDAD_CHIP[opts.prioridad] ?? '';
  // El cuerpo del anuncio conserva los saltos de línea del panel.
  const cuerpoHtml = esc(opts.cuerpo).replace(/\n/g, '<br>');
  const inner = `
    ${chip ? `<div style="margin:0 0 10px;">${chip}</div>` : ''}
    <h1 style="margin:0 0 6px;color:#1c1726;font-size:21px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;">${esc(opts.titulo)}</h1>
    <p style="margin:0 0 18px;color:#8a85a0;font-size:12px;">Aviso de <strong style="color:#5b556e;">${esc(opts.inmobiliariaNombre)}</strong></p>
    <p style="margin:0 0 22px;color:#3f3a4d;font-size:15px;line-height:1.7;">${cuerpoHtml}</p>
    ${
      opts.ctaUrl
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px;"><tr>
      <td align="center" bgcolor="#7c3aed" style="background-color:#7c3aed;border-radius:12px;">
        <a href="${opts.ctaUrl}" target="_blank" style="display:inline-block;padding:12px 26px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:800;color:#ffffff;text-decoration:none;">Ver en la app &rarr;</a>
      </td>
    </tr></table>`
        : ''
    }
    <p style="margin:16px 0 0;color:#8a85a0;font-size:11px;line-height:1.6;">Recibís este aviso porque ${esc(opts.inmobiliariaNombre)} gestiona tu alquiler/propiedad con My Alquiler.</p>`;
  return shell({ preview: `${opts.inmobiliariaNombre}: ${opts.titulo}`, inner });
}

/**
 * Email de un ANUNCIO del panel a UN destinatario. El canal EMAIL de los
 * anuncios existía como decisión de producto (canales ['APP','EMAIL']) pero
 * nunca se enviaba nada — este export lo hace real. Un destinatario por email
 * (nunca listas/BCC), pensado para mandarse en loop secuencial con throttle
 * (deliverability: parecer humano, no ráfaga). Best-effort: el caller loguea.
 */
export async function enviarAnuncioEmail(opts: {
  email: string;
  titulo: string;
  cuerpo: string;
  prioridad: string;
  inmobiliariaNombre: string;
  /** true → CTA a la app del inquilino; false (propietarios) → sin CTA. */
  paraInquilino: boolean;
}): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  const urgente = opts.prioridad === 'URGENTE';
  await t.sendMail({
    from,
    to: opts.email,
    subject: `${urgente ? 'URGENTE — ' : ''}${opts.titulo} · ${opts.inmobiliariaNombre}`,
    text: `${opts.titulo}\n\nAviso de ${opts.inmobiliariaNombre}:\n\n${opts.cuerpo}\n\n${opts.paraInquilino ? `Velo en la app: ${APP_INQUILINO_URL}\n\n` : ''}Recibís este aviso porque ${opts.inmobiliariaNombre} gestiona tu alquiler/propiedad con My Alquiler.`,
    html: anuncioHtml({
      titulo: opts.titulo,
      cuerpo: opts.cuerpo,
      prioridad: opts.prioridad,
      inmobiliariaNombre: opts.inmobiliariaNombre,
      // Los anuncios viven en el home de la PWA (no hay ruta /anuncios).
      ctaUrl: opts.paraInquilino ? APP_INQUILINO_URL : null,
    }),
  });
  return true;
}
