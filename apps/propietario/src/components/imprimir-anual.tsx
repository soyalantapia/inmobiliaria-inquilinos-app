'use client';

import { FileText } from 'lucide-react';
import { Button } from '@llave/ui/button';
import type { RendicionPortal } from '@/lib/api';
import { fecha, money, periodoLargo } from '@/lib/format';

/** Una moneda del resumen: sus filas ordenadas y sus cinco totales. */
export interface CorteAnual {
  moneda: 'ARS' | 'USD';
  filas: RendicionPortal[];
  cobrado: number;
  comision: number;
  gastos: number;
  otrosIngresos: number;
  teDepositamos: number;
}

/**
 * La cuenta del resumen, separada del papel para poder fijarla sin renderizar nada.
 *
 * El EJE ES LA FECHA DE DEPÓSITO, no el período liquidado: "cuánto me entró en 2026" es una
 * pregunta de caja, y un período de diciembre depositado en enero cuenta en enero. Es el mismo
 * criterio que la tarjeta de "te depositamos en 2026", así que los dos números coinciden — si
 * divergieran, el dueño tendría dos totales distintos en la misma pantalla.
 *
 * Y NO SE SUMAN MONEDAS: una entrada por cada una. En un papel que va a una liquidación de
 * impuestos, un total que mezcla pesos y dólares no se descubre.
 */
export function cortarAnual(rendiciones: RendicionPortal[], anio: number): CorteAnual[] {
  const por = new Map<'ARS' | 'USD', CorteAnual>();
  for (const r of rendiciones) {
    if (new Date(r.rendidoAt).getFullYear() !== anio) continue;
    const m = (r.moneda ?? 'ARS') as 'ARS' | 'USD';
    let c = por.get(m);
    if (!c) {
      c = { moneda: m, filas: [], cobrado: 0, comision: 0, gastos: 0, otrosIngresos: 0, teDepositamos: 0 };
      por.set(m, c);
    }
    c.filas.push(r);
    const r2 = (x: number) => Math.round(x * 100) / 100;
    c.cobrado = r2(c.cobrado + r.cobrado);
    c.comision = r2(c.comision + r.comision);
    c.gastos = r2(c.gastos + r.gastos);
    c.otrosIngresos = r2(c.otrosIngresos + r.otrosIngresos);
    c.teDepositamos = r2(c.teDepositamos + r.teDepositamos);
  }
  for (const c of por.values()) c.filas.sort((a, b) => a.rendidoAt.localeCompare(b.rendidoAt));
  // Los pesos primero, igual que en la pantalla.
  return [...por.values()].sort((a) => (a.moneda === 'ARS' ? -1 : 1));
}

/**
 * El año entero en una hoja, para el contador.
 *
 * POR QUÉ EXISTE. El portal ya deja imprimir UNA rendición, y eso sirve para discutir un mes
 * puntual. Pero lo que el dueño necesita una vez al año es otra cosa: cuánto entró en total,
 * cuánto se llevó la inmobiliaria y cuánto le quedó. Hasta ahora eso lo armaba a mano
 * imprimiendo doce hojas y sumando —o se lo pedía a la inmobiliaria por teléfono, que es
 * exactamente la llamada que este portal existe para evitar.
 *
 * TRES DECISIONES QUE NO SON OBVIAS:
 *
 * 1. El eje es la FECHA DE DEPÓSITO, no el período liquidado. "Cuánto me entró en 2026" es
 *    una pregunta de caja: un período de diciembre depositado en enero cuenta en enero, que
 *    es cuando la plata se movió. Es lo que le sirve al contador y es el mismo criterio que
 *    usa la tarjeta de "te depositamos en 2026", así que los dos números coinciden.
 *
 * 2. UNA TABLA POR MONEDA. Sumar pesos con dólares es plata inventada, y en un papel que va
 *    a una liquidación de impuestos el error no se descubre.
 *
 * 3. Dice qué NO es. No es un comprobante fiscal ni un certificado de retenciones: es el
 *    registro de lo que la inmobiliaria le depositó, tal como quedó en el sistema. Sin esa
 *    línea, un papel con membrete y totales se parece demasiado a algo que no es.
 */
