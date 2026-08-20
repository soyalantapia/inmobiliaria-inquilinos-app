'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Ban,
  Banknote,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileText,
  MapPin,
  MessageCircle,
  Phone,
  Wallet,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { cn } from '@llave/ui/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { propiedadesMock, contratosMock } from '@/lib/mock-data';
import { apiEnabled } from '@/lib/api/client';
import { useRendicionesList } from '@/lib/api/use-rendiciones';
import {
  listarRendicionesDePropietario,
  type Rendicion,
} from '@/lib/rendiciones-storage';
import { formatFechaCorta, formatMonto, formatPeriodo, formatTotalPorMoneda } from '@/lib/format';
import { rotuloEnLinea, rotuloPrincipal, rotuloSecundario } from '@/lib/rotulo-propiedad';
import type { Propietario } from '@/lib/types';

/**
 * Drawer/dialog que muestra el historial del propietario: rendiciones,
 * propiedades vinculadas, contratos. Centro de información de una mirada.
 */

// Antes este helper duplicaba la tabla de meses en minúscula y dejaba
// "mayo 2026" mientras el resto de la app usa "Mayo 2026". Lo
// unificamos al helper compartido formatPeriodo.
const periodoLabel = (p: string): string => formatPeriodo(p);

const metodoLabel: Record<Rendicion['metodo'], string> = {
  TRANSFERENCIA: 'Transferencia',
  MERCADOPAGO: 'Mercado Pago',
  EFECTIVO: 'Efectivo',
};

