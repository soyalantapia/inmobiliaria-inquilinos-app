'use client';

import { useEffect, useState } from 'react';
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
import { useCurrentUser } from '@/lib/use-current-user';
import { identificarSonarUser, reportarBug, type SonarSeverity } from '@/lib/sonar-client';

type UserSeverity = Extract<SonarSeverity, 'low' | 'medium' | 'high'>;

const SEV_LABELS: Record<UserSeverity, string> = {
  high: 'Bloqueante',
  medium: 'Molesto',
  low: 'Menor',
};

/**
 * Botón flotante para que el inquilino reporte bugs desde cualquier pantalla.
 * Posicionado en bottom-left para no chocar con la barra inferior de la PWA.
 */
export function ReportBugButton() {
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [sev, setSev] = useState<UserSeverity>('medium');
  const [sending, setSending] = useState(false);

  // Identidad en Sonar: sin esto los tickets llegan anónimos y usersAffected queda en 0.
  useEffect(() => {
    if (!user.isSignedIn || !user.email) return;
    identificarSonarUser({
      id: user.email,
      name: user.fullName,
      email: user.email,
      role: 'inquilino',
    });
  }, [user.isSignedIn, user.email, user.fullName]);

  function cerrar() {
    setOpen(false);
    setMsg('');
    setSev('medium');
  }

  async function enviar() {
    const text = msg.trim();
    if (!text || sending) return;
    setSending(true);
    const titulo = `🐛 ${text.split('\n')[0]}`.slice(0, 120);
    // Cerramos ANTES de capturar y esperamos dos frames a que el DOM se repinte: si no,
    // la foto que acompaña al reporte es la de este modal tapando la pantalla que el
    // usuario quería mostrar. (Cuando hubo un fallo previo el loader usa la foto que
    // congeló en ese momento, y esto no cambia nada.)
    setOpen(false);
    const ok = await new Promise<boolean>((resolve) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => resolve(reportarBug({ message: text, severity: sev, title: titulo }))),
      ),
    );
    setSending(false);
    if (ok) {
      cerrar();
      toast({
        variant: 'success',
        title: 'Reporte enviado',
        description: 'Va con la pantalla y el contexto técnico. ¡Gracias!',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'No se pudo enviar',
        description: 'El módulo de reportes no cargó todavía. Recargá e intentá de nuevo.',
      });
    }
  }

  return (
    <>
      {/* FAB: izquierda para no chocar con botones de navegación a la derecha */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-full bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition-all hover:bg-violet-700 active:scale-95 md:bottom-5"
        aria-label="Reportar un problema"
      >
        <Bug className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Reportar</span>
      </button>

      <Dialog open={open} onOpenChange={(v) => !v && cerrar()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-violet-600" />
              Reportar un problema
            </DialogTitle>
            <DialogDescription>
              El reporte se envía con la pantalla actual, los últimos pasos y el
              contexto de tu sesión de forma automática.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bug-msg-inq">¿Qué pasó?</Label>
              <Textarea
                id="bug-msg-inq"
                rows={3}
                autoFocus
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="Ej: el botón de pago no respondió cuando intenté pagar."
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
                    className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
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

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={cerrar}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-violet-600 hover:bg-violet-700"
              onClick={enviar}
              disabled={!msg.trim() || sending}
            >
              {sending ? (
                <span className="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
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
