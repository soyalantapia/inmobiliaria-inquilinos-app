import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Building2,
  Calendar,
  CalendarDays,
  FileText,
  KeyRound,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { Separator } from '@llave/ui/separator';
import { contratoMock, garanteMock, inquilinoActual } from '@/lib/mock-data';
import {
  diasHastaVencimiento,
  formatFechaCorta,
  formatMonto,
} from '@/lib/format';
import { generarGaranteToken, leerGaranteToken } from '@/lib/garante-token';

// Mismo criterio que `apiEnabled` de '@/lib/api/client', pero calculado acá
// para no importar un módulo 'use client' dentro de este server component.
// `NEXT_PUBLIC_API_URL` se inlinea en build, así que es una constante.
const API_HABILITADO = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '').length > 0;

// Para static export pre-generamos un token "demo" válido. En producción
// estos tokens se generan al compartir desde el inquilino — pero como la
// página es 100% lectura de los mocks, el HTML es el mismo para cualquier
// contratoId del demo, así que con uno alcanza.
export function generateStaticParams() {
  // token de larga duración para el contrato del demo
  const tokenDemo = generarGaranteToken(contratoMock.id, 365 * 5);
  return [{ token: tokenDemo }, { token: 'demo' }];
}

export const dynamicParams = false;

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

// Token de demo con expiración lejana — permite visitar /garantes/demo sin
// generar un token real, útil para mostrar la página en una presentación.
const DEMO_PAYLOAD = {
  contratoId: contratoMock.id,
  exp: Date.now() + 365 * 24 * 60 * 60 * 1000 * 5,
};

export default function GarantePublicPage({ params }: { params: { token: string } }) {
  const payload = params.token === 'demo' ? DEMO_PAYLOAD : leerGaranteToken(params.token);
  if (!payload) return notFound();

  // En producción todavía no hay endpoint para resolver un contrato por token
  // de garante: la vista actual lee de los mocks. Mostramos un estado neutro
  // "disponible pronto" en vez de exponer datos falsos de un contrato.
  if (API_HABILITADO) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col md:max-w-2xl">
        <header className="border-b bg-muted/30 px-5 py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Vista compartida · sólo lectura</span>
          </div>
          <h1 className="mt-1 text-lg font-semibold">Estado del contrato</h1>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center px-5 py-12 md:px-8">
          <Card className="w-full max-w-sm space-y-4 p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">Disponible pronto</p>
              <p className="text-sm text-muted-foreground">
                La vista compartida para garantes estará disponible en breve. Para
                consultas sobre el contrato, contactá directamente a la inmobiliaria.
              </p>
            </div>
            <Link
              href="/"
              className="inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              Conocé My Alquiler
            </Link>
          </Card>
        </main>
      </div>
    );
  }

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
          Compartido por {inquilinoActual.nombre} · link vigente hasta {formatFechaCorta(expFecha.toISOString())}
        </p>
      </header>

      <main className="flex-1 space-y-5 px-5 py-6 md:px-8">
        {/* Bloque "¿Qué hacés acá?" — antes el garante abría el link
            y veía datos del contrato sin saber si tenía que firmar,
            aceptar o si era informativo. Diego escribía "¿pero qué
            hago ahora?" a su sobrino. Este bloque pone el contexto
            arriba: sos garante de este contrato (activo), esto es
            informativo, el proceso de aceptación/firma sigue en la
            inmobiliaria. */}
        <Card className="space-y-2 border-primary/30 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <UserRound className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">Sos garante de este contrato</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {inquilinoActual.nombre} te eligió como garante. Esta vista te
                muestra los datos del alquiler que firmó con{' '}
                <strong className="text-foreground">{c.inmobiliaria}</strong>.
                Es informativa — el proceso de aceptación/firma del rol de
                garante sigue directamente con la inmobiliaria.
              </p>
            </div>
          </div>
        </Card>

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
            <p className="text-xs text-muted-foreground">Alquiler mensual</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMonto(c.montoActual, c.moneda)}
            </p>
            {/* POV neutro — antes "Te quedan 2 años…" sonaba raro al
                garante, que no es el inquilino. Ahora "Vence el X·
                Faltan Y" funciona para cualquier lector. */}
            <p className="text-xs text-muted-foreground">
              Vence el {formatFechaCorta(c.fechaFin)} · faltan{' '}
              {aniosRestantes > 0 ? `${aniosRestantes} año${aniosRestantes === 1 ? '' : 's'} y ` : ''}
              {mesesRestantes} mes{mesesRestantes === 1 ? '' : 'es'}
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
              value={`${formatFechaCorta(c.fechaInicio)} → ${formatFechaCorta(c.fechaFin)}`}
            />
            <Row
              icon={<TrendingUp className="h-4 w-4" />}
              label="Índice de ajuste"
              value={indiceLabel[c.indiceAjuste]}
            />
            <Row
              icon={<CalendarDays className="h-4 w-4" />}
              label="Próximo ajuste"
              value={formatFechaCorta(c.proximoAjuste)}
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
          {/* Antes "TU garantía" sugería que el garante había contratado
              la cobertura SUMA. La cobertura es contratada por la
              inmobiliaria/inquilino — Diego (garante personal) no tiene
              nada que ver con ella. Reescrito como "Garantía del
              contrato" + texto explicativo. */}
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Garantía del contrato
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
              <GaranteRow
                label="Vigente hasta"
                value={formatFechaCorta(garanteMock.vigenciaHasta)}
              />
              <GaranteRow label="Cobertura" value={formatMonto(garanteMock.montoCobertura)} />
              <GaranteRow label="Contacto" value={garanteMock.contactoNombre} />
            </div>
            <p className="text-xs text-muted-foreground">
              Esta cobertura la gestiona la inmobiliaria — vos no tenés que
              hacer nada al respecto.
            </p>
          </Card>
        </section>

        <Card className="space-y-3 border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">¿Dudas sobre el contrato?</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Esta vista es de sólo lectura. Para consultas o documentación
            adicional, contactá directamente con {c.inmobiliaria}.
          </p>
          {/* Antes había un solo CTA "Contactar inmobiliaria" sin
              decir si abría WhatsApp / email / teléfono. Ahora 2
              botones explícitos: chat verde (WA) + llamada azul,
              ambos con el número visible. */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              asChild
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <a
                href="https://wa.me/541145321100"
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href="tel:+541145321100">
                <Phone className="h-3.5 w-3.5" />
                Llamar
              </a>
            </Button>
            <span className="self-center text-[11px] text-muted-foreground">
              +54 11 4532-1100
            </span>
          </div>
        </Card>

        {/* Footer completo — antes "Con…" se truncaba. */}
        <div className="flex flex-wrap items-center justify-center gap-1 pt-4 text-[11px] text-muted-foreground">
          <UserRound className="h-3 w-3" />
          <span>My Alquiler · vista para garante · sin cuenta requerida</span>
          <span aria-hidden="true">·</span>
          <Link href="/" className="underline-offset-2 hover:underline">
            Conocé My Alquiler
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