interface HistorialPropietarioDialogProps {
  propietario: Propietario | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function HistorialPropietarioDialog({
  propietario,
  open,
  onOpenChange,
}: HistorialPropietarioDialogProps) {
  // En prod las rendiciones salen del server (GET /rendiciones); en demo, de
  // localStorage. Antes solo leía localStorage → historial en $0 en prod aunque
  // ya le hubieras rendido.
  // CON las anuladas. Es la única pantalla del panel que las quiere: acá es donde el operador
  // viene a buscar por qué al dueño le falta un depósito, y esconderlas convierte esa pregunta
  // en un misterio. En el resto del panel siguen ocultas, que es lo correcto para "¿ya se le
  // rindió?".
  const { rendiciones: rendicionesApi } = useRendicionesList({ incluirAnuladas: true });
  const rendiciones = useMemo(() => {
    if (!propietario) return [];
    if (apiEnabled) {
      return rendicionesApi
        .filter((r) => r.propietarioId === propietario.id)
        .map((r) => ({
          id: r.id,
          propietarioId: r.propietarioId,
          periodo: r.periodo,
          montoBruto: Number(r.montoBruto),
          comisionPct: r.comisionPct,
          totalGastos: Number(r.totalGastos),
          montoNeto: Number(r.montoNeto),
          moneda: r.moneda ?? 'ARS',
          rendidoAt: r.rendidoAt,
          metodo: r.metodo,
          notas: r.notas,
          anuladaAt: r.anuladaAt ?? null,
          motivoAnulacion: r.motivoAnulacion ?? null,
        }));
    }
    return listarRendicionesDePropietario(propietario.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propietario, open, rendicionesApi]);

  const propiedades = useMemo(() => {
    if (!propietario) return [];
    return propiedadesMock.filter((p) =>
      p.propietariosIds.includes(propietario.id),
    );
  }, [propietario]);

  const contratos = useMemo(() => {
    if (!propietario) return [];
    const propIds = new Set(propiedades.map((p) => p.id));
    return contratosMock.filter((c) =>
      propiedades.some((p) => p.contratoActualId === c.id) ||
      propIds.has(c.id),
    );
  }, [propietario, propiedades]);

  // DESGLOSADO POR MONEDA, no sumado. Esto era `reduce((s, r) => s + r.montoBruto, 0)`: un
  // dueño con una unidad en pesos y otra en dólares veía los dos montos sumados en un número
  // que no existe, y `formatMonto` sin moneda lo pintaba de pesos, así que el error quedaba
  // tapado. Es el total histórico que Camila le lee al dueño cuando llama a preguntar.
  // `formatTotalPorMoneda` ya existía, testeado y hecho para esto: con una sola moneda se ve
  // igual que antes.
  // Los totales cuentan SÓLO las vigentes. La lista de abajo las muestra a todas —tachadas
  // las anuladas— pero este número es el que el operador le lee al dueño por teléfono, y una
  // anulada ahí adentro es plata que no salió.
  const vigentes = rendiciones.filter((r) => !r.anuladaAt);
  const cuantasAnuladas = rendiciones.length - vigentes.length;
  const totalCobradoHistorico = formatTotalPorMoneda(
    vigentes.map((r) => ({ monto: r.montoBruto, moneda: r.moneda })),
  );
  const totalNetoHistorico = formatTotalPorMoneda(
    vigentes.map((r) => ({ monto: r.montoNeto, moneda: r.moneda })),
  );

  if (!propietario) return null;

  const tel = propietario.telefono.replace(/[^\d]/g, '');
  const waUrl = `https://wa.me/${tel}`;
  const telUrl = `tel:${propietario.telefono.replace(/\s/g, '')}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            {propietario.nombre} {propietario.apellido}
            <Badge variant="outline" className="text-[10px]">
              CUIT {propietario.cuit}
            </Badge>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-3 text-xs">
            <span>{propietario.email}</span>
            <span>·</span>
            <span>{propietario.telefono}</span>
            <span>·</span>
            <span>Comisión {propietario.comisionPct}%</span>
          </DialogDescription>
        </DialogHeader>

        {/* Métricas histórico */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <MetricBox
            label="Unidades"
            value={(apiEnabled ? (propietario.propiedadesIds?.length ?? 0) : propiedades.length).toString()}
            icon={<MapPin className="h-3 w-3 text-primary" />}
          />
          <MetricBox
            label="Contratos"
            value={contratos.length.toString()}
            icon={<FileText className="h-3 w-3 text-primary" />}
          />
          <MetricBox
            label="Rendiciones"
            /* Las vigentes: es la respuesta a "¿cuántas veces le depositamos?". Las anuladas
               están en la lista de abajo, pero no son un depósito y acá inflarían el número. */
            value={vigentes.length.toString()}
            icon={<CheckCircle2 className="h-3 w-3 text-emerald-600" />}
          />
          <MetricBox
            label="Neto histórico"
            /* I2-06: antes mostraba "—" (ambiguo: ¿$0, sin datos, error?).
               Ahora "$0" cuando no hubo rendiciones — coherente con el box
               "Rendiciones: 0" de al lado y con el empty state de abajo. */
            value={totalNetoHistorico}
            icon={<Banknote className="h-3 w-3 text-emerald-600" />}
          />
        </div>

        {/* Acciones rápidas — solo si hay teléfono cargado (si no, wa.me/tel
            quedaban sin número y abrían una pantalla de error). */}
        {tel ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
              asChild
            >
              <a href={waUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={telUrl}>
                <Phone className="h-4 w-4" />
                Llamar
              </a>
            </Button>
          </div>
        ) : (
          <p className="rounded-md bg-muted/50 px-2 py-1.5 text-center text-xs text-muted-foreground">
            Sin teléfono cargado — agregalo en la ficha del propietario para escribirle o llamarlo.
          </p>
        )}

        {/* CBU si lo tiene */}
        {propietario.cbuAlias && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs">
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
            {/* I2-07: antes decía sólo "Cobra en:" sin aclarar si el valor es
                un CBU o un alias. Roberto rinde plata a esa cuenta — saber el
                tipo importa para verificar antes de transferir. Detectamos:
                22 dígitos = CBU, si no = alias (igual que la ficha completa). */}
            <span className="text-muted-foreground">
              Cobra en ({/^\d{22}$/.test(propietario.cbuAlias.replace(/\s/g, '')) ? 'CBU' : 'alias'}):
            </span>
            <code className="font-mono">{propietario.cbuAlias}</code>
          </div>
        )}

        {/* Propiedades vinculadas */}
        {propiedades.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Propiedades ({propiedades.length})
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {propiedades.map((p) => (
                <Link
                  key={p.id}
                  href={`/propiedades/${p.id}`}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{rotuloPrincipal(p)}</p>
                    {/* La calle va acá cuando el título pasó a ser el complejo: es la
                        lista desde la que se ubica cuál de las unidades es. */}
                    <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                      {rotuloSecundario(p) && `${rotuloSecundario(p)} · `}
                      {p.ciudad} · {p.tipo.toLowerCase()}
                    </p>
                  </div>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Rendiciones */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Rendiciones ({vigentes.length})
            {cuantasAnuladas > 0 && (
              <span className="ml-1 font-normal normal-case tracking-normal text-destructive">
                + {cuantasAnuladas} {cuantasAnuladas === 1 ? 'anulada' : 'anuladas'}
              </span>
            )}
          </h3>
          {rendiciones.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center">
              <p className="text-sm font-medium">Sin rendiciones todavía</p>
              <p className="text-xs text-muted-foreground">
                Cuando le rindas el primer mes va a aparecer acá con el
                comprobante.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {rendiciones.map((r) => (
                <RendicionRow key={r.id} rendicion={r} />
              ))}
            </div>
          )}
          {rendiciones.length > 0 && (
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Total cobrado histórico (bruto):{' '}
              <strong className="text-foreground">
                {totalCobradoHistorico}
              </strong>
            </p>
          )}
        </div>

        {/* Notas */}
        {propietario.notas && (
          <div className="rounded-md bg-muted/40 p-3 text-xs">
            <p className="font-medium">Notas internas</p>
            <p className="italic text-muted-foreground">{propietario.notas}</p>
          </div>
        )}

        <Button variant="outline" asChild className="w-full">
          <Link
            href={`/propietarios/${propietario.id}`}
            onClick={() => onOpenChange(false)}
          >
            Abrir ficha completa
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function MetricBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/**
 * Una rendición del historial. Si está ANULADA se muestra igual, apagada y tachada.
 *
 * Esta es la única pantalla del panel donde las anuladas aparecen, y es a propósito: acá es
 * adonde viene el operador cuando el dueño llama preguntando por un depósito que no ve. Si la
 * rendición anulada no estuviera, la respuesta sería "no figura" —que es exactamente lo que
 * pasaba antes de la baja lógica, cuando anular borraba la fila—. Con el motivo a la vista, la
 * respuesta es la verdadera: se anuló, y por qué.
 */
function RendicionRow({ rendicion }: { rendicion: Rendicion }) {
  const anulada = Boolean(rendicion.anuladaAt);
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border p-3 text-sm', anulada && 'border-dashed bg-muted/30')}>
      <div
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-md',
          anulada
            ? 'bg-muted text-muted-foreground'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        )}
      >
        {anulada ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className={cn('text-sm font-medium', anulada && 'text-muted-foreground line-through')}>
            {periodoLabel(rendicion.periodo)}
          </p>
          {anulada ? (
            <Badge variant="outline" className="border-destructive/40 text-[10px] text-destructive">
              Anulada
            </Badge>
          ) : null}
          <Badge variant="outline" className="text-[10px]">
            {metodoLabel[rendicion.metodo]}
          </Badge>
        </div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Rendido el {formatFechaCorta(rendicion.rendidoAt)}
        </p>
        {rendicion.notas && (
          <p className="mt-1 text-xs italic text-muted-foreground">
            “{rendicion.notas}”
          </p>
        )}
        {/* El motivo es el punto entero de guardar la anulada: es lo que el operador le
            contesta al dueño. Va sin comillas y con etiqueta, para que no se confunda con las
            notas de la rendición. */}
        {anulada && (
          <p className="mt-1 text-xs text-destructive">
            <span className="font-medium">Motivo:</span>{' '}
            {rendicion.motivoAnulacion?.trim() || 'sin motivo registrado'}
            {rendicion.anuladaAt ? ` · ${formatFechaCorta(rendicion.anuladaAt)}` : ''}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            'text-sm font-semibold tabular-nums',
            anulada && 'font-normal text-muted-foreground line-through',
          )}
        >
          {formatMonto(rendicion.montoNeto, rendicion.moneda)}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {anulada ? 'no se depositó' : `bruto ${formatMonto(rendicion.montoBruto, rendicion.moneda)}`}
        </p>
      </div>
    </div>
  );
}
