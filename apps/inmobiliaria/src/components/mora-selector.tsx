'use client';

/**
 * Selector reutilizable de esquema de mora (punitorio por pago tardío).
 * Lo comparten el wizard de contratos ("Interés por mora"), la card de
 * Configuración ("Mora por defecto") y el diálogo de edición en el detalle
 * del contrato. Renderiza: selector de esquema + input de valor (con label
 * dinámico según el esquema) + preview en vivo "Con 10 días de atraso: +$X".
 */

import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@llave/ui/select';
import type { Moneda, TipoMora } from '@/lib/types';

/** Lo que puede elegir el usuario: un esquema concreto o heredar el default. */
export type MoraSeleccion = TipoMora | 'HEREDAR';

/** Default de mora de la inmobiliaria (GET /cobranza → mora). */
export interface MoraHeredada {
  tipo: TipoMora;
  valor: number | null;
  /** Moneda del DEFAULT, no la del contrato. Ver `moraEfectivaDe`. */
  moneda: Moneda;
}

export const MORA_TIPOS: Array<{ value: TipoMora; label: string }> = [
  { value: 'SIN_MORA', label: 'Sin mora' },
  { value: 'PORCENTAJE_DIARIO', label: '% por día de atraso' },
  { value: 'MONTO_FIJO', label: 'Monto fijo por mes de atraso' },
  { value: 'PORCENTAJE_MENSUAL', label: '% mensual (prorrateado por día)' },
];

/** Label del input de valor, según el esquema elegido. */
const VALOR_LABEL: Record<Exclude<TipoMora, 'SIN_MORA'>, string> = {
  PORCENTAJE_DIARIO: '% por día',
  MONTO_FIJO: 'Monto fijo por mes de atraso',
  PORCENTAJE_MENSUAL: '% mensual',
};

/**
 * Mora acumulada a los `diasAtraso` días, según el esquema:
 *  - diario: monto × valor/100 × días
 *  - fijo: valor × meses de atraso INICIADOS (días 1-30 → 1, 31-60 → 2, …)
 *  - mensual: monto × valor/100 × (días/30)
 */
export function calcularMora(
  tipo: TipoMora,
  valor: number,
  montoBase: number,
  diasAtraso: number,
): number {
  if (diasAtraso <= 0 || valor <= 0) return 0;
  switch (tipo) {
    case 'PORCENTAJE_DIARIO':
      return montoBase * (valor / 100) * diasAtraso;
    case 'MONTO_FIJO':
      return valor * Math.max(1, Math.ceil(diasAtraso / 30));
    case 'PORCENTAJE_MENSUAL':
      return montoBase * (valor / 100) * (diasAtraso / 30);
    default:
      return 0;
  }
}

/**
 * EL ESQUEMA QUE VA A APLICAR DE VERDAD — el mismo cálculo que `resolverEsquemaMora` del
 * server (`apps/api/src/lib/punitorios.ts`), que es quien manda.
 *
 * La regla que faltaba de este lado (T-58): un default `MONTO_FIJO` es un IMPORTE ABSOLUTO y
 * sólo vale en su propia moneda. Un default de 5.000 cargado pensando en pesos —la pantalla
 * que lo carga ni siquiera pedía moneda— aplicado sobre un contrato en dólares le reclama al
 * inquilino US$ 5.000 de punitorio. Los otros esquemas son porcentajes sobre una base que ya
 * está en la moneda del contrato: se heredan siempre.
 *
 * El panel reimplementaba la herencia sin esta parte, y no quedaba en un cartel equivocado: el
 * wizard de alta prefillea con esto la mora de cada período vencido y la manda como
 * `moraManual`. El server la persiste en `montoPunitorioManual`, y `calcularMora` arranca con
 * `if (manual != null) return manual` — o sea que el número del front PISA el `SIN_MORA` que
 * el propio server había resuelto. Deuda punitoria real, cobrable, y visible en la PWA del
 * inquilino.
 *
 * `herenciaDescartada` es para avisarle al usuario POR QUÉ el interés quedó en cero, en vez de
 * mostrarle un cero mudo.
 */
export function moraEfectivaDe(
  seleccion: MoraSeleccion,
  valorInput: string | number,
  heredado: MoraHeredada | null | undefined,
  monedaContrato: Moneda,
): { tipo: TipoMora; valor: number; herenciaDescartada: boolean } {
  if (seleccion !== 'HEREDAR') {
    return { tipo: seleccion, valor: Number(valorInput) || 0, herenciaDescartada: false };
  }
  if (!heredado || heredado.tipo === 'SIN_MORA') {
    return { tipo: 'SIN_MORA', valor: 0, herenciaDescartada: false };
  }
  if (heredado.tipo === 'MONTO_FIJO' && heredado.moneda !== monedaContrato) {
    return { tipo: 'SIN_MORA', valor: 0, herenciaDescartada: true };
  }
  return { tipo: heredado.tipo, valor: heredado.valor ?? 0, herenciaDescartada: false };
}

