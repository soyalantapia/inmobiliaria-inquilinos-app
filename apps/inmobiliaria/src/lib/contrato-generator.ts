/**
 * Generador del documento del contrato — Word + PDF.
 *
 * Pedido de los pilotos en la ronda de feedback: "Bajenme el contrato en
 * Word para poder editarlo y en PDF para mandar a firmar". El generador
 * arma un HTML con todos los datos del contrato (inquilino, propiedad,
 * monto, vigencia, índice, depósito, garantes, comisión) y permite:
 *
 *   - generarContratoWord(): descarga un .doc — Word abre HTML con esa
 *     extensión como documento editable.
 *   - generarContratoPdf(): abre una pestaña con la versión imprimible y
 *     dispara window.print() — el navegador permite "Guardar como PDF".
 *
 * No usamos jsPDF / docx para mantener la bundle chica. En backend real
 * esto se haría server-side con plantillas.
 */
import type { ContratoListado, Propietario } from './types';
import { formatFecha, formatMonto } from './format';

export interface VariablesContrato {
  contrato: ContratoListado;
  propietarios: Propietario[];
  diaPago?: number;
  indiceAjuste?: string;
  frecuenciaAjusteMeses?: number;
  comisionInmobiliariaPct?: number;
  depositoGarantia?: number;
  garantes?: Array<{ nombre: string; cuit?: string; direccion?: string }>;
  sociedad?: { razonSocial: string; cuit: string; direccion?: string };
  /** Lugar donde se firma (ej. "Ciudad de Buenos Aires"). */
  ciudadFirma?: string;
}

function escaparHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nombrarPropietarios(props: Propietario[]): string {
  if (props.length === 0) return '[propietario]';
  if (props.length === 1) return `${props[0]!.nombre} ${props[0]!.apellido}`;
  return props.map((p) => `${p.nombre} ${p.apellido}`).join(' y ');
}

function bloqueGarantes(garantes: VariablesContrato['garantes']): string {
  if (!garantes || garantes.length === 0) {
    return `<p><strong>GARANTÍA.—</strong> Las partes establecen como garantía
    de cumplimiento el depósito en dinero detallado en la cláusula
    correspondiente. Podrán incorporarse garantes adicionales por instrumento
    separado.</p>`;
  }
  const items = garantes
    .map((g, i) => {
      const idx = i + 1;
      const partes = [
        `<strong>Garante ${idx}:</strong> ${escaparHtml(g.nombre)}`,
        g.cuit ? `CUIT/CUIL ${escaparHtml(g.cuit)}` : null,
        g.direccion ? `domicilio en ${escaparHtml(g.direccion)}` : null,
      ].filter(Boolean);
      return `<li>${partes.join(', ')}</li>`;
    })
    .join('');
  return `<p><strong>GARANTÍA.—</strong> Como garantía del fiel cumplimiento
  de las obligaciones del LOCATARIO, intervienen las siguientes personas en
  carácter de garantes solidarios y lisos pagadores:</p>
  <ul>${items}</ul>`;
}

/**
 * Genera el HTML completo del contrato con los datos provistos.
 * El HTML está pensado tanto para descarga .doc como para impresión a PDF.
 */
