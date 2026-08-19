'use client';

import { Printer } from 'lucide-react';
import { Button } from '@llave/ui/button';
import type { RendicionDetalle } from '@/lib/api';

/**
 * Abre una versión imprimible de UNA rendición, para que el propietario se la lleve.
 *
 * POR QUÉ EXISTE: el dueño mira la rendición en el celular, pero cuando la necesita de verdad
 * —para el contador, para su carpeta, para discutir un gasto— no tenía forma de sacarla de la
 * app. Ni imprimir, ni PDF, ni copiar: la única salida era pedírsela a la inmobiliaria, que es
 * justo la llamada que el portal viene a evitar.
 *
 * MISMO PATRÓN QUE YA USA LA PWA (`descargar-contrato-trigger.tsx`, `certificado/imprimible`):
 * popup + `window.print()`. Cero dependencias nuevas y el diálogo nativo del navegador ya
 * ofrece "Guardar como PDF" en desktop y en Android/iOS.
 *
 * NO ES UN COMPROBANTE FISCAL, y el documento lo dice. El sistema no emite facturas ni está
 * conectado a ARCA; llamarlo "comprobante" a secas invitaría a usarlo como lo que no es.
 */

const ESTILOS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
         color: #18181b; line-height: 1.5; padding: 32px 48px; font-size: 13px;
         max-width: 820px; margin: 0 auto; }
  h1 { font-size: 17px; font-weight: 700; margin-bottom: 2px; }
  .sub { color: #71717a; font-size: 12px; margin-bottom: 20px; }
  h2 { font-size: 11px; font-weight: 700; margin-top: 22px; margin-bottom: 6px;
       text-transform: uppercase; letter-spacing: 0.06em; color: #71717a; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 5px 0; vertical-align: top; }
  td.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .concepto { color: #52525b; }
  .chico { font-size: 11px; color: #a1a1aa; }
  .tot td { border-top: 1px solid #18181b; padding-top: 8px; font-weight: 700; font-size: 15px; }
  .sep td { border-top: 1px solid #e4e4e7; }
  .nota { margin-top: 28px; padding: 10px 12px; background: #fafafa; border-left: 3px solid #d4d4d8;
          font-size: 11px; color: #52525b; }
  .barra { position: fixed; top: 0; left: 0; right: 0; background: #18181b; color: white;
           padding: 12px 20px; display: flex; justify-content: space-between; align-items: center;
           gap: 12px; z-index: 100; font-size: 13px; }
  .barra button { background: white; color: #18181b; border: none; padding: 8px 16px;
                  border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }
  .con-barra { padding-top: 76px; }
  @media print {
    .barra { display: none; }
    .con-barra { padding-top: 0; }
    body { padding: 12mm 16mm; }
  }
`;

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

interface Props {
  rendicion: RendicionDetalle;
  propietario: string;
  inmobiliaria: string;
  /** "Septiembre 2026" ya formateado por el caller, que es quien tiene el helper. */
  periodoLargo: string;
  money: (n: number) => string;
  fecha: (iso: string) => string;
}

export function ImprimirRendicion({ rendicion: r, propietario, inmobiliaria, periodoLargo, money, fecha }: Props) {
  const abrir = () => {
    if (typeof window === 'undefined') return;
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) {
      alert('Tu navegador bloqueó la ventana. Habilitá los popups para poder imprimir o guardar el PDF.');
      return;
    }

    const filas = (items: { izq: string; sub: string; monto: string }[]): string =>
      items
        .map(
          (i) => `<tr>
            <td><div>${esc(i.izq)}</div><div class="chico">${esc(i.sub)}</div></td>
            <td class="n">${esc(i.monto)}</td>
          </tr>`,
        )
        .join('');

    const alquileres = filas(
      r.detalleAlquileres.map((a) => ({
        izq: a.direccion,
        sub: a.participacionPct < 100 ? `${a.periodo} · te toca el ${a.participacionPct}%` : a.periodo,
        monto: money(a.monto),
      })),
    );
    const gastos = filas(
      r.detalleGastos.map((g) => ({
        izq: g.descripcion,
        sub: [fecha(g.fecha), g.tipo.toLowerCase(), g.proveedor].filter(Boolean).join(' · '),
        monto: `− ${money(g.monto)}`,
      })),
    );
    const ingresos = filas(
      r.detalleIngresos.map((x) => ({
        izq: x.descripcion,
        sub: x.participacionPct < 100 ? `${fecha(x.fecha)} · te toca el ${x.participacionPct}%` : fecha(x.fecha),
        monto: `+ ${money(x.monto)}`,
      })),
    );

    win.document.write(`<!doctype html>
<html lang="es-AR">
  <head>
    <meta charset="utf-8" />
    <title>Rendición ${esc(periodoLargo)} — ${esc(propietario)}</title>
    <style>${ESTILOS}</style>
  </head>
  <body class="con-barra">
    <div class="barra">
      <span>Rendición de ${esc(periodoLargo)} · imprimí o guardala como PDF</span>
      <button type="button" onclick="window.print()">Imprimir / Guardar PDF</button>
    </div>

    <h1>Rendición de ${esc(periodoLargo)}</h1>
    <p class="sub">
      ${esc(propietario)} · administra ${esc(inmobiliaria)}<br />
      Depositado el ${esc(fecha(r.rendidoAt))} por ${esc(r.metodo.toLowerCase())}
    </p>

    <h2>De dónde salió el alquiler</h2>
    <table>${alquileres || '<tr><td class="concepto">Sin alquileres imputados.</td><td class="n"></td></tr>'}</table>

    ${gastos ? `<h2>Qué se descontó</h2><table>${gastos}</table>` : ''}
    ${ingresos ? `<h2>Otros ingresos</h2><table>${ingresos}</table>` : ''}

    <h2>Cuentas</h2>
    <table>
      <tr><td class="concepto">Se cobró de alquiler</td><td class="n">${esc(money(r.cobrado))}</td></tr>
      <tr><td class="concepto">Comisión de la inmobiliaria (${r.comisionPct}%)</td><td class="n">− ${esc(money(r.comision))}</td></tr>
      ${r.gastos > 0 ? `<tr><td class="concepto">Gastos de tus unidades</td><td class="n">− ${esc(money(r.gastos))}</td></tr>` : ''}
      ${r.otrosIngresos > 0 ? `<tr><td class="concepto">Otros ingresos</td><td class="n">+ ${esc(money(r.otrosIngresos))}</td></tr>` : ''}
      <tr class="tot"><td>Te depositamos</td><td class="n">${esc(money(r.teDepositamos))}</td></tr>
    </table>

    <p class="nota">
      Este es el detalle de la rendición tal como quedó registrada en My Alquiler.
      <strong>No es una factura ni un comprobante fiscal</strong>: si necesitás uno, pedíselo a
      ${esc(inmobiliaria)}.
    </p>
  </body>
</html>`);
    win.document.close();
  };

  return (
    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={abrir}>
      <Printer className="h-3 w-3" />
      Imprimir o guardar PDF
    </Button>
  );
}
