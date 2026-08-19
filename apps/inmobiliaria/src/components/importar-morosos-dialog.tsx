'use client';

/**
 * Importar MOROSOS HISTÓRICOS desde una planilla.
 *
 * Mismos 4 pasos que la migración de cartera (subir → mapear → revisar →
 * resultado) porque es el flujo que el equipo de Camila ya conoce. Lo que cambia
 * es qué se está creando: acá cada fila es la DEUDA de alguien que ya se fue, y
 * la propiedad tiene que existir de antes.
 *
 * Sin fallback demo: sin API no hay cartera contra la cual matchear direcciones.
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, UserMinus } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@llave/ui/dialog';
import { Label } from '@llave/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import {
  useImportacionMorosos,
  type AnalisisMorosos,
  type CampoMorosos,
  type EstadoFilaMoroso,
  type FilaMorosoValidada,
  type ValidacionMorosos,
} from '@/lib/api/use-importacion-morosos';
import { formatMonto } from '@/lib/format';

const SIN_COLUMNA = '__none__';

const COLOR_ESTADO: Record<EstadoFilaMoroso, string> = {
  OK: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  ADVERTENCIA: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  ERROR: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  DUPLICADO: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
};

type Step = 'upload' | 'mapeo' | 'preview' | 'resultado';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** "2024-03" → "mar 2024". Lo que se lee en la tabla de revisión. */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function mesCorto(periodo: string | null): string {
  if (!periodo) return '—';
  const [y, m] = periodo.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return periodo;
  return `${MESES[m - 1]} ${y}`;
}

