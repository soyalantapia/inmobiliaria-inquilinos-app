'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
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
import {
  listarRendicionesDePropietario,
  type Rendicion,
} from '@/lib/rendiciones-storage';
import { formatFechaCorta, formatMonto, formatPeriodo } from '@/lib/format';
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
  const rendiciones = useMemo(() => {
    if (!propietario) return [];
    return listarRendicionesDePropietario(propietario.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propietario, open]);

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

  const totalCobradoHistorico = rendiciones.reduce((s, r) => s + r.montoBruto, 0);
  const totalNetoHistorico = rendiciones.reduce((s, r) => s + r.montoNeto, 0);

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
            value={propiedades.length.toString()}
            icon={<MapPin className="h-3 w-3 text-primary" />}
          />
          <MetricBox
            label="Contratos"
            value={contratos.length.toString()}
            icon={<FileText className="h-3 w-3 text-primary" />}
          />
          <MetricBox
            label="Rendiciones"
            value={rendiciones.length.toString()}
            icon={<CheckCircle2 className="h-3 w-3 text-emerald-600" />}
          />
          <MetricBox
            label="Neto histórico"
            /* I2-06: antes mostraba "—" (ambiguo: ¿$0, sin datos, error?).
               Ahora "$0" cuando no hubo rendiciones — coherente con el box
               "Rendiciones: 0" de al lado y con el empty state de abajo. */
            value={formatMonto(totalNetoHistorico)}
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
                    <p className="truncate text-sm font-medium">{p.direccion}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
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
            Rendiciones ({rendiciones.length})
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
                {formatMonto(totalCobradoHistorico)}
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

function RendicionRow({ rendicion }: { rendicion: Rendicion }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3 text-sm">
      <div
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        )}
      >
        <CheckCircle2 className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium">{periodoLabel(rendicion.periodo)}</p>
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
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums">
          {formatMonto(rendicion.montoNeto)}
        </p>
        <p className="text-[10px] text-muted-foreground">
          bruto {formatMonto(rendicion.montoBruto)}
        </p>
      </div>
    </div>
  );
}
