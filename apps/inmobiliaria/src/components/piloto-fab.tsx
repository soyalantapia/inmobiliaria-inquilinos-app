'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Bug,
  CheckCircle2,
  Lightbulb,
  Loader2,
  MessageCircle,
  Send,
} from 'lucide-react';
import { Button } from '@llave/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { apiEnabled } from '@/lib/api/client';
import {
  crearReporte,
  esClientePiloto,
  SEVERIDAD_LABEL,
  type SeveridadReporte,
  type TipoReporte,
} from '@/lib/piloto-storage';

const SEV_COLOR: Record<SeveridadReporte, string> = {
  BLOQUEA: 'border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive/20',
  MOLESTO:
    'border-amber-500 bg-amber-50 text-amber-700 ring-2 ring-amber-500/20 dark:bg-amber-900/30 dark:text-amber-300',
  MENOR: 'border-foreground/30 bg-muted text-foreground ring-2 ring-foreground/10',
};

/**
 * FAB (floating action button) que aparece SÓLO si la cuenta tiene
 * el modo piloto activado. Permite al cliente piloto reportar bug /
 * idea / pregunta desde cualquier pantalla sin tener que ir a un
 * formulario aparte.
 *
 * Quote de Ramiro:
 *   "Vamos a hacer como diez usuarios y usándolo distinta gente que
 *    empiece a saltar los errores. Que esté re-contraprobado durante
 *    un mes o dos meses para que ya lo tengamos filoso filoso."
 */