function formatPct(valor: number | null): string {
  return (valor ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

/** Descripción corta legible: "0,15% por día", "$5.000 por mes de atraso", "Sin mora". */
export function descripcionMora(
  tipo: TipoMora,
  valor: number | null,
  moneda: Moneda = 'ARS',
): string {
  const simbolo = moneda === 'USD' ? 'US$' : '$';
  switch (tipo) {
    case 'SIN_MORA':
      return 'Sin mora';
    case 'PORCENTAJE_DIARIO':
      return `${formatPct(valor)}% por día`;
    case 'MONTO_FIJO':
      return `${simbolo} ${Math.round(valor ?? 0).toLocaleString('es-AR')} por mes de atraso`;
    case 'PORCENTAJE_MENSUAL':
      return `${formatPct(valor)}% mensual`;
  }
}

export function MoraSelector({
  seleccion,
  valor,
  onSeleccionChange,
  onValorChange,
  heredado,
  conHeredar = false,
  montoBase = 0,
  moneda = 'ARS',
  notaPreview,
  idPrefix = 'mora',
}: {
  seleccion: MoraSeleccion;
  /** Valor crudo del input (string, dígitos/decimal según el esquema). */
  valor: string;
  onSeleccionChange: (s: MoraSeleccion) => void;
  onValorChange: (v: string) => void;
  /** Default de la inmobiliaria; null = todavía no lo sabemos (fetch/permiso). */
  heredado?: MoraHeredada | null;
  /** Si true, agrega la opción "Heredar de la inmobiliaria (X)" al selector. */
  conHeredar?: boolean;
  /** Monto de referencia para el preview (alquiler mensual). 0 = sin preview. */
  montoBase?: number;
  moneda?: Moneda;
  /** Prefijo del preview, ej. "Ejemplo con un alquiler de $500.000". */
  notaPreview?: string;
  idPrefix?: string;
}) {
  const simbolo = moneda === 'USD' ? 'US$' : '$';

  // Esquema EFECTIVO para el preview: el MISMO que va a aplicar el server, herencia incluida.
  // Antes el preview heredaba a ciegas y prometía un interés que el server descartaba.
  const efectivo = moraEfectivaDe(seleccion, valor, heredado, moneda);

  const preview =
    efectivo.tipo !== 'SIN_MORA' && efectivo.valor > 0 && montoBase > 0
      ? Math.round(calcularMora(efectivo.tipo, efectivo.valor, montoBase, 10))
      : null;

  const esMontoFijo = seleccion === 'MONTO_FIJO';
  const conValor = seleccion !== 'SIN_MORA' && seleccion !== 'HEREDAR';

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-tipo`}>Esquema</Label>
          <Select
            value={seleccion}
            onValueChange={(v) => onSeleccionChange(v as MoraSeleccion)}
          >
            <SelectTrigger id={`${idPrefix}-tipo`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {conHeredar && (
                <SelectItem value="HEREDAR">
                  {/* La moneda del DEFAULT, no la del contrato: un default de US$ 5.000 leído
                      con `moneda` decía "$ 5.000" en un contrato en pesos, que es otro número. */}
                  {heredado
                    ? `Heredar de la inmobiliaria (${descripcionMora(heredado.tipo, heredado.valor, heredado.moneda)})`
                    : 'Heredar de la inmobiliaria'}
                </SelectItem>
              )}
              {MORA_TIPOS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {conValor && (
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-valor`}>
              {VALOR_LABEL[seleccion as Exclude<TipoMora, 'SIN_MORA'>]}
            </Label>
            <div className="relative">
              {esMontoFijo && (
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {simbolo}
                </span>
              )}
              <Input
                id={`${idPrefix}-valor`}
                inputMode={esMontoFijo ? 'numeric' : 'decimal'}
                value={
                  esMontoFijo
                    ? valor
                      ? Number(valor).toLocaleString('es-AR')
                      : ''
                    : valor
                }
                onChange={(e) =>
                  onValorChange(
                    esMontoFijo
                      ? e.target.value.replace(/\D/g, '').slice(0, 12)
                      : e.target.value.replace(/[^\d.]/g, '').slice(0, 6),
                  )
                }
                placeholder={esMontoFijo ? '5.000' : '0.15'}
                className={esMontoFijo ? 'pl-9' : 'pr-8'}
              />
              {!esMontoFijo && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Por qué el interés quedó en cero. Sin este cartel el usuario ve "Heredar de la
          inmobiliaria (US$ 5.000 por mes de atraso)" elegido y un preview vacío, y la
          conclusión razonable es que la pantalla está rota. */}
      {efectivo.herenciaDescartada && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          El interés por defecto es un <strong>monto fijo</strong> en{' '}
          {heredado?.moneda === 'USD' ? 'dólares' : 'pesos'} y este contrato es en{' '}
          {moneda === 'USD' ? 'dólares' : 'pesos'}: <strong>no se hereda</strong>, porque
          aplicarlo 1:1 cobraría un punitorio que no es. Elegí un esquema para este contrato
          si querés cobrar mora.
        </p>
      )}

      {preview != null && (
        <p className="text-[11px] text-muted-foreground">
          {notaPreview ? `${notaPreview} — c` : 'C'}on 10 días de atraso:{' '}
          <span className="font-medium text-foreground">
            +{simbolo} {preview.toLocaleString('es-AR')}
          </span>
        </p>
      )}
    </div>
  );
}
