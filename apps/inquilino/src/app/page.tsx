import Link from 'next/link';
import { Bell, MapPin } from 'lucide-react';
import { Avatar, AvatarFallback } from '@llave/ui/avatar';
import { Card } from '@llave/ui/card';
import { NavBar } from '@/components/nav-bar';
import { PaymentCard } from '@/components/payment-card';
import { contratoMock, liquidacionesMock } from '@/lib/mock-data';

export default function HomePage() {
  const pendiente = liquidacionesMock.find((l) => l.estado !== 'PAGADO');
  const ultimosPagos = liquidacionesMock.filter((l) => l.estado === 'PAGADO').slice(0, 3);

  return (
    <>
      <header className="flex items-center justify-between p-5">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback className="bg-primary/10 text-primary">M</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs text-muted-foreground">Hola</p>
            <p className="font-semibold">Mariela</p>
          </div>
        </div>
        <button className="rounded-full p-2 hover:bg-muted" aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
        </button>
      </header>

      <main className="flex-1 space-y-6 px-5 pb-6">
        <Card className="bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 opacity-80" />
            <div>
              <p className="text-xs opacity-80">Tu hogar</p>
              <p className="font-semibold">{contratoMock.direccion}</p>
              <p className="text-xs opacity-80">{contratoMock.ciudad} · {contratoMock.inmobiliaria}</p>
            </div>
          </div>
        </Card>

        {pendiente && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">A pagar</h2>
            <PaymentCard liquidacion={pendiente} />
          </section>
        )}

        {ultimosPagos.length > 0 && (
          <section className="space-y-3">
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
        )}
      </main>

      <NavBar />
    </>
  );
}
