'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { Input } from '@llave/ui/input';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { NavBar } from '@/components/nav-bar';
import { leerArchivoComoDataUrl } from '@/lib/documentos-storage';
import { formatFecha } from '@/lib/format';
import {
  AMBIENTES_DEFAULT,
  type EstadoInventario,
  type EstadoItem,
  type ItemInventario,
  agregarItem,
  eliminarItem,
  estadoColor,
  estadoLabel,
  firmarInmobiliaria,
  leerInventario,
} from '@/lib/inventario-storage';

// Foto-checklist del estado del depto al entrar. Es la única defensa real
// contra "te descontamos del depósito por la mancha de la pared" sin prueba.
// Estructura: ambientes predefinidos + items con estado + foto opcional.

export default function InventarioPage() {
  const [estado, setEstado] = useState<EstadoInventario>({
    items: [],
    firmadoInmobiliaria: false,
    firmadoAt: null,
  });
  const [hidratado, setHidratado] = useState(false);
  const [agregando, setAgregando] = useState<string | null>(null); // ambiente activo
  const [eliminando, setEliminando] = useState<ItemInventario | null>(null);

  useEffect(() => {
    setEstado(leerInventario());
    setHidratado(true);
  }, []);

  if (!hidratado) {
    return (
      <>
        <main className="flex-1 px-5 pb-6 md:px-8" />
        <NavBar />
      </>
    );
  }

  const itemsPor = (ambiente: string) =>
    estado.items.filter((i) => i.ambiente === ambiente);

  const total = estado.items.length;
  const conFoto = estado.items.filter((i) => i.fotoUrl).length;

  const handleAgregar = (item: Omit<ItemInventario, 'id' | 'createdAt'>) => {
    agregarItem(item);
    setEstado(leerInventario());
    setAgregando(null);
    toast({ title: 'Item agregado' });
  };

  const handleEliminar = () => {
    if (!eliminando) return;
    eliminarItem(eliminando.id);
    setEstado(leerInventario());
    setEliminando(null);
    toast({ title: 'Eliminado' });
  };

  const handleFirmar = () => {
    firmarInmobiliaria();
    setEstado(leerInventario());
    toast({ title: 'Inventario firmado por la inmobiliaria (demo)' });
  };

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
          <h1 className="text-xl font-semibold md:text-2xl">Inventario inicial</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-5 pb-6 md:px-8">
        <Card className="space-y-2 border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="mt-0.5 h-4 w-4 text-primary" />
            <div className="text-xs">
              <p className="font-medium">Documentá cómo recibiste el depto</p>
              <p className="text-muted-foreground">
                Sacá fotos y anotá el estado de cada cosa. Cuando devuelvas las llaves, esto te
                cubre frente a descuentos injustos del depósito.
              </p>
            </div>
          </div>
        </Card>

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-3">
          <ResumenItem label="Items cargados" value={total} />
          <ResumenItem label="Con foto" value={conFoto} />
          <ResumenItem
            label="Estado"
            value={estado.firmadoInmobiliaria ? '✓' : '—'}
            hint={estado.firmadoInmobiliaria ? 'Firmado' : 'Sin firmar'}
          />
        </div>

        {/* Estado de firma */}
        {!estado.firmadoInmobiliaria && total > 0 && (
          <Card className="flex items-center gap-3 border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
            <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1 text-xs">
              <p className="font-medium">Falta firma de la inmobiliaria</p>
              <p className="text-muted-foreground">
                Pediles que firmen el inventario para que tenga validez al devolver el depósito.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleFirmar}>
              Simular firma
            </Button>
          </Card>
        )}

        {estado.firmadoInmobiliaria && (
          <Card className="flex items-center gap-3 border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <div className="flex-1 text-xs">
              <p className="font-medium">Inventario firmado</p>
              <p className="text-muted-foreground">
                Firmado el {formatFecha(estado.firmadoAt!)} — guardado como respaldo.
              </p>
            </div>
          </Card>
        )}

        {/* Ambientes */}
        {AMBIENTES_DEFAULT.map((amb) => {
          const items = itemsPor(amb);
          return (
            <section key={amb} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{amb}</h2>
                  {items.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {items.length}
                    </Badge>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setAgregando(amb)}>
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </Button>
              </div>

              {agregando === amb && (
                <FormularioItem
                  ambiente={amb}
                  onCancel={() => setAgregando(null)}
                  onSubmit={handleAgregar}
                />
              )}

              {items.length === 0 && agregando !== amb ? (
                <Card className="border-dashed p-4 text-center">
                  <p className="text-xs text-muted-foreground">Sin items en {amb.toLowerCase()}</p>
                </Card>
              ) : (
                items.map((it) => (
                  <ItemCard key={it.id} item={it} onDelete={() => setEliminando(it)} />
                ))
              )}
            </section>
          );
        })}
      </main>

      <NavBar />

      <ConfirmDialog
        open={!!eliminando}
        onOpenChange={(o) => !o && setEliminando(null)}
        title="¿Eliminar item?"
        description={eliminando?.descripcion}
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleEliminar}
      />
    </>
  );
}