export function ImportarMorososDialog({ open, onOpenChange }: Props) {
  const { campos, analizar, validar, confirmar } = useImportacionMorosos();
  const [step, setStep] = useState<Step>('upload');
  const [cargando, setCargando] = useState(false);
  const [listaCampos, setListaCampos] = useState<CampoMorosos[]>([]);
  const [analisis, setAnalisis] = useState<AnalisisMorosos | null>(null);
  const [mapeo, setMapeo] = useState<Record<string, number>>({});
  const [validacion, setValidacion] = useState<ValidacionMorosos | null>(null);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [resultado, setResultado] = useState<{ creadas: number; cuotasTotales: number; errores: Array<{ fila: number; motivo: string }> } | null>(null);

  function reset() {
    setStep('upload');
    setAnalisis(null);
    setMapeo({});
    setValidacion(null);
    setSeleccion(new Set());
    setResultado(null);
  }

  function cerrar(v: boolean) {
    onOpenChange(v);
    if (!v) setTimeout(reset, 200);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setCargando(true);
    try {
      const [cs, a] = await Promise.all([campos(), analizar(file)]);
      setListaCampos(cs);
      setAnalisis(a);
      setMapeo(a.mapeoSugerido);
      setStep('mapeo');
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No pudimos leer la planilla',
        description: e instanceof Error ? e.message : 'Probá con un .xlsx o .csv',
      });
    } finally {
      setCargando(false);
    }
  }

  async function revisar() {
    if (!analisis) return;
    const faltan = listaCampos.filter((c) => c.requerido && mapeo[c.key] === undefined);
    if (faltan.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Faltan columnas',
        description: `Asigná: ${faltan.map((c) => c.label).join(', ')}`,
      });
      return;
    }
    setCargando(true);
    try {
      const v = await validar(analisis.filas, mapeo);
      setValidacion(v);
      // Se preseleccionan las importables. Las que tienen error no se pueden
      // tildar: la fila hay que arreglarla en la planilla, no forzarla.
      setSeleccion(new Set(v.filas.filter((f) => f.importable).map((f) => f.indice)));
      setStep('preview');
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No pudimos revisar la planilla',
        description: e instanceof Error ? e.message : 'Probá de nuevo',
      });
    } finally {
      setCargando(false);
    }
  }

  async function importar() {
    if (!analisis || seleccion.size === 0) return;
    setCargando(true);
    try {
      const r = await confirmar(analisis.filas, mapeo, [...seleccion]);
      setResultado(r);
      setStep('resultado');
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No pudimos importar',
        description: e instanceof Error ? e.message : 'Probá de nuevo',
      });
    } finally {
      setCargando(false);
    }
  }

  function toggle(indice: number) {
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(indice)) s.delete(indice);
      else s.add(indice);
      return s;
    });
  }

  // Cuánta deuda se va a crear con lo tildado. Es el número que hay que mirar
  // antes de apretar: está creando plata adeudada.
  const mesesSeleccionados = (validacion?.filas ?? [])
    .filter((f) => seleccion.has(f.indice))
    .reduce((acc, f) => acc + f.meses, 0);

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserMinus className="h-4 w-4" />
            Importar morosos históricos
          </DialogTitle>
          <DialogDescription>
            Deuda de inquilinos que <strong>ya se fueron</strong>. Las propiedades tienen que estar
            cargadas: esta planilla no da de alta inmuebles. Ninguna propiedad cambia de estado ni
            de inquilino actual.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/40">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-medium">Subí tu planilla de morosos</p>
                <p className="text-sm text-muted-foreground">Excel (.xlsx, .xls) o CSV</p>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
              {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
            </label>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Una fila por deuda: <strong>dirección · inquilino · debe desde · debe hasta · monto</strong>.
              Los meses van como <code>2024-03</code> o <code>03/2024</code>. Si el mismo inquilino
              debe en dos propiedades, son dos filas.
            </div>
          </div>
        )}

        {step === 'mapeo' && analisis && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Detectamos {analisis.filas.length} fila(s). Decinos qué columna es cuál.
            </p>
            {analisis.filasDescartadas > 0 && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                Tu archivo tiene {analisis.filasDelArchivo} filas y el máximo por importación es{' '}
                {analisis.maxFilas}: quedaron afuera {analisis.filasDescartadas}. Subí el resto en una
                segunda planilla.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {listaCampos.map((c) => (
                <div key={c.key} className="space-y-1.5">
                  <Label htmlFor={`map-${c.key}`}>
                    {c.label} {c.requerido && <span className="text-destructive">*</span>}
                  </Label>
                  <Select
                    value={mapeo[c.key] === undefined ? SIN_COLUMNA : String(mapeo[c.key])}
                    onValueChange={(v) =>
                      setMapeo((prev) => {
                        const next = { ...prev };
                        if (v === SIN_COLUMNA) delete next[c.key];
                        else next[c.key] = Number(v);
                        return next;
                      })
                    }
                  >
                    <SelectTrigger id={`map-${c.key}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SIN_COLUMNA}>— sin asignar —</SelectItem>
                      {analisis.columnas.map((col, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {col || `Columna ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => cerrar(false)} disabled={cargando}>
                Cancelar
              </Button>
              <Button onClick={() => void revisar()} disabled={cargando}>
                {cargando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Revisar filas
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && validacion && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className={COLOR_ESTADO.OK}>{validacion.resumen.OK ?? 0} listas</Badge>
              <Badge className={COLOR_ESTADO.ADVERTENCIA}>
                {validacion.resumen.ADVERTENCIA ?? 0} con aviso
              </Badge>
              <Badge className={COLOR_ESTADO.DUPLICADO}>{validacion.resumen.DUPLICADO ?? 0} ya cargadas</Badge>
              <Badge className={COLOR_ESTADO.ERROR}>{validacion.resumen.ERROR ?? 0} con error</Badge>
            </div>

            <div className="max-h-[45vh] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left">
                    <th className="w-10 p-2" />
                    <th className="p-2 font-medium">Inquilino</th>
                    <th className="p-2 font-medium">Propiedad</th>
                    <th className="p-2 font-medium">Debe</th>
                    <th className="p-2 font-medium">Por mes</th>
                    <th className="p-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {validacion.filas.map((f: FilaMorosoValidada) => (
                    <tr key={f.indice} className="border-t align-top">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={seleccion.has(f.indice)}
                          disabled={!f.importable}
                          onChange={() => toggle(f.indice)}
                        />
                      </td>
                      <td className="p-2">
                        <div className="font-medium">
                          {f.datos.inquilinoNombre} {f.datos.inquilinoApellido ?? ''}
                        </div>
                        {f.datos.inquilinoDni && (
                          <div className="text-xs text-muted-foreground">DNI {f.datos.inquilinoDni}</div>
                        )}
                      </td>
                      <td className="max-w-[220px] truncate p-2">{f.datos.direccion}</td>
                      <td className="whitespace-nowrap p-2">
                        {f.meses > 0 ? (
                          <>
                            <div>
                              {mesCorto(f.datos.debeDesde)} → {mesCorto(f.datos.debeHasta)}
                            </div>
                            <div className="text-xs text-muted-foreground">{f.meses} mes(es)</div>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="whitespace-nowrap p-2">
                        {Number.isFinite(f.datos.monto) ? formatMonto(f.datos.monto, f.datos.moneda) : '—'}
                      </td>
                      <td className="p-2">
                        <Badge className={COLOR_ESTADO[f.estado]}>{f.estado}</Badge>
                        {f.motivo && <div className="mt-1 max-w-[260px] text-xs text-muted-foreground">{f.motivo}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {seleccion.size > 0 && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                Se va a cargar la deuda de <strong>{seleccion.size}</strong> inquilino(s):{' '}
                <strong>{mesesSeleccionados}</strong> cuota(s) adeudada(s) en total.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('mapeo')} disabled={cargando}>
                Volver
              </Button>
              <Button onClick={() => void importar()} disabled={cargando || seleccion.size === 0}>
                {cargando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Importar {seleccion.size}
              </Button>
            </div>
          </div>
        )}

        {step === 'resultado' && resultado && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-900/20">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-medium">Se cargaron {resultado.creadas} deuda(s)</p>
                <p className="text-sm text-muted-foreground">
                  {resultado.cuotasTotales} cuota(s) adeudada(s). Cada una aparece en la ficha del
                  inquilino y en el historial de su propiedad.
                </p>
              </div>
            </div>
            {resultado.errores.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <p className="font-medium">{resultado.errores.length} fila(s) no entraron</p>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {resultado.errores.slice(0, 10).map((e) => (
                    <li key={e.fila}>
                      Fila {e.fila + 2}: {e.motivo}
                    </li>
                  ))}
                </ul>
                {resultado.errores.length > 10 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    …y {resultado.errores.length - 10} más. Corregilas en la planilla y volvé a subirla:
                    las que ya entraron no se duplican si las sacás.
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => cerrar(false)}>Listo</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
