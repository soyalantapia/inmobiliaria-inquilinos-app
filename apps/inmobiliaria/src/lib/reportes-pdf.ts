// Generación de PDFs imprimibles desde el browser usando una ventana popup
// con HTML estilado para impresión. No usamos jsPDF para mantener el bundle
// chico — para reportes simples (tablas + textos), window.print() funciona
// perfecto: el operador imprime directo o "guarda como PDF" desde el diálogo
// nativo del sistema operativo.

import { leerCuponActivo } from './cupones';

interface ColumnaTabla {
  header: string;
  /** Width hint en % para el ancho de la columna */
  width?: string;
  align?: 'left' | 'right' | 'center';
}

/**
 * Sección agrupada del reporte: se renderiza con un subtítulo + su propia
 * tabla. Sirve para reportes "por sociedad" o "por propietario" donde
 * conviene visualmente separar los grupos en lugar de una tabla flat.
 */
export interface SeccionReporte {
  titulo: string;
  subtitulo?: string;
  filas: (string | number)[][];
  subtotal?: { label: string; valor: string };
}

export interface ReportePrintable {
  titulo: string;
  subtitulo?: string;
  inmobiliaria: string;
  fechaGeneracion?: string;
  columnas: ColumnaTabla[];
  /**
   * Una de las dos formas:
   * - `filas`: tabla flat (uso clásico).
   * - `secciones`: múltiples grupos con subtítulo y subtotal. Si `secciones`
   *   está presente, se ignora `filas`.
   */
  filas?: (string | number)[][];
  secciones?: SeccionReporte[];
  totales?: { label: string; valor: string }[];
  notaFinal?: string;
}

