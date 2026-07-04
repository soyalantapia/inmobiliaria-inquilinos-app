'use client';

/**
 * Migración de cartera REAL (prod). 3 pasos: subir planilla → mapear columnas
 * (flexible: el admin elige qué columna es qué) → revisar validación e importar.
 * Crea propiedades + inquilinos + contratos reales (ver importaciones-cartera.ts).
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@llave/ui/dialog';
import { Label } from '@llave/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import {
  useImportacionCartera,
  type CampoImportacion,
  type EstadoFilaImport,
  type FilaValidada,
  type SubidaImportacion,
  type ValidacionImportacion,
} from '@/lib/api/use-importacion-cartera';
import { formatMonto } from '@/lib/format';

const SIN_COLUMNA = '__none__';

const COLOR_ESTADO: Record<EstadoFilaImport, string> = {
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

export function MigracionMasivaApiDialog({ open, onOpenChange }: Props) {
  const { campos, subir, guardarMapeo, confirmar } = useImportacionCartera();
  const [step, setStep] = useState<Step>('upload');
  const [cargando, setCargando] = useState(false);
  const [subida, setSubida] = useState<SubidaImportacion | null>(null);
  const [listaCampos, setListaCampos] = useState<CampoImportacion[]>([]);
  const [mapeo, setMapeo] = useState<Record<string, number>>({});
  const [validacion, setValidacion] = useState<ValidacionImportacion | null>(null);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [resultado, setResultado] = useState<{ creadas: number; errores: Array<{ fila: number; motivo: string }> } | null>(null);

  const reset = () => {
    setStep('upload');
    setSubida(null);
    setMapeo({});
    setValidacion(null);
    setSeleccion(new Set());
    setResultado(null);
    setCargando(false);
  };
  const cerrar = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargando(true);
    try {
      const [c, s] = await Promise.all([campos(), subir(file)]);
      setListaCampos(c);
      setSubida(s);
      setMapeo(s.mapeoSugerido);
      setStep('mapeo');
    } catch (err) {
      toast({ variant: 'destructive', title: 'No pudimos leer la planilla', description: err instanceof Error ? err.message : undefined });
    } finally {
      setCargando(false);
      e.target.value = '';
    }
  };

  const verValidacion = async () => {
    if (!subida) return;
    const faltantes = listaCampos.filter((c) => c.requerido && mapeo[c.key] === undefined);
    if (faltantes.length > 0) {
      toast({ variant: 'destructive', title: 'Faltan columnas', description: `Asigná: ${faltantes.map((c) => c.label).join(', ')}` });
      return;
    }
    setCargando(true);
    try {
      const v = await guardarMapeo(subida.id, mapeo);
      setValidacion(v);
      // Por defecto seleccionamos las importables (OK + ADVERTENCIA).
      setSeleccion(new Set(v.filas.filter((f) => f.estado === 'OK' || f.estado === 'ADVERTENCIA').map((f) => f.fila)));
      setStep('preview');
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se pudo validar', description: err instanceof Error ? err.message : undefined });
    } finally {
      setCargando(false);
    }
  };

  const importar = async () => {
    if (!subida) return;
    if (seleccion.size === 0) {
      toast({ variant: 'destructive', title: 'Elegí al menos una fila para importar' });
      return;
    }
    setCargando(true);
    try {
      const r = await confirmar(subida.id, [...seleccion]);
      setResultado(r);
      setStep('resultado');
      toast({ variant: 'success', title: `Se importaron ${r.creadas} contrato${r.creadas === 1 ? '' : 's'}` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se pudo importar', description: err instanceof Error ? err.message : undefined });
    } finally {
      setCargando(false);
    }
  };

  const toggleFila = (fila: number) => {
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(fila)) n.delete(fila);
      else n.add(fila);
      return n;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar cartera
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Subí tu planilla de contratos (Excel o CSV — con tus propias columnas). En el próximo paso elegís qué columna
              es cada dato. Creamos las propiedades, inquilinos y contratos.
            </p>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/20 py-10 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30">
              {cargando ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-primary" />}
              <span>{cargando ? 'Leyendo…' : 'Elegí el archivo (.xlsx, .xls, .csv)'}</span>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} disabled={cargando} />
            </label>
          </div>
        )}

        {step === 'mapeo' && subida && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Detectamos <strong className="text-foreground">{subida.totalFilas}</strong> filas. Confirmá a qué dato corresponde
              cada columna de tu planilla (ya sugerimos las que reconocimos).
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {listaCampos.map((c) => (
                <div key={c.key} className="space-y-1">
                  <Label className="text-xs">
                    {c.label}
                    {c.requerido && <span className="ml-1 text-destructive">*</span>}
                  </Label>
                  <Select
                    value={mapeo[c.key] === undefined ? SIN_COLUMNA : String(mapeo[c.key])}
                    onValueChange={(v) =>
                      setMapeo((m) => {
                        const n = { ...m };
                        if (v === SIN_COLUMNA) delete n[c.key];
                        else n[c.key] = Number(v);
                        return n;
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="— sin asignar —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SIN_COLUMNA}>— sin asignar —</SelectItem>
                      {subida.columnas.map((col, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {col || `Columna ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={cerrar}>
                Cancelar
              </Button>
              <Button onClick={verValidacion} disabled={cargando}>
                {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
                Revisar filas
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && validacion && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <ResumenChip label="OK" n={validacion.resumen.OK ?? 0} clase={COLOR_ESTADO.OK} />
              <ResumenChip label="Con aviso" n={validacion.resumen.ADVERTENCIA ?? 0} clase={COLOR_ESTADO.ADVERTENCIA} />
              <ResumenChip label="Duplicados" n={validacion.resumen.DUPLICADO ?? 0} clase={COLOR_ESTADO.DUPLICADO} />
              <ResumenChip label="Con error" n={validacion.resumen.ERROR ?? 0} clase={COLOR_ESTADO.ERROR} />
            </div>
            <div className="max-h-[45vh] overflow-y-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="w-8 p-2"></th>
                    <th className="p-2">Inquilino</th>
                    <th className="p-2">Dirección</th>
                    <th className="p-2 text-right">Monto</th>
                    <th className="p-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {validacion.filas.map((f) => (
                    <FilaRow key={f.fila} f={f} checked={seleccion.has(f.fila)} onToggle={() => toggleFila(f.fila)} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-xs text-muted-foreground">{seleccion.size} seleccionada{seleccion.size === 1 ? '' : 's'} para importar</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('mapeo')}>
                  Volver
                </Button>
                <Button onClick={importar} disabled={cargando || seleccion.size === 0}>
                  {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Importar {seleccion.size}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'resultado' && resultado && (
          <div className="space-y-3">
            <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-4 text-center dark:border-emerald-900/40 dark:bg-emerald-900/10">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-2 text-sm font-medium">Se importaron {resultado.creadas} contratos</p>
            </div>
            {resultado.errores.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50/40 p-3 text-xs dark:border-amber-900/40 dark:bg-amber-900/10">
                <p className="flex items-center gap-1.5 font-medium text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {resultado.errores.length} fila(s) no se importaron
                </p>
                <ul className="mt-1.5 space-y-0.5 text-amber-900/80 dark:text-amber-200/80">
                  {resultado.errores.slice(0, 10).map((e) => (
                    <li key={e.fila}>· Fila {e.fila + 2}: {e.motivo}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end border-t pt-3">
              <Button onClick={cerrar}>Listo</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResumenChip({ label, n, clase }: { label: string; n: number; clase: string }) {
  return <span className={`rounded-full px-2 py-0.5 font-medium ${clase}`}>{n} {label}</span>;
}

function FilaRow({ f, checked, onToggle }: { f: FilaValidada; checked: boolean; onToggle: () => void }) {
  const importable = f.estado === 'OK' || f.estado === 'ADVERTENCIA';
  return (
    <tr className="border-t">
      <td className="p-2">
        <input type="checkbox" checked={checked} disabled={!importable} onChange={onToggle} aria-label={`Importar fila ${f.fila + 2}`} />
      </td>
      <td className="p-2">
        <p className="font-medium">{f.datos.inquilino || '—'}</p>
        {f.datos.dni && <p className="text-[10px] text-muted-foreground">DNI {f.datos.dni}</p>}
      </td>
      <td className="max-w-[180px] truncate p-2">{f.datos.direccion || '—'}</td>
      <td className="p-2 text-right tabular-nums">{Number.isFinite(f.datos.monto) ? formatMonto(f.datos.monto) : '—'}</td>
      <td className="p-2">
        <Badge className={`text-[9px] ${COLOR_ESTADO[f.estado]}`}>{f.estado === 'ADVERTENCIA' ? 'Aviso' : f.estado === 'DUPLICADO' ? 'Duplicado' : f.estado === 'ERROR' ? 'Error' : 'OK'}</Badge>
        {f.motivo && <p className="mt-0.5 text-[10px] text-muted-foreground">{f.motivo}</p>}
      </td>
    </tr>
  );
}
