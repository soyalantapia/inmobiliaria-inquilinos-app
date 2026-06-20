/**
 * SLA por urgencia del reclamo — pedido del feedback: "necesito que el
 * sistema me avise cuando un reclamo se está pasando del tiempo razonable
 * para resolver, sino el inquilino me llama y nos comemos un mes de
 * morosidad".
 *
 * Reglas:
 *   - EMERGENCIA  → 6h  (corte total de servicio, fuga grave)
 *   - ALTA        → 24h (calefacción rota en invierno, baño tapado)
 *   - MEDIA       → 72h (rotura no crítica, pintura)
 *   - BAJA        → 1 semana (mejora estética, ajuste menor)
 *
 * El estado se calcula contra `createdAt` y se desactiva si el reclamo
 * ya está RESUELTO o CERRADO.
 */
import type { Reclamo, UrgenciaReclamo } from './types';

export type EstadoSla = 'EN_TIEMPO' | 'PROXIMO_VENCIMIENTO' | 'VENCIDO' | 'RESUELTO';

export const SLA_HORAS_POR_URGENCIA: Record<UrgenciaReclamo, number> = {
  EMERGENCIA: 6,
  ALTA: 24,
  MEDIA: 72,
  BAJA: 168, // 7 días
};

export interface ResumenSla {
  estado: EstadoSla;
  horasTranscurridas: number;
  horasLimite: number;
  /** Horas restantes — negativo si ya pasó. */
  horasRestantes: number;
  /** Porcentaje del SLA consumido (0-100+). */
  pctConsumido: number;
  /** Frase humana para mostrar. */
  texto: string;
  /** Si conviene mandar alerta (a más del 80%). */
  alertar: boolean;
}

export function evaluarSla(reclamo: Reclamo, ahoraMs = Date.now()): ResumenSla {
  const limite = SLA_HORAS_POR_URGENCIA[reclamo.urgencia];
  const creado = Date.parse(reclamo.createdAt);

  // Reclamo reabierto por el inquilino (PERSISTE): vuelve a un estado activo
  // conservando resueltoAt como ancla → el SLA reinicia desde la reapertura, no
  // desde createdAt (sino reaparecería como VENCIDO al instante). Para resueltos
  // `inicio` = createdAt. Mantener idéntico al server (apps/api .../operacion.ts).
  const reabierto =
    reclamo.estado !== 'RESUELTO' && reclamo.estado !== 'CERRADO' && !!reclamo.resueltoAt;
  const inicio = reabierto ? Date.parse(reclamo.resueltoAt as string) : creado;
  const horas = Math.max(0, (ahoraMs - inicio) / 3600_000);
  const restantes = limite - horas;
  const pct = (horas / limite) * 100;

  if (reclamo.estado === 'RESUELTO' || reclamo.estado === 'CERRADO') {
    const cerradoEn = reclamo.resueltoAt ?? null;
    const dur = cerradoEn
      ? Math.max(0, (Date.parse(cerradoEn) - creado) / 3600_000)
      : horas;
    return {
      estado: 'RESUELTO',
      horasTranscurridas: dur,
      horasLimite: limite,
      horasRestantes: limite - dur,
      pctConsumido: (dur / limite) * 100,
      texto:
        dur <= limite
          ? `Resuelto en ${formatHoras(dur)}, dentro del plazo (${formatHoras(limite)}).`
          : `Resuelto en ${formatHoras(dur)}, ${formatHoras(dur - limite)} más que el plazo.`,
      alertar: false,
    };
  }

  if (restantes < 0) {
    return {
      estado: 'VENCIDO',
      horasTranscurridas: horas,
      horasLimite: limite,
      horasRestantes: restantes,
      pctConsumido: pct,
      texto: `Atrasado hace ${formatHoras(-restantes)} (el plazo para resolver era ${formatHoras(limite)}).`,
      alertar: true,
    };
  }

  if (pct >= 80) {
    return {
      estado: 'PROXIMO_VENCIMIENTO',
      horasTranscurridas: horas,
      horasLimite: limite,
      horasRestantes: restantes,
      pctConsumido: pct,
      texto: `Faltan ${formatHoras(restantes)} para cumplir el plazo.`,
      alertar: true,
    };
  }

  return {
    estado: 'EN_TIEMPO',
    horasTranscurridas: horas,
    horasLimite: limite,
    horasRestantes: restantes,
    pctConsumido: pct,
    texto: `${Math.round(pct)}% del plazo consumido.`,
    alertar: false,
  };
}

function formatHoras(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${Math.round(h)}h`;
  const dias = h / 24;
  return `${dias.toFixed(dias < 10 ? 1 : 0)}d`;
}

export const ESTADO_SLA_COLOR: Record<EstadoSla, string> = {
  EN_TIEMPO:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  PROXIMO_VENCIMIENTO:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  VENCIDO:
    'bg-destructive/15 text-destructive',
  RESUELTO: 'bg-muted text-muted-foreground',
};

export const ESTADO_SLA_LABEL: Record<EstadoSla, string> = {
  EN_TIEMPO: 'En tiempo',
  PROXIMO_VENCIMIENTO: 'Por vencer',
  VENCIDO: 'Vencido',
  RESUELTO: 'Resuelto',
};
