import Link from 'next/link';
import { CalendarClock, MapPin, Sparkles, TrendingUp } from 'lucide-react';
import { Card } from '@llave/ui/card';
import { NavBar } from '@/components/nav-bar';
import { PaymentCard } from '@/components/payment-card';
import { UserMenu } from '@/components/user-menu';
import { contratoMock, liquidacionesMock } from '@/lib/mock-data';
import { diasHastaVencimiento, formatFecha } from '@/lib/format';

export default function HomePage() {
  const pendiente = liquidacionesMock.find((l) => l.estado !== 'PAGADO');
  const ultimosPagos = liquidacionesMock.filter((l) => l.estado === 'PAGADO').slice(0, 3);

  // alerta cuando faltan ≤3 días o está vencido
  const diasV = pendiente ? diasHastaVencimiento(pendiente.fechaVencimiento) : null;
  const alertaPago = diasV !== null && diasV <= 3;

  // alerta de aumento si próximoAjuste está dentro de los próximos 60 días
  const diasAjuste = diasHastaVencimiento(contratoMock.proximoAjuste);
  const alertaAjuste = diasAjuste >= 0 && diasAjuste <= 60;

  return (
    <>
      <header className="p-5">
        <UserMenu />
      </header>

      <main className="flex-1 space-y-6 px-5 pb-6">
        <Card className="animate-fade-in bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-lg shadow-primary/20">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 opacity-80" />
            <div>
              <p className="text-xs opacity-80">Tu hogar</p>
              <p className="font-semibold">{contratoMock.direccion}</p>
              <p className="text-xs opacity-80">{contratoMock.ciudad} · {contratoMock.inmobiliaria}</p>
            </div>
          </div>
        </Card>

        {(alertaPago || alertaAjuste) && (
          <div className="space-y-2 animate-fade-in">
            {alertaPago && pendiente && diasV !== null && (
              <Card className="flex items-start gap-3 border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-900/10">
                <CalendarClock className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    {diasV < 0
                      ? `Atrasaste el pago hace ${Math.abs(diasV)} día${Math.abs(diasV) === 1 ? '' : 's'}`
                      : diasV === 0
                        ? 'Tu alquiler vence hoy'
                        : `Tu alquiler vence en ${diasV} día${diasV === 1 ? '' : 's'}`}
                  </p>
                  <Link
                    href={`/pago/${pendiente.id}`}
                    className="text-xs font-medium text-amber-900 underline dark:text-amber-200"
                  >
                    Pagar ahora
                  </Link>
                </div>
              </Card>
            )}
            {alertaAjuste && (
              <Card className="flex items-start gap-3 border-primary/20 bg-primary/5 p-4 text-sm">
                <TrendingUp className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium">
                    Próximo ajuste el {formatFecha(contratoMock.proximoAjuste)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Índice ICL · faltan {diasAjuste} días
                  </p>
                </div>
              </Card>
            )}
          </div>
        )}

        {pendiente && (
          <section className="space-y-3 animate-fade-in">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              A pagar
            </h2>
            <PaymentCard liquidacion={pendiente} />
          </section>
        )}

        {ultimosPagos.length > 0 ? (
          <section className="space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Últimos pagos
              </h2>
              <Link href="/comprobantes" className="text-xs font-medium text-primary hover:underline">
                Ver todos
              </Link>
            </div>
            <div className="space-y-3">
              {ultimosPagos.map((l) => (
                <PaymentCard key={l.id} liquidacion={l} />
              ))}
            </div>
          </section>
        ) : (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
            <p className="font-medium text-foreground">Todavía no tenés pagos</p>
            <p>Cuando hagas el primero aparece acá.</p>
          </Card>
        )}
      </main>

      <NavBar />
    </>
  );
}
