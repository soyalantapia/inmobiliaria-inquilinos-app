'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Droplets,
  Flame,
  MessageCircle,
  Zap,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import {
  type AlertaServicios,
  listarAlertasServicios,
} from '@/lib/alertas-servicios';

const ICONO_TIPO = {
  LUZ: Zap,
  GAS: Flame,
  AGUA: Droplets,
  INTERNET: Bell,
  ABL: Bell,
  CABLE: Bell,
} as const;

export function AlertasServiciosCard() {
  const [alertas, setAlertas] = useState<AlertaServicios[]>([]);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setAlertas(listarAlertasServicios());
    setHidratado(true);
  }, []);

  if (!hidratado) return null;

  if (alertas.length === 0) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-900/10">
        <CardContent className="flex items-center gap-3 p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              Servicios al día
            </p>
            <p className="text-xs text-emerald-900/70 dark:text-emerald-200/70">
              Todos los inquilinos subieron sus boletas obligatorias del mes.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const criticos = alertas.filter((a) => a.gravedad === 'CRITICO').length;

  return (
    <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <div
            className={`grid h-10 w-10 place-items-center rounded-md ${
              criticos > 0
                ? 'bg-destructive/10 text-destructive'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {alertas.length} alerta{alertas.length === 1 ? '' : 's'} de servicios
            </p>
            <p className="text-xs text-muted-foreground">
              Inquilinos que no subieron boletas o las tienen vencidas.
              Tratalo como morosidad blanda — un recordatorio antes de
              que pase a deuda.
            </p>
          </div>
          {criticos > 0 && (
            <Badge variant="destructive" className="text-xs">
              {criticos} críticas
            </Badge>
          )}
        </div>
        <ul className="divide-y rounded-md border">
          {alertas.slice(0, 6).map((a, i) => {
            const Icon = ICONO_TIPO[a.tipo];
            return (
              <li key={i} className="flex items-start gap-3 p-3 text-xs">
                <Icon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    a.gravedad === 'CRITICO'
                      ? 'text-destructive'
                      : a.gravedad === 'ATENCION'
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-muted-foreground'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-medium">{a.inquilino}</p>
                    <Badge
                      variant={
                        a.gravedad === 'CRITICO'
                          ? 'destructive'
                          : a.gravedad === 'ATENCION'
                            ? 'warning'
                            : 'outline'
                      }
                      className="text-[9px]"
                    >
                      {a.tipo.charAt(0) + a.tipo.slice(1).toLowerCase()}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{a.direccion}</p>
                  <p className="text-[11px]">{a.detalle}</p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Hola! Te paso a recordar la boleta de ${a.tipo.toLowerCase()} de ${a.direccion} — ${a.detalle}. Subila a la app o avisame.`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                  </a>
                </Button>
              </li>
            );
          })}
          {alertas.length > 6 && (
            <li className="p-3 text-center text-[10px] text-muted-foreground">
              + {alertas.length - 6} más · ver completas filtrando por servicio.
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
