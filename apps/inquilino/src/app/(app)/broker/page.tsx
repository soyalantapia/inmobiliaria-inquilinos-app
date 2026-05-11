'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Send, Sparkles } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { ChatBubble } from '@/components/chat-bubble';
import { NavBar } from '@/components/nav-bar';
import { chatInicialMock, contratoMock, respuestasMock } from '@/lib/mock-data';
import { guardarChat, leerChat, limpiarChat } from '@/lib/chat-storage';
import type { MensajeChat } from '@/lib/types';

const sugerencias = [
  '¿Cuándo es el próximo aumento?',
  '¿Puedo tener mascotas?',
  '¿Cuánto pagué de depósito?',
];

export default function ContratoPage() {
  const [mensajes, setMensajes] = useState<MensajeChat[]>(chatInicialMock);
  const [input, setInput] = useState('');
  const [pensando, setPensando] = useState(false);
  const [hidratado, setHidratado] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // hidratar desde localStorage al montar (sin SSR mismatch)
  useEffect(() => {
    const persistido = leerChat(contratoMock.id);
    if (persistido && persistido.length > 0) {
      setMensajes(persistido);
    }
    setHidratado(true);
  }, []);

  // persistir cuando cambian los mensajes (después de hidratar para no pisar)
  useEffect(() => {
    if (!hidratado) return;
    guardarChat(contratoMock.id, mensajes);
  }, [mensajes, hidratado]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, pensando]);

  const reiniciarChat = () => {
    limpiarChat(contratoMock.id);
    setMensajes(chatInicialMock);
  };

  const enviar = async (texto: string) => {
    if (!texto.trim()) return;
    const userMsg: MensajeChat = {
      id: `u_${Date.now()}`,
      rol: 'USER',
      contenido: texto.trim(),
      createdAt: new Date().toISOString(),
    };
    setMensajes((prev) => [...prev, userMsg]);
    setInput('');
    setPensando(true);

    // mock RAG: en Sprint 2 esto streamea desde /api/chat/contrato/:id
    await new Promise((r) => setTimeout(r, 800));

    const match = respuestasMock.find((r) => r.patron.test(texto));
    const respuesta: MensajeChat = match
      ? {
          id: `a_${Date.now()}`,
          rol: 'ASSISTANT',
          contenido: match.respuesta,
          citas: match.citas,
          createdAt: new Date().toISOString(),
        }
      : {
          id: `a_${Date.now()}`,
          rol: 'ASSISTANT',
          contenido: 'Eso no está claro en tu contrato. ¿Querés que te derivemos a la inmobiliaria?',
          createdAt: new Date().toISOString(),
        };

    setMensajes((prev) => [...prev, respuesta]);
    setPensando(false);
  };

  return (
    <>
      <header className="border-b p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Broker · tu asistente del contrato
            </div>
            <h1 className="mt-1 text-lg font-semibold">Preguntale lo que quieras</h1>
            <p className="text-xs text-muted-foreground">
              Responde solo sobre tu contrato — {contratoMock.direccion}
            </p>
          </div>
          {mensajes.length > 1 && (
            <button
              onClick={reiniciarChat}
              className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Reiniciar conversación"
              title="Reiniciar"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
        {mensajes.map((m) => (
          <ChatBubble key={m.id} mensaje={m} />
        ))}
        {pensando && (
          <Card className="w-fit rounded-bl-sm bg-muted px-4 py-3 text-sm text-muted-foreground">
            <span className="inline-flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
            </span>
          </Card>
        )}
        <div ref={scrollRef} />
      </main>

      <div className="space-y-3 border-t bg-background p-4">
        {mensajes.length <= 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sugerencias.map((s) => (
              <button
                key={s}
                onClick={() => enviar(s)}
                className="shrink-0 rounded-full border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar(input);
          }}
          className="flex items-center gap-2"
        >
          <Input
            placeholder="Preguntale a tu contrato"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={pensando}
          />
          <Button type="submit" size="icon" disabled={!input.trim() || pensando}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <NavBar />
    </>
  );
}
