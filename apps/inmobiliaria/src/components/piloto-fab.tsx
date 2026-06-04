'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Bug,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
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
import {
  crearReporte,
  esClientePiloto,
  type TipoReporte,
} from '@/lib/piloto-storage';

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
    if (!hidratado || !esPiloto) return;
    const main = document.getElementById('main-content');
    if (!main) return;
    main.style.paddingBottom = '6rem';
    return () => {
      main.style.paddingBottom = '';
    };
  }, [hidratado, esPiloto]);

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
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Reportar</span>
      </button>

      <ReporteDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ReporteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tipo, setTipo] = useState<TipoReporte>('BUG');
  const [titulo, setTitulo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (!open) {
      setTipo('BUG');
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
      crearReporte({ tipo, titulo, detalle });
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
    {
      id: 'PREGUNTA',
      icon: HelpCircle,
      label: 'Pregunta',
      descripcion: 'No sabés cómo hacer algo',
      color:
        'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/40',
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
                es idea, la sumamos al roadmap.
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
            <Sparkles className="h-5 w-5 text-violet-600" />
            Reportar al equipo
          </DialogTitle>
          <DialogDescription>
            Sos cliente piloto. Lo que reportes acá lo lee directo el equipo
            de producto el mismo día. Sin filtros, sin tickets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
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
              {tipo === 'BUG' ? '¿Qué falló?' : tipo === 'IDEA' ? 'Tu idea en una línea' : 'Tu pregunta'}
            </Label>
            <Input
              id="rep-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={
                tipo === 'BUG'
                  ? 'Ej: el botón Conciliar no responde'
                  : tipo === 'IDEA'
                    ? 'Ej: poder filtrar por barrio'
                    : 'Ej: ¿cómo descargo el certificado?'
              }
              autoFocus
            />
          </div>

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
                  : tipo === 'IDEA'
                    ? '¿Para qué te servirá? ¿Cómo se usaría?'
                    : 'Cualquier contexto adicional.'
              }
            />
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>Adjuntamos automático:</span>
              <Badge variant="outline" className="text-[9px]">
                URL actual
              </Badge>
              <Badge variant="outline" className="text-[9px]">
                Timestamp
              </Badge>
              <Badge variant="outline" className="text-[9px]">
                Tu user
              </Badge>
            </div>
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
