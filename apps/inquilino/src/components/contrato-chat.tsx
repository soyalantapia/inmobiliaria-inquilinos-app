'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Loader2,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import {
  PREGUNTAS_SUGERIDAS,
  responderPregunta,
  type MensajeContratoChat,
} from '@/lib/contrato-chat';

/**
 * Chat con el contrato — se monta en /contrato. El inquilino escribe
 * (o tapea un chip sugerido) y la "IA" responde citando la cláusula
 * relevante. Da transparencia y seguridad sin obligar al inquilino a
 * leer 30 páginas.
 *
 * Demo: respuestas mockeadas determinísticas (lib/contrato-chat.ts).
 * Producción: RAG sobre el PDF del contrato + Claude.
 */
export function ContratoChat() {
  const [mensajes, setMensajes] = useState<MensajeContratoChat[]>([]);
  const [input, setInput] = useState('');
  const [pensando, setPensando] = useState(false);
  // Sugerencias progresivas: mostramos solo las 3 primeras al toque y un
  // botón "Más preguntas" expandible. Antes la lista mostraba 6 chips de
  // entrada, lo cual saturaba visualmente la sección de búsqueda.
  const [verMasSugerencias, setVerMasSugerencias] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll al final cuando entra un nuevo mensaje
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, pensando]);

  const enviar = (texto: string) => {
    const limpio = texto.trim();
    if (!limpio) return;

    const msgUsuario: MensajeContratoChat = {
      id: `m_${Date.now()}_u`,
      rol: 'usuario',
      texto: limpio,
      enviadoAt: new Date().toISOString(),
    };
    setMensajes((prev) => [...prev, msgUsuario]);
    setInput('');
    setPensando(true);

    // Delay simulado para que se sienta "el contrato está pensando".
    setTimeout(() => {
      const resp = responderPregunta(limpio);
      const msgAsistente: MensajeContratoChat = {
        id: `m_${Date.now()}_a`,
        rol: 'asistente',
        texto: resp.texto,
        citas: resp.citas,
        followUps: resp.followUps,
        enviadoAt: new Date().toISOString(),
      };
      setMensajes((prev) => [...prev, msgAsistente]);
      setPensando(false);
    }, 900);
  };

  const limpiar = () => {
    setMensajes([]);
  };

  const haySugerencias = mensajes.length === 0;

  return (
    <Card className="overflow-hidden border-violet-200 dark:border-violet-900/40">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-violet-50/60 px-4 py-3 dark:bg-violet-900/15">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-600 text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Preguntale a tu contrato</p>
          <p className="text-[11px] text-muted-foreground">
            Te respondo en segundos con la cláusula exacta del PDF firmado.
          </p>
        </div>
        {mensajes.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={limpiar}
            aria-label="Borrar conversación"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Mensajes */}
      <div
        ref={scrollRef}
        className="max-h-[420px] overflow-y-auto px-4 py-3 space-y-3"
      >
        {haySugerencias && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Empezá con una de estas preguntas:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(verMasSugerencias
                ? PREGUNTAS_SUGERIDAS
                : PREGUNTAS_SUGERIDAS.slice(0, 3)
              ).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => enviar(p)}
                  className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-violet-50 hover:border-violet-300 dark:hover:bg-violet-900/20"
                >
                  {p}
                </button>
              ))}
              {!verMasSugerencias && PREGUNTAS_SUGERIDAS.length > 3 && (
                <button
                  type="button"
                  onClick={() => setVerMasSugerencias(true)}
                  className="rounded-full border border-dashed bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                  Más preguntas ({PREGUNTAS_SUGERIDAS.length - 3})
                </button>
              )}
            </div>
          </div>
        )}

        {mensajes.map((m) => (
          <MensajeBurbuja key={m.id} mensaje={m} onFollowUp={enviar} />
        ))}

        {pensando && (
          <div className="flex items-start gap-2">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              <Sparkles className="h-3 w-3" />
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!pensando) enviar(input);
        }}
        className="flex items-center gap-2 border-t bg-muted/20 p-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribí tu pregunta…"
          disabled={pensando}
          className="bg-background"
        />
        <Button
          type="submit"
          size="icon"
          disabled={pensando || input.trim().length === 0}
          className="bg-violet-600 text-white hover:bg-violet-700"
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}

function MensajeBurbuja({
  mensaje,
  onFollowUp,
}: {
  mensaje: MensajeContratoChat;
  onFollowUp: (p: string) => void;
}) {
  if (mensaje.rol === 'usuario') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          {mensaje.texto}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
        <Sparkles className="h-3 w-3" />
      </div>
      <div className="flex-1 max-w-[85%] space-y-2">
        <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm leading-relaxed">
          {mensaje.texto}
        </div>

        {mensaje.citas && mensaje.citas.length > 0 && (
          <div className="space-y-1.5">
            {mensaje.citas.map((c, i) => (
              <div
                key={i}
                className="rounded-md border border-violet-200 bg-violet-50/40 p-2.5 text-xs dark:border-violet-900/40 dark:bg-violet-900/10"
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <BookOpen className="h-3 w-3 text-violet-700 dark:text-violet-300" />
                  <Badge
                    variant="outline"
                    className="border-violet-300 text-[10px] text-violet-800 dark:border-violet-900/40 dark:text-violet-200"
                  >
                    {c.referencia}
                  </Badge>
                </div>
                <p className="italic leading-relaxed text-muted-foreground">
                  &ldquo;{c.texto}&rdquo;
                </p>
              </div>
            ))}
          </div>
        )}

        {mensaje.followUps && mensaje.followUps.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {mensaje.followUps.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onFollowUp(f)}
                className="rounded-full border bg-background px-2.5 py-1 text-[11px] transition-colors hover:bg-violet-50 hover:border-violet-300 dark:hover:bg-violet-900/20"
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
