'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  Wand2,
  XCircle,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@llave/ui/table';
import { toast } from '@llave/ui/use-toast';
import {
  ESTADO_FILA_COLOR,
  ESTADO_FILA_LABEL,
  analizarArchivoMigracion,
  type FilaMigracion,
} from '@/lib/migracion-masiva';
import { formatMonto } from '@/lib/format';
import { apiEnabled } from '@/lib/api/client';

type Step = 'upload' | 'leyendo' | 'preview' | 'listo';
const MAX_FILE_MB = 20;

interface MigracionMasivaDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImportado?: (cantidad: number) => void;
}

/**
 * Dialog de "Migrar mi cartera": la inmo sube un archivo (Excel/CSV/PDF
 * que tenía de su sistema viejo) y la IA detecta los contratos. Después
 * se previsualiza, se eligen los que se importan, y se confirma.
 *
 * Quita la fricción más grande para que un cliente nuevo se mude desde
 * otra plataforma — antes de esto, había que cargar 100+ contratos uno
 * por uno.
 */
export function MigracionMasivaDialog({
  open,
  onOpenChange,
  onImportado,
}: MigracionMasivaDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [filas, setFilas] = useState<FilaMigracion[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [cantidadImportada, setCantidadImportada] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setStep('upload');
      setFile(null);
      setFilas([]);
      setSeleccionados(new Set());
      setCantidadImportada(0);
    }
  }, [open]);

  const handleFile = (f: File) => {
    if (f.size / 1024 / 1024 > MAX_FILE_MB) {
      toast({
        title: 'Archivo muy grande',
        description: `Máximo ${MAX_FILE_MB} MB.`,
        variant: 'destructive',
      });
      return;
    }
    setFile(f);
    setStep('leyendo');
    // Simulamos el análisis IA con un delay realista (parece más serio).
    setTimeout(() => {
      const detectadas = analizarArchivoMigracion(f.name, f.size);
      setFilas(detectadas);
      // Pre-seleccionamos OK y WARNING (el admin filtra después).
      // Los DUPLICADOS quedan fuera por default.
      const inicial = new Set(
        detectadas
          .filter((d) => d.estado !== 'DUPLICADO')
          .map((d) => d.id),
      );
      setSeleccionados(inicial);
      setStep('preview');
    }, 2200);
  };

  const stats = useMemo(() => {
    const ok = filas.filter((f) => f.estado === 'OK').length;
    const warn = filas.filter((f) => f.estado === 'WARNING').length;
    const dup = filas.filter((f) => f.estado === 'DUPLICADO').length;
    return { ok, warn, dup, total: filas.length };
  }, [filas]);

  const toggleSeleccion = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSeleccionarTodos = () => {
    // Solo las filas seleccionables (los DUPLICADOs quedan fuera por default y
    // su checkbox está disabled): antes "seleccionar todos" metía los DUPLICADOs
    // —que no se podían destildar— e inflaba el contador y el "Importamos N".
    const seleccionables = filas.filter((f) => f.estado !== 'DUPLICADO');
    if (seleccionados.size === seleccionables.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(seleccionables.map((f) => f.id)));
    }
  };

  const importar = () => {
    // En prod la importación masiva por IA no está disponible todavía — el
    // endpoint /contratos/importar-bulk no existe. Mostramos el estado real
    // en lugar de simular un éxito que no persiste en la DB.
    if (apiEnabled) {
      toast({
        title: 'Importación masiva · Próximamente',
        description: 'Estamos desarrollando esta funcionalidad. Por ahora usá el alta manual desde "Nuevo contrato".',
      });
      onOpenChange(false);
      return;
    }
    const n = seleccionados.size;
    setCantidadImportada(n);
    setStep('listo');
    onImportado?.(n);
    toast({
      variant: 'success',
      title: `Importamos ${n} contrato${n === 1 ? '' : 's'}`,
      description: 'Ya están disponibles en tu cartera.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-violet-600" />
            Migrar mi cartera
          </DialogTitle>
          <DialogDescription>
            Subí el Excel, CSV o PDF que tenías en tu sistema viejo. La IA
            extrae los contratos y los importamos en bloque.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && <StepUpload inputRef={inputRef} onFile={handleFile} />}
        {step === 'leyendo' && <StepLeyendo file={file} />}
        {step === 'preview' && (
          <StepPreview
            filas={filas}
            seleccionados={seleccionados}
            stats={stats}
            onToggle={toggleSeleccion}
            onToggleTodos={toggleSeleccionarTodos}
            onCancelar={() => onOpenChange(false)}
            onImportar={importar}
          />
        )}
        {step === 'listo' && (
          <StepListo
            cantidad={cantidadImportada}
            total={filas.length}
            onCerrar={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepUpload({
  inputRef,
  onFile,
}: {
  inputRef: React.RefObject<HTMLInputElement>;
  onFile: (f: File) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/40 p-4 text-sm">
        <p className="font-medium">¿Qué archivo subir?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Lo que sea que tengas: la planilla de Excel con tus contratos, un
          CSV exportado del sistema viejo, o incluso un PDF de tu archivo
          físico escaneado. La IA lee cualquiera.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 rounded-md border bg-background p-2">
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Excel · .xlsx</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border bg-background p-2">
            <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
            <span>CSV · .csv</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border bg-background p-2">
            <FileText className="h-3.5 w-3.5 text-red-600" />
            <span>PDF · escaneo</span>
          </div>
        </div>
      </div>

      <label
        htmlFor="migracion-file"
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-violet-300 bg-violet-50/60 px-6 py-12 text-center transition-colors hover:border-violet-500 dark:border-violet-900/40 dark:bg-violet-900/10"
      >
        <Upload className="h-10 w-10 text-violet-600" />
        <div>
          <p className="text-sm font-medium">Tocá para subir tu archivo</p>
          <p className="text-xs text-muted-foreground">
            Hasta {MAX_FILE_MB} MB · sin límite de filas
          </p>
        </div>
        <input
          ref={inputRef}
          id="migracion-file"
          type="file"
          accept=".xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>

      <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">¿Y los inquilinos?</p>
        <p>
          Si tu archivo tiene los datos de cada inquilino (nombre, DNI,
          teléfono), los importamos junto con cada contrato. Si faltan, te
          los pedimos después de a uno cuando entres a cada propiedad.
        </p>
      </div>
    </div>
  );
}

function StepLeyendo({ file }: { file: File | null }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-12 text-center">
      <Loader2 aria-hidden="true" className="h-12 w-12 animate-spin text-violet-600" />
      <div>
        <p className="text-base font-semibold">Leyendo tu archivo…</p>
        <p className="text-xs text-muted-foreground">
          {file?.name ?? 'Procesando'} · {(file?.size ?? 0) / 1024 < 1024
            ? `${Math.round((file?.size ?? 0) / 1024)} KB`
            : `${((file?.size ?? 0) / 1024 / 1024).toFixed(1)} MB`}
        </p>
      </div>
      <div className="mt-2 flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
        <p>✓ Detectando estructura de columnas</p>
        <p>✓ Extrayendo contratos y propiedades</p>
        <p>✓ Normalizando direcciones y montos</p>
        <p>✓ Cruzando con tu cartera actual para evitar duplicados</p>
      </div>
    </div>
  );
}

function StepPreview({
  filas,
  seleccionados,
  stats,
  onToggle,
  onToggleTodos,
  onCancelar,
  onImportar,
}: {
  filas: FilaMigracion[];
  seleccionados: Set<string>;
  stats: { ok: number; warn: number; dup: number; total: number };
  onToggle: (id: string) => void;
  onToggleTodos: () => void;
  onCancelar: () => void;
  onImportar: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-md border-2 border-violet-200 bg-violet-50/60 p-3 dark:border-violet-900/40 dark:bg-violet-900/10">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold">
            Detectamos {stats.total} contrato{stats.total === 1 ? '' : 's'} en tu archivo
          </p>
          <p className="text-xs text-muted-foreground">
            {stats.ok} listos para importar · {stats.warn} con datos faltantes ·{' '}
            {stats.dup} duplicados (ya en tu cartera)
          </p>
        </div>
      </div>

      <div className="rounded-md border max-h-[50vh] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={
                    seleccionados.size > 0 &&
                    seleccionados.size === filas.filter((f) => f.estado !== 'DUPLICADO').length
                  }
                  onChange={onToggleTodos}
                  className="h-4 w-4 rounded border-border accent-primary"
                  aria-label="Seleccionar todos"
                />
              </TableHead>
              <TableHead>Inquilino</TableHead>
              <TableHead>Propiedad</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Inicio</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f) => {
              const seleccionado = seleccionados.has(f.id);
              const disabled = f.estado === 'DUPLICADO';
              return (
                <TableRow
                  key={f.id}
                  className={
                    disabled
                      ? 'opacity-50'
                      : f.estado === 'WARNING'
                        ? 'bg-amber-50/30 dark:bg-amber-900/5'
                        : ''
                  }
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={seleccionado}
                      disabled={disabled}
                      onChange={() => onToggle(f.id)}
                      className="h-4 w-4 rounded border-border accent-primary"
                      aria-label={`Seleccionar ${f.inquilino}`}
                    />
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{f.inquilino}</p>
                    {f.dni && (
                      <p className="text-[10px] text-muted-foreground">DNI {f.dni}</p>
                    )}
                    {f.telefono && (
                      <p className="text-[10px] text-muted-foreground">
                        💬 {f.telefono}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{f.direccion}</p>
                    {f.propietario && (
                      <p className="text-[10px] text-muted-foreground">
                        Propietario: {f.propietario}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMonto(f.monto)}
                  </TableCell>
                  <TableCell className="text-sm">{f.fechaInicio}</TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${ESTADO_FILA_COLOR[f.estado]}`}>
                      {ESTADO_FILA_LABEL[f.estado]}
                    </Badge>
                    {f.issue && (
                      <p className="mt-1 flex items-start gap-1 text-[10px] text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                        {f.issue}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-between gap-3 border-t bg-background px-6 py-4">
        <div>
          <p className="text-sm font-semibold">
            {seleccionados.size} contrato{seleccionados.size === 1 ? '' : 's'} seleccionado
            {seleccionados.size === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-muted-foreground">
            Los duplicados quedan fuera por default · podés deseleccionar
            warnings si querés cargarlos a mano después.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button
            onClick={onImportar}
            disabled={seleccionados.size === 0}
            className="bg-violet-600 text-white hover:bg-violet-700"
          >
            <Wand2 className="h-4 w-4" />
            Importar {seleccionados.size}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepListo({
  cantidad,
  total,
  onCerrar,
}: {
  cantidad: number;
  total: number;
  onCerrar: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <div>
        <p className="text-lg font-semibold">¡Cartera migrada!</p>
        <p className="text-sm text-muted-foreground">
          Importamos <strong>{cantidad}</strong> contrato{cantidad === 1 ? '' : 's'} de{' '}
          <strong>{total}</strong> detectados. Ya están disponibles en tu listado de
          propiedades.
        </p>
      </div>
      {cantidad < total && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs dark:border-amber-900/40 dark:bg-amber-900/10">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-amber-900 dark:text-amber-200">
            Quedaron {total - cantidad} sin importar (duplicados o que
            deseleccionaste). Podés volver a correr la importación si los
            necesitás.
          </p>
        </div>
      )}
      <Button size="lg" className="w-full" onClick={onCerrar}>
        Cerrar
      </Button>
    </div>
  );
}
