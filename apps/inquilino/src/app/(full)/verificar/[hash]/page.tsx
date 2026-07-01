import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Isotipo } from '@/components/isotipo';
import {
  NIVEL_COLOR,
  NIVEL_LABEL,
  buscarCertificadoPorHash,
  generarCertificado,
} from '@/lib/certificado-inquilino';
import { formatFecha, formatMonto } from '@/lib/format';
import { VerificadoFecha } from './verificado-fecha';

// Mismo criterio que `apiEnabled` de '@/lib/api/client', pero calculado acá
// para no importar un módulo 'use client' dentro de este server component.
// `NEXT_PUBLIC_API_URL` se inlinea en build, así que es una constante segura
// incluso con static export (generateStaticParams + dynamicParams=false).
const API_HABILITADO = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '').length > 0;

/**
 * Página pública (sin auth) que verifica un certificado de inquilino.
 *
 * Flow:
 *  1. El inquilino lleva el link a una inmobiliaria nueva.
 *  2. La inmo abre la URL desde su celular o computadora.
 *  3. Esta página carga, valida el hash y muestra los datos verificados.
 *
 * Si el hash no matchea con el formato esperado, redirigimos a 404.
 *
 * En la demo, todos los hashes válidos (formato XXXX-XXXX-XXXX) devuelven
 * el certificado del inquilino mock. En producción, esto consulta el
 * datawarehouse de My Alquiler con el hash como key.
 */
export function generateStaticParams() {
  // Pre-renderizamos el hash del certificado del inquilino mock para que
  // el link compartido tenga una página estática lista.
  // generarCertificado() funciona en SSR porque maneja typeof window.
  const cert = generarCertificado();
  return [{ hash: cert.hash }];
}

export const dynamicParams = process.env.STATIC_EXPORT !== '1';