export function ImprimirAnual({
  rendiciones,
  anio,
  propietario,
  inmobiliaria,
}: {
  rendiciones: RendicionPortal[];
  anio: number;
  propietario: string;
  inmobiliaria: string;
}) {
  const cortes = cortarAnual(rendiciones, anio);
  if (cortes.length === 0) return null;

  const abrir = () => {
    if (typeof window === 'undefined') return;
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) {
      alert('Tu navegador bloqueó la ventana. Habilitá los popups para poder imprimir o guardar el PDF.');
      return;
    }

    const tablas = cortes
      .map((c) => {
        const { moneda: mon, filas } = c;
        const plata = (x: number) => money(x, mon);

        const cuerpo = filas
          .map(
            (r) => `<tr>
              <td>${esc(periodoLargo(r.periodo))}<div class="chico">depositado el ${esc(fecha(r.rendidoAt))}</div></td>
              <td class="n">${esc(plata(r.cobrado))}</td>
              <td class="n">− ${esc(plata(r.comision))}</td>
              <td class="n">${r.gastos > 0 ? `− ${esc(plata(r.gastos))}` : '—'}</td>
              <td class="n">${r.otrosIngresos > 0 ? `+ ${esc(plata(r.otrosIngresos))}` : '—'}</td>
              <td class="n"><strong>${esc(plata(r.teDepositamos))}</strong></td>
            </tr>`,
          )
          .join('');

        return `
          ${cortes.length > 1 ? `<h2>${mon === 'USD' ? 'En dólares' : 'En pesos'}</h2>` : ''}
          <table>
            <tr class="cab">
              <td>Período</td><td class="n">Se cobró</td><td class="n">Comisión</td>
              <td class="n">Gastos</td><td class="n">Otros</td><td class="n">Te depositamos</td>
            </tr>
            ${cuerpo}
            <tr class="tot">
              <td>Total ${esc(String(anio))} · ${filas.length} ${filas.length === 1 ? 'rendición' : 'rendiciones'}</td>
              <td class="n">${esc(plata(c.cobrado))}</td>
              <td class="n">− ${esc(plata(c.comision))}</td>
              <td class="n">− ${esc(plata(c.gastos))}</td>
              <td class="n">+ ${esc(plata(c.otrosIngresos))}</td>
              <td class="n">${esc(plata(c.teDepositamos))}</td>
            </tr>
          </table>`;
      })
      .join('');

    win.document.write(`<!doctype html>
<html lang="es-AR"><head><meta charset="utf-8" />
<title>Resumen ${esc(String(anio))} — ${esc(propietario)}</title>
<style>${ESTILOS}</style></head>
<body class="con-barra">
  <div class="barra">
    <span>Resumen de ${esc(String(anio))} · imprimilo o guardalo como PDF</span>
    <button onclick="window.print()">Imprimir</button>
  </div>
  <h1>Resumen de ${esc(String(anio))}</h1>
  <p class="sub">${esc(propietario)} · administra ${esc(inmobiliaria)}</p>
  ${tablas}
  <p class="nota">
    Las filas van por <strong>fecha de depósito</strong>, no por el mes liquidado: un período de
    diciembre depositado en enero cuenta en enero, que es cuando se movió la plata.
    <br /><br />
    Este es el registro de lo que ${esc(inmobiliaria)} te depositó, tal como quedó en My Alquiler.
    <strong>No es una factura ni un certificado de retenciones</strong>: si necesitás uno, pedíselo a ellos.
  </p>
</body></html>`);
    win.document.close();
  };

  return (
    <Button variant="outline" size="sm" onClick={abrir} className="w-full sm:w-auto">
      <FileText className="h-4 w-4" />
      Resumen de {anio} para el contador
    </Button>
  );
}

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

const ESTILOS = `
  * { box-sizing: border-box; }
  body { font: 13px/1.5 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         color: #18181b; max-width: 900px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  .sub { color: #71717a; margin: 0 0 20px; font-size: 12px; }
  h2 { font-size: 11px; font-weight: 700; margin-top: 24px; margin-bottom: 6px;
       text-transform: uppercase; letter-spacing: 0.06em; color: #71717a; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  td { padding: 6px 8px; vertical-align: top; border-bottom: 1px solid #f4f4f5; }
  td.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .cab td { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
            color: #71717a; border-bottom: 1px solid #d4d4d8; }
  .chico { font-size: 11px; color: #a1a1aa; }
  .tot td { border-top: 2px solid #18181b; border-bottom: none; padding-top: 10px;
            font-weight: 700; font-size: 14px; }
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
    body { padding: 12mm 14mm; }
    tr { break-inside: avoid; }
  }
`;
