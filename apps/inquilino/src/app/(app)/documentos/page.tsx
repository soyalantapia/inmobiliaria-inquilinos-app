'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  FileText,
  IdCard,
  ImageIcon,
  Plus,
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
import { toast } from '@llave/ui/use-toast';
import { NavBar } from '@/components/nav-bar';
import {
  type CategoriaDocumento,
  type Documento,
  categoriaDescripcion,
  categoriaLabel,
  eliminarDocumento,
  formatTamanio,
  guardarDocumento,
  leerArchivoComoDataUrl,
  listarDocumentos,
} from '@/lib/documentos-storage';
import { formatFecha } from '@/lib/format';

const TAMAÑO_MAX = 2 * 1024 * 1024; // 2MB para no reventar localStorage

const iconoCategoria: Record<CategoriaDocumento, React.ReactNode> = {
  IDENTIDAD: <IdCard className="h-4 w-4" />,
  INGRESOS: <Wallet className="h-4 w-4" />,
  GARANTE: <ShieldCheck className="h-4 w-4" />,
  OTRO: <FileText className="h-4 w-4" />,
};

export default function DocumentosPage() {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaDocumento>('IDENTIDAD');
  const [eliminando, setEliminando] = useState<Documento | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDocumentos(listarDocumentos());
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > TAMAÑO_MAX) {
      toast({
        title: 'Archivo muy grande',
        description: 'Máximo 2MB en esta demo (en producción usaríamos S3).',
        variant: 'destructive',
      });
      return;
    }
    try {
      const dataUrl = await leerArchivoComoDataUrl(file);
      const doc: Documento = {
        id: `doc_${Date.now()}`,
        categoria: categoriaActiva,
        nombre: file.name,
        tipoMime: file.type || 'application/octet-stream',
        tamanioBytes: file.size,
        dataUrl,
        subidoAt: new Date().toISOString(),
        vencimiento: null,
      };
      guardarDocumento(doc);
      setDocumentos(listarDocumentos());
      toast({ title: 'Documento guardado', description: file.name });
    } catch {
      toast({ title: 'No pudimos subirlo', variant: 'destructive' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmarEliminar = () => {
    if (!eliminando) return;
    eliminarDocumento(eliminando.id);
    setDocumentos(listarDocumentos());
    setEliminando(null);
    toast({ title: 'Eliminado' });
  };

  const docsPorCategoria = (cat: CategoriaDocumento) =>
    documentos.filter((d) => d.categoria === cat);

  return (
    <>
      <header className="flex items-center gap-3 p-5 md:px-8">
        <Button size="icon" variant="ghost" asChild>
          <Link href="/cuenta">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Mi cuenta</p>
          <h1 className="text-xl font-semibold md:text-2xl">Mis documentos</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-5 pb-6 md:px-8">
        <Card className="space-y-2 border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-4 w-4 text-primary" />
            <div className="text-xs">
              <p className="font-medium">¿Por qué tener esto cargado?</p>
              <p className="text-muted-foreground">
                Cuando llegue la renovación, una mudanza o tengas que dar de alta una garantía
                nueva, los reutilizás en un click.
              </p>
            </div>
          </div>
        </Card>

        {/* Tabs de categoría */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(Object.keys(categoriaLabel) as CategoriaDocumento[]).map((cat) => {
            const count = docsPorCategoria(cat).length;
            const active = categoriaActiva === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoriaActiva(cat)}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted/40',
                )}
              >
                {iconoCategoria[cat]}
                {categoriaLabel[cat]}
                {count > 0 && (
                  <Badge
                    variant={active ? 'secondary' : 'outline'}
                    className="h-5 min-w-5 justify-center px-1.5 text-[10px]"
                  >
                    {count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {/* Header de categoría + upload */}
        <Card className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{categoriaLabel[categoriaActiva]}</p>
              <p className="text-xs text-muted-foreground">
                {categoriaDescripcion[categoriaActiva]}
              </p>
            </div>
            <Button size="sm" onClick={() => fileInputRef.current?.click()}>
              <Plus className="h-3.5 w-3.5" />
              Subir
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed bg-muted/30 py-6 text-center transition-colors hover:bg-muted/50"
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium">Tocá para subir</span>
            <span className="text-[11px] text-muted-foreground">
              JPG, PNG o PDF · hasta 2MB en esta demo
            </span>
          </button>
        </Card>

        {/* Lista de documentos de la categoría */}
        <section className="space-y-3">
          {docsPorCategoria(categoriaActiva).length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-medium">Sin documentos todavía</p>
              <p className="text-xs text-muted-foreground">
                Subí el primero para tenerlo siempre a mano.
              </p>
            </Card>
          ) : (
            <Card className="divide-y">
              {docsPorCategoria(categoriaActiva).map((doc) => (
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

      <NavBar />

      <ConfirmDialog
        open={!!eliminando}
        onOpenChange={(o) => !o && setEliminando(null)}
        title={`¿Eliminar "${eliminando?.nombre}"?`}
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={confirmarEliminar}
      />
    </>
  );
}

function DocumentoRow({ doc, onDelete }: { doc: Documento; onDelete: () => void }) {
  const esImagen = doc.tipoMime.startsWith('image/');

  return (
    <div className="flex items-center gap-3 p-4">
      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
        {esImagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doc.dataUrl} alt={doc.nombre} className="h-full w-full object-cover" />
        ) : doc.tipoMime === 'application/pdf' ? (
          <FileText className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
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
