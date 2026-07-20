'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bug, Send } from 'lucide-react';
import { Button } from '@llave/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Label } from '@llave/ui/label';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { apiEnabled } from '@/lib/api/client';
import { useMe } from '@/lib/api/hooks';
import { identificarSonarUser, reportarBug, type SonarSeverity } from '@/lib/sonar-client';

type UserSeverity = Extract<SonarSeverity, 'low' | 'medium' | 'high'>;

const SEV_LABELS: Record<UserSeverity, string> = {
  high: 'Bloqueante',
  medium: 'Molesto',
  low: 'Menor',
};

/**
 * Botón flotante "Reportar un bug", visible para cualquier usuario del panel.
 * Abre un dialog (descripción + gravedad) y manda el reporte a Sonar vía
 * window.Sonar.capture (kind: 'manual'). El loader adjunta automáticamente la
 * pantalla/ruta, breadcrumbs, contexto y el usuario identificado.
 *
 * Además identifica al usuario en Sonar, así TODO reporte (manual y automático) queda
 * atribuido y `usersAffected` cuenta gente real en vez de quedarse en 0.
 */
export function ReportBugButton() {
  const pathname = usePathname() ?? '';
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [sev, setSev] = useState<UserSeverity>('medium');
  const [sending, setSending] = useState(false);

  // Identidad en Sonar. Sin esto los tickets llegan anónimos: usersAffected queda
  // siempre en 0 y no se puede saber a quién le pasó. Idempotente.
  useEffect(() => {
    if (!me) return;
    identificarSonarUser({ id: me.email, name: me.nombre, email: me.email, role: me.rol });
  }, [me]);

  function cerrar() {
    setOpen(false);
    setMsg('');
    setSev('medium');
  }

  function enviar() {
    const text = msg.trim();
    if (!text || sending) return;
    setSending(true);
    const titulo = `🐛 ${text.split('\n')[0]}`.slice(0, 120);
    const ok = reportarBug({ message: text, severity: sev, title: titulo });
    setSending(false);
    if (ok) {
      cerrar();
      toast({
        variant: 'success',
        title: 'Bug reportado',
        description: 'El reporte llegó al equipo con el contexto de la pantalla.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'No se pudo enviar',
        description: 'El módulo de reportes no cargó todavía. Recargá la página e intentá de nuevo.',
      });
    }
  }

  return (
    <>
      {/* Posición del FAB. Dos colisiones reales que evitar:
          1) PilotoFab vive en la MISMA esquina (bottom-20 right-5 / md:bottom-5) y se
             monta cuando NO hay API (dev y demo). Ahí subimos un piso para apilarlos
             en vez de superponerlos.
          2) /configuracion tiene CTAs primarios al pie ("Guardar cambios"): igual que
             PilotoFab, nos corremos a la izquierda.
          En mobile subimos siempre para no tapar la barra inferior (h-16 = pb-16 del layout). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed z-40 flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 transition-all hover:bg-violet-700 hover:shadow-xl active:scale-95 ${
          pathname.startsWith('/configuracion') ? 'left-4 md:left-6' : 'right-4 md:right-6'
        } ${apiEnabled ? 'bottom-20 md:bottom-5' : 'bottom-36 md:bottom-20'}`}
        aria-label="Reportar un bug"
      >
        <Bug className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Reportar bug</span>
      </button>

      <Dialog open={open} onOpenChange={(v) => !v && cerrar()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-violet-600" />
              Reportar un bug
            </DialogTitle>
            <DialogDescription>
              El reporte llega con la captura de pantalla, los últimos pasos y el
              contexto técnico de forma automática. Solo describí qué pasó.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bug-desc">¿Qué pasó?</Label>
              <Textarea
                id="bug-desc"
                rows={4}
                autoFocus
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="Ej: hice clic en 'Conciliar' y la pantalla quedó en blanco. Pasó dos veces seguidas."
              />
            </div>

            <div className="space-y-1.5">
              <Label>¿Cuánto te afecta?</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['high', 'medium', 'low'] as UserSeverity[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={sev === s}
                    onClick={() => setSev(s)}
                    className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                      sev === s
                        ? s === 'high'
                          ? 'border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive/20'
                          : s === 'medium'
                            ? 'border-amber-500 bg-amber-50 text-amber-700 ring-2 ring-amber-500/20'
                            : 'border-foreground/30 bg-muted text-foreground ring-2 ring-foreground/10'
                        : 'border-border bg-background hover:bg-muted/40'
                    }`}
                  >
                    {SEV_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={cerrar}>
              Cancelar
            </Button>
            <Button
              onClick={enviar}
              disabled={!msg.trim() || sending}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {sending ? (
                <span className="mr-1.5 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
              ) : (
                <Send className="mr-1.5 h-3.5 w-3.5" />
              )}
              Enviar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
