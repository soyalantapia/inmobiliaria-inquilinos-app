'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Download,
  MapPin,
  MessageCircle,
  Printer,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { toast } from '@llave/ui/use-toast';
import {
  NIVEL_COLOR,
  NIVEL_LABEL,
  generarCertificado,
  type CertificadoInquilino,
} from '@/lib/certificado-inquilino';
import { formatFecha, formatFechaCorta, formatMonto, parseLocal } from '@/lib/format';
import { imprimirCertificado } from './imprimible';

/**
 * Certificado de inquilino · "reemplazo del garante".
 *
 * Lo que ve el inquilino al entrar a /certificado:
 *  - Card grande con su nivel (EXCELENTE / BUENO / REGULAR / NUEVO)
 *  - Métricas del historial (cuotas al día, atraso promedio, rating)
 *  - Botones para descargar el PDF, copiar el link de verificación
 *    y compartir por WhatsApp
 *
 * Cuando el inquilino se muda y se postula a otro inmueble, le pasa
 * el link de verificación a la nueva inmo. Esa inmo lo abre, valida
 * los datos y se ahorra pedir garante.
 */
export default function CertificadoInquilinoPage() {
  const [hidratado, setHidratado] = useState(false);
  const [certificado, setCertificado] = useState<CertificadoInquilino | null>(null);

  useEffect(() => {
    setCertificado(generarCertificado());
    setHidratado(true);
  }, []);

  const validoHastaTexto = useMemo(
    () => (certificado ? formatFecha(certificado.validoHasta) : ''),
    [certificado],
  );

  // Cuántos días faltan para que venza el certificado — para el banner
  // de renovación cuando se acerca el vencimiento.
  const diasHastaVencer = useMemo(() => {
    if (!certificado) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vence = parseLocal(certificado.validoHasta);
    return Math.ceil((vence.getTime() - hoy.getTime()) / 86400000);
  }, [certificado]);

  // Cuando el nivel es bajo (REGULAR), el certificado JUEGA EN CONTRA si lo
  // mostrás a otra inmo. Mostramos coaching en lugar de un CTA grande de
  // compartir — primero regularizá, después compartís con orgullo.
  const nivelBajo = certificado?.nivel === 'REGULAR';

  if (!hidratado || !certificado) return null;

  const copiar = async (texto: string, label: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast({ title: `${label} copiado`, description: 'Pegalo donde lo necesites.' });
    } catch {
      toast({ title: 'No pudimos copiar', variant: 'destructive' });
    }
  };

  const compartirWhatsApp = () => {
    const texto = [
      `Hola! 👋 Te paso mi certificado de inquilino al día (My Alquiler).`,
      ``,
      `Verificalo acá:`,
      certificado.urlVerificacion,
      ``,
      `Código: ${certificado.hash}`,
      `Válido hasta ${validoHastaTexto}.`,
    ].join('\n');
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank', 'noopener');
  };

  return (
    <>
      <header className="flex items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/cuenta" aria-label="Volver">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">Mi certificado</h1>
        </div>
        <ShieldCheck className="h-5 w-5 text-emerald-600" />
      </header>

      <main className="flex-1 space-y-5 px-5 pb-8">
        {/* Explicación */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="space-y-1">
              <p className="font-semibold">¿Para qué sirve?</p>
              <p className="text-xs text-muted-foreground">
                Si te mudás, llevá este certificado a la nueva inmobiliaria.
                Te ahorrás presentar garante: el certificado prueba con datos
                verificables que estás al día. La inmo lo valida en 5 segundos
                abriendo el link.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Banner de coaching cuando el nivel está bajo. El certificado en
            "Regular" juega EN CONTRA del inquilino: la inmo destino lo abre
            y ve un historial flojo. Mejor avisar y mostrar cómo mejorarlo
            antes de invitarlo a compartir. */}
        {nivelBajo && (
          <Card className="border-amber-300 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-900/10">
            <CardContent className="space-y-3 p-4 text-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="space-y-1">
                  <p className="font-semibold">
                    Antes de compartir, mejorá tu nivel
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Hoy tu certificado está en{' '}
                    <strong>{NIVEL_LABEL[certificado.nivel]}</strong>. Si una
                    inmobiliaria lo abre, va a ver un historial flojo y puede
                    pedirte garante igual. Regularizá los pagos y volvé a
                    generarlo cuando suba el nivel.
                  </p>
                </div>
              </div>
              <Link
                href="/"
                className="flex items-center justify-between gap-2 rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
              >
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Ir a regularizar mis pagos
                </span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Banner "Vence pronto" — cuando el certificado tiene ≤ 7 días
            antes de expirar. Le da al inquilino la oportunidad de regenerar
            uno nuevo antes de necesitarlo en una postulación. */}
        {diasHastaVencer !== null &&
          diasHastaVencer > 0 &&
          diasHastaVencer <= 7 && (
            <Card className="border-amber-300 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10">
              <CardContent className="flex items-center gap-3 p-3 text-xs">
                <Clock className="h-4 w-4 shrink-0 text-amber-700" />
                <p className="flex-1">
                  Tu certificado vence en{' '}
                  <strong>
                    {diasHastaVencer} día{diasHastaVencer === 1 ? '' : 's'}
                  </strong>
                  . Regenerá uno nuevo cuando lo necesites — los datos se
                  toman al instante.
                </p>
              </CardContent>
            </Card>
          )}

        {/* Hero del certificado */}
        <Card className="overflow-hidden">
          <div
            className={`flex items-center gap-3 p-4 ${NIVEL_COLOR[certificado.nivel]}`}
          >
            <BadgeCheck className="h-7 w-7" />
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wide opacity-80">
                Nivel del historial
              </p>
              <p className="text-2xl font-bold leading-tight">
                {NIVEL_LABEL[certificado.nivel]}
              </p>
              <p className="text-[11px] opacity-95">{certificado.nivelDetalle}</p>
            </div>
          </div>
          <CardContent className="space-y-3 p-5">
            <div className="space-y-1">
              <p className="text-base font-semibold leading-tight">
                {certificado.inquilino.nombre}
              </p>
              <p className="text-xs text-muted-foreground">
                DNI {certificado.inquilino.dni}
              </p>
            </div>

            <div className="space-y-1 rounded-md bg-muted/30 p-3 text-xs">
              <p className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-3 w-3 text-muted-foreground" />
                <span>
                  Inquilino actual en{' '}
                  <strong className="text-foreground">
                    {certificado.contratoActual.direccion}
                  </strong>
                </span>
              </p>
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Desde {formatFechaCorta(certificado.contratoActual.fechaInicio)} ·{' '}
                {certificado.contratoActual.mesesCumplidos} meses cumplidos
              </p>
              <p className="text-muted-foreground">
                Administra {certificado.contratoActual.inmobiliaria} ·{' '}
                {formatMonto(certificado.contratoActual.montoMensual, certificado.contratoActual.moneda)}{' '}
                / mes
              </p>
            </div>

            {/* Métricas con sub-texto explicativo — antes solo aparecía el
                valor sin contexto ("0/2", "4d", "4.7★") y el inquilino no
                entendía qué medía cada cosa. */}
            <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs">
              <Metric
                label="Cuotas al día"
                valor={`${certificado.historial.cuotasAlDia}/${certificado.historial.cuotasTotales}`}
                sub="pagadas en término"
                accent="emerald"
              />
              <Metric
                label="Atraso prom."
                valor={`${certificado.historial.atrasoPromedioDias}`}
                sub="días promedio"
                accent={certificado.historial.atrasoPromedioDias === 0 ? 'emerald' : 'amber'}
              />
              <Metric
                label="Cuidado"
                valor={`${certificado.historial.ratingPromedio}★`}
                sub="rating del hogar"
                accent="emerald"
              />
            </div>
          </CardContent>
        </Card>

        {/* Hash + verificación */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Código del certificado
                </p>
                <p className="font-mono text-lg font-bold tabular-nums">
                  {certificado.hash}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copiar(certificado.hash, 'Código')}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            {/* Link compacto: en mobile el host completo
                (http://localhost:3000/verificar/HASH o myalquiler.com.ar/...)
                ocupa demasiado espacio. Mostramos solo "verificar/HASH" como
                preview pero el link copiado/compartido es el completo. */}
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Link de verificación
              </p>
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
                <p className="flex-1 truncate font-mono text-[11px]">
                  {(() => {
                    const u = certificado.urlVerificacion;
                    const idx = u.indexOf('/verificar/');
                    return idx >= 0 ? `…${u.slice(idx)}` : u;
                  })()}
                </p>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => copiar(certificado.urlVerificacion, 'Link')}
                  aria-label="Copiar link"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Check className="h-2.5 w-2.5" />
              Válido hasta {validoHastaTexto}
            </Badge>
          </CardContent>
        </Card>

        {/* Acciones.
            Si el nivel está bajo, el CTA principal NO es "Compartir por
            WhatsApp" en verde grande: bajamos el botón a outline para no
            invitar a hacerlo. El coaching arriba ya redirige a regularizar. */}
        <div className="space-y-2">
          <Button
            size="xl"
            className={
              nivelBajo
                ? 'w-full'
                : 'w-full bg-emerald-600 text-white hover:bg-emerald-700'
            }
            variant={nivelBajo ? 'outline' : 'default'}
            onClick={compartirWhatsApp}
          >
            <MessageCircle className="h-5 w-5" />
            {nivelBajo ? 'Compartir igual' : 'Compartir por WhatsApp'}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => imprimirCertificado(certificado)}
            >
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => copiar(certificado.urlVerificacion, 'Link')}
            >
              <Download className="h-4 w-4" />
              Copiar link
            </Button>
          </div>
        </div>

        {/* Footer explicativo */}
        <div className="rounded-md border bg-muted/30 p-3 text-[11px] text-muted-foreground">
          <p>
            <strong className="text-foreground">¿Cómo lo verifica la inmobiliaria?</strong>
          </p>
          <ol className="mt-1 space-y-0.5">
            <li>1. Abre el link o escanea el QR.</li>
            <li>2. Ve tus datos verificados y el nivel del historial.</li>
            <li>3. Decide si te alquila sin pedir garante.</li>
          </ol>
          <p className="mt-2">
            Tus datos sensibles (CBU, comprobantes) NO se exponen en el link
            público. Sólo el resumen verificable.
          </p>
        </div>
      </main>
    </>
  );
}

function Metric({
  label,
  valor,
  sub,
  accent,
}: {
  label: string;
  valor: string;
  sub?: string;
  accent?: 'emerald' | 'amber';
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`text-sm font-bold tabular-nums ${
          accent === 'emerald'
            ? 'text-emerald-700 dark:text-emerald-300'
            : accent === 'amber'
              ? 'text-amber-700 dark:text-amber-300'
              : ''
        }`}
      >
        {valor}
      </p>
      {sub && (
        <p className="text-[9px] text-muted-foreground/80 leading-tight">{sub}</p>
      )}
    </div>
  );
}

