'use client';

import { useEffect, useState } from 'react';
import { Mail, MessageCircle, Phone, Send } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { cn } from '@llave/ui/cn';
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
  type CanalComunicacion,
  plantillasMensajeMock,
  type PlantillaMensaje,
} from '@/lib/mock-data';

// Modal reusable para que el PM le mande un mensaje al inquilino.
// Soporta WhatsApp / Email / Llamada y plantillas con interpolación.

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  inquilino: { nombre: string; telefono?: string; email?: string };
  direccion?: string;
  fechaFin?: string;
}

export function MensajeInquilinoDialog({
  open,
  onOpenChange,
  inquilino,
  direccion,
  fechaFin,
}: Props) {
  const [canal, setCanal] = useState<CanalComunicacion>('WHATSAPP');
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [plantillaActiva, setPlantillaActiva] = useState<string | null>(null);

  // Reset al abrir/cerrar
  useEffect(() => {
    if (open) {
      setCanal('WHATSAPP');
      setAsunto('');
      setCuerpo('');
      setPlantillaActiva(null);
    }
  }, [open]);

  const aplicarPlantilla = (p: PlantillaMensaje) => {
    setPlantillaActiva(p.id);
    setCanal(p.canal);
    setAsunto(p.asunto);
    setCuerpo(interpolar(p.cuerpo, inquilino, { direccion, fechaFin }));
  };

  const enviar = () => {
    if (!cuerpo.trim()) {
      toast({ title: 'Falta el mensaje', variant: 'destructive' });
      return;
    }
    // Antes: si el canal elegido no tenía el dato de contacto (ej. inquilino sin
    // teléfono), caía en el else sin hacer nada pero igual toasteaba "enviado"
    // → falso éxito. Ahora frenamos con un mensaje claro y NO decimos que salió.
    const tel = inquilino.telefono?.replace(/[^\d]/g, '') || '';
    if ((canal === 'WHATSAPP' || canal === 'LLAMADA') && !tel) {
      toast({
        variant: 'destructive',
        title: 'Este inquilino no tiene WhatsApp/teléfono cargado',
        description: 'Cargá el número del inquilino desde el contrato para poder escribirle o llamarlo.',
      });
      return;
    }
    if (canal === 'EMAIL' && !inquilino.email) {
      toast({
        variant: 'destructive',
        title: 'Este inquilino no tiene email cargado',
        description: 'Cargá el email del inquilino desde el contrato para escribirle por ahí.',
      });
      return;
    }
    // En backend real: POST a /api/comunicaciones. Acá abrimos el canal.
    if (canal === 'WHATSAPP') {
      window.open(`https://wa.me/${tel}?text=${encodeURIComponent(cuerpo)}`, '_blank');
    } else if (canal === 'EMAIL') {
      const subject = encodeURIComponent(asunto || 'Sobre tu contrato');
      const body = encodeURIComponent(cuerpo);
      window.location.href = `mailto:${inquilino.email}?subject=${subject}&body=${body}`;
    } else if (canal === 'LLAMADA') {
      window.location.href = `tel:${tel}`;
    }
    // Honesto: abrimos el canal con el mensaje listo, pero NO se está guardando en
    // "Comunicaciones" (todavía no hay backend para eso). Antes el toast decía
    // "enviado · queda registrado en Comunicaciones" y era un falso éxito.
    toast({
      title:
        canal === 'WHATSAPP'
          ? 'Abrimos WhatsApp con el mensaje listo 📲'
          : canal === 'EMAIL'
            ? 'Abrimos tu correo con el mensaje listo 📧'
            : 'Abrimos el marcador para llamar 📞',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mensaje a {inquilino.nombre}</DialogTitle>
          <DialogDescription>
            Plantillas listas o escribí libre. Queda registrado en el historial del contrato.
          </DialogDescription>
        </DialogHeader>

        {/* Canal */}
        <div className="flex gap-2">
          <CanalButton
            active={canal === 'WHATSAPP'}
            onClick={() => setCanal('WHATSAPP')}
            icon={<MessageCircle className="h-4 w-4" />}
            label="WhatsApp"
            disabled={!inquilino.telefono}
          />
          <CanalButton
            active={canal === 'EMAIL'}
            onClick={() => setCanal('EMAIL')}
            icon={<Mail className="h-4 w-4" />}
            label="Email"
            disabled={!inquilino.email}
          />
          <CanalButton
            active={canal === 'LLAMADA'}
            onClick={() => setCanal('LLAMADA')}
            icon={<Phone className="h-4 w-4" />}
            label="Llamar"
            disabled={!inquilino.telefono}
          />
        </div>

        {/* Plantillas */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Plantillas
          </p>
          <div className="flex flex-wrap gap-2">
            {plantillasMensajeMock.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={plantillaActiva === p.id}
                onClick={() => aplicarPlantilla(p)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-colors',
                  plantillaActiva === p.id
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'border-border hover:bg-muted/40',
                )}
              >
                {p.titulo}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        {canal === 'EMAIL' && (
          <div className="space-y-1">
            <Label htmlFor="mid-asunto" className="text-xs">Asunto</Label>
            <Input id="mid-asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} />
          </div>
        )}

        {canal === 'LLAMADA' ? (
          <div className="space-y-2 rounded-md border bg-muted/30 p-4 text-sm">
            <p className="font-medium">Llamar al {inquilino.telefono}</p>
            <p className="text-xs text-muted-foreground">
              Vas a abrir la llamada con la app de tu sistema. Después podés dejar una nota acá
              para registrarla en Comunicaciones.
            </p>
            <Textarea
              aria-label="Nota de la llamada"
              placeholder="Nota de la llamada (opcional)…"
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              rows={3}
            />
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="mid-mensaje" className="text-xs">Mensaje</Label>
            <Textarea
              id="mid-mensaje"
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              rows={6}
              placeholder={`Hola ${inquilino.nombre.split(' ')[0]}, …`}
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={enviar}>
            <Send className="h-4 w-4" />
            {canal === 'LLAMADA' ? 'Llamar' : 'Enviar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CanalButton({
  active,
  onClick,
  icon,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
        active
          ? 'border-primary bg-primary/10 font-medium text-primary'
          : 'border-border hover:bg-muted/40',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function interpolar(
  cuerpo: string,
  inquilino: Props['inquilino'],
  extra: { direccion?: string; fechaFin?: string },
): string {
  return cuerpo
    .replace(/\{\{nombre\}\}/g, inquilino.nombre.split(' ')[0] ?? inquilino.nombre)
    .replace(/\{\{direccion\}\}/g, extra.direccion ?? '')
    .replace(/\{\{fechaFin\}\}/g, extra.fechaFin ?? '')
    .replace(/\{\{porcentaje\}\}/g, '—')
    .replace(/\{\{nuevoMonto\}\}/g, '—')
    .replace(/\{\{detalle\}\}/g, '…');
}