function ResumenItem({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card className="space-y-1 p-3 text-center">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{hint ?? label}</p>
    </Card>
  );
}

function ItemCard({ item, onDelete }: { item: ItemInventario; onDelete: () => void }) {
  return (
    <Card className="flex items-start gap-3 p-3">
      <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
        {item.fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.fotoUrl} alt={item.descripcion} className="h-full w-full object-cover" />
        ) : (
          <Camera className="h-5 w-5 text-muted-foreground/50" />
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{item.descripcion}</p>
          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', estadoColor[item.estado])} />
          <p className="text-xs text-muted-foreground">{estadoLabel[item.estado]}</p>
        </div>
        {item.observaciones && (
          <p className="text-xs text-muted-foreground">{item.observaciones}</p>
        )}
      </div>
    </Card>
  );
}

function FormularioItem({
  ambiente,
  onCancel,
  onSubmit,
}: {
  ambiente: string;
  onCancel: () => void;
  onSubmit: (item: Omit<ItemInventario, 'id' | 'createdAt'>) => void;
}) {
  const [descripcion, setDescripcion] = useState('');
  const [estadoSel, setEstadoSel] = useState<EstadoItem>('BUENO');
  const [observaciones, setObservaciones] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      toast({
        title: 'Foto muy pesada',
        description: 'Máximo 1.5MB',
        variant: 'destructive',
      });
      return;
    }
    const url = await leerArchivoComoDataUrl(file);
    setFotoUrl(url);
  };

  const handleSubmit = () => {
    if (!descripcion.trim()) {
      toast({ title: 'Falta la descripción', variant: 'destructive' });
      return;
    }
    onSubmit({
      ambiente,
      descripcion: descripcion.trim(),
      estado: estadoSel,
      observaciones: observaciones.trim() || null,
      fotoUrl,
    });
  };

  return (
    <Card className="space-y-3 border-primary/30 p-4">
      <Input
        placeholder="Ej: Pared del living"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        autoFocus
      />

      <div className="grid grid-cols-4 gap-2">
        {(['BUENO', 'REGULAR', 'MALO', 'FALTANTE'] as EstadoItem[]).map((e) => (
          <button
            key={e}
            onClick={() => setEstadoSel(e)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-md border p-2 text-[11px] transition-colors',
              estadoSel === e
                ? 'border-primary bg-primary/10 font-medium'
                : 'border-border hover:bg-muted/40',
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', estadoColor[e])} />
            {estadoLabel[e]}
          </button>
        ))}
      </div>

      <Textarea
        placeholder="Observaciones (opcional)"
        value={observaciones}
        onChange={(e) => setObservaciones(e.target.value)}
        rows={2}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFoto}
      />

      {fotoUrl ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fotoUrl} alt="" className="h-16 w-16 rounded-md object-cover" />
          <Button size="sm" variant="ghost" onClick={() => setFotoUrl(null)}>
            Quitar foto
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera className="h-3.5 w-3.5" />
          Agregar foto
        </Button>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={handleSubmit}>
          Guardar
        </Button>
      </div>
    </Card>
  );
}
