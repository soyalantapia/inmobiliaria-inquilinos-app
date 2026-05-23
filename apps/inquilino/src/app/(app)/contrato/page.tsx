import Link from 'next/link';
import {
  Building2,
  Calendar,
  CalendarDays,
  Clock,
  Download,
  FileText,
  KeyRound,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { BotonProximamente } from '@/components/boton-proximamente';
import { CompartirGarante } from '@/components/compartir-garante';
import { ContratoChat } from '@/components/contrato-chat';
import { ContratoTimeline } from '@/components/contrato-timeline';
import { DepositoTracker } from '@/components/deposito-tracker';
import { HistorialAjustes } from '@/components/historial-ajustes';
import { NavBar } from '@/components/nav-bar';
import { RenovacionBanner } from '@/components/renovacion-banner';
import { UserMenu } from '@/components/user-menu';
import { contratoMock, garanteMock, inquilinoActual } from '@/lib/mock-data';
import {
  diasHastaVencimiento,
  formatDuracion,
  formatFecha,
  formatMonto,
} from '@/lib/format';

const tipoGaranteLabel: Record<typeof garanteMock.tipo, string> = {
  PROPIETARIA: 'Garantía propietaria',
  CAUCION: 'Caución',
  SUELDO: 'Recibo de sueldo',
  DIGITAL: 'Garantía digital',
};

const indiceLabel: Record<typeof contratoMock.indiceAjuste, string> = {
  ICL: 'ICL — BCRA',
  IPC: 'IPC — INDEC',
  CASA_PROPIA: 'Casa Propia',
  UVA: 'UVA',
  CAC: 'CAC — Construcción',
  RIPTE: 'RIPTE',
  FIJO: 'Fijo',
};

export default function ContratoPage() {
  const c = contratoMock;
  const diasFin = diasHastaVencimiento(c.fechaFin);
  const duracionRestante = formatDuracion(diasFin);
  const diasAjuste = diasHastaVencimiento(c.proximoAjuste);

  return (
    <>
      <header className="p-5 md:hidden">
        <UserMenu />
      </header>

      <main className="flex-1 space-y-5 px-5 pb-6 md:px-8 md:pt-8">
        {/* Header con CTA PDF visible desde el inicio.
            Antes el botón "Descargar PDF" estaba al final del scroll, con lo
            que era invisible para un inquilino que entra a /contrato a
            buscarlo. Ahora vive arriba a la derecha como acción primaria. */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <FileText className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Mi contrato</p>
              <h1 className="truncate text-2xl font-semibold leading-tight md:text-3xl">
                {c.direccion}
              </h1>
              <p className="text-sm text-muted-foreground">
                {c.ciudad} · administra {c.inmobiliaria}
              </p>
            </div>
          </div>
          <BotonProximamente
            variant="outline"
            size="sm"
            className="shrink-0"
            toastTitle="Preparando PDF…"
            toastMessage="En unos segundos te llega al mail una copia del contrato firmado."
          >
            <Download className="h-4 w-4" />
            PDF
          </BotonProximamente>
        </div>

        <RenovacionBanner contratoId={c.id} diasHastaFin={diasFin} />

        <Card className="animate-fade-in space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">Activo</Badge>
            <span className="text-xs text-muted-foreground">
              {formatFecha(c.fechaInicio)} → {formatFecha(c.fechaFin)}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Alquiler actual</p>
            <p className="text-3xl font-semibold">{formatMonto(c.montoActual, c.moneda)}</p>
            <p className="text-xs text-muted-foreground">
              Te quedan {duracionRestante} de contrato
            </p>
          </div>
        </Card>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Datos clave
          </h2>
          <Card className="divide-y">
            <Row
              icon={<Calendar className="h-4 w-4" />}
              label="Día de pago"
              value={`Día ${c.diaPago} de cada mes`}
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
              label="Depósito en garantía"
              value={formatMonto(c.montoActual, c.moneda)}
              hint="1 mes — te lo devuelven al final"
            />
            {/* Quitamos la row de Dirección: ya aparece arriba en el header
                de la página ("Mi contrato · Gorriti 4521…"). */}
          </Card>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Evolución y depósito
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <HistorialAjustes />
            <DepositoTracker depositoOriginal={c.montoActual} fechaFin={c.fechaFin} />
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Línea de tiempo
          </h2>
          <Card className="p-5">
            <ContratoTimeline />
          </Card>
        </section>

        {/* Chat con el contrato: la IA responde dudas comunes citando
            la cláusula exacta. Es transparencia real para el inquilino
            sin obligarlo a leer 30 páginas. Distinto del Broker (/broker):
            acá las respuestas vienen citando el PDF firmado, no es chat
            conversacional general. El título lo enfatiza. */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Buscar en el contrato firmado
          </h2>
          <ContratoChat />
        </section>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Quiénes están en este contrato
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Inmobiliaria
                </p>
              </div>
              <div>
                <p className="font-medium">{c.inmobiliaria}</p>
                <p className="text-xs text-muted-foreground">CUIT 30-71234567-9</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href="https://wa.me/541145321100">
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href="tel:+541145321100">
                    <Phone className="h-3.5 w-3.5" />
                    Llamar
                  </a>
                </Button>
              </div>
            </Card>

            <Card className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Garantía
                  </p>
                </div>
                <Badge variant="success">Vigente</Badge>
              </div>
              <div>
                <p className="font-medium">{garanteMock.nombreProveedor}</p>
                <p className="text-xs text-muted-foreground">
                  {tipoGaranteLabel[garanteMock.tipo]}
                  {garanteMock.numeroPoliza && ` · ${garanteMock.numeroPoliza}`}
                </p>
              </div>
              {/* Resumen compacto: solo cobertura + vencimiento.
                  El "Contacto" del proveedor de garantía no es info que el
                  inquilino necesite ver de entrada — queda implícito en los
                  botones Llamar / Email abajo. */}
              <div className="space-y-1.5 rounded-md border bg-muted/40 p-3 text-xs">
                <GaranteRow
                  icon={<KeyRound className="h-3.5 w-3.5" />}
                  label="Cobertura"
                  value={formatMonto(garanteMock.montoCobertura)}
                />
                <GaranteRow
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Vigente hasta"
                  value={formatFecha(garanteMock.vigenciaHasta)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={`tel:${garanteMock.contactoTelefono.replace(/\s/g, '')}`}>
                    <Phone className="h-3.5 w-3.5" />
                    Llamar
                  </a>
                </Button>
                {garanteMock.contactoEmail && (
                  <Button size="sm" variant="ghost" asChild>
                    <a href={`mailto:${garanteMock.contactoEmail}`}>
                      <Mail className="h-3.5 w-3.5" />
                      Email
                    </a>
                  </Button>
                )}
                <CompartirGarante
                  contratoId={c.id}
                  nombreInquilino={inquilinoActual.nombre}
                  direccion={c.direccion}
                />
              </div>
            </Card>
          </div>
        </section>

      </main>

      <NavBar />
    </>
  );
}

function GaranteRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-medium tabular-nums">{value}</span>
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
    <div className="flex items-start justify-between gap-3 px-5 py-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-medium break-words">{value}</p>
          {hint && (
            <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">{hint}</p>
          )}
        </div>
      </div>
      {hint && (
        <p className="hidden shrink-0 text-xs text-muted-foreground sm:block">
          {hint}
        </p>
      )}
    </div>
  );
}
