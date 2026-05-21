import {
  Banknote,
  Clock,
  Globe2,
  Handshake,
  Lightbulb,
  MessageCircle,
  Rocket,
  Sparkles,
  ThumbsUp,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Topbar } from '@/components/topbar';
import {
  CATEGORIA_LABEL,
  ESTADO_COLOR,
  ESTADO_LABEL,
  ROADMAP,
  type CategoriaRoadmap,
  type EstadoRoadmap,
} from '@/lib/roadmap-data';

/**
 * Página de roadmap visible para los clientes. Lista los features que
 * vienen agrupados por estado, con badge de cuántos pilotos pidieron
 * cada uno (señal de demanda). En la base de cada card hay un CTA
 * "Pedírmelo cuando salga" que abre WhatsApp con el equipo.
 *
 * Idea de Ramiro: "de acá doce meses, empezamos a cobrar servicios
 * extra". Algunos items están marcados como cobros aparte para
 * sembrar la expectativa.
 */
export default function RoadmapPage() {
  const grupos: Array<{ estado: EstadoRoadmap; titulo: string; sub: string }> = [
    {
      estado: 'ENVIO',
      titulo: 'Recién enviado',
      sub: 'Lanzamos esto en los últimos 30 días.',
    },
    {
      estado: 'EN_DESARROLLO',
      titulo: 'En desarrollo',
      sub: 'Entra en el próximo release (6-8 semanas).',
    },
    {
      estado: 'PROXIMO_TRIMESTRE',
      titulo: 'Próximo trimestre',
      sub: 'Trabajo de diseño hecho, esperando turno.',
    },
    {
      estado: 'EXPLORANDO',
      titulo: 'Explorando',
      sub: 'Ideas que están en investigación. Tu pedido las puede acelerar.',
    },
  ];

  const iconoCategoria: Record<CategoriaRoadmap, React.ComponentType<{ className?: string }>> = {
    COBRANZAS: Banknote,
    CONTRATOS: Handshake,
    CONSORCIOS: Sparkles,
    INTEGRACIONES: Sparkles,
    IA: Lightbulb,
    MULTI_PAIS: Globe2,
    EXPERIENCIA: Rocket,
  };

  const total = ROADMAP.length;
  const enviados = ROADMAP.filter((r) => r.estado === 'ENVIO').length;
  const enDesarrollo = ROADMAP.filter((r) => r.estado === 'EN_DESARROLLO').length;

  return (
    <>
      <Topbar titulo="Roadmap" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lo que viene
          </p>
          <h1 className="text-2xl font-semibold md:text-3xl">Roadmap del producto</h1>
          <p className="text-sm text-muted-foreground">
            Avanzamos rápido y querés saber para dónde vamos. Acá tenés los{' '}
            {total} items que están sobre la mesa. Si querés que aceleremos
            alguno, decínoslo por WhatsApp — tu pedido pesa.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            label="Items totales"
            valor={total.toString()}
            icon={<Sparkles className="h-4 w-4" />}
            tone="muted"
          />
          <Kpi
            label="Enviados (30d)"
            valor={enviados.toString()}
            icon={<ThumbsUp className="h-4 w-4" />}
            tone="emerald"
          />
          <Kpi
            label="En desarrollo"
            valor={enDesarrollo.toString()}
            icon={<Clock className="h-4 w-4" />}
            tone="primary"
          />
          <Kpi
            label="Cobros aparte"
            valor={ROADMAP.filter((r) => r.cobrosAparte).length.toString()}
            icon={<Banknote className="h-4 w-4" />}
            tone="amber"
            hint="Servicios extra que se facturan suelto"
          />
        </div>

        {/* Grupos */}
        {grupos.map((g) => {
          const items = ROADMAP.filter((r) => r.estado === g.estado).sort(
            (a, b) => b.pedidoPor - a.pedidoPor,
          );
          if (items.length === 0) return null;
          return (
            <section key={g.estado} className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-lg font-semibold">{g.titulo}</h2>
                <Badge className={`text-[10px] ${ESTADO_COLOR[g.estado]}`}>
                  {items.length} item{items.length === 1 ? '' : 's'}
                </Badge>
                <p className="text-xs text-muted-foreground">{g.sub}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((item) => {
                  const Icon = iconoCategoria[item.categoria];
                  return (
                    <Card key={item.id}>
                      <CardContent className="space-y-3 p-5">
                        <div className="flex items-start gap-3">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className="text-[10px]">
                                {CATEGORIA_LABEL[item.categoria]}
                              </Badge>
                              {item.cobrosAparte && (
                                <Badge className="bg-amber-100 text-[10px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                  + servicio extra
                                </Badge>
                              )}
                              {item.trimestreObjetivo && (
                                <Badge variant="outline" className="text-[10px]">
                                  {item.trimestreObjetivo}
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-sm font-semibold leading-tight">
                              {item.titulo}
                            </p>
                          </div>
                        </div>

                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {item.resumen}
                        </p>
                        {item.detalle && (
                          <p className="rounded-md border-l-2 border-muted-foreground/30 bg-muted/30 p-2 text-[11px] italic text-muted-foreground">
                            {item.detalle}
                          </p>
                        )}

                        <div className="flex items-center justify-between border-t pt-2">
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <ThumbsUp className="h-3 w-3" />
                            <span>
                              <strong className="text-foreground">{item.pedidoPor}</strong>{' '}
                              piloto{item.pedidoPor === 1 ? '' : 's'} lo pidieron
                            </span>
                          </div>
                          {item.estado !== 'ENVIO' && (
                            <Button asChild size="sm" variant="ghost" className="h-7 text-[11px]">
                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(`Hola! Me gustaría ver más rápido el feature "${item.titulo}" del roadmap.`)}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <MessageCircle className="h-3 w-3" />
                                Pedir
                              </a>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Footer con CTA */}
        <Card className="border-violet-200 bg-gradient-to-br from-violet-50/60 to-primary/5 dark:border-violet-900/40 dark:from-violet-900/15">
          <CardContent className="flex flex-wrap items-center gap-4 p-5">
            <div className="flex-1 min-w-0">
              <p className="font-semibold">¿Tenés una idea que no está acá?</p>
              <p className="text-xs text-muted-foreground">
                Contanos por WhatsApp lo que necesitás. Las ideas que más se
                piden las priorizamos arriba de todo.
              </p>
            </div>
            <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
              <a
                href="https://wa.me/?text=Hola%21%20Quiero%20proponer%20una%20idea%20para%20el%20roadmap%20de%20My%20Alquiler."
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="h-4 w-4" />
                Sumar una idea
              </a>
            </Button>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function Kpi({
  label,
  valor,
  icon,
  tone,
  hint,
}: {
  label: string;
  valor: string;
  icon: React.ReactNode;
  tone: 'primary' | 'emerald' | 'amber' | 'muted';
  hint?: string;
}) {
  const tones = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    muted: 'bg-muted text-muted-foreground',
  };
  return (
    <Card className="space-y-2 p-4">
      <div className={`inline-grid h-8 w-8 place-items-center rounded-md ${tones[tone]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-semibold tabular-nums md:text-2xl">{valor}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}
