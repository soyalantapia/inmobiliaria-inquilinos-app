'use client';

import { useState } from 'react';
import { CheckCircle2, Copy, Mail, Send, Sparkles } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { toast } from '@llave/ui/use-toast';

interface EmailBienvenidaDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  destinatario: {
    nombre: string;
    email: string;
  };
  /** Dirección de la propiedad — opcional para personalizar el mail. */
  propiedad?: string;
  /** Variante del mail: bienvenida inicial vs recordatorio. */
  modo?: 'bienvenida' | 'recordatorio';
}

/**
 * Preview del email de bienvenida que recibe el inquilino. Muestra el mail
 * tal como va a llegarle, con el link de activación que abre la app.
 *
 * En backend real, este preview es lo que el provider de mail manda. Acá
 * lo mostramos como un dialog para que el agente vea qué se envía.
 */
export function EmailBienvenidaDialog({
  open,
  onOpenChange,
  destinatario,
  propiedad,
  modo = 'bienvenida',
}: EmailBienvenidaDialogProps) {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const asunto =
    modo === 'recordatorio'
      ? '🔑 Recordatorio · Activá tu cuenta en Llave'
      : '🎉 Te invitamos a Llave, la app de tu alquiler';

  const onEnviar = async () => {
    setEnviando(true);
    await new Promise((r) => setTimeout(r, 600));
    setEnviando(false);
    setEnviado(true);
    toast({
      variant: 'success',
      title:
        modo === 'recordatorio' ? 'Recordatorio enviado' : 'Email de bienvenida enviado',
      description: `Le mandamos a ${destinatario.email} el link para activar su cuenta.`,
    });
    // Cerramos el dialog después de un momento
    setTimeout(() => {
      onOpenChange(false);
      setEnviado(false);
    }, 1200);
  };

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `https://soyalantapia.github.io/inmobiliaria-inquilinos-app/inquilino/login/`,
      );
      toast({ title: 'Link copiado al portapapeles' });
    } catch {
      toast({ title: 'No pudimos copiar el link', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {modo === 'recordatorio' ? 'Reenviar invitación' : 'Email de bienvenida'}
          </DialogTitle>
          <DialogDescription>
            Esto es lo que va a recibir <strong>{destinatario.nombre}</strong> en{' '}
            <span className="font-mono text-xs">{destinatario.email}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Vista del email */}
        <div className="rounded-lg border bg-card overflow-hidden">
          {/* Cabecera del email */}
          <div className="border-b bg-muted/30 px-4 py-3 space-y-1 text-xs">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 shrink-0">De:</span>
              <span className="font-medium">hola@llave.com.ar</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 shrink-0">Para:</span>
              <span className="font-medium">{destinatario.email}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 shrink-0">Asunto:</span>
              <span className="font-semibold">{asunto}</span>
            </div>
          </div>

          {/* Cuerpo del email */}
          <div className="p-5 space-y-4 bg-background">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-purple-600 text-white font-bold shadow-sm">
                L
              </div>
              <span className="font-semibold">Llave</span>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">
                {modo === 'recordatorio'
                  ? `Hola ${destinatario.nombre}, todavía no entraste 👋`
                  : `¡Hola ${destinatario.nombre}! 👋`}
              </h2>

              {modo === 'recordatorio' ? (
                <p className="text-sm text-muted-foreground">
                  Te invitamos a Llave hace unos días pero todavía no entraste a tu cuenta.
                  Acordate de activarla así podés gestionar tu alquiler desde el celular.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Te damos la bienvenida a <strong>Llave</strong>, la app para gestionar
                    tu alquiler. Desde acá vas a poder:
                  </p>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      Pagar tu alquiler con un toque
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      Ver el contrato y todos tus recibos
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      Cargar reclamos con foto desde el celular
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      Hablar con la IA de tu contrato cuando tengas dudas
                    </li>
                  </ul>
                </>
              )}

              {propiedad && (
                <p className="text-xs text-muted-foreground">
                  Propiedad: <strong>{propiedad}</strong>
                </p>
              )}

              {/* CTA */}
              <div className="rounded-md border bg-gradient-to-br from-primary/5 to-purple-50 dark:to-purple-900/10 p-4 text-center space-y-2">
                <p className="text-xs text-muted-foreground">
                  Tocá el botón para activar tu cuenta:
                </p>
                <a
                  href="/inquilino/login/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Sparkles className="h-4 w-4" />
                  Activar mi cuenta
                </a>
                <p className="text-[11px] text-muted-foreground break-all">
                  o entrá a https://soyalantapia.github.io/inmobiliaria-inquilinos-app/inquilino/login/
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                Al entrar te vamos a pedir un código de 6 dígitos que te mandamos por mail.
                Usá <strong>{destinatario.email}</strong> para ingresar.
              </p>

              <div className="border-t pt-3 mt-3">
                <p className="text-xs text-muted-foreground">
                  Si tenés alguna duda, respondé este mail o escribinos por WhatsApp.
                </p>
                <p className="text-xs text-muted-foreground mt-1">— El equipo de tu inmobiliaria</p>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={copiarLink}>
            <Copy className="h-3.5 w-3.5" />
            Copiar link
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
              Cerrar
            </Button>
            <Button onClick={onEnviar} disabled={enviando || enviado}>
              {enviado ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Enviado
                </>
              ) : enviando ? (
                <>
                  <Send className="h-4 w-4 animate-pulse" />
                  Enviando…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {modo === 'recordatorio' ? 'Reenviar' : 'Enviar email'}
                </>
              )}
            </Button>
          </div>
        </div>

        <Badge variant="outline" className="text-[10px] gap-1 self-start">
          Modo demo · el mail se simula
        </Badge>
      </DialogContent>
    </Dialog>
  );
}
