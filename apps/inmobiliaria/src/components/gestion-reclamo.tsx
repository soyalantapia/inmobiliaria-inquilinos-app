'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  HardHat,
  Home,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  UserCog,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { toast } from '@llave/ui/use-toast';
import { mensajeWhatsappTrabajo } from '@/components/asignar-profesional-dialog';
import {
  type CategoriaProfesional,
  type ProfesionalAdmin,
  profesionalCategoriaLabelAdmin,
} from '@/lib/mock-data';
import { listarProfesionalesAdmin } from '@/lib/profesionales-storage';
import { asignarProfesional, clasificarReclamo } from '@/lib/reclamos-store';
import { apiEnabled } from '@/lib/api/client';
import { useProfesionales } from '@/lib/api/use-profesionales';
import type { Reclamo, CategoriaReclamo, ClasificacionReclamo } from '@/lib/types';
import { formatFechaCorta } from '@/lib/format';

// Bloque de gestión que va en /reclamos/[id] del admin.
// Permite clasificar el reclamo (uso y goce vs desperfecto, lo que define
// quién paga) y asignar un profesional de la red curada.

// Mapeo simple de categoría de reclamo → categoría de profesional sugerida.
// El admin igual puede cambiarlo cuando elige.
const sugerenciaCategoria: Partial<Record<CategoriaReclamo, CategoriaProfesional>> = {
  PLOMERIA: 'PLOMERO',
  ELECTRICIDAD: 'ELECTRICISTA',
  CERRADURA: 'CERRAJERO',
  CALEFACCION: 'GASISTA',
};

