'use client';

import type { CertificadoInquilino } from '@/lib/certificado-inquilino';
import { NIVEL_LABEL } from '@/lib/certificado-inquilino';
import { formatFecha, formatMonto } from '@/lib/format';

/**
 * Abre una ventana imprimible (PDF nativo del navegador) con el
 * certificado formateado a una sola página A4. El destinatario es
 * la inmobiliaria nueva que va a recibir el papel — el formato debe
 * ser legal, sobrio, con marca My Alquiler y el código de verificación
 * grande para que sea fácil tipear en otra computadora.
 */
export function imprimirCertificado(c: CertificadoInquilino): void {
  if (typeof window === 'undefined') return;
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) {
    alert('Tu navegador bloqueó el popup. Habilitalo para generar el PDF.');
    return;
  }
  const escapar = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const nivelBg = {
    EXCELENTE: '#10b981',
    BUENO: '#3b82f6',
    REGULAR: '#f59e0b',
    NUEVO: '#9ca3af',
  }[c.nivel];

  const html = `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8"/>
<title>Certificado de inquilino · ${escapar(c.inquilino.nombre)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;
    color: #111;
    padding: 32px;
    font-size: 13px;
    line-height: 1.45;
  }
  .preview-bar {
    position: fixed; top: 0; left: 0; right: 0;
    background: #18181b; color: white;
    padding: 12px 20px;
    display: flex; justify-content: space-between; align-items: center;
    z-index: 100;
  }
  .preview-bar button {
    background: white; color: #18181b; border: none;
    padding: 8px 16px; border-radius: 6px;
    font-weight: 600; cursor: pointer;
  }
  .with-bar { padding-top: 80px; }

  .header {
    display: flex; align-items: flex-start; justify-content: space-between;
    border-bottom: 2px solid #111;
    padding-bottom: 16px; margin-bottom: 24px;
  }
  .header h1 { font-size: 24px; font-weight: 700; }
  .header .meta { text-align: right; font-size: 11px; color: #555; }
  .header .brand { font-weight: 700; }

  .nivel-card {
    background: ${nivelBg};
    color: white;
    padding: 20px 24px;
    border-radius: 12px;
    margin-bottom: 24px;
    display: flex; align-items: center; gap: 16px;
  }
  .nivel-card .icon {
    width: 48px; height: 48px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    display: grid; place-items: center;
    font-size: 26px;
  }
  .nivel-card .nivel-titulo { font-size: 22px; font-weight: 700; line-height: 1.1; }
  .nivel-card .nivel-detalle { font-size: 12px; opacity: 0.95; margin-top: 4px; }

  .section { margin-bottom: 20px; }
  .section h2 {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: #555;
    border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px;
  }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .row { display: flex; justify-content: space-between; padding: 3px 0; }
  .row .label { color: #555; }
  .row .value { font-weight: 600; }

  .stat {
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    padding: 12px;
    text-align: center;
  }
  .stat .num { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .stat .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; margin-top: 2px; }

  .verificacion {
    border: 2px solid #111;
    border-radius: 12px;
    padding: 16px 20px;
    background: #fafafa;
    margin-top: 24px;
  }
  .verificacion .codigo {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 26px; font-weight: 700;
    letter-spacing: 0.08em;
    margin: 4px 0;
  }
  .verificacion .url { font-family: ui-monospace, monospace; font-size: 11px; color: #555; word-break: break-all; }

  .footer {
    margin-top: 32px; padding-top: 16px;
    border-top: 1px solid #e4e4e7;
    font-size: 10px; color: #888; text-align: center;
  }

  @media print {
    body { padding: 12mm; }
    .preview-bar { display: none; }
    .with-bar { padding-top: 0; }
  }
</style>
</head>
<body class="with-bar">
  <div class="preview-bar">
    <div style="font-size: 13px">Vista previa · Listo para imprimir o guardar como PDF</div>
    <button type="button" onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>

  <div class="header">
    <div>
      <h1>Certificado de inquilino</h1>
      <div style="font-size: 13px; color: #555; margin-top: 4px">
        Historial de pagos verificable · sirve como reemplazo del garante
      </div>
    </div>
    <div class="meta">
      <div class="brand">My Alquiler</div>
      <div>Generado el ${escapar(formatFecha(c.generadoAt))}</div>
      <div>Válido hasta ${escapar(formatFecha(c.validoHasta))}</div>
    </div>
  </div>

  <div class="nivel-card">
    <div class="icon">✓</div>
    <div>
      <div style="font-size: 10px; text-transform: uppercase; opacity: 0.85; letter-spacing: 0.06em">
        Nivel del historial
      </div>
      <div class="nivel-titulo">${escapar(NIVEL_LABEL[c.nivel])}</div>
      <div class="nivel-detalle">${escapar(c.nivelDetalle)}</div>
    </div>
  </div>

  <div class="section">
    <h2>Datos del inquilino</h2>
    <div class="grid-2">
      <div class="row"><span class="label">Nombre</span><span class="value">${escapar(c.inquilino.nombre)}</span></div>
      <div class="row"><span class="label">DNI</span><span class="value">${escapar(c.inquilino.dni)}</span></div>
      <div class="row"><span class="label">Email</span><span class="value">${escapar(c.inquilino.email)}</span></div>
      <div class="row"><span class="label">Teléfono</span><span class="value">${escapar(c.inquilino.telefono)}</span></div>
    </div>
  </div>

  <div class="section">
    <h2>Contrato vigente</h2>
    <div class="grid-2">
      <div class="row"><span class="label">Propiedad</span><span class="value">${escapar(c.contratoActual.direccion)}</span></div>
      <div class="row"><span class="label">Administrada por</span><span class="value">${escapar(c.contratoActual.inmobiliaria)}</span></div>
      <div class="row"><span class="label">Vive desde</span><span class="value">${escapar(formatFecha(c.contratoActual.fechaInicio))}</span></div>
      <div class="row"><span class="label">Meses cumplidos</span><span class="value">${c.contratoActual.mesesCumplidos}</span></div>
      <div class="row"><span class="label">Alquiler mensual</span><span class="value">${escapar(formatMonto(c.contratoActual.montoMensual, c.contratoActual.moneda))}</span></div>
    </div>
  </div>

  <div class="section">
    <h2>Historial de pagos</h2>
    <div class="grid-3">
      <div class="stat">
        <div class="num">${c.historial.cuotasAlDia}<span style="font-size: 14px; color: #888">/${c.historial.cuotasTotales}</span></div>
        <div class="lbl">Cuotas al día</div>
      </div>
      <div class="stat">
        <div class="num">${c.historial.atrasoPromedioDias}<span style="font-size: 14px; color: #888"> días</span></div>
        <div class="lbl">Atraso promedio</div>
      </div>
      <div class="stat">
        <div class="num">${c.historial.pagosRechazados}</div>
        <div class="lbl">Pagos rechazados</div>
      </div>
    </div>
    <div style="margin-top: 10px; font-size: 11px; color: #555">
      Adicional: rating promedio que dio a profesionales de mantenimiento ${c.historial.ratingPromedio}/5 ★
      — proxy de "cuida la propiedad".
    </div>
  </div>

  <div class="verificacion">
    <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #555">
      Código de verificación
    </div>
    <div class="codigo">${escapar(c.hash)}</div>
    <div class="url">${escapar(c.urlVerificacion)}</div>
    <div style="margin-top: 8px; font-size: 11px; color: #555">
      Cualquier inmobiliaria puede entrar a la URL o ingresar el código en
      myalquiler.com.ar/verificar para validar este certificado.
    </div>
  </div>

  <div class="footer">
    Emitido por My Alquiler · Información verificable contra nuestro
    datawarehouse. Este certificado no contiene datos sensibles del inquilino
    (CBU, comprobantes individuales) — sólo el resumen agregado de su
    historial. Si encontrás una inconsistencia, contactanos.
  </div>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}
