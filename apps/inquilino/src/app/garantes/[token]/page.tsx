import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Building2,
  Calendar,
  CalendarDays,
  FileText,
  KeyRound,
  MapPin,
  ShieldCheck,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { Separator } from '@llave/ui/separator';
import { contratoMock, garanteMock, inquilinoActual } from '@/lib/mock-data';
import { diasHastaVencimiento, formatFecha, formatMonto } from '@/lib/format';
import { leerGaranteToken } from '@/lib/garante-token';

// Vista pública read-only para que el garante consulte el estado del contrato
// sin necesidad de cuenta. El token es de un solo uso visual (no hay sesión
// ni datos del garante guardados acá). En backend real validaría firma y
// que el contratoId existe.

const indiceLabel: Record<typeof contratoMock.indiceAjuste, string> = {
  ICL: 'ICL — BCRA',
  IPC: 'IPC — INDEC',
  CASA_PROPIA: 'Casa Propia',
  UVA: 'UVA',
  CAC: 'CAC — Construcción',
  RIPTE: 'RIPTE',
  FIJO: 'Fijo',
};

export default function GarantePublicPage({ params }: { params: { token: string } }) {
  const payload = leerGaranteToken(params.token);
  if (!payload) return notFound();

  // En real, buscaríamos el contrato por payload.contratoId. Acá usamos el mock.
  const c = contratoMock;
  const diasFin = diasHastaVencimiento(c.fechaFin);
  const aniosRestantes = Math.floor(diasFin / 365);
  const mesesRestantes = Math.floor((diasFin % 365) / 30);
  const diasAjuste = diasHastaVencimiento(c.proximoAjuste);
  const expFecha = new Date(payload.exp);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col md:max-w-2xl">
      <header className="border-b bg-muted/30 px-5 py-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Vista compartida · sólo lectura</span>
        </div>
        <h1 className="mt-1 text-lg font-semibold">Estado del contrato</h1>
        <p className="text-xs text-muted-foreground">
          Compartido por {inquilinoActual.nombre} · link vigente hasta {formatFecha(expFecha.toISOString())}
        </p>
      </header>

      <main className="flex-1 space-y-5 px-5 py-6 md:px-8">
        <Card className="space-y-3 p-5">
          <div className="flex items-start gap-3">
            <FileText className="mt-1 h-5 w-5 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Propiedad</p>
              <p className="text-base font-semibold leading-tight">{c.direccion}</p>
              <p className="text-xs text-muted-foreground">
                {c.ciudad} · administra {c.inmobiliaria}
              </p>
            </div>
            <Badge variant="success">Activo</Badge>
          </div>
          <Separator />
          <div>
            <p className="text-xs text-muted-foreground">Alquiler actual</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMonto(c.montoActual, c.moneda)}
            </p>
            <p className="text-xs text-muted-foreground">
              Te quedan {aniosRestantes > 0 ? `${aniosRestantes} año${aniosRestantes === 1 ? '' : 's'} y ` : ''}
              {mesesRestantes} mes{mesesRestantes === 1 ? '' : 'es'} de contrato
            </p>
          </div>
        </Card>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Datos del contrato
          </h2>
          <Card className="divide-y">
            <Row
              icon={<Calendar className="h-4 w-4" />}
              label="Período"
              value={`${formatFecha(c.fechaInicio)} → ${formatFecha(c.fechaFin)}`}
            />
            <Row
              icon={<TrendingUp className="h-4 w-4" />}
              label="Índice de ajuste"
              value={indiceLabel[c.indiceAjuste]}
            />
            <Row
              icon={<CalendarDays className="h-4 w-4" />}
              label="Próximo ajuste"
              value={formatFecha(c.proximoAjuste)}
              hint={`en ${diasAjuste} días`}
            />
            <Row
              icon={<KeyRound className="h-4 w-4" />}
              label="Día de pago"
              value={`Día ${c.diaPago} de cada mes`}
            />
            <Row
              icon={<MapPin className="h-4 w-4" />}
              label="Dirección"
              value={c.direccion}
              hint={c.ciudad}
            />
          </Card>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tu garantía
          </h2>
          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">{garanteMock.nombreProveedor}</p>
              </div>
              <Badge variant="success">Vigente</Badge>
            </div>
            <div className="space-y-1.5 rounded-md border bg-muted/40 p-3 text-xs">
              <GaranteRow label="Tipo" value={garanteMock.tipo} />
              {garanteMock.numeroPoliza && (
                <GaranteRow label="N° de póliza" value={garanteMock.numeroPoliza} />
              )}
              <GaranteRow label="Vigente hasta" value={formatFecha(garanteMock.vigenciaHasta)} />
              <GaranteRow label="Cobertura" value={formatMonto(garanteMock.montoCobertura)} />
              <GaranteRow label="Contacto" value={garanteMock.contactoNombre} />
            </div>
            <p className="text-xs text-muted-foreground">
              Si necesitás dar de baja la garantía o cambiarla, contactá directamente con la
              inmobiliaria.
            </p>
          </Card>
        </section>

        <Card className="space-y-3 border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">¿Dudas sobre el contrato?</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Esta vista es de sólo lectura. Para consultas o documentación adicional, contactá
            directamente con {c.inmobiliaria}.
          </p>
          <Button size="sm" variant="outline" asChild>
            <a href="https://wa.me/541145321100" target="_blank" rel="noreferrer">
              Contactar inmobiliaria
            </a>
          </Button>
        </Card>

        <div className="flex items-center justify-center gap-1 pt-4 text-[11px] text-muted-foreground">
          <UserRound className="h-3 w-3" />
          <span>Llave · vista para garante</span>
          <span>·</span>
          <Link href="/" className="underline-offset-2 hover:underline">
            Conocé Llave
          </Link>
        </div>
      </main>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate font-medium">{value}</p>
        </div>
      </div>
      {hint && <p className="shrink-0 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function GaranteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
