'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Handshake,
  MapPin,
  Sparkles,
  Users,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { toast } from '@llave/ui/use-toast';
import {
  CUPONES_VALIDOS,
  aplicarCupon,
  leerCuponActivo,
  removerCupon,
  type Cupon,
} from '@/lib/cupones';

/**
 * Browser de convenios. Reemplaza el input "Tengo un cupón" por una
 * vista catálogo donde la inmo puede ver QUIÉN está adherido al
 * convenio, qué descuento aplica, y aplicarlo de un click.
 *
 * Si el partner está PROXIMAMENTE, se muestra el card pero el botón
 * queda deshabilitado con leyenda "En firma".
 */
export function ConveniosBrowser() {
  const [hidratado, setHidratado] = useState(false);
  const [cuponActivoCodigo, setCuponActivoCodigo] = useState<string | null>(null);

  useEffect(() => {
    setCuponActivoCodigo(leerCuponActivo()?.cupon.codigo ?? null);
    setHidratado(true);
  }, []);

  if (!hidratado) return null;

  const activos = CUPONES_VALIDOS.filter((c) => c.estado !== 'PROXIMAMENTE');
  const proximamente = CUPONES_VALIDOS.filter((c) => c.estado === 'PROXIMAMENTE');

  const aplicar = (cupon: Cupon) => {
    const res = aplicarCupon(cupon.codigo);
    if (res.ok) {
      setCuponActivoCodigo(res.cupon.codigo);
      toast({
        variant: 'success',
        title: `Convenio ${cupon.convenio} aplicado`,
        description: `Tenés ${cupon.porcentaje}% de descuento sobre tu plan. Se aplica en la próxima factura.`,
      });
    } else {
      toast({
        title: 'No pudimos aplicar el convenio',
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  const remover = () => {
    removerCupon();
    setCuponActivoCodigo(null);
    toast({ title: 'Convenio quitado' });
  };

  return (
    <div className="space-y-4">
      {/* El header explicativo lo provee el <Card> wrapper en
          /configuracion → Convenios. No duplicamos copy acá. */}

      {/* Convenios activos */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Convenios activos ({activos.length})
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {activos.map((c) => (
            <ConvenioCard
              key={c.codigo}
              cupon={c}
              activo={cuponActivoCodigo === c.codigo}
              onAplicar={() => aplicar(c)}
              onRemover={remover}
            />
          ))}
        </div>
      </div>

      {/* Próximamente */}
      {proximamente.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Próximamente ({proximamente.length})
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {proximamente.map((c) => (
              <ConvenioCard key={c.codigo} cupon={c} proximo />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConvenioCard({
  cupon,
  activo,
  proximo,
  onAplicar,
  onRemover,
}: {
  cupon: Cupon;
  activo?: boolean;
  proximo?: boolean;
  onAplicar?: () => void;
  onRemover?: () => void;
}) {
  return (
    <Card
      className={
        activo
          ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-900/10'
          : proximo
            ? 'border-dashed bg-muted/20'
            : ''
      }
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          {/* Sigla / logo placeholder */}
          <div
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg text-xs font-bold ${
              proximo
                ? 'bg-muted text-muted-foreground'
                : 'bg-primary text-primary-foreground'
            }`}
          >
            {cupon.sigla?.slice(0, 4) ?? cupon.convenio.slice(0, 4)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-sm font-semibold">{cupon.convenio}</p>
              <Badge
                className={`shrink-0 text-[10px] ${
                  activo
                    ? 'bg-emerald-500 text-white'
                    : proximo
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      : 'bg-primary/10 text-primary'
                }`}
              >
                {activo ? 'Activo en tu cuenta' : proximo ? 'En firma' : `${cupon.porcentaje}% off`}
              </Badge>
            </div>
            {cupon.cobertura && (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="h-2.5 w-2.5" />
                {cupon.cobertura}
                {cupon.matriculados && (
                  <>
                    {' · '}
                    <Users className="h-2.5 w-2.5" />
                    {cupon.matriculados.toLocaleString('es-AR')} matriculados
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        {cupon.descripcion && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {cupon.descripcion}
          </p>
        )}

        {cupon.beneficios && cupon.beneficios.length > 0 && (
          <ul role="list" className="space-y-1 text-[11px]">
            {cupon.beneficios.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
          <div className="text-[10px] text-muted-foreground">
            Código: <span className="font-mono font-semibold">{cupon.codigo}</span>
            {cupon.vigenciaHasta && (
              <>
                {' · '}vence {new Date(cupon.vigenciaHasta).toLocaleDateString('es-AR')}
              </>
            )}
          </div>
          <div className="flex gap-2">
            {cupon.sitioWeb && (
              <Button size="sm" variant="ghost" asChild>
                <a href={cupon.sitioWeb} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3" />
                  Sitio
                </a>
              </Button>
            )}
            {activo ? (
              <Button size="sm" variant="outline" onClick={onRemover}>
                Quitar
              </Button>
            ) : proximo ? (
              <Button size="sm" disabled variant="outline">
                <Sparkles className="h-3 w-3" />
                En firma
              </Button>
            ) : (
              <Button size="sm" onClick={onAplicar}>
                Aplicar convenio
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