export function PilotoFab() {
  const [hidratado, setHidratado] = useState(false);
  const [esPiloto, setEsPiloto] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? '';

  useEffect(() => {
    setEsPiloto(esClientePiloto());
    setHidratado(true);
  }, []);

  // I2-01: cuando el FAB está visible, reservamos espacio al pie del
  // contenido para que el botón flotante no tape los CTAs que viven en la
  // esquina inferior de las cards al final del scroll (ej. "Generar mensaje
  // WhatsApp" en Renovaciones). El padding sólo existe mientras el FAB existe
  // — en producción sin modo piloto no se agrega nada.
  useEffect(() => {
    // En prod (apiEnabled) no hay modo piloto: no reservamos padding extra.
    if (apiEnabled || !hidratado || !esPiloto) return;
    const main = document.getElementById('main-content');
    if (!main) return;
    main.style.paddingBottom = '6rem';
    return () => {
      main.style.paddingBottom = '';
    };
  }, [hidratado, esPiloto]);

  // El modo piloto (FAB "Reportar") es de la beta cerrada. En prod no se
  // monta ni el botón ni el padding reservado.
  if (apiEnabled) return null;

  if (!hidratado || !esPiloto) return null;

  // /configuracion tiene CTAs primarios al pie ("Guardar cambios",
  // "Comparar planes"). Ahí movemos el FAB a la izquierda para que no
  // los tape. Resto de la app: bottom-right clásico.
  // En mobile lo elevamos (bottom-20) para que no choque con la barra de
  // navegación inferior (h-16); en desktop (sin barra) vuelve a bottom-5.
  const enConfig = pathname.startsWith('/configuracion');
  const positionClasses = enConfig
    ? 'fixed bottom-20 left-5 md:bottom-5'
    : 'fixed bottom-20 right-5 md:bottom-5';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${positionClasses} z-40 flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 transition-all hover:bg-violet-700 hover:shadow-xl active:scale-95`}
        aria-label="Reportar problema o idea"
      >
        <Bug className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Reportar</span>
      </button>

      <ReporteDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ReporteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tipo, setTipo] = useState<TipoReporte>('BUG');
  const [severidad, setSeveridad] = useState<SeveridadReporte | null>(null);
  const [titulo, setTitulo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  // El contexto técnico (pantalla, viewport, navegador, URL) se sigue capturando
  // y guardando en el reporte vía crearReporte() — ya no se muestra en el UI.
  // (Backend: ver TODO de "trackeo absoluto" en lib/piloto-storage.ts.)

  useEffect(() => {
    if (!open) {
      setTipo('BUG');
      setSeveridad(null);
      setTitulo('');
      setDetalle('');
      setEnviando(false);
      setEnviado(false);
    }
  }, [open]);

  const puedeEnviar = titulo.trim().length >= 3 && detalle.trim().length >= 5;

  const enviar = () => {
    if (!puedeEnviar) return;
    setEnviando(true);
    // Pequeño delay simulado para que se sienta como una llamada al back
    setTimeout(() => {
      crearReporte({
        tipo,
        titulo,
        detalle,
        severidad: tipo === 'BUG' && severidad ? severidad : undefined,
      });
      setEnviando(false);
      setEnviado(true);
      toast({
        variant: 'success',
        title: '¡Recibido!',
        description: 'El equipo de My Alquiler lo revisa en las próximas horas.',
      });
    }, 600);
  };

  const TIPOS: Array<{
    id: TipoReporte;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    descripcion: string;
    color: string;
  }> = [
    {
      id: 'BUG',
      icon: Bug,
      label: 'Bug',
      descripcion: 'Algo no funciona como debería',
      color:
        'bg-destructive/10 text-destructive hover:bg-destructive/20',
    },
    {
      id: 'IDEA',
      icon: Lightbulb,
      label: 'Idea',
      descripcion: 'Una feature que te gustaría',
      color:
        'bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/40',
    },
  ];

  if (enviado) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <p className="text-lg font-semibold">¡Gracias por reportarlo!</p>
              <p className="text-sm text-muted-foreground">
                Te leemos. Si es bug, lo corregimos en el próximo deploy. Si
                es idea, la tenemos en cuenta para mejorar.
              </p>
            </div>
            <Button onClick={onClose} className="w-full">
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-violet-600" />
            Reportar al equipo
          </DialogTitle>
          <DialogDescription>
            Sos cliente piloto. Lo que reportes acá lo lee directo el equipo
            de producto el mismo día. Sin filtros, sin tickets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {TIPOS.map((t) => {
              const Icon = t.icon;
              const seleccionado = tipo === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={seleccionado}
                  onClick={() => setTipo(t.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-md border p-3 text-center text-xs transition-colors ${
                    seleccionado
                      ? `${t.color} border-current ring-2 ring-current/20`
                      : 'border-border bg-background hover:bg-muted/40'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{t.label}</span>
                  <span className="text-[10px] leading-tight opacity-70">
                    {t.descripcion}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rep-titulo">
              {tipo === 'BUG' ? '¿Qué falló?' : 'Tu idea en una línea'}
            </Label>
            <Input
              id="rep-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={
                tipo === 'BUG'
                  ? 'Ej: el botón Conciliar no responde'
                  : 'Ej: poder filtrar por barrio'
              }
              autoFocus
            />
          </div>

          {tipo === 'BUG' && (
            <div className="space-y-1.5">
              <Label>¿Cuánto te afecta?</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['BLOQUEA', 'MOLESTO', 'MENOR'] as SeveridadReporte[]).map((s) => {
                  const sel = severidad === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={sel}
                      onClick={() => setSeveridad(sel ? null : s)}
                      className={`rounded-md border px-2 py-2 text-xs font-medium transition-colors ${
                        sel ? SEV_COLOR[s] : 'border-border bg-background hover:bg-muted/40'
                      }`}
                    >
                      {SEVERIDAD_LABEL[s]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rep-detalle">Detalle</Label>
            <Textarea
              id="rep-detalle"
              rows={4}
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder={
                tipo === 'BUG'
                  ? 'Contanos qué hiciste, qué esperabas que pasara y qué pasó en su lugar. ¿Pasa siempre o sólo a veces?'
                  : '¿Para qué te servirá? ¿Cómo se usaría?'
              }
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            asChild
            variant="ghost"
            className="text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300"
          >
            <a
              href="https://wa.me/?text=Hola%21%20Soy%20cliente%20piloto%20y%20quiero%20comentarte%20algo."
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="h-4 w-4" />
              Prefiero WhatsApp
            </a>
          </Button>
          <Button onClick={enviar} disabled={!puedeEnviar || enviando}>
            {enviando ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
