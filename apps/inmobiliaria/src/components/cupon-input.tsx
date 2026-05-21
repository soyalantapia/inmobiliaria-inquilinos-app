'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Tag, X } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { toast } from '@llave/ui/use-toast';
import {
  type CuponActivo,
  aplicarCupon,
  leerCuponActivo,
  removerCupon,
} from '@/lib/cupones';
import { formatMonto } from '@/lib/format';
import { calcularResumenPlan } from '@/lib/plan';

/**
 * Input para que el inmo aplique un cupón de descuento (convenio).
 * Si ya tiene un cupón activo, muestra el chip + opción de remover.
 */
export function CuponInput() {
  const [activo, setActivo] = useState<CuponActivo | null>(null);
  const [codigo, setCodigo] = useState('');
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setActivo(leerCuponActivo());
    setHidratado(true);
  }, []);

  if (!hidratado) return null;

  const plan = calcularResumenPlan();

  const handleAplicar = () => {
    if (!codigo.trim()) return;
    const res = aplicarCupon(codigo);
    if (res.ok) {
      const nuevo: CuponActivo = { cupon: res.cupon, aplicadoAt: new Date().toISOString() };
      setActivo(nuevo);
      setCodigo('');
      toast({
        variant: 'success',
        title: `¡Cupón aplicado! ${res.cupon.porcentaje}% de descuento`,
        description: res.cupon.detalle,
      });
    } else {
      toast({
        title: 'No pudimos aplicar el cupón',
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  const handleRemover = () => {
    removerCupon();
    setActivo(null);
    toast({ title: 'Cupón removido', description: 'Volvés al precio sin descuento.' });
  };

  if (activo) {
    const ahorroMensual = Math.round(plan.costoMensualTotal * (activo.cupon.porcentaje / 100));
    return (
      <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-900/10">
        <CardContent className="flex flex-wrap items-start gap-3 p-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-emerald-500 text-white">
            <Tag className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">
                Cupón <span className="font-mono">{activo.cupon.codigo}</span> aplicado
              </p>
              <Badge variant="success" className="gap-1 text-[10px]">
                <CheckCircle2 className="h-3 w-3" />
                {activo.cupon.porcentaje}% off
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {activo.cupon.detalle}. Estás ahorrando{' '}
              <strong className="text-foreground tabular-nums">
                {formatMonto(ahorroMensual)}
              </strong>{' '}
              por mes.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemover}
            className="shrink-0 gap-1"
          >
            <X className="h-3 w-3" />
            Remover
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-semibold">¿Tenés un código de descuento?</p>
            <p className="text-xs text-muted-foreground">
              Convenios con colegios profesionales (CUCICBA, CPI, etc.) o promos
              de lanzamiento.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="Ej: CUCICBA10"
            className="flex-1 font-mono uppercase"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAplicar();
              }
            }}
          />
          <Button onClick={handleAplicar} disabled={!codigo.trim()}>
            Aplicar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