export function generarContratoHTML(v: VariablesContrato): string {
  const { contrato, propietarios, sociedad } = v;
  const diaPago = v.diaPago ?? 5;
  const indice = v.indiceAjuste ?? 'ICL';
  const frecuencia = v.frecuenciaAjusteMeses ?? 6;
  const comision = v.comisionInmobiliariaPct ?? 4.17;
  const deposito = v.depositoGarantia ?? contrato.monto;
  const ciudad = v.ciudadFirma ?? 'Ciudad Autónoma de Buenos Aires';
  const propietarioNombre = nombrarPropietarios(propietarios);

  const css = `
    body { font-family: 'Times New Roman', Georgia, serif; font-size: 12pt; line-height: 1.5; color: #111; margin: 2.5cm; }
    h1 { font-size: 16pt; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0; }
    h2 { font-size: 13pt; margin-top: 1.6em; }
    .subt { text-align: center; font-size: 11pt; color: #555; margin-top: 4px; margin-bottom: 24px; }
    .partes { background: #f5f7fa; padding: 12px 16px; border-left: 4px solid #b8c4d4; margin: 12px 0; font-size: 11pt; }
    .firmas { margin-top: 80px; display: flex; gap: 48px; justify-content: space-between; }
    .firma { flex: 1; border-top: 1px solid #111; padding-top: 6px; text-align: center; font-size: 10pt; }
    p { text-align: justify; margin: 8px 0; }
    ul { margin: 6px 0 12px 20px; }
    .meta { font-size: 10pt; color: #777; text-align: right; margin-top: 36px; border-top: 1px dashed #ccc; padding-top: 8px; }
  `;

  const partesHtml = `
    <div class="partes">
      <p><strong>LOCADOR/A:</strong> ${escaparHtml(propietarioNombre)}${
        sociedad ? `, representado por ${escaparHtml(sociedad.razonSocial)} (CUIT ${escaparHtml(sociedad.cuit)})` : ''
      }.</p>
      <p><strong>LOCATARIO/A:</strong> ${escaparHtml(contrato.inquilino)}.</p>
      <p><strong>INMUEBLE:</strong> ${escaparHtml(contrato.direccion)}.</p>
    </div>
  `;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Contrato de locación · ${escaparHtml(contrato.inquilino)}</title>
  <style>${css}</style>
</head>
<body>
  <h1>Contrato de locación de inmueble</h1>
  <p class="subt">Ley 27.737 · Código Civil y Comercial de la Nación</p>

  ${partesHtml}

  <p>En la ciudad de ${escaparHtml(ciudad)}, a los ${formatFecha(
    contrato.fechaInicio,
  )}, entre las partes individualizadas precedentemente se conviene celebrar
  el presente contrato de locación, sujeto a las siguientes cláusulas:</p>

  <h2>Primera — Objeto</h2>
  <p>El LOCADOR da en locación al LOCATARIO, quien acepta, el inmueble
  ubicado en ${escaparHtml(contrato.direccion)}, destinado exclusivamente
  a vivienda única familiar permanente del LOCATARIO, no pudiendo
  alterarse dicho destino sin autorización expresa y por escrito del
  LOCADOR.</p>

  <h2>Segunda — Plazo</h2>
  <p>El plazo de la locación es de TREINTA Y SEIS (36) MESES, contados
  a partir del ${formatFecha(contrato.fechaInicio)} y hasta el
  ${formatFecha(contrato.fechaFin)}.</p>

  <h2>Tercera — Precio</h2>
  <p>El precio inicial del alquiler queda establecido en la suma de
  <strong>${formatMonto(contrato.monto)}</strong> mensuales, pagaderos
  por adelantado del 1 al ${diaPago} de cada mes en la cuenta
  bancaria que el LOCADOR comunique al LOCATARIO. La falta de pago en
  término dará lugar a los intereses punitorios previstos en este
  contrato y a las consecuencias dispuestas por la legislación vigente.</p>

  <h2>Cuarta — Actualización del canon</h2>
  <p>Las partes acuerdan que el canon se ajustará cada
  <strong>${frecuencia} (${frecuencia === 6 ? 'seis' : frecuencia === 12 ? 'doce' : String(frecuencia)})
  meses</strong> aplicando el índice <strong>${indice}</strong> publicado
  por el Banco Central de la República Argentina, conforme lo establecido
  por el art. 14 de la Ley 27.737. Las actualizaciones se calcularán
  tomando como base la última publicación oficial disponible al
  vencimiento del período correspondiente.</p>

  <h2>Quinta — Depósito en garantía</h2>
  <p>En este acto el LOCATARIO entrega al LOCADOR la suma de
  <strong>${formatMonto(deposito)}</strong> en concepto de depósito en
  garantía, que será restituida al finalizar la locación, una vez
  verificado el cumplimiento de las obligaciones contractuales y la
  inexistencia de daños no derivados del uso normal y prudente del
  inmueble.</p>

  <h2>Sexta — Honorarios de intermediación</h2>
  <p>Las partes reconocen la intervención profesional de la inmobiliaria
  ${sociedad ? escaparHtml(sociedad.razonSocial) : '[inmobiliaria]'},
  por la cual el LOCATARIO abonará en concepto de honorarios el
  equivalente al <strong>${comision}%</strong> mensual del canon
  durante la vigencia del contrato, conforme la normativa aplicable.</p>

  <h2>Séptima — Servicios y expensas</h2>
  <p>Quedan a cargo del LOCATARIO el pago de los servicios de suministro
  (energía eléctrica, gas, agua corriente, internet) y de las expensas
  ordinarias. Las expensas extraordinarias quedan a cargo del LOCADOR.</p>

  <h2>Octava — Garantías</h2>
  ${bloqueGarantes(v.garantes)}

  <h2>Novena — Rescisión anticipada</h2>
  <p>El LOCATARIO podrá rescindir anticipadamente el contrato previa
  notificación fehaciente al LOCADOR con sesenta (60) días de
  anticipación. La multa aplicable será la prevista por la legislación
  vigente al momento de la rescisión.</p>

  <h2>Décima — Jurisdicción</h2>
  <p>A todos los efectos legales del presente, las partes se someten a la
  jurisdicción de los Tribunales Ordinarios de ${escaparHtml(ciudad)},
  con renuncia expresa a cualquier otro fuero o jurisdicción que pudiera
  corresponder. Se constituyen los siguientes domicilios especiales:
  el LOCATARIO en el inmueble locado y el LOCADOR en el indicado al inicio.</p>

  <p>En prueba de conformidad se firman <strong>tres (3)</strong>
  ejemplares de un mismo tenor y a un solo efecto, en el lugar y fecha
  arriba indicados.</p>

  <div class="firmas">
    <div class="firma">LOCADOR/A<br/>${escaparHtml(propietarioNombre)}</div>
    <div class="firma">LOCATARIO/A<br/>${escaparHtml(contrato.inquilino)}</div>
    <div class="firma">INMOBILIARIA<br/>${
      sociedad ? escaparHtml(sociedad.razonSocial) : 'My Alquiler'
    }</div>
  </div>

  <p class="meta">Generado por My Alquiler · contrato #${escaparHtml(contrato.id)} ·
  Documento editable. Adaptá los términos según la normativa vigente
  antes de firmar.</p>
</body>
</html>`;
}

/**
 * Dispara la descarga del HTML como .doc. Word reconoce HTML como
 * documento editable y abre el archivo en modo edición.
 */
export function descargarContratoWord(v: VariablesContrato): void {
  if (typeof window === 'undefined') return;
  const html = generarContratoHTML(v);
  const blob = new Blob(['﻿', html], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Contrato - ${v.contrato.inquilino} - ${v.contrato.fechaInicio}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Abre el contrato en una nueva pestaña y dispara la impresora del
 * navegador. El usuario elige "Guardar como PDF" en el diálogo nativo
 * para tener el contrato listo para enviar a firma.
 */
export function imprimirContratoPdf(v: VariablesContrato): void {
  if (typeof window === 'undefined') return;
  const html = generarContratoHTML(v);
  const ventana = window.open('', '_blank', 'width=900,height=1100');
  if (!ventana) {
    alert('No pudimos abrir la ventana de impresión. Habilitá los pop-ups.');
    return;
  }
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
  // Pequeño delay para que los estilos terminen de aplicarse antes del
  // diálogo de impresión.
  setTimeout(() => {
    ventana.focus();
    ventana.print();
  }, 350);
}
