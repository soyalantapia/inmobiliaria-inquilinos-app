'use client';

/**
 * Genera un COMPROBANTE INFORMATIVO imprimible (HTML → PDF via window.print) para
 * que el inquilino tenga un respaldo propio del pago al instante. Funciona offline,
 * sin backend ni librerías de PDF — solo es un popup con CSS de print.
 *
 * NO es un recibo oficial, y el documento tiene que decirlo. Lo arma el browser del
 * inquilino con los datos de su app: la inmobiliaria no lo emite, no lo firma y ni se
 * entera. Antes el pie declaraba "Recibo emitido digitalmente por la inmobiliaria.
 * Tiene validez legal como prueba de pago" — un documento que nadie emitió, atribuido
 * a un tercero, que el inquilino podía llevar a un reclamo creyendo que lo respaldaba.
 */

import type { PagoDeLiquidacion } from '@/lib/types';

export interface ReciboInput {
  /** Periodo cobrado, ej. "2026-05" */
  periodo: string;
  periodoFmt: string; // "Mayo 2026"
  inquilino: string;
  direccion: string;
  monto: number;
  montoFmt: string; // "$ 480.000"
  /**
   * Método REAL del cobro, ya en texto legible ("Transferencia", "Efectivo").
   * Opcional a propósito: el llamador lo tenía HARDCODEADO en "Transferencia", así que un
   * cobro en efectivo o por cheque salía impreso como una transferencia bancaria que nunca
   * existió. Si no se puede saber el método (demo offline, o parciales con métodos
   * distintos), se omite la fila en vez de afirmar uno.
   */
  metodo?: string;
  fechaPago: string; // ISO
  fechaPagoFmt: string; // "11 may 2026"
  /** Razón social de la inmobiliaria — head del comprobante. */
  inmobiliaria: string;
  /** Referencia interna del comprobante. NO es numeración oficial de recibo. */
  numero?: string;
}

