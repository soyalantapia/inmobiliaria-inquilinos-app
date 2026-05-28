'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Send, Sparkles } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { ChatBubble } from '@/components/chat-bubble';
import { NavBar } from '@/components/nav-bar';
import {
  chatInicialMock,
  contratoMock,
  liquidacionesMock,
  respuestasMock,
} from '@/lib/mock-data';
import { guardarChat, leerChat, limpiarChat } from '@/lib/chat-storage';
import { aplicarEstadoDemo, useDemoEstado } from '@/lib/demo-estado';
import { formatMonto } from '@/lib/format';
import { TASA_PUNITORIA_DIARIA_DEFAULT, calcularPunitorios } from '@/lib/punitorios';
import type { MensajeChat } from '@/lib/types';

const sugerenciasIniciales = [
  '¿Cuándo es el próximo aumento?',
  '¿Puedo tener mascotas?',
  '¿Cuánto pagué de depósito?',
];

// Sugerencias específicas cuando el inquilino tiene una cuota vencida.
// Reemplazan a las iniciales para que la primera duda sea sobre la deuda.
const sugerenciasMoroso = [
  '¿Cuánto debo en total?',
  '¿Cómo se calculan los punitorios?',
  '¿Qué pasa si no pago a tiempo?',
];

// Mensaje semilla del asistente cuando el inquilino entra con deuda.
// Reemplaza al saludo neutro `chatInicialMock` solo en el primer ingreso —
// si ya conversó antes, respetamos su historial persistido.
function buildSeedMoroso(opts: {
  diasAtraso: number;
  totalAPagar: number;
  punitorioAcumulado: number;
}): MensajeChat {
  const { diasAtraso, totalAPagar, punitorioAcumulado } = opts;
  return {
    id: 'msg_seed_moroso',
    rol: 'ASSISTANT',
    contenido:
      `Hola, veo que tu alquiler de este mes está vencido hace ${diasAtraso} día${diasAtraso === 1 ? '' : 's'}. ` +
      `Hoy tendrías que pagar ${formatMonto(totalAPagar)} (incluye ${formatMonto(punitorioAcumulado)} de punitorios). ` +
      `¿Querés que te explique cómo regularizarlo o ver cómo se calculan los punitorios?`,
    createdAt: new Date().toISOString(),
  };
}

// Sugerencias de follow-up según el último tema. Si la última pregunta del
// usuario matcheó algún patrón, mostramos preguntas relacionadas que el
// inquilino probablemente quiera hacer después.
const sugerenciasContextuales: Array<{ disparador: RegExp; siguientes: string[] }> = [
  {
    disparador: /aumento|ajust|icl/i,
    siguientes: [
      '¿Cuánto va a ser el próximo aumento estimado?',
      '¿Puedo renegociar el contrato antes del ajuste?',
      '¿Qué pasa si no estoy de acuerdo con el índice?',
    ],
  },
  {
    disparador: /mascot|perro|gato/i,
    siguientes: [
      '¿Hay límite de mascotas?',
      '¿Qué pasa si la mascota daña algo?',
      '¿Necesito avisar a la inmobiliaria?',
    ],
  },
  {
    disparador: /depós|deposit|garantía|garante/i,
    siguientes: [
      '¿Cuándo me devuelven el depósito?',
      '¿Puedo cambiar de garante?',
      '¿Cómo funciona la garantía digital?',
    ],
  },
  {
    disparador: /vencimiento|finaliza|termina|renovaci/i,
    siguientes: [
      '¿Cuánto antes tengo que avisar si me voy?',
      '¿Puedo renovar el contrato?',
      '¿Qué pasa si me quedo después del vencimiento?',
    ],
  },
];

function obtenerSugerenciasParaUltimo(
  mensajes: MensajeChat[],
  iniciales: string[],
): string[] {
  // Si solo hay el mensaje de seed (assistant inicial) → mostrar iniciales
  if (mensajes.length <= 1) return iniciales;
  // Buscamos el último mensaje del usuario
  const ultimoUser = [...mensajes].reverse().find((m) => m.rol === 'USER');
  if (!ultimoUser) return iniciales;
  const match = sugerenciasContextuales.find((s) => s.disparador.test(ultimoUser.contenido));
  return match?.siguientes ?? iniciales;
}

