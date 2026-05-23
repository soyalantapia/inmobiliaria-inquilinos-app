'use client';

/**
 * Alertas de servicios: cuando el inquilino tiene la luz/gas pendiente
 * (subió la boleta pero no la pagó) o cuando no subió la boleta del
 * mes a tiempo. Pedido del feedback: "alertar como morosidad o
 * incumplimiento a inquilinos que no suban comprobantes/boletas de
 * servicios cuando sea obligatorio".
 *
 * Deriva del cross-app reader de boletas que sube el inquilino.
 */
import { contratosMock } from './mock-data';
import {
  leerBoletasDeContrato,
  type BoletaInquilino,
  type EstadoBoletaInquilino,
  type TipoServicioBoleta,
} from './boletas-cross-app';

export type GravedadAlerta = 'INFO' | 'ATENCION' | 'CRITICO';

export interface AlertaServicios {
  contratoId: string;
  inquilino: string;
  direccion: string;
  tipo: TipoServicioBoleta;
  /** "Sin boleta cargada este mes" o "Boleta vencida sin pagar". */
  motivo: 'SIN_BOLETA' | 'BOLETA_VENCIDA' | 'BOLETA_PENDIENTE';
  gravedad: GravedadAlerta;
  detalle: string;
  /** Días de atraso si aplica. */
  diasAtraso?: number;
}

/**
 * Servicios obligatorios que el inquilino debe subir cada mes según el
 * contrato. Por default luz y gas; agua va por expensas en mucha casos
 * y por eso es opcional.
 */
const OBLIGATORIOS: TipoServicioBoleta[] = ['LUZ', 'GAS'];

/**
 * Devuelve la lista de alertas para todos los contratos activos.
 */
export function listarAlertasServicios(): AlertaServicios[] {
  const ahora = new Date();
  const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  const alertas: AlertaServicios[] = [];

  for (const c of contratosMock) {
    if (c.estado !== 'ACTIVO') continue;
    const boletas = leerBoletasDeContrato(c.id);

    for (const tipo of OBLIGATORIOS) {
      const delMes = boletas.find((b) => b.tipo === tipo && b.periodo === mesActual);

      if (!delMes) {
        // No subió la boleta del mes — alerta de gravedad media.
        alertas.push({
          contratoId: c.id,
          inquilino: c.inquilino,
          direccion: c.direccion,
          tipo,
          motivo: 'SIN_BOLETA',
          gravedad: 'ATENCION',
          detalle: `No subió la boleta de ${labelTipo(tipo)} de ${mesActual}.`,
        });
        continue;
      }

      // La boleta está subida; chequear si pagó o pasó el vencimiento.
      const vencimiento = Date.parse(delMes.vencimiento);
      const diasAtraso = Math.floor((Date.now() - vencimiento) / 86400_000);

      if (delMes.estado !== 'PAGADA' && diasAtraso > 0) {
        alertas.push({
          contratoId: c.id,
          inquilino: c.inquilino,
          direccion: c.direccion,
          tipo,
          motivo: 'BOLETA_VENCIDA',
          gravedad: diasAtraso > 7 ? 'CRITICO' : 'ATENCION',
          detalle: `Boleta de ${labelTipo(tipo)} vencida hace ${diasAtraso} día${diasAtraso === 1 ? '' : 's'}.`,
          diasAtraso,
        });
      } else if (delMes.estado !== 'PAGADA') {
        const diasParaVencer = Math.floor((vencimiento - Date.now()) / 86400_000);
        if (diasParaVencer >= 0 && diasParaVencer <= 5) {
          alertas.push({
            contratoId: c.id,
            inquilino: c.inquilino,
            direccion: c.direccion,
            tipo,
            motivo: 'BOLETA_PENDIENTE',
            gravedad: 'INFO',
            detalle: `${labelTipo(tipo)} vence en ${diasParaVencer} día${diasParaVencer === 1 ? '' : 's'}.`,
          });
        }
      }
    }
  }

  // Ordenamos por gravedad y luego por dias de atraso.
  const peso: Record<GravedadAlerta, number> = {
    CRITICO: 3,
    ATENCION: 2,
    INFO: 1,
  };
  return alertas.sort(
    (a, b) =>
      peso[b.gravedad] - peso[a.gravedad] || (b.diasAtraso ?? 0) - (a.diasAtraso ?? 0),
  );
}

function labelTipo(t: TipoServicioBoleta): string {
  return {
    LUZ: 'luz',
    GAS: 'gas',
    AGUA: 'agua',
    INTERNET: 'internet',
    ABL: 'ABL',
    CABLE: 'cable',
  }[t];
}

/**
 * Para mostrar como "score de cumplimiento de boletas" en el scoring
 * del inquilino. Devuelve un puntaje 0-100 según cuántos meses cumplió
 * con la carga de boletas de los servicios obligatorios.
 */
export function puntajeCargaBoletas(contratoId: string): {
  puntaje: number;
  detalle: string;
} {
  const boletas = leerBoletasDeContrato(contratoId);
  const ahora = new Date();
  let mesesEvaluados = 0;
  let mesesCumplidos = 0;

  for (let i = 0; i < 6; i++) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    for (const tipo of OBLIGATORIOS) {
      mesesEvaluados += 1;
      const subio = boletas.some((b) => b.tipo === tipo && b.periodo === periodo);
      if (subio) mesesCumplidos += 1;
    }
  }

  if (mesesEvaluados === 0) {
    return { puntaje: 70, detalle: 'Sin historial suficiente todavía.' };
  }
  const puntaje = Math.round((mesesCumplidos / mesesEvaluados) * 100);
  return {
    puntaje,
    detalle: `${mesesCumplidos}/${mesesEvaluados} cargas obligatorias subidas en los últimos 6 meses.`,
  };
}