export default function VerificarCertificadoPage({
  params,
}: {
  params: { hash: string };
}) {
  // En producción no hay endpoint público para resolver un certificado por
  // hash: buscarCertificadoPorHash() regenera el certificado del inquilino
  // mock (nombre + DNI + dirección + inmobiliaria) para CUALQUIER hash válido.
  // Exponer eso filtraría PII de un inquilino demo a cualquiera con el link.
  // Mostramos un estado neutro hasta que exista verificación real contra el
  // datawarehouse de My Alquiler.
  if (API_HABILITADO) {
    return (
      <main className="min-h-screen bg-muted/20 p-4 md:p-8">
        <div className="mx-auto max-w-2xl space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Isotipo size={32} />
              <div>
                <p className="text-sm font-semibold leading-tight">My Alquiler</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Verificación de certificado
                </p>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <ArrowLeft className="h-3 w-3" />
                Cerrar
              </Link>
            </Button>
          </div>

          <Card>
            <CardContent className="space-y-4 p-8 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">
                  Certificado no disponible
                </p>
                <p className="text-sm text-muted-foreground">
                  No pudimos verificar este certificado en línea. Pedile al
                  inquilino que lo regenere desde su app, o verificá los datos
                  directamente con la inmobiliaria.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="pt-2 text-center text-[10px] text-muted-foreground">
            My Alquiler · myalquiler.com.ar
          </div>
        </div>
      </main>
    );
  }

  const cert = buscarCertificadoPorHash(params.hash);
  if (!cert) notFound();

  const validoTodavia = new Date(cert.validoHasta).getTime() > Date.now();

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-5">
        {/* Header con marca My Alquiler */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Isotipo size={32} />
            <div>
              <p className="text-sm font-semibold leading-tight">My Alquiler</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Verificación de certificado
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="h-3 w-3" />
              Cerrar
            </Link>
          </Button>
        </div>

        {/* Banner de validez */}
        {validoTodavia ? (
          <Card className="border-emerald-300 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-900/15">
            <CardContent className="flex items-start gap-3 p-4">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                  Certificado válido
                </p>
                <p className="text-xs text-emerald-900/80 dark:text-emerald-200/80">
                  Verificado el <VerificadoFecha />. Vigencia hasta{' '}
                  {formatFecha(cert.validoHasta)}.
                </p>
              </div>
              <Badge className="ml-auto bg-emerald-500 text-white">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Válido
              </Badge>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="flex items-start gap-3 p-4">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-destructive">Certificado vencido</p>
                <p className="text-xs text-muted-foreground">
                  Este certificado expiró el {formatFecha(cert.validoHasta)}. Pediselo
                  al inquilino regenerado.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card del nivel */}
        <Card className="overflow-hidden">
          <div className={`flex items-center gap-3 p-5 ${NIVEL_COLOR[cert.nivel]}`}>
            <BadgeCheck className="h-8 w-8" />
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wide opacity-90">
                Nivel del historial
              </p>
              <p className="text-2xl font-bold leading-tight md:text-3xl">
                {NIVEL_LABEL[cert.nivel]}
              </p>
              <p className="text-xs opacity-95">{cert.nivelDetalle}</p>
            </div>
          </div>
        </Card>

        {/* Datos del inquilino */}
        <Card>
          <CardContent className="space-y-4 p-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Inquilino verificado
              </p>
              <p className="mt-1 text-lg font-bold leading-tight">{cert.inquilino.nombre}</p>
              <p className="text-xs text-muted-foreground">DNI {cert.inquilino.dni}</p>
            </div>

            <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1.5">
              <p className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-3 w-3 text-muted-foreground" />
                <span>
                  Vive en{' '}
                  <strong className="text-foreground">
                    {cert.contratoActual.direccion}
                  </strong>
                </span>
              </p>
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Desde {formatFecha(cert.contratoActual.fechaInicio)} ·{' '}
                {cert.contratoActual.mesesCumplidos} meses de inquilino
              </p>
              <p className="text-muted-foreground">
                Administrado por <strong className="text-foreground">{cert.contratoActual.inmobiliaria}</strong>
              </p>
              <p className="text-muted-foreground">
                Alquiler vigente:{' '}
                <strong className="text-foreground tabular-nums">
                  {formatMonto(cert.contratoActual.montoMensual, cert.contratoActual.moneda)}
                </strong>{' '}
                / mes
              </p>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-3">
              <Metric
                grande
                label="Al día"
                valor={`${cert.historial.cuotasAlDia}`}
                sub={`de ${cert.historial.cuotasTotales} cuotas`}
                accent="emerald"
              />
              <Metric
                grande
                label="Atraso prom."
                valor={`${cert.historial.atrasoPromedioDias}d`}
                accent={cert.historial.atrasoPromedioDias === 0 ? 'emerald' : 'amber'}
              />
              <Metric
                grande
                label="Rechazados"
                valor={`${cert.historial.pagosRechazados}`}
                accent={cert.historial.pagosRechazados === 0 ? 'emerald' : 'red'}
              />
            </div>

            <div className="rounded-md border bg-muted/20 p-3 text-[11px] text-muted-foreground">
              <p>
                Calificación que el inquilino le dio a los profesionales de
                mantenimiento (proxy de &ldquo;cuida la propiedad&rdquo;):{' '}
                <strong className="text-foreground">
                  {cert.historial.ratingPromedio} / 5 ★
                </strong>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Hash + sello */}
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Código del certificado
            </p>
            <p className="font-mono text-xl font-bold tabular-nums">{cert.hash}</p>
            <p className="text-[11px] text-muted-foreground">
              Generado por My Alquiler el {formatFecha(cert.generadoAt)}. Este
              dato es verificable cruzando con nuestro datawarehouse.
            </p>
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs dark:border-amber-900/40 dark:bg-amber-900/10">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
          <p className="text-amber-900 dark:text-amber-200">
            Este certificado reemplaza al garante en la mayoría de las
            inmobiliarias. La decisión final sobre alquilar la propiedad sigue
            siendo del agente. El sello My Alquiler garantiza la veracidad de
            los datos de historial — no garantiza el pago futuro.
          </p>
        </div>

        <div className="pt-2 text-center text-[10px] text-muted-foreground">
          My Alquiler · myalquiler.com.ar · Si esta página tarda en cargar, el
          link puede estar mal copiado.
        </div>
      </div>
    </main>
  );
}

function Metric({
  label,
  valor,
  sub,
  accent,
  grande,
}: {
  label: string;
  valor: string;
  sub?: string;
  accent?: 'emerald' | 'amber' | 'red';
  grande?: boolean;
}) {
  return (
    <div className="rounded-md border bg-card p-3 text-center">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`${grande ? 'text-2xl' : 'text-base'} font-bold tabular-nums ${
          accent === 'emerald'
            ? 'text-emerald-700 dark:text-emerald-300'
            : accent === 'amber'
              ? 'text-amber-700 dark:text-amber-300'
              : accent === 'red'
                ? 'text-red-700 dark:text-red-300'
                : ''
        }`}
      >
        {valor}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