export function GestionReclamo({
  reclamo,
  onUpdate,
  asignarApi,
}: {
  reclamo: Reclamo;
  onUpdate: (r: Reclamo) => void;
  /** Acción real de asignación (POST /reclamos/:id/asignar) — usada en prod. */
  asignarApi?: (profesionalId: string) => Promise<void>;
}) {
  // Red de profesionales: API real en prod, store local en demo.
  const { profesionales: profesionalesApi } = useProfesionales();
  const [profesionalesDemo, setProfesionalesDemo] = useState<ProfesionalAdmin[]>([]);
  const [seleccionProf, setSeleccionProf] = useState<string>('');
  const [asignando, setAsignando] = useState(false);

  useEffect(() => {
    if (!apiEnabled) setProfesionalesDemo(listarProfesionalesAdmin().filter((p) => p.activo));
  }, []);

  const profesionales = apiEnabled
    ? profesionalesApi.filter((p) => p.activo)
    : profesionalesDemo;

  const sugerida = sugerenciaCategoria[reclamo.categoria];

  // Profesionales sugeridos (mismo rubro) y otros, ordenados por rating.
  const { sugeridos, otros } = useMemo(() => {
    const ordenados = [...profesionales].sort((a, b) => b.rating - a.rating);
    if (!sugerida) return { sugeridos: [], otros: ordenados };
    return {
      sugeridos: ordenados.filter((p) => p.categoria === sugerida),
      otros: ordenados.filter((p) => p.categoria !== sugerida),
    };
  }, [profesionales, sugerida]);

  // La clasificación (uso y goce / desperfecto) no tiene endpoint en el API:
  // solo opera en build demo (store). En prod se mantiene deshabilitada.
  const handleClasificar = (clasificacion: ClasificacionReclamo) => {
    if (apiEnabled) return;
    const actualizado = clasificarReclamo(reclamo.id, clasificacion, 'Roberto Tapia');
    if (actualizado) {
      onUpdate(actualizado);
      toast({
        title:
          clasificacion === 'USO_Y_GOCE'
            ? 'Marcado como Uso y goce'
            : 'Marcado como Desperfecto',
        description:
          clasificacion === 'USO_Y_GOCE'
            ? 'Lo paga el inquilino.'
            : 'Lo paga el propietario.',
      });
    }
  };

  const handleAsignar = async () => {
    if (!seleccionProf) {
      toast({ title: 'Elegí un profesional', variant: 'destructive' });
      return;
    }
    const prof = profesionales.find((p) => p.id === seleccionProf);
    if (!prof) return;

    // Prod: POST /reclamos/:id/asignar (la query del detalle se invalida y
    // trae el profesional + el evento PROFESIONAL_ASIGNADO reales).
    if (apiEnabled) {
      if (!asignarApi) return;
      setAsignando(true);
      try {
        await asignarApi(prof.id);
        toast({
          title: `${prof.nombre} asignado`,
          description: 'Se le notificó al inquilino. El profesional lo va a contactar.',
        });
        setSeleccionProf('');
      } catch {
        toast({ title: 'No se pudo asignar el profesional', variant: 'destructive' });
      } finally {
        setAsignando(false);
      }
      return;
    }

    // Demo: store local.
    const actualizado = asignarProfesional(
      reclamo.id,
      {
        id: prof.id,
        nombre: prof.nombre,
        telefono: prof.telefono,
        categoria: profesionalCategoriaLabelAdmin[prof.categoria],
      },
      'Roberto Tapia',
    );
    if (actualizado) {
      onUpdate(actualizado);
      toast({
        title: `${prof.nombre} asignado`,
        description: 'Se le notificó al inquilino. El profesional lo va a contactar.',
      });
      setSeleccionProf('');
    }
  };

  return (
    <div className="space-y-4">
      {/* 1) Clasificación */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <UserCog className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Clasificación · ¿Quién paga?</h3>
          </div>
          {reclamo.clasificacion ? (
            <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="font-medium">
                {reclamo.clasificacion === 'USO_Y_GOCE'
                  ? 'Uso y goce — paga el inquilino'
                  : 'Desperfecto — paga el propietario'}
              </span>
              {/* Re-clasificar no tiene endpoint en el API → solo demo. */}
              {!apiEnabled && (
                <button
                  type="button"
                  onClick={() => onUpdate({ ...reclamo, clasificacion: null })}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                >
                  Cambiar
                </button>
              )}
            </div>
          ) : apiEnabled ? (
            // En prod la clasificación todavía no tiene endpoint: mostramos el
            // estado real (sin clasificar) sin acciones que no persistan.
            <p className="text-xs text-muted-foreground">Sin clasificar todavía.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Antes de asignar un profesional, decidí quién se hace cargo del costo.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleClasificar('USO_Y_GOCE')}
                  className={cn(
                    'flex items-start gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted/40',
                  )}
                >
                  <Home className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium">Uso y goce</p>
                    <p className="text-xs text-muted-foreground">
                      Rotura por uso normal. Lo paga el inquilino.
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleClasificar('DESPERFECTO')}
                  className={cn(
                    'flex items-start gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted/40',
                  )}
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">Desperfecto</p>
                    <p className="text-xs text-muted-foreground">
                      Problema del inmueble. Lo paga el propietario.
                    </p>
                  </div>
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Calificación que dejó el inquilino al resolverse (D3): antes se persistía
          pero no se mostraba en ningún lado del panel. */}
      {reclamo.ratingInquilino && (
        <Card>
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold">Calificación del inquilino</h3>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`h-4 w-4 ${
                    n <= reclamo.ratingInquilino!.estrellas
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-muted-foreground/30'
                  }`}
                />
              ))}
              <span className="ml-1 text-sm font-medium tabular-nums">
                {reclamo.ratingInquilino.estrellas}/5
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {formatFechaCorta(reclamo.ratingInquilino.enviadoAt)}
              </span>
            </div>
            {reclamo.ratingInquilino.comentario && (
              <p className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
                “{reclamo.ratingInquilino.comentario}”
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 2) Asignar profesional — la lista de cards reemplaza al select plano. */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <HardHat className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Profesional asignado</h3>
            </div>
            {reclamo.profesionalAsignadoNombre && (
              <Badge variant="success">Asignado</Badge>
            )}
          </div>

          {reclamo.profesionalAsignadoNombre ? (
            <ProfesionalAsignadoCard
              reclamo={reclamo}
              // Reasignar/desasignar no tiene endpoint en el API → solo demo.
              onCambiar={
                apiEnabled
                  ? undefined
                  : () =>
                      onUpdate({
                        ...reclamo,
                        profesionalAsignadoId: null,
                        profesionalAsignadoNombre: null,
                        profesionalAsignadoTelefono: null,
                        profesionalAsignadoCategoria: null,
                      })
              }
            />
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Elegí uno de tu red. El inquilino lo ve y coordina con él, pero la
                autorización del trabajo es tuya.
              </p>

              {sugeridos.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    <Sparkles className="h-3 w-3" />
                    Sugeridos por rubro · {profesionalCategoriaLabelAdmin[sugerida!]}
                  </p>
                  <div className="space-y-1.5">
                    {sugeridos.map((p) => (
                      <ProfesionalRow
                        key={p.id}
                        profesional={p}
                        selected={seleccionProf === p.id}
                        onSelect={() => setSeleccionProf(p.id)}
                        destacado
                      />
                    ))}
                  </div>
                </div>
              )}

              {otros.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {sugeridos.length > 0 ? 'Otros' : 'Tu red'} ({otros.length})
                  </p>
                  <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                    {otros.map((p) => (
                      <ProfesionalRow
                        key={p.id}
                        profesional={p}
                        selected={seleccionProf === p.id}
                        onSelect={() => setSeleccionProf(p.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <Button
                size="sm"
                className="w-full"
                onClick={handleAsignar}
                disabled={!seleccionProf || asignando}
              >
                {asignando ? 'Asignando…' : 'Asignar y avisar al inquilino'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================================================
 * Fila de profesional elegible (lista de selección)
 * ============================================================ */
function ProfesionalRow({
  profesional,
  selected,
  onSelect,
  destacado = false,
}: {
  profesional: ProfesionalAdmin;
  selected: boolean;
  onSelect: () => void;
  destacado?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 rounded-md p-2.5 text-left transition-colors',
        selected
          ? 'border-2 border-primary bg-primary/5 ring-2 ring-primary/20'
          : destacado
            ? // border-2 violeta + bg sutil destacan claramente al
              // profesional cuyo rubro coincide con el reclamo.
              'border-2 border-primary/60 bg-primary/5 hover:bg-primary/10'
            : 'border border-border bg-background hover:border-primary/40 hover:bg-muted/30',
      )}
    >
      <div
        className={cn(
          'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border',
          selected ? 'border-primary bg-primary' : 'border-border',
        )}
      >
        {selected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-medium">{profesional.nombre}</p>
          {destacado && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-foreground">
              Recomendado
            </span>
          )}
          {profesional.verificado && (
            <ShieldCheck
              className="h-3 w-3 shrink-0 text-emerald-600"
              aria-label="Verificado"
            />
          )}
          <div className="ml-auto flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-[11px] font-semibold tabular-nums">
              {profesional.rating.toFixed(1)}
            </span>
          </div>
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          {profesionalCategoriaLabelAdmin[profesional.categoria]} ·{' '}
          {profesional.zona}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">
          {profesional.cantTrabajos} trabajo
          {profesional.cantTrabajos === 1 ? '' : 's'}
          {profesional.ultimoTrabajo &&
            ` · últ. ${formatFechaCorta(profesional.ultimoTrabajo)}`}
        </p>
      </div>
    </button>
  );
}

/* ============================================================
 * Card del profesional ya asignado con CTA de WhatsApp
 * ============================================================ */
function ProfesionalAsignadoCard({
  reclamo,
  onCambiar,
}: {
  reclamo: Reclamo;
  /** Si falta (prod, sin endpoint de reasignación), no se ofrece "Cambiar". */
  onCambiar?: () => void;
}) {
  // Reconstruimos un objeto mínimo del profesional para reutilizar el helper
  // de mensaje del dialog. Lo importante para el mensaje es la categoría y el
  // nombre — los campos analytics no se usan.
  const profMinimo: ProfesionalAdmin = {
    id: reclamo.profesionalAsignadoId ?? '',
    nombre: reclamo.profesionalAsignadoNombre ?? '',
    telefono: reclamo.profesionalAsignadoTelefono ?? '',
    email: null,
    categoria: (reclamo.profesionalAsignadoCategoria as CategoriaProfesional) ?? 'PLOMERO',
    zona: '',
    rating: 0,
    cantTrabajos: 0,
    ultimoTrabajo: null,
    verificado: false,
    notas: null,
    activo: true,
  };
  const tel = (reclamo.profesionalAsignadoTelefono ?? '').replace(/[^\d]/g, '');
  const waUrl = `https://wa.me/${tel}?text=${encodeURIComponent(
    mensajeWhatsappTrabajo(profMinimo, reclamo),
  )}`;
  const telUrl = `tel:${(reclamo.profesionalAsignadoTelefono ?? '').replace(/\s/g, '')}`;

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{reclamo.profesionalAsignadoNombre}</p>
        <Badge variant="outline" className="text-[10px]">
          {reclamo.profesionalAsignadoCategoria}
        </Badge>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Phone className="h-3 w-3" />
        {reclamo.profesionalAsignadoTelefono}
      </p>
      <p className="text-xs text-muted-foreground">
        Le compartimos al inquilino los datos para coordinar.
      </p>
      <div
        className={cn(
          'grid gap-1.5 border-t pt-3',
          onCambiar ? 'grid-cols-[1fr_1fr_auto]' : 'grid-cols-2',
        )}
      >
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300"
          asChild
        >
          <a href={waUrl} target="_blank" rel="noreferrer">
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={telUrl}>
            <Phone className="h-3.5 w-3.5" />
            Llamar
          </a>
        </Button>
        {onCambiar && (
          <Button size="sm" variant="ghost" onClick={onCambiar}>
            Cambiar
          </Button>
        )}
      </div>
    </div>
  );
}
