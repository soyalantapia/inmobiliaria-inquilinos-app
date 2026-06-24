'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  TrendingDown,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import {
  contactosCobranzaMock,
  contratosMock,
  type ContactoCobranza,
} from '@/lib/mock-data';
import { consorciosMock } from '@/lib/consorcios-storage';
import { diasHastaVencimiento, formatFechaCorta, formatMonto } from '@/lib/format';

/**
 * Plantillas de mensaje pre-armadas para cobranza. La inmo elige el
 * tono y edita antes de mandar. Cada plantilla apunta al titular o al
 * garante.
 */
const PLANTILLAS: Array<{
  id: string;
  destinatario: 'titular' | 'garante';
  titulo: string;
  cuerpo: string;
}> = [
  {
    id: 'recordatorio-titular',
    destinatario: 'titular',
    titulo: 'Recordatorio cordial · titular',
    cuerpo:
      'Hola {nombre}! Te paso a recordar que el alquiler de {direccion} venció el {vencimiento} ({dias} días de atraso). Por favor avisame cuándo podés regularizar para que no se sumen punitorios. Quedo atenta!',
  },
  {
    id: 'segundo-aviso-titular',
    destinatario: 'titular',
    titulo: 'Segundo aviso · titular',
    cuerpo:
      'Hola {nombre}, sigo sin novedades del alquiler vencido de {direccion}. El alquiler adeudado es {monto}. Necesito que me confirmes fecha de pago hoy mismo. Si no podés pagar el total, hablamos para armar un plan.',
  },
  {
    id: 'aviso-garante',
    destinatario: 'garante',
    titulo: 'Aviso al garante',
    cuerpo:
      'Hola {nombre}, te escribo desde {inmobiliaria}. {inquilino} es inquilino de {direccion} y figurás como garante. El alquiler de mayo venció hace {dias} días por {monto} y no logramos contactarlo. Te pido que coordines con él el pago a la brevedad.',
  },
  {
    id: 'intimacion-final',
    destinatario: 'titular',
    titulo: 'Intimación previa a iniciar acciones',
    cuerpo:
      'Sr/a {nombre}: en mi carácter de administrador de {direccion} le intimo a regularizar el pago vencido por {monto} en un plazo perentorio de 48hs. Caso contrario daremos inicio a las acciones legales pertinentes según contrato.',
  },
  {
    id: 'debe-luz',
    destinatario: 'titular',
    titulo: 'Deuda de luz · servicios',
    cuerpo:
      'Hola {nombre}! Por contrato la boleta de luz está a tu cargo. La de {direccion} viene marcada como impaga y figura un atraso. Subila al perfil o pasámela por acá así no se corta el suministro y no aparece en el listado de deudores.',
  },
  {
    id: 'falta-boleta',
    destinatario: 'titular',
    titulo: 'Falta comprobante de servicios',
    cuerpo:
      'Hola {nombre}, te paso a recordar que cuando pagás los servicios (luz, gas, agua) tenés que subir la boleta paga al perfil. Sin el comprobante figura como pendiente y nos vemos obligados a marcarlo. Cualquier duda, escribime.',
  },
];

interface Props {
  inmobiliaria?: string;
}

interface MorosoEnriquecido {
  contrato: (typeof contratosMock)[number];
  contacto: ContactoCobranza | null;
  dias: number;
  consorcioId: string | null;
  consorcioNombre: string | null;
}

/**
 * Detecta a qué consorcio pertenece un contrato matcheando la calle del
 * contrato con la del consorcio. En backend real esto sería un FK,
 * pero alcanza para filtrar en la demo.
 */
function detectarConsorcio(direccion: string): {
  id: string;
  nombre: string;
} | null {
  const norm = direccion.toLowerCase().split(',')[0]?.trim() ?? '';
  for (const c of consorciosMock) {
    const calleConsorcio = c.direccion.toLowerCase().split(',')[0]?.trim() ?? '';
    if (calleConsorcio && norm.startsWith(calleConsorcio)) {
      return { id: c.id, nombre: c.nombre };
    }
  }
  return null;
}

