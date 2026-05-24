'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Download,
  FileText,
  IdCard,
  ImageIcon,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  Wallet,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { Progress } from '@llave/ui/progress';
import { toast } from '@llave/ui/use-toast';
import { NavBar } from '@/components/nav-bar';
import {
  type CategoriaDocumento,
  type Documento,
  type SlotDocumento,
  SLOTS_DOCUMENTOS,
  categoriaDescripcion,
  categoriaLabel,
  eliminarDocumento,
  formatTamanio,
  guardarDocumento,
  leerArchivoComoDataUrl,
  listarDocumentos,
} from '@/lib/documentos-storage';
import { formatFecha } from '@/lib/format';

const TAMAÑO_MAX = 2 * 1024 * 1024; // 2MB

const iconoCategoria: Record<CategoriaDocumento, React.ReactNode> = {
  IDENTIDAD: <IdCard className="h-4 w-4" />,
  INGRESOS: <Wallet className="h-4 w-4" />,
  GARANTE: <ShieldCheck className="h-4 w-4" />,
  OTRO: <FileText className="h-4 w-4" />,
};

export default function DocumentosPage() {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [hidratado, setHidratado] = useState(false);
  const [eliminando, setEliminando] = useState<Documento | null>(null);
  const [slotActivo, setSlotActivo] = useState<SlotDocumento | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const otroInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDocumentos(listarDocumentos());
    setHidratado(true);
  }, []);

  // ===== Cálculos sobre el checklist =====
  const requeridos = useMemo(() => SLOTS_DOCUMENTOS.filter((s) => s.requerido), []);
  const opcionales = useMemo(() => SLOTS_DOCUMENTOS.filter((s) => !s.requerido), []);

  const docsPorSlot = useMemo(() => {
    const map: Record<string, Documento> = {};
    documentos.forEach((d) => {
      if (d.slotId) map[d.slotId] = d;
    });
    return map;
  }, [documentos]);

  const requeridosCargados = requeridos.filter((s) => docsPorSlot[s.id]).length;
  const totalRequeridos = requeridos.length;
  const completitud =
    totalRequeridos === 0 ? 100 : Math.round((requeridosCargados / totalRequeridos) * 100);
  const completo = requeridosCargados === totalRequeridos;

  // Documentos sin slot (otros) — los que el inquilino subió por iniciativa propia
  const documentosOtros = useMemo(
    () => documentos.filter((d) => !d.slotId),
    [documentos],
  );

  // ===== Subida =====
  const subirArchivo = async (file: File, slot: SlotDocumento | null) => {
    if (file.size > TAMAÑO_MAX) {
      toast({
        title: 'Archivo muy grande',
        description: 'Máximo 2 MB en esta demo.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const dataUrl = await leerArchivoComoDataUrl(file);
      // Si reemplazamos un slot ya cargado, primero borramos el anterior
      const previo = slot ? docsPorSlot[slot.id] : undefined;
      if (previo) {
        eliminarDocumento(previo.id);
      }
      const doc: Documento = {
        id: `doc_${Date.now()}`,
        categoria: slot?.categoria ?? 'OTRO',
        nombre: file.name,
        tipoMime: file.type || 'application/octet-stream',
        tamanioBytes: file.size,
        dataUrl,
        subidoAt: new Date().toISOString(),
        vencimiento: null,
        slotId: slot?.id,
      };
      guardarDocumento(doc);
      setDocumentos(listarDocumentos());
      toast({
        title: slot ? '¡Documento cargado!' : 'Archivo subido',
        description: slot?.titulo ?? file.name,
      });
    } catch {
      toast({ title: 'No pudimos subirlo', variant: 'destructive' });
    }
  };

  const handleUploadSlot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !slotActivo) return;
    await subirArchivo(file, slotActivo);
    setSlotActivo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadOtro = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await subirArchivo(file, null);
    if (otroInputRef.current) otroInputRef.current.value = '';
  };

  const abrirUploadSlot = (slot: SlotDocumento) => {
    setSlotActivo(slot);
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const confirmarEliminar = () => {
    if (!eliminando) return;
    eliminarDocumento(eliminando.id);
    setDocumentos(listarDocumentos());
    setEliminando(null);
    toast({ title: 'Eliminado' });
  };

  return (
    <>
      <header className="flex items-center gap-3 p-5 md:px-8">
        <Button size="icon" variant="ghost" asChild>
          <Link href="/cuenta" aria-label="Volver a Mi cuenta">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Mi cuenta</p>
          <h1 className="text-xl font-semibold md:text-2xl">Mis documentos</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-5 pb-28 md:px-8 md:pb-8">
        {/* RESUMEN: progreso del checklist */}
        {hidratado && (
          <Card
            className={cn(
              'space-y-3 p-5 transition-colors',
              completo
                ? 'border-emerald-200 bg-emerald-50/60'
                : 'border-primary/20 bg-primary/5',
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white shadow-sm',
                  completo ? 'bg-emerald-500' : 'bg-primary',
                )}
              >
                {completo ? (
                  <CheckCircle2 className="h-6 w-6" strokeWidth={2.5} />
                ) : (
                  <FileText className="h-6 w-6" strokeWidth={2.2} />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <p className="text-sm font-semibold leading-tight">
                    {completo
                      ? '¡Documentación al día!'
                      : `Te faltan ${totalRequeridos - requeridosCargados} de ${totalRequeridos}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {completo
                      ? 'Cuando renueves o cambies de garantía, los reutilizás en un click.'
                      : 'Subí los documentos requeridos por la inmobiliaria para tener todo a mano.'}
                  </p>
                </div>
                <div className="space-y-1">
                  <Progress value={completitud} className="h-2" />
                  <p className="text-[11px] text-muted-foreground">
                    {requeridosCargados} de {totalRequeridos} requeridos · {completitud}%
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* CHECKLIST DE REQUERIDOS — agrupado por categoría */}
        {hidratado && (
          <>
            <SeccionSlots
              titulo="Identidad"
              icon={<IdCard className="h-4 w-4" />}
              slots={requeridos.filter((s) => s.categoria === 'IDENTIDAD')}
              docs={docsPorSlot}
              onSubir={abrirUploadSlot}
              onEliminar={(d) => setEliminando(d)}
            />
            <SeccionSlots
              titulo="Ingresos"
              icon={<Wallet className="h-4 w-4" />}
              slots={[
                ...requeridos.filter((s) => s.categoria === 'INGRESOS'),
                ...opcionales.filter((s) => s.categoria === 'INGRESOS'),
              ]}
              docs={docsPorSlot}
              onSubir={abrirUploadSlot}
              onEliminar={(d) => setEliminando(d)}
            />
            <SeccionSlots
              titulo="Garante"
              icon={<ShieldCheck className="h-4 w-4" />}
              slots={requeridos.filter((s) => s.categoria === 'GARANTE')}
              docs={docsPorSlot}
              onSubir={abrirUploadSlot}
              onEliminar={(d) => setEliminando(d)}
            />
          </>
        )}

        {/* OTROS — documentos libres que el inquilino sube */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText className="h-4 w-4" />
              Otros documentos
            </h2>
            <Button size="sm" variant="outline" onClick={() => otroInputRef.current?.click()}>
              <Plus className="h-3.5 w-3.5" />
              Subir
            </Button>
          </div>
          <input
            ref={otroInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleUploadOtro}
          />
          {documentosOtros.length === 0 ? (
            <Card className="border-dashed bg-muted/20 p-6 text-center">
              <p className="text-sm font-medium">Sin otros documentos</p>
              <p className="text-xs text-muted-foreground">
                {categoriaDescripcion.OTRO}
              </p>
            </Card>
          ) : (
            <Card className="divide-y">
              {documentosOtros.map((doc) => (
                <DocumentoRow
                  key={doc.id}
                  doc={doc}
                  onDelete={() => setEliminando(doc)}
                />
              ))}
            </Card>
          )}
        </section>
      </main>

      {/* Input file oculto compartido para los slots */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleUploadSlot}
      />

      <NavBar />

      <ConfirmDialog
        open={!!eliminando}
        onOpenChange={(o) => !o && setEliminando(null)}
        title={`¿Eliminar "${eliminando?.nombre}"?`}
        description="Vas a tener que subirlo de nuevo si lo necesitás."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={confirmarEliminar}
      />
    </>
  );
}

// ============================================================
// Sección de slots agrupados por categoría
// ============================================================
function SeccionSlots({
  titulo,
  icon,
  slots,
  docs,
  onSubir,
  onEliminar,
}: {
  titulo: string;
  icon: React.ReactNode;
  slots: SlotDocumento[];
  docs: Record<string, Documento>;
  onSubir: (s: SlotDocumento) => void;
  onEliminar: (d: Documento) => void;
}) {
  if (slots.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {titulo}
      </h2>
      <Card className="divide-y">
        {slots.map((slot) => (
          <SlotRow
            key={slot.id}
            slot={slot}
            doc={docs[slot.id]}
            onSubir={() => onSubir(slot)}
            onEliminar={onEliminar}
          />
        ))}
      </Card>
    </section>
  );
}

// ============================================================
// Fila de un slot: cargado o pendiente
// ============================================================
function SlotRow({
  slot,
  doc,
  onSubir,
  onEliminar,
}: {
  slot: SlotDocumento;
  doc: Documento | undefined;
  onSubir: () => void;
  onEliminar: (d: Documento) => void;
}) {
  const cargado = !!doc;

  return (
    <div className="flex items-start gap-3 p-4">
      <div
        className={cn(
          'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full',
          cargado ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground',
        )}
      >
        {cargado ? (
          <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium">{slot.titulo}</p>
          {!slot.requerido && (
            <Badge variant="outline" className="text-[10px]">
              Opcional
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{slot.descripcion}</p>
        {cargado && doc && (
          <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/30 p-2">
            <PreviewMini doc={doc} />
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-medium">{doc.nombre}</p>
              <p className="text-[11px] text-muted-foreground">
                {formatTamanio(doc.tamanioBytes)} · subido el {formatFecha(doc.subidoAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center">
              <a
                href={doc.dataUrl}
                download={doc.nombre}
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Descargar"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={() => onEliminar(doc)}
                className="grid h-7 w-7 place-items-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
                aria-label="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
      <Button
        size="sm"
        variant={cargado ? 'outline' : 'default'}
        onClick={onSubir}
        className="shrink-0"
      >
        {cargado ? (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            Reemplazar
          </>
        ) : (
          <>
            <Upload className="h-3.5 w-3.5" />
            Subir
          </>
        )}
      </Button>
    </div>
  );
}

function PreviewMini({ doc }: { doc: Documento }) {
  const esImagen = doc.tipoMime.startsWith('image/');
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
      {esImagen ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={doc.dataUrl} alt={doc.nombre} className="h-full w-full object-cover" />
      ) : doc.tipoMime === 'application/pdf' ? (
        <FileText className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}

// ============================================================
// Fila libre (sección "Otros")
// ============================================================
function DocumentoRow({ doc, onDelete }: { doc: Documento; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <PreviewMini doc={doc} />
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{doc.nombre}</p>
        <p className="text-xs text-muted-foreground">
          {formatTamanio(doc.tamanioBytes)} · subido el {formatFecha(doc.subidoAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="icon" variant="ghost" asChild>
          <a href={doc.dataUrl} download={doc.nombre} aria-label="Descargar">
            <Download className="h-4 w-4" />
          </a>
        </Button>
        <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Eliminar">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
