'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Download,
  Gift,
  Mail,
  MessageCircle,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
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
  ESTADO_REFERIDO_COLOR,
  ESTADO_REFERIDO_LABEL,
  cancelarInvitacion,
  invitarColega,
  leerReferidos,
  mensajeInvitacion,
  resumenReferidos,
  urlInvitacion,
  type ReferidosState,
} from '@/lib/referidos-storage';
import { abrirReporteImprimible } from '@/lib/reportes-pdf';
import { sociedadPrincipal } from '@/lib/sociedades-storage';
import { formatFecha } from '@/lib/format';

/**
 * Manager del programa de referidos: muestra código, link de
 * invitación, resumen de invitados y kit descargable para compartir.
 *
 * Loop esperado:
 * 1. La inmo agarra el link / código.
 * 2. Lo manda a sus colegas por WhatsApp.
 * 3. Cada colega que se da de alta suma 1 mes gratis a la inmo
 *    referidora (y arranca con 1 mes gratis él).
 */
export function ReferidosManager() {
  const [hidratado, setHidratado] = useState(false);
  const [state, setState] = useState<ReferidosState | null>(null);
  const [invitarOpen, setInvitarOpen] = useState(false);
  const [verMensaje, setVerMensaje] = useState(false);

  const recargar = () => setState(leerReferidos());

  useEffect(() => {
    recargar();
    setHidratado(true);
  }, []);

  const resumen = useMemo(() => (state ? resumenReferidos() : null), [state]);

  if (!hidratado || !state || !resumen) return null;

  const link = urlInvitacion(state.codigo);

  const copiar = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copiado`, description: 'Pegalo donde lo necesites.' });
    } catch {
      toast({ title: 'No pudimos copiar', variant: 'destructive' });
    }
  };

  const descargarOnePager = () => {
    const soc = sociedadPrincipal();
    abrirReporteImprimible({
      titulo: 'My Alquiler · Invitación a colegas',
      subtitulo: `Te recomienda ${soc.nombreComercial} · Código ${state.codigo}`,
      inmobiliaria: soc.razonSocial,
      columnas: [
        { header: 'Lo que resolvés', width: '50%' },
        { header: 'En la plataforma', width: '50%' },
      ],
      filas: [
        ['Cobranzas a inquilinos', 'Validador por resumen + lectura IA del comprobante'],
        ['Rendición a propietarios', 'Dashboard de cartera + PDF con desglose'],
        ['Reclamos / mantenimiento', 'Red de profesionales con link mágico'],
        ['Renovaciones', 'Negociador IA con propuesta de aumento'],
        ['Comunicación con inquilino', 'WhatsApp como canal principal'],
        ['Multi-sociedad', 'S.R.L. + S.A. + fideicomisos en una cuenta'],
        ['Consorcios', 'Módulo aparte para PH'],
        ['Facturación ARCA', 'Automática al conciliar el pago'],
      ],
      totales: [
        { label: 'Mes gratis al sumarse', valor: '1 mes' },
        { label: 'Trial completo', valor: '6 meses (promotores)' },
      ],
      notaFinal:
        `Usá el código ${state.codigo} al darte de alta o ingresá directo a ${link}. ` +
        'Cualquier consulta te respondemos por WhatsApp el mismo día.',
    });
  };

  const descargarFaq = () => {
    abrirReporteImprimible({
      titulo: 'FAQ · My Alquiler para inmobiliarias',
      subtitulo: 'Lo que más nos preguntan',
      inmobiliaria: sociedadPrincipal().razonSocial,
      columnas: [
        { header: 'Pregunta', width: '40%' },
        { header: 'Respuesta', width: '60%' },
      ],
      filas: [
        [
          '¿Cuánto sale?',
          '4 planes por tramo de cartera: hasta 10 propiedades $50k, hasta 50 $100k, hasta 100 $200k, hasta 250 $350k. Sin permanencia.',
        ],
        [
          '¿Necesito instalar algo?',
          'No. Es web — funciona en cualquier navegador y desde el celular. Los inquilinos usan una PWA que se instala como app pero sin pasar por la store.',
        ],
        [
          '¿Migra mi cartera actual?',
          'Sí. Te subimos los contratos en una sesión inicial sin cargo. Después cargás los pagos que ya cobraste a mano y arranca al día siguiente.',
        ],
        [
          '¿Cómo cobra el inquilino?',
          'Le mandás link directo de pago. El validador lee el comprobante con IA y vos confirmás en un click. También podés conectar el resumen de tu banco para conciliar en bloque.',
        ],
        [
          '¿Y los reclamos?',
          'El inquilino lo carga desde la app, vos lo asignás a un profesional de tu red. El profesional confirma visita por WhatsApp con un link mágico (sin login).',
        ],
        [
          '¿Hay convenio con mi colegio?',
          'Tenemos acuerdos activos con CUCICBA, CPI Córdoba, Edifica y otros en firma. Mirá la tab Convenios en /configuración.',
        ],
        [
          '¿Y mis datos?',
          'Encriptados en tránsito y en reposo. Backups diarios. Nunca pedimos credenciales bancarias del inquilino ni de tu cuenta — solo trabajamos con archivos que subís vos.',
        ],
      ],
    });
  };

  return (
    <div className="space-y-5">
      {/* Header explicativo + ganancia */}
      <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-violet-50/30 dark:border-violet-900/40 dark:from-violet-900/15 dark:to-violet-900/5">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-violet-600 text-white">
              <Gift className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold">Programa de referidos</p>
              <p className="text-xs text-muted-foreground">
                Por cada colega que se sume, sumás <strong>1 mes gratis</strong> y
                tu colega también arranca con <strong>1 mes gratis</strong>. No tiene
                tope.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiRef label="Meses gratis ganados" valor={`${resumen.mesesGratisGanados}`} highlight />
            <KpiRef label="Colegas activos" valor={`${resumen.activos}`} />
            <KpiRef label="Registrados (sin operar)" valor={`${resumen.registrados}`} />
            <KpiRef label="Invitados pendientes" valor={`${resumen.invitados}`} />
          </div>
        </CardContent>
      </Card>

      {/* Tu código + acciones de compartir */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Tu código de referido
              </p>
              <p className="font-mono text-2xl font-bold tabular-nums">
                {state.codigo}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => copiar(state.codigo, 'Código')}>
              <Copy className="h-3.5 w-3.5" />
              Copiar código
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Link directo</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={link}
                className="font-mono text-xs"
                onFocus={(e) => e.target.select()}
              />
              <Button size="sm" variant="outline" onClick={() => copiar(link, 'Link')}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => {
                const url = `https://wa.me/?text=${encodeURIComponent(mensajeInvitacion(state.codigo))}`;
                window.open(url, '_blank', 'noopener');
              }}
            >
              <MessageCircle className="h-4 w-4" />
              Compartir por WhatsApp
            </Button>
            <Button variant="outline" onClick={() => setVerMensaje(true)}>
              <Mail className="h-4 w-4" />
              Ver mensaje sugerido
            </Button>
            <Button variant="outline" onClick={() => setInvitarOpen(true)}>
              <Plus className="h-4 w-4" />
              Invitar a alguien
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Kit descargable (material de venta) */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Material de venta</p>
              <p className="text-xs text-muted-foreground">
                Imprimí o mandá estos PDFs cuando le presentes My Alquiler a
                colegas. Salen con tu sociedad como referencia.
              </p>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <Button variant="outline" className="justify-start" onClick={descargarOnePager}>
              <Download className="h-4 w-4" />
              One-pager · qué resolvemos
            </Button>
            <Button variant="outline" className="justify-start" onClick={descargarFaq}>
              <Download className="h-4 w-4" />
              FAQ · preguntas frecuentes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Listado de referidos */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">
                Tus invitaciones ({state.referidos.length})
              </p>
              <p className="text-xs text-muted-foreground">
                Seguimos automáticamente quién se registró y empezó a operar.
              </p>
            </div>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          {state.referidos.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Todavía no invitaste a nadie. Compartí tu código y empezá a sumar
              meses gratis.
            </div>
          ) : (
            <div className="space-y-2">
              {state.referidos.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-md border p-3"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    {r.nombre
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-medium">{r.nombre}</p>
                      <Badge className={`text-[10px] ${ESTADO_REFERIDO_COLOR[r.estado]}`}>
                        {ESTADO_REFERIDO_LABEL[r.estado]}
                      </Badge>
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {r.email}
                      {r.inmobiliaria && ` · ${r.inmobiliaria}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      <Clock className="mr-1 inline h-2.5 w-2.5" />
                      {r.estado === 'ACTIVO' && r.activoDesde
                        ? `Operando desde ${formatFecha(r.activoDesde)}`
                        : r.estado === 'REGISTRADO' && r.registradoAt
                          ? `Se registró el ${formatFecha(r.registradoAt)}`
                          : `Invitado el ${formatFecha(r.invitadoAt)}`}
                    </p>
                  </div>
                  {r.estado === 'INVITADO' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        cancelarInvitacion(r.id);
                        recargar();
                        toast({ title: 'Invitación cancelada' });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <InvitarDialog
        open={invitarOpen}
        codigo={state.codigo}
        onClose={() => setInvitarOpen(false)}
        onInvitado={() => {
          recargar();
          setInvitarOpen(false);
        }}
      />

      <MensajeSugeridoDialog
        open={verMensaje}
        onClose={() => setVerMensaje(false)}
        mensaje={mensajeInvitacion(state.codigo)}
        onCopiar={(t) => copiar(t, 'Mensaje')}
      />
    </div>
  );
}

function KpiRef({
  label,
  valor,
  highlight,
}: {
  label: string;
  valor: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md border bg-background/60 p-3">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-0.5 text-2xl font-bold tabular-nums ${
          highlight ? 'text-violet-700 dark:text-violet-300' : ''
        }`}
      >
        {valor}
      </p>
    </div>
  );
}