export function MorososPanel({ inmobiliaria = 'My Alquiler' }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroConsorcio, setFiltroConsorcio] = useState<string>('TODOS');
  const [mensaje, setMensaje] = useState<{
    moroso: MorosoEnriquecido;
    plantillaId: string;
    destinatario: 'titular' | 'garante';
    texto: string;
  } | null>(null);

  const morosos = useMemo<MorosoEnriquecido[]>(() => {
    return contratosMock
      .filter((c) => c.estadoPagoActual === 'VENCIDO')
      .map((c) => {
        const cnsr = detectarConsorcio(c.direccion);
        return {
          contrato: c,
          contacto: contactosCobranzaMock.find((x) => x.contratoId === c.id) ?? null,
          dias: -diasHastaVencimiento(c.proximoVencimiento),
          consorcioId: cnsr?.id ?? null,
          consorcioNombre: cnsr?.nombre ?? null,
        };
      })
      .sort((a, b) => b.dias - a.dias);
  }, []);

  const consorciosConMorosos = useMemo(() => {
    const set = new Map<string, string>();
    morosos.forEach((m) => {
      if (m.consorcioId && m.consorcioNombre) {
        set.set(m.consorcioId, m.consorcioNombre);
      }
    });
    return Array.from(set.entries());
  }, [morosos]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return morosos.filter((m) => {
      if (filtroConsorcio !== 'TODOS' && m.consorcioId !== filtroConsorcio) {
        return false;
      }
      if (!q) return true;
      return (
        m.contrato.inquilino.toLowerCase().includes(q) ||
        m.contrato.direccion.toLowerCase().includes(q) ||
        (m.contacto?.garante?.nombre.toLowerCase().includes(q) ?? false)
      );
    });
  }, [morosos, busqueda, filtroConsorcio]);

  const total = morosos.reduce((acc, m) => acc + m.contrato.monto, 0);
  const aVisible = expandido ? filtrados : filtrados.slice(0, 3);

  if (morosos.length === 0) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-900/10">
        <CardContent className="flex items-center gap-3 p-4">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              Sin morosos este mes
            </p>
            <p className="text-xs text-emerald-900/70 dark:text-emerald-200/70">
              Todos los contratos están pagados o pendientes pero no vencidos.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const abrirPlantilla = (
    moroso: MorosoEnriquecido,
    plantillaId: string,
  ) => {
    const tpl = PLANTILLAS.find((p) => p.id === plantillaId);
    if (!tpl) return;
    const destino =
      tpl.destinatario === 'garante' && moroso.contacto?.garante
        ? moroso.contacto.garante
        : moroso.contacto?.titular ?? null;
    // Sólo el nombre de pila — "Hola Laura" suena más cercano que
    // "Hola Laura Giménez" en un WhatsApp de cobranza.
    const nombre = destino?.nombre?.split(' ')[0] ?? 'cliente';
    const dias = moroso.dias;
    const monto = formatMonto(moroso.contrato.monto, moroso.contrato.moneda);
    const texto = tpl.cuerpo
      .replace(/\{nombre\}/g, nombre)
      .replace(/\{direccion\}/g, moroso.contrato.direccion)
      .replace(/\{inquilino\}/g, moroso.contrato.inquilino)
      .replace(/\{vencimiento\}/g, formatFechaCorta(moroso.contrato.proximoVencimiento))
      .replace(/\{dias\}/g, String(dias))
      .replace(/\{monto\}/g, monto)
      .replace(/\{inmobiliaria\}/g, inmobiliaria);
    setMensaje({
      moroso,
      plantillaId,
      destinatario: tpl.destinatario,
      texto,
    });
  };

  const mandarWhatsapp = () => {
    if (!mensaje) return;
    const tel =
      mensaje.destinatario === 'garante'
        ? mensaje.moroso.contacto?.garante?.telefono
        : mensaje.moroso.contacto?.titular.telefono;
    if (!tel) {
      toast({
        variant: 'destructive',
        title: 'Sin teléfono',
        description: `No tenemos teléfono del ${mensaje.destinatario}.`,
      });
      return;
    }
    const telLimpio = tel.replace(/[^\d]/g, '');
    const url = `https://wa.me/${telLimpio}?text=${encodeURIComponent(mensaje.texto)}`;
    window.open(url, '_blank', 'noopener');
    setMensaje(null);
  };

  return (
    <Card className="border-destructive/30">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                Morosos · {morosos.length} contrato{morosos.length === 1 ? '' : 's'}
              </p>
              {/* Antes el monto total aparecía DOS veces (en el detalle
                  acá y en un Badge destructive a la derecha) — quitamos
                  el texto duplicado y dejamos solo el badge prominente. */}
              <p className="text-xs text-muted-foreground">
                Datos de titular y garante listos para llamar, mandar
                WhatsApp o mail.
              </p>
            </div>
          </div>
          <Badge variant="destructive" className="shrink-0 gap-1 text-xs">
            <TrendingDown className="h-3 w-3" />
            Deuda total {formatMonto(total)}
          </Badge>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            placeholder="Buscar por inquilino, dirección o garante…"
            aria-label="Buscar morosos"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {consorciosConMorosos.length > 0 && (
            <select
              value={filtroConsorcio}
              onChange={(e) => setFiltroConsorcio(e.target.value)}
              aria-label="Filtrar por consorcio"
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
            >
              <option value="TODOS">Todos los consorcios</option>
              {consorciosConMorosos.map(([id, nombre]) => (
                <option key={id} value={id}>
                  {nombre}
                </option>
              ))}
            </select>
          )}
        </div>

        <ul role="list" className="divide-y rounded-md border">
          {aVisible.map((m) => (
            <MorosoRow
              key={m.contrato.id}
              moroso={m}
              onAbrirPlantilla={(pid) => abrirPlantilla(m, pid)}
            />
          ))}
          {aVisible.length === 0 && (
            <li className="p-6 text-center text-xs text-muted-foreground">
              No coincide con la búsqueda.
            </li>
          )}
        </ul>

        {filtrados.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpandido((v) => !v)}
            className="w-full"
          >
            {expandido ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Ver solo los 3 más urgentes
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Ver los {filtrados.length} moroso{filtrados.length === 1 ? '' : 's'}
              </>
            )}
          </Button>
        )}
      </CardContent>

      <Dialog
        open={!!mensaje}
        onOpenChange={(o) => !o && setMensaje(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              Mensaje a{' '}
              {mensaje?.destinatario === 'garante' ? 'garante' : 'titular'}
            </DialogTitle>
          </DialogHeader>
          {mensaje && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/40 p-2 text-xs">
                <p className="font-medium">{mensaje.moroso.contrato.inquilino}</p>
                <p className="text-muted-foreground">
                  {mensaje.moroso.contrato.direccion} · {mensaje.moroso.dias} día
                  {mensaje.moroso.dias === 1 ? '' : 's'} de atraso
                </p>
              </div>
              <div role="group" aria-labelledby="mp-plantilla-label" className="space-y-1">
                <p id="mp-plantilla-label" className="text-xs font-medium leading-none">Plantilla</p>
                <div className="flex flex-wrap gap-1.5">
                  {PLANTILLAS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={p.id === mensaje.plantillaId}
                      onClick={() => abrirPlantilla(mensaje.moroso, p.id)}
                      className={`rounded-full border px-2.5 py-1 text-[10px] transition-colors ${
                        p.id === mensaje.plantillaId
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:bg-muted/40'
                      }`}
                    >
                      {p.titulo}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mensaje-cuerpo" className="text-xs">
                  Texto a enviar (podés editarlo)
                </Label>
                <Textarea
                  id="mensaje-cuerpo"
                  rows={6}
                  value={mensaje.texto}
                  onChange={(e) =>
                    setMensaje({ ...mensaje, texto: e.target.value })
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setMensaje(null)}>
                  Cancelar
                </Button>
                <Button onClick={mandarWhatsapp}>
                  <MessageCircle className="h-4 w-4" />
                  Abrir WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function MorosoRow({
  moroso,
  onAbrirPlantilla,
}: {
  moroso: MorosoEnriquecido;
  onAbrirPlantilla: (plantillaId: string) => void;
}) {
  const c = moroso.contrato;
  const contacto = moroso.contacto;
  const tonoUrgencia =
    moroso.dias > 30 ? 'destructive' : moroso.dias > 15 ? 'warning' : 'outline';
  return (
    <li className="space-y-2 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{c.inquilino}</p>
            <Badge variant={tonoUrgencia} className="text-[10px]">
              {moroso.dias} día{moroso.dias === 1 ? '' : 's'}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {formatMonto(c.monto, c.moneda)}
            </Badge>
            {moroso.consorcioNombre && (
              <Badge variant="secondary" className="text-[9px]">
                {moroso.consorcioNombre}
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{c.direccion}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAbrirPlantilla('recordatorio-titular')}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-xs">Avisar titular</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-2 rounded-md border bg-muted/30 p-2 text-xs sm:grid-cols-2">
        <ContactoBloque
          rol="Titular"
          nombre={contacto?.titular.nombre ?? c.inquilino}
          telefono={contacto?.titular.telefono ?? null}
          email={contacto?.titular.email ?? null}
        />
        {contacto?.garante ? (
          <ContactoBloque
            rol={`Garante · ${contacto.garante.tipo}`}
            nombre={contacto.garante.nombre}
            telefono={contacto.garante.telefono}
            email={null}
            onMensaje={() => onAbrirPlantilla('aviso-garante')}
          />
        ) : (
          <div className="rounded-md border border-dashed bg-background/40 p-2 text-[11px] text-muted-foreground">
            Sin garante registrado · cargá uno desde el contrato.
          </div>
        )}
      </div>
    </li>
  );
}

function ContactoBloque({
  rol,
  nombre,
  telefono,
  email,
  onMensaje,
}: {
  rol: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  onMensaje?: () => void;
}) {
  const telLimpio = telefono?.replace(/[^\d]/g, '');
  return (
    <div className="rounded-md border bg-background/60 p-2">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {rol}
      </p>
      <p className="text-xs font-semibold">{nombre}</p>
      <div className="flex flex-wrap items-center gap-1 pt-1">
        {telefono && telLimpio && (
          <>
            <a
              href={`tel:${telLimpio}`}
              className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[10px] hover:bg-muted/40"
            >
              <Phone className="h-3 w-3" />
              {telefono}
            </a>
            <a
              href={`https://wa.me/${telLimpio}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 hover:bg-emerald-100"
            >
              <MessageCircle className="h-3 w-3" />
              WA
            </a>
          </>
        )}
        {email && (
          <a
            href={`mailto:${email}`}
            className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[10px] hover:bg-muted/40"
          >
            <Mail className="h-3 w-3" />
            Mail
          </a>
        )}
        {onMensaje && (
          <button
            type="button"
            onClick={onMensaje}
            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5 text-[10px] text-primary hover:bg-primary/10"
          >
            <Sparkles className="h-3 w-3" />
            Avisar garante
          </button>
        )}
      </div>
    </div>
  );
}
