'use client';

import { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  CreditCard,
  FileText,
  KeyRound,
  MessageCircle,
  PawPrint,
  Search,
  Sparkles,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { Input } from '@llave/ui/input';
import { NavBar } from '@/components/nav-bar';

interface FaqItem {
  id: string;
  pregunta: string;
  respuesta: string;
  categoria: string;
}

interface Categoria {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

const CATEGORIAS: Categoria[] = [
  { key: 'pagos', label: 'Pagos', icon: CreditCard, color: 'bg-primary/10 text-primary' },
  { key: 'contrato', label: 'Contrato', icon: FileText, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { key: 'aumentos', label: 'Aumentos', icon: TrendingUp, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { key: 'garantia', label: 'Garantía', icon: KeyRound, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  { key: 'mascotas', label: 'Mascotas', icon: PawPrint, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
  { key: 'reclamos', label: 'Reclamos', icon: Wrench, color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300' },
];

const FAQS: FaqItem[] = [
  {
    id: 'pagos-1',
    pregunta: '¿Cómo pago el alquiler?',
    respuesta:
      'Desde la pestaña Pagos, tocás en el monto que aparece arriba. Te llevamos al detalle con CBU/Alias, copiás los datos, hacés la transferencia desde tu home banking y subís el comprobante.',
    categoria: 'pagos',
  },
  {
    id: 'pagos-2',
    pregunta: '¿Qué pasa si me atraso?',
    respuesta:
      'Se generan punitorios diarios sobre el monto original (tasa según contrato, típicamente 0.15% por día). Lo ves en tiempo real en el hero de Pagos: cuánto sumás por día más que pase.',
    categoria: 'pagos',
  },
  {
    id: 'pagos-3',
    pregunta: '¿Tardan en validar mi comprobante?',
    respuesta:
      'Entre 24 y 48 horas hábiles. Mientras tanto pausamos los punitorios. Te avisamos por WhatsApp cuando esté confirmado.',
    categoria: 'pagos',
  },
  {
    id: 'contrato-1',
    pregunta: '¿Dónde veo mi contrato firmado?',
    respuesta:
      'En la pestaña Contrato podés ver todos los datos y descargar el PDF firmado. Si no aparece, escribile a la inmobiliaria.',
    categoria: 'contrato',
  },
  {
    id: 'contrato-2',
    pregunta: '¿Qué es el Asistente?',
    respuesta:
      'Es una IA que leyó tu contrato y te responde preguntas al instante. Cita las cláusulas exactas. Si la pregunta es legal compleja te deriva a la inmobiliaria.',
    categoria: 'contrato',
  },
  {
    id: 'aumentos-1',
    pregunta: '¿Cada cuánto me aumentan?',
    respuesta:
      'Depende de tu contrato. La mayoría son cada 12 meses ajustando por ICL (Índice de Contratos de Locación del BCRA). En tu pestaña Contrato ves el próximo ajuste y el índice que aplica.',
    categoria: 'aumentos',
  },
  {
    id: 'aumentos-2',
    pregunta: '¿Puedo negociar el aumento?',
    respuesta:
      'El ajuste por índice no se negocia, está fijado por contrato. Si estás cerca de la renovación sí podés negociar el nuevo contrato completo.',
    categoria: 'aumentos',
  },
  {
    id: 'garantia-1',
    pregunta: '¿Cuándo me devuelven el depósito?',
    respuesta:
      'Al finalizar el contrato y entregar las llaves. Si no hay daños ni deudas, te lo devuelven actualizado por el último alquiler pagado.',
    categoria: 'garantia',
  },
  {
    id: 'garantia-2',
    pregunta: '¿Puedo cambiar de garante?',
    respuesta:
      'Sí, pero necesitás autorización de la inmobiliaria. El nuevo garante tiene que pasar el screening crediticio. Te conviene avisar con tiempo.',
    categoria: 'garantia',
  },
  {
    id: 'mascotas-1',
    pregunta: '¿Puedo tener mascotas?',
    respuesta:
      'Depende de tu contrato. En general se permiten perros y gatos hasta cierto peso. Preguntale al Asistente que te cita la cláusula 9 si está habilitado.',
    categoria: 'mascotas',
  },
  {
    id: 'reclamos-1',
    pregunta: '¿Qué hago si se rompe algo?',
    respuesta:
      'Entrá a Reclamos → Nuevo. Elegís categoría (plomería, electricidad, etc.), sacás una foto, contás brevemente qué pasa, y marcás la urgencia. La inmobiliaria recibe el aviso al instante.',
    categoria: 'reclamos',
  },
  {
    id: 'reclamos-2',
    pregunta: '¿Quién paga las reparaciones?',
    respuesta:
      'Las reparaciones por uso normal y desgaste las paga el propietario. Los daños por mal uso o accidente son del inquilino. La cláusula 11 lo detalla.',
    categoria: 'reclamos',
  },
];

const GLOSARIO = [
  {
    termino: 'ICL',
    definicion:
      'Índice de Contratos de Locación. Lo publica el BCRA y se usa para ajustar alquileres anualmente. Es un promedio entre el IPC y la variación salarial.',
  },
  {
    termino: 'IPC',
    definicion:
      'Índice de Precios al Consumidor. Lo publica el INDEC y mide la inflación general. Algunos contratos lo usan para ajustar.',
  },
  {
    termino: 'UVA',
    definicion:
      'Unidad de Valor Adquisitivo. Se actualiza por inflación y se usa en algunos contratos modernos o créditos hipotecarios.',
  },
  {
    termino: 'Casa Propia',
    definicion:
      'Índice oficial del gobierno argentino para ajuste de alquileres. Usa el menor valor entre IPC y salarios.',
  },
  {
    termino: 'Garante / Garantía propietaria',
    definicion:
      'Persona o póliza que se compromete a cubrir tu alquiler si no podés pagarlo. Puede ser un familiar con propiedad o una garantía digital.',
  },
  {
    termino: 'Punitorios',
    definicion:
      'Intereses diarios que se suman al alquiler por cada día de atraso. La tasa está en el contrato.',
  },
  {
    termino: 'Depósito',
    definicion:
      'Suma equivalente a 1 mes de alquiler que pagás al inicio. Se devuelve al final del contrato si no hay daños ni deudas, actualizada al último valor del alquiler.',
  },
  {
    termino: 'Expensas',
    definicion:
      'Costo mensual de mantenimiento del edificio (limpieza, luz común, encargado, etc.). Lo paga el inquilino salvo que el contrato diga otra cosa.',
  },
];

export default function AyudaPage() {
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return FAQS.filter((f) => {
      if (categoria && f.categoria !== categoria) return false;
      if (!term) return true;
      return (
        f.pregunta.toLowerCase().includes(term) ||
        f.respuesta.toLowerCase().includes(term)
      );
    });
  }, [busqueda, categoria]);

  const glosarioFiltrado = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return GLOSARIO;
    return GLOSARIO.filter(
      (g) =>
        g.termino.toLowerCase().includes(term) || g.definicion.toLowerCase().includes(term),
    );
  }, [busqueda]);

  return (
    <>
      <header className="p-5">
        <h1 className="text-2xl font-semibold md:text-3xl">¿En qué te ayudamos?</h1>
        <p className="text-sm text-muted-foreground">
          Buscá una pregunta o revisá las categorías.
        </p>
      </header>

      <main className="flex-1 space-y-6 px-5 pb-6 md:px-8">
        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar en ayuda"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Ej: aumento, mascotas, depósito..."
            className="h-12 pl-9 text-base"
          />
        </div>

        {/* Categorías */}
        {!busqueda && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Categorías
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIAS.map((c) => {
                const Icon = c.icon;
                const activo = categoria === c.key;
                const count = FAQS.filter((f) => f.categoria === c.key).length;
                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setCategoria(activo ? null : c.key)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-colors',
                      activo
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-primary/40',
                    )}
                  >
                    <div className={cn('grid h-9 w-9 place-items-center rounded-full', c.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-medium">{c.label}</span>
                    <span className="text-[10px] text-muted-foreground">{count}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Banner si hay filtro */}
        {(categoria || busqueda) && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {filtradas.length} resultado{filtradas.length === 1 ? '' : 's'}
              {categoria && (
                <>
                  {' '}
                  en <strong>{CATEGORIAS.find((c) => c.key === categoria)?.label}</strong>
                </>
              )}
              {busqueda && (
                <>
                  {' '}
                  para <strong>&ldquo;{busqueda}&rdquo;</strong>
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                setBusqueda('');
                setCategoria(null);
              }}
              className="font-medium text-primary hover:underline"
            >
              Limpiar
            </button>
          </div>
        )}

        {/* FAQ accordion */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Preguntas frecuentes
          </h2>
          {filtradas.length === 0 ? (
            <Card>
              <CardContent className="space-y-2 p-8 text-center text-muted-foreground">
                <BookOpen className="mx-auto h-8 w-8" />
                <p className="font-medium text-foreground">Sin resultados</p>
                <p className="text-sm">Probá con otras palabras o preguntale al Asistente.</p>
                <Button asChild size="sm" className="mt-2">
                  <a href="/broker">
                    <Sparkles className="h-3.5 w-3.5" />
                    Abrir Asistente
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="divide-y">
              {filtradas.map((f) => {
                const expandido = abierto === f.id;
                return (
                  <div key={f.id}>
                    <button
                      type="button"
                      onClick={() => setAbierto(expandido ? null : f.id)}
                      aria-expanded={expandido}
                      aria-controls={`faq-respuesta-${f.id}`}
                      className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/40"
                    >
                      <span className="flex-1 text-sm font-medium">{f.pregunta}</span>
                      <ChevronDown
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                          expandido && 'rotate-180',
                        )}
                        aria-hidden="true"
                      />
                    </button>
                    {expandido && (
                      <div
                        id={`faq-respuesta-${f.id}`}
                        className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground animate-fade-in"
                      >
                        {f.respuesta}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          )}
        </section>

        {/* Glosario */}
        {glosarioFiltrado.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Glosario
              </h2>
              <Badge variant="secondary">{glosarioFiltrado.length}</Badge>
            </div>
            <Card className="divide-y">
              {glosarioFiltrado.map((g) => (
                <TerminoRow key={g.termino} termino={g.termino} definicion={g.definicion} />
              ))}
            </Card>
          </section>
        )}

        {/* CTA al Broker / inmo */}
        <Card className="space-y-3 border-primary/20 bg-primary/5 p-5 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <p className="font-medium">¿No encontrás lo que buscás?</p>
          <p className="text-sm text-muted-foreground">
            El Asistente entiende preguntas en lenguaje natural y cita tu contrato.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <a href="/broker">
                <Sparkles className="h-4 w-4" />
                Preguntale al Asistente
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="https://wa.me/541145321100" target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" />
                Hablar con humano
              </a>
            </Button>
          </div>
        </Card>
      </main>

      <NavBar />
    </>
  );
}

// ============================================================
// Termino del glosario — expandible al toque para no saturar.
// ============================================================
function TerminoRow({
  termino,
  definicion,
}: {
  termino: string;
  definicion: string;
}) {
  const [expandido, setExpandido] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setExpandido((v) => !v)}
      className="block w-full p-4 text-left transition-colors hover:bg-muted/40"
    >
      <p className="text-sm font-semibold">{termino}</p>
      <p
        className={`mt-1 text-xs leading-relaxed text-muted-foreground ${
          expandido ? '' : 'line-clamp-1'
        }`}
      >
        {definicion}
      </p>
    </button>
  );
}
