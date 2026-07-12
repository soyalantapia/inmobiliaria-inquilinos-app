'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Star, ShieldCheck, MapPin, CheckCircle2, Clock, Wrench } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { Badge } from '@llave/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@llave/ui/dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { toast } from '@llave/ui/use-toast';
import { cn } from '@llave/ui/cn';
import {
  useRedProfesionales,
  useFichaRed,
  contratarDeRedApi,
  cargarSeguroApi,
  type RedFiltros,
  type RedProfesionalFicha,
} from '@/lib/api/use-red-profesionales';
import { profesionalCategoriaLabelAdmin, type CategoriaProfesional } from '@/lib/mock-data';
import { formatMonto } from '@/lib/format';

const CATS = Object.keys(profesionalCategoriaLabelAdmin) as CategoriaProfesional[];

function Estrellas({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} de 5`}>
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      <span className="font-semibold tabular-nums">{n > 0 ? n.toFixed(1) : '—'}</span>
    </span>
  );
}

export default function RedProfesionalesPage() {
  const qc = useQueryClient();
  const [cat, setCat] = useState<CategoriaProfesional | 'TODOS'>('TODOS');
  const [q, setQ] = useState('');
  const [zona, setZona] = useState('');
  const [soloAsegurados, setSoloAsegurados] = useState(false);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [contratando, setContratando] = useState<string | null>(null);

  const filtros: RedFiltros = useMemo(
    () => ({
      ...(cat !== 'TODOS' ? { categoria: cat } : {}),
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(zona.trim() ? { zona: zona.trim() } : {}),
    }),
    [cat, q, zona],
  );
  const { profesionales: profesionalesRaw, cargando, isError } = useRedProfesionales(filtros);
  // "Solo asegurados" — el diferencial comercial del ecosistema — se filtra en el
  // cliente sobre p.asegurado (ya viene en el payload); no necesita backend.
  const profesionales = useMemo(
    () => (soloAsegurados ? profesionalesRaw.filter((p) => p.asegurado) : profesionalesRaw),
    [profesionalesRaw, soloAsegurados],
  );
  const asegCount = profesionalesRaw.filter((p) => p.asegurado).length;

  const contratar = async (redId: string) => {
    setContratando(redId);
    try {
      await contratarDeRedApi(redId);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['profesionales'] }),
        qc.invalidateQueries({ queryKey: ['red-profesionales'] }),
        qc.invalidateQueries({ queryKey: ['red-profesional', redId] }),
      ]);
      toast({ variant: 'success', title: 'Agregado a tu cartera', description: 'Ya podés asignarlo a un reclamo.' });
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo agregar', description: 'Probá de nuevo en un momento.' });
    } finally {
      setContratando(null);
    }
  };

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <Link href="/profesionales" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a mis profesionales
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold md:text-3xl">Red compartida</h1>
          <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Ecosistema</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Profesionales que otras inmobiliarias probaron y compartieron, con su ficha técnica real.
          Sumá el que quieras a tu cartera para asignarlo a un reclamo.
        </p>
      </div>

      {/* Filtros */}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['TODOS', ...CATS] as (CategoriaProfesional | 'TODOS')[]).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cat === c}
              onClick={() => setCat(c)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                cat === c ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted/40',
              )}
            >
              {c === 'TODOS' ? 'Todos' : profesionalCategoriaLabelAdmin[c]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre…"
            className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
          <input
            value={zona}
            onChange={(e) => setZona(e.target.value)}
            placeholder="Zona (ej: Palermo)"
            className="w-full max-w-[12rem] rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
          {/* Toggle "Solo asegurados": el gancho comercial del ecosistema
              (profesionales con póliza vigente). Filtra client-side. */}
          <button
            type="button"
            aria-pressed={soloAsegurados}
            onClick={() => setSoloAsegurados((v) => !v)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              soloAsegurados
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-border bg-background hover:bg-muted/40',
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Solo asegurados
            {asegCount > 0 && (
              <span className={cn('tabular-nums', soloAsegurados ? 'text-white/90' : 'text-muted-foreground')}>
                · {asegCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Directorio */}
      {cargando ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-36 animate-pulse bg-muted/40" />)}
        </div>
      ) : isError ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">No pudimos cargar la red</p>
          <p className="mt-1 text-xs text-muted-foreground">Hubo un problema de conexión. Reintentá en un momento.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>Reintentar</Button>
        </Card>
      ) : profesionales.length === 0 ? (
        <Card className="p-8 text-center">
          <Wrench className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Todavía no hay profesionales en la red</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A medida que las inmobiliarias compartan sus profesionales, van a aparecer acá con su reputación.
            Podés ser de las primeras: compartí los tuyos desde «Mis profesionales».
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {profesionales.map((p) => (
            <Card key={p.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-semibold">{p.nombre}</p>
                    {p.asegurado && (
                      <Badge variant="success" className="gap-1 text-[10px]"><ShieldCheck className="h-3 w-3" /> Asegurado</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{profesionalCategoriaLabelAdmin[p.categoria]}</p>
                </div>
                <Estrellas n={p.ratingPromedio} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {p.zona && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.zona}</span>}
                <span>{p.trabajos} trabajo{p.trabajos === 1 ? '' : 's'}</span>
                <span>{p.reseñas} reseña{p.reseñas === 1 ? '' : 's'}</span>
              </div>
              <div className="mt-3 flex items-center gap-2 border-t pt-3">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setFichaId(p.id)}>Ver ficha</Button>
                {p.enMiCartera ? (
                  <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> En tu cartera</Badge>
                ) : (
                  <Button size="sm" className="flex-1" disabled={contratando === p.id} onClick={() => contratar(p.id)}>
                    {contratando === p.id ? 'Agregando…' : 'Sumar a mi cartera'}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <FichaRedDialog id={fichaId} onClose={() => setFichaId(null)} onContratar={contratar} contratando={contratando} />
    </div>
  );
}

function MetricBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// Seguro self-serve del profesional (solo si está en mi cartera). Cargo aseguradora +
// póliza + vencimiento; el badge "Asegurado" aparece en la red mientras esté vigente.
function SeguroSection({ ficha }: { ficha: RedProfesionalFicha }) {
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [aseguradora, setAseguradora] = useState(ficha.aseguradora ?? '');
  const [nroPoliza, setNroPoliza] = useState('');
  const [polizaVence, setPolizaVence] = useState(ficha.polizaVence ?? '');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await cargarSeguroApi(ficha.id, {
        aseguradora: aseguradora.trim() || undefined,
        nroPoliza: nroPoliza.trim() || undefined,
        polizaVence: polizaVence || null,
      });
      await qc.invalidateQueries({ queryKey: ['red-profesional', ficha.id] });
      await qc.invalidateQueries({ queryKey: ['red-profesionales'] });
      toast({ title: 'Seguro actualizado' });
      setEditando(false);
    } catch (e) {
      toast({ title: 'No se pudo guardar', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Seguro / póliza</p>
        <Button variant="ghost" size="sm" onClick={() => setEditando((v) => !v)}>
          {editando ? 'Cerrar' : ficha.asegurado ? 'Editar' : 'Cargar'}
        </Button>
      </div>
      {!editando &&
        (ficha.asegurado ? (
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
            Asegurado{ficha.aseguradora ? ` por ${ficha.aseguradora}` : ''}
            {ficha.polizaVence ? ` · vence ${new Date(ficha.polizaVence).toLocaleDateString('es-AR')}` : ''}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            Sin póliza vigente. Cargá el seguro para que figure “Asegurado” en la red.
          </p>
        ))}
      {editando && (
        <div className="mt-2 space-y-2">
          <Input placeholder="Aseguradora (ej: La Caja)" value={aseguradora} onChange={(e) => setAseguradora(e.target.value)} />
          <Input placeholder="N° de póliza (opcional)" value={nroPoliza} onChange={(e) => setNroPoliza(e.target.value)} />
          <div className="space-y-1">
            <Label htmlFor="pol-vence" className="text-xs">Vence</Label>
            <Input id="pol-vence" type="date" value={polizaVence} onChange={(e) => setPolizaVence(e.target.value)} />
          </div>
          <Button size="sm" className="w-full" disabled={guardando} onClick={guardar}>
            {guardando ? 'Guardando…' : 'Guardar seguro'}
          </Button>
        </div>
      )}
    </div>
  );
}

function FichaRedDialog({
  id, onClose, onContratar, contratando,
}: { id: string | null; onClose: () => void; onContratar: (id: string) => void; contratando: string | null }) {
  const { ficha, cargando } = useFichaRed(id);
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ficha?.nombre ?? 'Ficha técnica'}
            {ficha?.asegurado && <Badge variant="success" className="gap-1 text-[10px]"><ShieldCheck className="h-3 w-3" /> Asegurado</Badge>}
          </DialogTitle>
        </DialogHeader>
        {cargando || !ficha ? (
          <div className="h-40 animate-pulse rounded-md bg-muted/40" />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{profesionalCategoriaLabelAdmin[ficha.categoria]}</span>
              {ficha.zona && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {ficha.zona}</span>}
              <Estrellas n={ficha.ratingPromedio} />
              <span>({ficha.reseñas})</span>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <MetricBox label="Trabajos" value={String(ficha.trabajos)} />
              <MetricBox label="Resueltos" value={`${Math.round(ficha.tasaResolucion * 100)}%`} sub={`${ficha.resueltos}/${ficha.asignados}`} />
              <MetricBox label="Rating" value={ficha.ratingPromedio > 0 ? ficha.ratingPromedio.toFixed(1) : '—'} sub={`${ficha.reseñas} reseñas`} />
              <MetricBox label="Respuesta" value={ficha.tiempoPromedioHoras != null ? `${ficha.tiempoPromedioHoras}h` : '—'} />
            </div>
            {/* Rubros y zonas donde ya trabajó (agregados, anonimizados): datos que
                el backend ya devolvía pero la UI no mostraba. Refuerzan la confianza. */}
            {(ficha.categorias.length > 0 || ficha.zonas.length > 0) && (
              <div className="space-y-2">
                {ficha.categorias.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Rubros:</span>
                    {ficha.categorias.map((c) => (
                      <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                    ))}
                  </div>
                )}
                {ficha.zonas.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Trabajó en:</span>
                    {ficha.zonas.map((z) => (
                      <Badge key={z} variant="outline" className="gap-1 text-[10px]"><MapPin className="h-2.5 w-2.5" />{z}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
            {ficha.preciosPorCategoria.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium">Rango de precios</p>
                <div className="space-y-1">
                  {ficha.preciosPorCategoria.map((p) => (
                    <div key={p.categoria} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{p.categoria}</span>
                      <span className="tabular-nums">{formatMonto(p.min)} – {formatMonto(p.max)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {ficha.trabajosRecientes.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium">Trabajos recientes</p>
                <div className="space-y-1">
                  {ficha.trabajosRecientes.map((t, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-xs">
                      <span className="flex items-center gap-2">
                        <Wrench className="h-3 w-3 text-muted-foreground" />
                        {t.categoria}{t.ciudad ? ` · ${t.ciudad}` : ''}
                      </span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        {t.estrellas != null && <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{t.estrellas}</span>}
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(t.fecha).toLocaleDateString('es-AR')}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Datos anonimizados: nunca mostramos dirección, inquilino ni la inmobiliaria.
                </p>
              </div>
            )}
            {/* Seguro self-serve: sólo la inmo que tiene al profesional en su cartera lo carga.
                'Asegurado' aparece en la red mientras la póliza esté vigente. */}
            {ficha.enMiCartera && <SeguroSection ficha={ficha} />}
            <div className="flex items-center gap-2 border-t pt-3">
              {ficha.enMiCartera ? (
                <div className="flex-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />
                  En tu cartera{ficha.contacto?.telefono ? ` · ${ficha.contacto.telefono}` : ''}
                </div>
              ) : (
                <Button className="flex-1" disabled={contratando === ficha.id} onClick={() => onContratar(ficha.id)}>
                  {contratando === ficha.id ? 'Agregando…' : 'Sumar a mi cartera'}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
