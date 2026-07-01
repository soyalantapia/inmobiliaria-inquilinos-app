'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Globe2,
  Info,
  ScrollText,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Label } from '@llave/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import {
  MONEDA_LABEL,
  PAISES,
  formatearMontoConPais,
  paisPorCodigo,
  type CodigoPais,
  type ConfiguracionPais,
  type Moneda,
} from '@/lib/paises';
import { useMercado, setMercado } from '@/lib/api/hooks';

/**
 * Tab "Mercado" de /configuracion. La inmo elige:
 *   - país de operación (AR / UY / BR / PY)
 *   - moneda (por defecto la local; admite USD para contratos en dólares)
 *   - índice de ajuste default para nuevos contratos
 *
 * Si elige un país no activo todavía, mostramos un banner amber con
 * la fecha estimada de apertura y desactivamos el botón "Guardar".
 *
 * Idea de Ramiro: "el molde nuestro funciona en cualquier lado, lo
 * que cambia es el índice y algunas normas".
 */
export function ConfiguracionPais() {
  // Config persistida: en prod viene de /mercado (por inmobiliaria), en demo de
  // localStorage. El hook dual abstrae el modo.
  const { config: persistido, cargando } = useMercado();
  const qc = useQueryClient();
  const [config, setConfig] = useState<ConfiguracionPais | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Inicializamos el form una vez que llega la config. Mount-gate: en SSR/primer
  // render config=null → return null, sin romper la hidratación.
  useEffect(() => {
    if (persistido && !config) setConfig(persistido);
  }, [persistido, config]);

  if (cargando || !config) return null;

  const pais = paisPorCodigo(config.codigo);
  const monedasPosibles: Moneda[] = [pais.monedaDefault, 'USD'];

  const cambiarPais = (cod: CodigoPais) => {
    const nuevo = paisPorCodigo(cod);
    setConfig({
      codigo: cod,
      moneda: nuevo.monedaDefault,
      indiceDefault: nuevo.indicesAjuste[0]?.codigo ?? 'ICL',
    });
  };

  const cambiarMoneda = (m: Moneda) => {
    setConfig({ ...config, moneda: m });
  };

  const cambiarIndice = (codigo: string) => {
    setConfig({ ...config, indiceDefault: codigo });
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await setMercado(config);
      // Invalidar la caché para que el wizard de contratos (y cualquier lector)
      // tome el valor nuevo en la misma sesión, sin esperar el staleTime de 60s.
      await qc.invalidateQueries({ queryKey: ['mercado'] });
      toast({
        variant: 'success',
        title: 'Configuración guardada',
        description: `Ahora operás en ${pais.nombre} con ${MONEDA_LABEL[config.moneda]}. Los contratos nuevos arrancan con ${config.indiceDefault}.`,
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No se pudo guardar',
        description: e instanceof Error ? e.message : 'Probá de nuevo en un momento.',
      });
    } finally {
      setGuardando(false);
    }
  };

  const ejemploMonto = formatearMontoConPais(572000, config);

  return (
    <div className="space-y-5">
      {/* Banner de descuento de lanzamiento — NO duplica al
          CardDescription del wrapper en /configuracion → Mercado.
          Sólo aporta el hook comercial: si elegís un país aún no
          abierto, te avisamos con descuento. */}
      <Card className="border-violet-200 bg-violet-50/40 dark:border-violet-900/40 dark:bg-violet-900/10">
        <CardContent className="flex items-start gap-3 p-4">
          <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">¿Tu país todavía no está activo?</strong>{' '}
            Elegilo igual y te avisamos cuando abramos, con descuento de
            lanzamiento para los que llegan primero.
          </p>
        </CardContent>
      </Card>

      {/* Selector de país */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="text-sm font-semibold">País de operación</p>
            <p className="text-xs text-muted-foreground">
              Donde tenés tu inmobiliaria registrada y el grueso de tus contratos.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {PAISES.map((p) => {
              const seleccionado = config.codigo === p.codigo;
              return (
                <button
                  key={p.codigo}
                  type="button"
                  aria-pressed={seleccionado}
                  onClick={() => p.activo && cambiarPais(p.codigo)}
                  disabled={!p.activo}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors ${
                    seleccionado
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : p.activo
                        ? 'hover:border-primary/40 hover:bg-muted/40'
                        : 'cursor-not-allowed opacity-50'
                  }`}
                >
                  <span className="text-2xl">{p.emoji}</span>
                  <span className="text-sm font-medium">{p.nombre}</span>
                  {p.activo ? (
                    seleccionado && (
                      <Badge className="bg-primary text-[9px] text-primary-foreground">
                        <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" />
                        Activo
                      </Badge>
                    )
                  ) : (
                    <Badge variant="outline" className="text-[9px]">
                      <Clock className="mr-0.5 h-2.5 w-2.5" />
                      {p.apertura}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {!pais.activo && (
        <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
            <div>
              <p className="font-medium">My Alquiler todavía no abrió en {pais.nombre}</p>
              <p className="text-xs text-muted-foreground">
                Lanzamiento estimado: <strong>{pais.apertura}</strong>. Te
                avisamos por mail cuando esté listo. Mientras tanto, podés
                seguir operando en Argentina.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Moneda + índice (sólo para país activo) */}
      {pais.activo && (
        <>
          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="text-sm font-semibold">Moneda de los contratos</p>
                <p className="text-xs text-muted-foreground">
                  Default {pais.monedaDefault}. Si trabajás contratos en dólares,
                  podés elegir USD.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {monedasPosibles.map((m) => {
                  const seleccionada = config.moneda === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => cambiarMoneda(m)}
                      className={`flex items-center gap-3 rounded-md border p-3 text-left text-sm transition-colors ${
                        seleccionada
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{m}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {MONEDA_LABEL[m]}
                        </p>
                      </div>
                      {seleccionada && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Ejemplo de formato
                </p>
                <p className="text-base font-semibold tabular-nums">
                  {ejemploMonto}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Así se ven los montos en las facturas y la app.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Índice de ajuste default</p>
                  <p className="text-xs text-muted-foreground">
                    Se usa para los contratos nuevos. Podés cambiarlo por
                    contrato si querés un caso especial.
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="indice">Índice</Label>
                <Select
                  value={config.indiceDefault}
                  onValueChange={(v) => cambiarIndice(v)}
                >
                  <SelectTrigger id="indice">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pais.indicesAjuste.map((i) => (
                      <SelectItem key={i.codigo} value={i.codigo}>
                        <div>
                          <p className="font-medium">
                            {i.codigo} · {i.nombre}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {i.fuente} · cada {i.periodicidadMeses}{' '}
                            {i.periodicidadMeses === 1 ? 'mes' : 'meses'}
                          </p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Normas locales */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start gap-2">
                <ScrollText className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Normas locales aplicables</p>
                  <p className="text-xs text-muted-foreground">
                    Referencia informativa del marco regulatorio del país elegido.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Norma
                  label="Ley aplicable"
                  valor={pais.norma.leyAplicable}
                />
                <Norma
                  label="Plazo mínimo"
                  valor={`${pais.norma.plazoMinimoMeses} meses`}
                />
                <Norma
                  label="Depósito máximo"
                  valor={`${pais.norma.depositoMaximoCanones} ${pais.norma.depositoMaximoCanones === 1 ? 'canon' : 'cánones'}`}
                />
                <Norma
                  label="Multa rescisión"
                  valor={`Hasta ${pais.norma.multaRescisionMaximaCanones} cánones`}
                />
              </div>
              <p className="rounded-md border border-amber-200 bg-amber-50/40 p-2 text-[11px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
                Estos valores son referenciales del marco regulatorio. Para
                cláusulas específicas, consultá con tu asesor legal — My
                Alquiler facilita el operativo, no reemplaza al abogado.
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={guardar} size="lg" disabled={guardando}>
              <CheckCircle2 className="h-4 w-4" />
              {guardando ? 'Guardando…' : 'Guardar configuración'}
            </Button>
          </div>
        </>
      )}

    </div>
  );
}

function Norma({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2.5">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold">{valor}</p>
    </div>
  );
}
