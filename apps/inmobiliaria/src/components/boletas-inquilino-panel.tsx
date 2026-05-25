'use client';

import { useEffect, useState } from 'react';
import {
  Cable,
  CheckCircle2,
  Download,
  Droplets,
  Flame,
  Landmark,
  Receipt,
  Wifi,
  Zap,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import {
  type BoletaInquilino,
  type EstadoBoletaInquilino,
  type TipoServicioBoleta,
  ESTADO_BOLETA_LABEL,
  TIPO_BOLETA_LABEL,
  formatPeriodoBoleta,
  leerBoletasDeContrato,
} from '@/lib/boletas-cross-app';
import { formatFecha, formatFechaCorta, formatMonto } from '@/lib/format';

const ICONO: Record<TipoServicioBoleta, typeof Zap> = {
  LUZ: Zap,
  GAS: Flame,
  AGUA: Droplets,
  INTERNET: Wifi,
  ABL: Landmark,
  CABLE: Cable,
};

const VARIANTE: Record<
  EstadoBoletaInquilino,
  'success' | 'outline' | 'warning'
> = {
  PAGADA: 'success',
  SUBIDA: 'outline',
  EN_REVISION: 'warning',
};

interface Props {
  contratoId: string;
}

export function BoletasInquilinoPanel({ contratoId }: Props) {
  const [boletas, setBoletas] = useState<BoletaInquilino[]>([]);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setBoletas(leerBoletasDeContrato(contratoId));
    setHidratado(true);
  }, [contratoId]);

  if (!hidratado) return null;

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">Boletas que subió el inquilino</p>
              <p className="text-xs text-muted-foreground">
                Servicios públicos cargados desde la app del inquilino.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0">
            {boletas.length}
          </Badge>
        </div>

        {boletas.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-xs text-muted-foreground">
            El inquilino todavía no subió boletas de servicios. Cuando suba
            una, aparece acá automáticamente.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {boletas.map((b) => {
              const Icon = ICONO[b.tipo];
              const esImagen = b.tipoMime.startsWith('image/');
              return (
                <li
                  key={b.id}
                  className="flex items-center gap-3 p-3 text-sm"
                >
                  {esImagen ? (
                    <img
                      src={b.dataUrl}
                      alt={b.nombreArchivo}
                      className="h-10 w-10 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-xs font-medium">
                        {TIPO_BOLETA_LABEL[b.tipo]} ·{' '}
                        {formatPeriodoBoleta(b.periodo)}
                      </p>
                      <Badge
                        variant={VARIANTE[b.estado]}
                        className="text-[9px]"
                      >
                        {ESTADO_BOLETA_LABEL[b.estado]}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {formatMonto(b.monto)} · vence {formatFechaCorta(b.vencimiento)}
                      {b.pagadoAt && (
                        <span>
                          {' '}
                          ·{' '}
                          <CheckCircle2 className="inline h-3 w-3 text-emerald-600" />{' '}
                          {formatFechaCorta(b.pagadoAt)}
                        </span>
                      )}
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <a
                      href={b.dataUrl}
                      download={b.nombreArchivo}
                      aria-label="Descargar"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