const ESTILOS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;
         color: #111; line-height: 1.5; padding: 32px; font-size: 13px; }
  .recibo { max-width: 560px; margin: 0 auto; border: 1px solid #d4d4d8;
            border-radius: 8px; padding: 32px; background: white; }
  .head { display: flex; justify-content: space-between; align-items: start;
          border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 24px; }
  .head .logo { font-size: 22px; font-weight: 700; color: #111; }
  .head .sub { font-size: 12px; color: #555; margin-top: 4px; }
  .head .numero { text-align: right; font-size: 11px; color: #555; }
  .head .numero strong { display: block; font-size: 16px; color: #111; margin-top: 4px;
                         font-variant-numeric: tabular-nums; }
  h2 { font-size: 11px; text-transform: uppercase; color: #555; letter-spacing: 0.06em;
       margin-top: 24px; margin-bottom: 8px; font-weight: 600; }
  .row { display: flex; justify-content: space-between; padding: 8px 0;
         border-bottom: 1px solid #f4f4f5; font-size: 13px; }
  .row .label { color: #555; }
  .row .value { font-weight: 500; color: #111; text-align: right; }
  .total { margin-top: 32px; padding-top: 20px; border-top: 2px solid #111;
           display: flex; justify-content: space-between; align-items: baseline; }
  .total .label { font-size: 11px; text-transform: uppercase; color: #555;
                  letter-spacing: 0.06em; font-weight: 600; }
  .total .value { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .nota { margin-top: 24px; padding: 12px; background: #f4f4f5; font-size: 11px;
          color: #555; border-left: 3px solid #999; }
  .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #999; }
  .preview-bar { position: fixed; top: 0; left: 0; right: 0; background: #18181b;
                 color: white; padding: 12px 20px; display: flex; justify-content: space-between;
                 align-items: center; z-index: 100; }
  .preview-bar button { background: white; color: #18181b; border: none; padding: 8px 16px;
                        border-radius: 6px; font-weight: 600; cursor: pointer; }
  .with-bar { padding-top: 80px; }
  @media print {
    .preview-bar { display: none; }
    .with-bar { padding-top: 12mm; }
    body { padding: 0; }
    .recibo { border: none; padding: 12mm; }
  }
`;

export function abrirReciboImprimible(recibo: ReciboInput): void {
  if (typeof window === 'undefined') return;
  const win = window.open('', '_blank', 'width=700,height=900');
  if (!win) {
    alert('Tu navegador bloqueó el popup. Habilitalo para descargar el recibo.');
    return;
  }
  // Referencia derivada del período y la fecha del pago: estable siempre que haya fecha de
  // pago real (si el llamador cae al `new Date()` de respaldo, cambia por día). Antes salía de
  // Math.random(): reimprimir el MISMO pago daba un número distinto cada vez, así que no
  // identificaba nada — y con el prefijo "R-" parecía la numeración oficial de un recibo
  // emitido por la inmobiliaria, que es justo lo que este documento no es.
  const numero =
    recibo.numero ??
    `${recibo.periodo.replace('-', '')}-${recibo.fechaPago.slice(0, 10).replace(/-/g, '')}`;
  const html = `<!doctype html>
<html lang="es-AR">
  <head>
    <meta charset="utf-8" />
    <title>Comprobante ${recibo.periodoFmt} — ${recibo.inquilino}</title>
    <style>${ESTILOS}</style>
  </head>
  <body class="with-bar">
    <div class="preview-bar">
      <span>Comprobante listo · presioná Imprimir para guardarlo como PDF</span>
      <button onclick="window.print()">Imprimir / Guardar PDF</button>
    </div>
    <div class="recibo">
      <div class="head">
        <div>
          <p class="logo">${escapeHtml(recibo.inmobiliaria)}</p>
          <p class="sub">Comprobante informativo generado por el inquilino</p>
        </div>
        <div class="numero">
          <span>Referencia</span>
          <strong>${escapeHtml(numero)}</strong>
        </div>
      </div>

      <h2>Datos del pago</h2>
      <div class="row"><span class="label">Inquilino</span><span class="value">${escapeHtml(recibo.inquilino)}</span></div>
      <div class="row"><span class="label">Propiedad</span><span class="value">${escapeHtml(recibo.direccion)}</span></div>
      <div class="row"><span class="label">Período</span><span class="value">${escapeHtml(recibo.periodoFmt)}</span></div>
      <div class="row"><span class="label">Fecha de pago</span><span class="value">${escapeHtml(recibo.fechaPagoFmt)}</span></div>
      ${recibo.metodo ? `<div class="row"><span class="label">Método</span><span class="value">${escapeHtml(recibo.metodo)}</span></div>` : ''}

      <div class="total">
        <span class="label">Total cobrado</span>
        <span class="value">${escapeHtml(recibo.montoFmt)}</span>
      </div>

      <div class="nota">
        <strong>Este no es un recibo oficial.</strong> Lo generaste vos desde My Alquiler con los
        datos registrados en tu cuenta: ${escapeHtml(recibo.inmobiliaria || 'la inmobiliaria')} no lo emitió ni lo
        firmó. Te sirve como respaldo propio de lo que figura pagado en la app. El comprobante
        de la transferencia sigue siendo el que prueba el pago: guardalo. Si necesitás un recibo
        oficial, pedíselo a la inmobiliaria.
      </div>

      <div class="footer">
        Generado el ${new Date().toLocaleDateString('es-AR')} desde My Alquiler, a pedido del
        inquilino. Documento informativo, sin valor de recibo.
      </div>
    </div>
  </body>
</html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Etiquetas legibles de los métodos que maneja el API. */
const METODO_LABEL: Record<PagoDeLiquidacion['metodo'], string> = {
  TRANSFERENCIA: 'Transferencia',
  MERCADOPAGO: 'Mercado Pago',
  EFECTIVO: 'Efectivo',
  CHEQUE: 'Cheque',
};

/**
 * Método REAL del cobro para imprimir en el comprobante. La pantalla de detalle le pasaba
 * "Transferencia" HARDCODEADO: un cobro en efectivo o por cheque que registró la
 * inmobiliaria salía impreso como una transferencia bancaria que nunca existió.
 *
 * Devuelve undefined —y entonces el comprobante NO imprime la fila— cuando no hay UN método
 * único que afirmar: en la demo offline `liq.pagos` no existe, y en prod un período cubierto
 * con parciales de distinto método (mitad efectivo, mitad transferencia) no tiene uno solo.
 * Omitir la fila es preferible a elegir un método por sobre el otro.
 */
export function metodoParaRecibo(pagos: PagoDeLiquidacion[] | undefined): string | undefined {
  // Los RECHAZADOS quedan afuera: esa plata no entró, su método no describe el cobro.
  const metodos = (pagos ?? []).filter((p) => p.estado !== 'RECHAZADO').map((p) => p.metodo);
  const primero = metodos[0];
  if (!primero) return undefined;
  if (metodos.some((m) => m !== primero)) return undefined;
  return METODO_LABEL[primero];
}
