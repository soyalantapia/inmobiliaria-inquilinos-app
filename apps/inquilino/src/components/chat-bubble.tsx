import { Quote } from 'lucide-react';
import { cn } from '@llave/ui/cn';
import type { MensajeChat } from '@/lib/types';

export function ChatBubble({ mensaje }: { mensaje: MensajeChat }) {
  const esUser = mensaje.rol === 'USER';
  return (
    <div className={cn('flex w-full', esUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] space-y-2 rounded-2xl px-4 py-3 text-sm',
          esUser
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm bg-muted text-foreground',
        )}
      >
        <p className="whitespace-pre-line leading-relaxed">{mensaje.contenido}</p>

        {mensaje.citas?.map((cita, i) => (
          <div
            key={i}
            className={cn(
              'space-y-1 rounded-md border-l-2 px-3 py-2 text-xs',
              esUser
                ? 'border-primary-foreground/40 bg-primary-foreground/10'
                : 'border-primary/40 bg-background',
            )}
          >
            <div className="flex items-center gap-1 font-medium opacity-80">
              <Quote className="h-3 w-3" />
              {cita.clausula}
            </div>
            <p className="italic opacity-90">"{cita.texto}"</p>
          </div>
        ))}
      </div>
    </div>
  );
}
