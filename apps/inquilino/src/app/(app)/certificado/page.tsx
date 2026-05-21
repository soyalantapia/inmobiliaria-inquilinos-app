'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Check,
  Copy,
  Download,
  MapPin,
  MessageCircle,
  Printer,
  ShieldCheck,
  Sparkles,
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
import { formatFecha, formatMonto } from '@/lib/format';
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
                escaneando el QR o abriendo el link.
              </p>
            </div>
          </CardContent>
        </Card>

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
                Desde {formatFecha(certificado.contratoActual.fechaInicio)} ·{' '}
                {certificado.contratoActual.mesesCumplidos} meses cumplidos
              </p>
              <p className="text-muted-foreground">
                Administra {certificado.contratoActual.inmobiliaria} ·{' '}
                {formatMonto(certificado.contratoActual.montoMensual, certificado.contratoActual.moneda)}{' '}
                / mes
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs">
              <Metric
                label="Cuotas al día"
                valor={`${certificado.historial.cuotasAlDia}/${certificado.historial.cuotasTotales}`}
                accent="emerald"
              />
              <Metric
                label="Atraso prom."
                valor={`${certificado.historial.atrasoPromedioDias}d`}
                accent={certificado.historial.atrasoPromedioDias === 0 ? 'emerald' : 'amber'}
              />
              <Metric
                label="Rating cuidado"
                valor={`${certificado.historial.ratingPromedio}★`}
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
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Link de verificación
              </p>
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
                <p className="flex-1 truncate font-mono text-[11px]">
                  {certificado.urlVerificacion}
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

        {/* Acciones */}
        <div className="space-y-2">
          <Button
            size="xl"
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={compartirWhatsApp}
          >
            <MessageCircle className="h-5 w-5" />
            Compartir por WhatsApp
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
  accent,
}: {
  label: string;
  valor: string;
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
    </div>
  );
}