export default function ContratoPage() {
  const [demoEstado] = useDemoEstado();
  const [mensajes, setMensajes] = useState<MensajeChat[]>(chatInicialMock);
  const [input, setInput] = useState('');
  const [pensando, setPensando] = useState(false);
  const [hidratado, setHidratado] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Estado de pago vigente — usa el mismo modelo demo que la home para que el
  // asistente sepa si hay deuda vencida, pago a tiempo o nada pendiente.
  // Recalcula cuando demoEstado cambia (el switcher impacta inmediatamente).
  const estadoPago = useMemo(() => {
    const pendienteMock = liquidacionesMock.find((l) => l.estado !== 'PAGADO');
    const liq = aplicarEstadoDemo(demoEstado, pendienteMock);
    if (!liq) return { vencido: false } as const;
    const calc = calcularPunitorios(liq, TASA_PUNITORIA_DIARIA_DEFAULT);
    return {
      vencido: calc.diasAtraso > 0,
      diasAtraso: calc.diasAtraso,
      totalAPagar: calc.totalAPagar,
      punitorioAcumulado: calc.punitorioAcumulado,
    } as const;
  }, [demoEstado]);

  const sugerenciasBase = estadoPago.vencido ? sugerenciasMoroso : sugerenciasIniciales;

  // hidratar desde localStorage al montar (sin SSR mismatch).
  // Leemos demoEstado directo desde storage para evitar la race condition
  // contra useDemoEstado (que defaultea a 'atrasado' en el primer render
  // y recién hidrata en su propio useEffect — si confiábamos en su valor
  // acá, siempre inyectábamos el seed moroso aunque el inquilino estuviera
  // al día).
  useEffect(() => {
    const persistido = leerChat(contratoMock.id);
    if (persistido && persistido.length > 0) {
      setMensajes(persistido);
    } else {
      let estadoInicial: 'al-dia' | 'a-tiempo' | 'atrasado' = 'atrasado';
      try {
        const stored = window.localStorage.getItem('llave-inquilino:demo');
        if (stored === 'al-dia' || stored === 'a-tiempo' || stored === 'atrasado') {
          estadoInicial = stored;
        }
      } catch {
        // ignore
      }
      const pendienteMock = liquidacionesMock.find((l) => l.estado !== 'PAGADO');
      const liq = aplicarEstadoDemo(estadoInicial, pendienteMock);
      if (liq) {
        const calc = calcularPunitorios(liq, TASA_PUNITORIA_DIARIA_DEFAULT);
        if (calc.diasAtraso > 0) {
          setMensajes([
            buildSeedMoroso({
              diasAtraso: calc.diasAtraso,
              totalAPagar: calc.totalAPagar,
              punitorioAcumulado: calc.punitorioAcumulado,
            }),
          ]);
        }
      }
    }
    setHidratado(true);
    // Marcamos que el inquilino abrió el Broker al menos una vez. La home
    // usa esto para no seguir mostrando el "nudge" de descubrimiento.
    try {
      window.localStorage.setItem('llave-inquilino:broker-visitado', '1');
    } catch {
      // ignore
    }
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
    if (estadoPago.vencido) {
      setMensajes([
        buildSeedMoroso({
          diasAtraso: estadoPago.diasAtraso,
          totalAPagar: estadoPago.totalAPagar,
          punitorioAcumulado: estadoPago.punitorioAcumulado,
        }),
      ]);
    } else {
      setMensajes(chatInicialMock);
    }
  };

  // Respuestas contextuales que dependen del estado de pago vigente — no
  // las podemos meter en `respuestasMock` (data layer) porque necesitan
  // valores en runtime (días de atraso, total a pagar, etc.).
  const responderContextual = (texto: string): MensajeChat | null => {
    if (!estadoPago.vencido) return null;
    const t = texto.toLowerCase();

    if (/(cu[áa]nto|monto).*(debo|deuda|pagar)|deuda total/.test(t)) {
      return {
        id: `a_${Date.now()}`,
        rol: 'ASSISTANT',
        contenido:
          `Hoy tu deuda es ${formatMonto(estadoPago.totalAPagar)}. ` +
          `Eso incluye el alquiler vencido más ${formatMonto(estadoPago.punitorioAcumulado)} de punitorios acumulados ` +
          `por ${estadoPago.diasAtraso} día${estadoPago.diasAtraso === 1 ? '' : 's'} de atraso. ` +
          `Si pagás hoy se cierra ahí; cada día que pase suma punitorios.`,
        createdAt: new Date().toISOString(),
      };
    }

    if (/punitor|recargo|interes|inter[ée]s/.test(t)) {
      const porDia = estadoPago.punitorioAcumulado / Math.max(1, estadoPago.diasAtraso);
      return {
        id: `a_${Date.now()}`,
        rol: 'ASSISTANT',
        contenido:
          `Los punitorios son del ${TASA_PUNITORIA_DIARIA_DEFAULT}% diario sobre el alquiler vencido (aprox. ${formatMonto(porDia)} por día). ` +
          `Hoy llevás ${estadoPago.diasAtraso} día${estadoPago.diasAtraso === 1 ? '' : 's'} de atraso y se acumularon ${formatMonto(estadoPago.punitorioAcumulado)}. ` +
          `Cuanto antes pagues, menos suma.`,
        citas: [
          {
            clausula: 'Cláusula 5ª — Mora',
            texto:
              'La falta de pago en término del alquiler devenga un punitorio diario equivalente al porcentaje pactado en el contrato.',
          },
        ],
        createdAt: new Date().toISOString(),
      };
    }

    if (/(regulariz|cancel|c[óo]mo pago|c[óo]mo lo (pago|salda)|salda)/.test(t)) {
      return {
        id: `a_${Date.now()}`,
        rol: 'ASSISTANT',
        contenido:
          `Podés regularizarlo desde "Pagar ahora" en el inicio. Tenés dos opciones: ` +
          `pagar el saldo completo (${formatMonto(estadoPago.totalAPagar)}) y quedar al día, o pagar un parcial y completar después. ` +
          `Apenas subís el comprobante, la inmobiliaria lo valida y se actualiza tu estado.`,
        createdAt: new Date().toISOString(),
      };
    }

    if (/(no pago|si no pago|qu[ée] pasa|consecuencia|desalojo)/.test(t)) {
      return {
        id: `a_${Date.now()}`,
        rol: 'ASSISTANT',
        contenido:
          `Mientras la deuda sigue impaga, se suman punitorios diarios y queda registrado en tu historial de pagos. ` +
          `Si pasan varios meses sin regularizar, la inmobiliaria puede iniciar el procedimiento contractual de rescisión. ` +
          `Antes de llegar a eso siempre podés escribirles para acordar un plan.`,
        createdAt: new Date().toISOString(),
      };
    }

    return null;
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

    // 1) Primero matcheamos contra respuestas contextuales (dependen del
    //    estado de pago en runtime). 2) Si no, caemos a `respuestasMock`.
    const contextual = responderContextual(texto);
    const match = !contextual ? respuestasMock.find((r) => r.patron.test(texto)) : null;
    const respuesta: MensajeChat = contextual
      ? contextual
      : match
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
          <div className="flex items-start gap-3 min-w-0">
            <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <Sparkles className="h-5 w-5" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500/60" />
                <span className="relative h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">Asistente</h1>
                <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Online
                </span>
              </div>
              {/* En mobile angosto la dirección se cortaba ("Gorriti
                  45...") y confundía. Mostramos solo el copy
                  funcional; la dirección ya se sabe en /contrato. */}
              <p className="truncate text-xs text-muted-foreground">
                Ayuda con pagos, deuda y trámites
              </p>
            </div>
          </div>
          {mensajes.length > 1 && (
            <button
              type="button"
              onClick={reiniciarChat}
              className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Reiniciar conversación"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <main
        className="flex flex-1 flex-col gap-3 overflow-y-auto p-5"
        aria-live="polite"
        aria-label="Conversación con el Asistente"
      >
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
        {!pensando && (
          // Antes: `flex overflow-x-auto` + `shrink-0` chips. Eso
          // dejaba el segundo chip ("¿Cómo se calculan los
          // punitorios?") cortado a la derecha en mobile angosto, y
          // el fade hint sugería que había más pero no era obvio que
          // se podía scrollear. Ahora `flex-wrap` permite que envuelva
          // a 2 líneas — sin chips truncos y sin gestos ocultos.
          <div className="flex flex-wrap gap-2">
            {obtenerSugerenciasParaUltimo(mensajes, sugerenciasBase).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => enviar(s)}
                className="rounded-full border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent"
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
            placeholder="Preguntale al asistente"
            aria-label="Pregunta al asistente"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={pensando}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || pensando}
            aria-label="Enviar mensaje"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <NavBar />
    </>
  );
}
