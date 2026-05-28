'use client';

import { Download } from 'lucide-react';
import { Button, type ButtonProps } from '@llave/ui/button';
import type { Contrato } from '@/lib/types';
import { formatFecha, formatMonto } from '@/lib/format';

interface Props {
  contrato: Contrato;
  inquilinoNombre: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
}

const ESTILOS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', serif; color: #111; line-height: 1.6;
         padding: 32px 56px; font-size: 13px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 18px; font-weight: 700; text-align: center; margin-bottom: 24px;
       text-transform: uppercase; letter-spacing: 0.04em; }
  h2 { font-size: 13px; font-weight: 700; margin-top: 24px; margin-bottom: 8px;
       text-transform: uppercase; letter-spacing: 0.03em; }
  p { margin-bottom: 12px; text-align: justify; }
  .dato { display: flex; gap: 8px; margin-bottom: 4px; font-size: 12px; }
  .dato strong { min-width: 140px; color: #555; font-weight: 600; }
  .firma { margin-top: 64px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  .firma .box { border-top: 1px solid #111; padding-top: 8px; text-align: center;
                font-size: 11px; }
  .nota { margin-top: 24px; padding: 12px; background: #fafafa; border-left: 3px solid #999;
          font-size: 11px; color: #555; }
  .preview-bar { position: fixed; top: 0; left: 0; right: 0; background: #18181b;
                 color: white; padding: 12px 20px; display: flex; justify-content: space-between;
                 align-items: center; z-index: 100; }
  .preview-bar button { background: white; color: #18181b; border: none; padding: 8px 16px;
                        border-radius: 6px; font-weight: 600; cursor: pointer;
                        font-family: -apple-system, sans-serif; }
  .with-bar { padding-top: 80px; }
  @media print {
    .preview-bar { display: none; }
    .with-bar { padding-top: 12mm; }
    body { padding: 12mm 18mm; }
  }
`;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Trigger que abre una copia imprimible del contrato firmado en un
 * popup. El usuario imprime / guarda como PDF desde el diálogo nativo.
 * Es una representación simplificada legal (no reemplaza al contrato
 * original ICL), pero sirve como copia de referencia.
 */
export function DescargarContratoTrigger({
  contrato,
  inquilinoNombre,
  variant = 'outline',
  size = 'sm',
  className,
}: Props) {
  const handleClick = () => {
    if (typeof window === 'undefined') return;
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) {
      alert('Tu navegador bloqueó el popup. Habilitalo para descargar el PDF.');
      return;
    }
    const html = `<!doctype html>
<html lang="es-AR">
  <head>
    <meta charset="utf-8" />
    <title>Contrato de locación — ${escapeHtml(inquilinoNombre)}</title>
    <style>${ESTILOS}</style>
  </head>
  <body class="with-bar">
    <div class="preview-bar">
      <span>Copia del contrato lista · presioná Imprimir para guardarlo como PDF</span>
      <button type="button" onclick="window.print()">Imprimir / Guardar PDF</button>
    </div>

    <h1>Contrato de locación</h1>

    <h2>Datos del inmueble</h2>
    <p class="dato"><strong>Dirección:</strong> ${escapeHtml(contrato.direccion)}</p>
    <p class="dato"><strong>Ciudad:</strong> ${escapeHtml(contrato.ciudad)}</p>
    <p class="dato"><strong>Administra:</strong> ${escapeHtml(contrato.inmobiliaria)}</p>

    <h2>Partes</h2>
    <p class="dato"><strong>Inquilino (locatario):</strong> ${escapeHtml(inquilinoNombre)}</p>
    <p class="dato"><strong>Administradora:</strong> ${escapeHtml(contrato.inmobiliaria)}</p>

    <h2>Condiciones económicas</h2>
    <p class="dato"><strong>Alquiler mensual:</strong> ${escapeHtml(formatMonto(contrato.montoActual, contrato.moneda))}</p>
    <p class="dato"><strong>Día de pago:</strong> ${contrato.diaPago} de cada mes</p>
    <p class="dato"><strong>Índice de ajuste:</strong> ${escapeHtml(contrato.indiceAjuste)}</p>
    <p class="dato"><strong>Próximo ajuste:</strong> ${escapeHtml(formatFecha(contrato.proximoAjuste))}</p>

    <h2>Vigencia</h2>
    <p class="dato"><strong>Fecha de inicio:</strong> ${escapeHtml(formatFecha(contrato.fechaInicio))}</p>
    <p class="dato"><strong>Fecha de fin:</strong> ${escapeHtml(formatFecha(contrato.fechaFin))}</p>

    <h2>Cláusulas generales</h2>
    <p>
      El locatario se compromete a abonar mensualmente el monto pactado dentro de los 5 días corridos
      del vencimiento. La administradora emite recibo digital al confirmar cada pago.
    </p>
    <p>
      El monto se ajusta cada 12 meses según el índice ICL publicado por el BCRA. La administradora
      notifica al locatario el nuevo monto con 15 días de anticipación a su entrada en vigencia.
    </p>
    <p>
      Las obligaciones de mantenimiento, garantías, depósito, expensas y demás términos accesorios se
      rigen por el documento original firmado entre las partes.
    </p>

    <div class="nota">
      Esta es una <strong>copia de referencia digital</strong>. El contrato vinculante es el firmado
      originalmente por las partes y conservado por la administradora.
    </div>

    <div class="firma">
      <div class="box">Locatario</div>
      <div class="box">Administradora</div>
    </div>
  </body>
</html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={handleClick}>
      <Download className="h-4 w-4" />
      PDF
    </Button>
  );
}