function InvitarDialog({
  open,
  codigo,
  onClose,
  onInvitado,
}: {
  open: boolean;
  codigo: string;
  onClose: () => void;
  onInvitado: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [inmobiliaria, setInmobiliaria] = useState('');
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const puedeInvitar = nombre.trim().length >= 2 && emailOk;

  useEffect(() => {
    if (open) {
      setNombre('');
      setEmail('');
      setInmobiliaria('');
    }
  }, [open]);

  const submit = () => {
    if (!puedeInvitar) return;
    invitarColega({ nombre, email, inmobiliaria });
    toast({
      variant: 'success',
      title: `Invitación enviada a ${nombre.split(' ')[0]}`,
      description: `Le llega un mail con el código ${codigo} y el link directo.`,
    });
    onInvitado();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-violet-600" />
            Invitar a un colega
          </DialogTitle>
          <DialogDescription>
            Le mandamos un mail desde tu cuenta con el código y el link
            directo. Si se da de alta, sumás 1 mes gratis.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ref-nom">Nombre</Label>
            <Input
              id="ref-nom"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Juan García"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ref-email">Email</Label>
            <Input
              id="ref-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@inmobiliaria.com.ar"
            />
            {email.length > 0 && !emailOk && (
              <p className="text-[11px] text-destructive">Email inválido</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ref-inm" className="flex items-center gap-1.5">
              Inmobiliaria
              <span className="text-[10px] font-normal text-muted-foreground">opcional</span>
            </Label>
            <Input
              id="ref-inm"
              value={inmobiliaria}
              onChange={(e) => setInmobiliaria(e.target.value)}
              placeholder="García Propiedades"
            />
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!puedeInvitar}>
            <Mail className="h-4 w-4" />
            Enviar invitación
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MensajeSugeridoDialog({
  open,
  onClose,
  mensaje,
  onCopiar,
}: {
  open: boolean;
  onClose: () => void;
  mensaje: string;
  onCopiar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState(mensaje);
  useEffect(() => {
    if (open) setTexto(mensaje);
  }, [open, mensaje]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            Mensaje sugerido
          </DialogTitle>
          <DialogDescription>
            Editalo si querés y compartilo por WhatsApp, email o el canal que
            uses con tus colegas.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={14}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="font-mono text-xs"
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onCopiar(texto)}>
            <Copy className="h-4 w-4" />
            Copiar
          </Button>
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => {
              const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
              window.open(url, '_blank', 'noopener');
            }}
          >
            <Check className="h-4 w-4" />
            Abrir en WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