/** Estilos comunes (impresión + pantalla previa). */
const ESTILOS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;
         color: #111; line-height: 1.4; padding: 32px; font-size: 12px; }
  .header { display: flex; align-items: start; justify-content: space-between;
            border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 22px; font-weight: 700; }
  .header .subtitle { color: #555; font-size: 13px; margin-top: 4px; }
  .header .meta { text-align: right; font-size: 11px; color: #555; }
  .header .inmo { font-weight: 600; color: #111; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .seccion { margin-bottom: 32px; page-break-inside: avoid; }
  .seccion h2 { font-size: 14px; font-weight: 700; margin-bottom: 2px;
                color: #111; border-left: 4px solid #111; padding-left: 8px; }
  .seccion .subt { font-size: 11px; color: #666; margin-bottom: 8px;
                   padding-left: 12px; }
  .subtotal { font-size: 11px; text-align: right; font-weight: 600;
              border-top: 1px solid #111; padding-top: 6px; margin-top: 4px;
              font-variant-numeric: tabular-nums; }
  .subtotal .label { color: #555; font-weight: 400; margin-right: 8px;
                     text-transform: uppercase; font-size: 10px;
                     letter-spacing: 0.04em; }
  thead { background: #f4f4f5; }
  th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e4e4e7;
           font-size: 11px; vertical-align: top; }
  th { font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
       color: #555; font-size: 10px; }
  td.right, th.right { text-align: right; font-variant-numeric: tabular-nums; }
  td.center, th.center { text-align: center; }
  td.monto { font-weight: 600; }
  .totales { margin-top: 16px; border-top: 2px solid #111; padding-top: 12px;
             display: flex; justify-content: flex-end; gap: 24px; }
  .totales .item { text-align: right; }
  .totales .item .label { font-size: 10px; text-transform: uppercase; color: #555;
                          letter-spacing: 0.04em; }
  .totales .item .valor { font-size: 16px; font-weight: 700; margin-top: 2px;
                          font-variant-numeric: tabular-nums; }
  .nota { margin-top: 32px; padding: 12px; background: #fafafa; border-left: 3px solid #999;
          font-size: 11px; color: #555; }
  .footer { margin-top: 48px; text-align: center; font-size: 10px; color: #999;
            border-top: 1px solid #e4e4e7; padding-top: 12px; }
  .footer .convenio { display: inline-flex; align-items: center; gap: 6px;
                      padding: 4px 10px; border-radius: 12px;
                      background: #ecfdf5; color: #047857;
                      font-weight: 600; font-size: 10px;
                      margin-top: 6px; }
  .preview-bar { position: fixed; top: 0; left: 0; right: 0; background: #18181b;
                 color: white; padding: 12px 20px; display: flex; justify-content: space-between;
                 align-items: center; z-index: 100; }
  .preview-bar button { background: white; color: #18181b; border: none; padding: 8px 16px;
                        border-radius: 6px; font-weight: 600; cursor: pointer; }
  .preview-bar .left { font-size: 13px; }
  .with-bar { padding-top: 80px; }
  @media print {
    body { padding: 12mm; }
    .preview-bar { display: none; }
    .with-bar { padding-top: 0; }
  }
`;

export function abrirReporteImprimible(reporte: ReportePrintable): void {
  if (typeof window === 'undefined') return;
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) {
    alert('Tu navegador bloqueó el popup. Habilitalo para generar el PDF.');
    return;
  }
  const fecha =
    reporte.fechaGeneracion ?? new Date().toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const headerHtml = `
    <div class="header">
      <div>
        <h1>${escapar(reporte.titulo)}</h1>
        ${reporte.subtitulo ? `<div class="subtitle">${escapar(reporte.subtitulo)}</div>` : ''}
      </div>
      <div class="meta">
        <div class="inmo">${escapar(reporte.inmobiliaria)}</div>
        <div>Generado el ${escapar(fecha)}</div>
      </div>
    </div>`;

  const colsHtml = reporte.columnas
    .map(
      (c) =>
        `<th class="${c.align === 'right' ? 'right' : c.align === 'center' ? 'center' : ''}" ${c.width ? `style="width:${c.width}"` : ''}>${escapar(c.header)}</th>`,
    )
    .join('');

  const renderFilas = (filas: (string | number)[][]) =>
    filas
      .map(
        (fila) =>
          '<tr>' +
          fila
            .map((celda, i) => {
              const col = reporte.columnas[i];
              const cls =
                col?.align === 'right' ? 'right monto' : col?.align === 'center' ? 'center' : '';
              return `<td class="${cls}">${escapar(String(celda))}</td>`;
            })
            .join('') +
          '</tr>',
      )
      .join('');

  const rowsHtml = reporte.filas ? renderFilas(reporte.filas) : '';

  const seccionesHtml = reporte.secciones
    ? reporte.secciones
        .map(
          (s) => `
            <div class="seccion">
              <h2>${escapar(s.titulo)}</h2>
              ${s.subtitulo ? `<div class="subt">${escapar(s.subtitulo)}</div>` : ''}
              <table>
                <thead><tr>${colsHtml}</tr></thead>
                <tbody>${renderFilas(s.filas)}</tbody>
              </table>
              ${
                s.subtotal
                  ? `<div class="subtotal"><span class="label">${escapar(s.subtotal.label)}</span>${escapar(s.subtotal.valor)}</div>`
                  : ''
              }
            </div>`,
        )
        .join('')
    : '';

  const totalesHtml = reporte.totales
    ? `<div class="totales">${reporte.totales
        .map(
          (t) =>
            `<div class="item"><div class="label">${escapar(t.label)}</div><div class="valor">${escapar(t.valor)}</div></div>`,
        )
        .join('')}</div>`
    : '';

  const notaHtml = reporte.notaFinal ? `<div class="nota">${escapar(reporte.notaFinal)}</div>` : '';

  win.document.write(`<!doctype html><html lang="es-AR"><head><meta charset="utf-8"/>
    <title>${escapar(reporte.titulo)}</title>
    <style>${ESTILOS}</style></head><body class="with-bar">
    <div class="preview-bar">
      <div class="left">Vista previa · Listo para imprimir o guardar como PDF</div>
      <button onclick="window.print()">Imprimir / Guardar PDF</button>
    </div>
    ${headerHtml}
    ${
      reporte.secciones && reporte.secciones.length > 0
        ? seccionesHtml
        : `<table>
            <thead><tr>${colsHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>`
    }
    ${totalesHtml}
    ${notaHtml}
    <div class="footer">
      My Alquiler · Generado automáticamente · ${escapar(reporte.inmobiliaria)}
      ${cuponActivoHtml()}
    </div>
    </body></html>`);
  win.document.close();
}

/**
 * Si la inmobiliaria tiene un convenio activo (CUCICBA, CPI, Edifica,
 * etc.), se muestra un chip verde en el footer del PDF como sello.
 * Genera sensación de pertenencia hacia el propietario / inquilino que
 * recibe el documento — refuerza el partnership.
 */
function cuponActivoHtml(): string {
  const activo = leerCuponActivo();
  if (!activo) return '';
  return `<br/><span class="convenio">✓ Cliente ${escapar(activo.cupon.convenio)}</span>`;
}

function escapar(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
