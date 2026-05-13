'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  HardHat,
  Home,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { toast } from '@llave/ui/use-toast';
import {
  type ProfesionalAdmin,
  profesionalCategoriaLabelAdmin,
} from '@/lib/mock-data';
import { listarProfesionalesAdmin } from '@/lib/profesionales-storage';
import { asignarProfesional, clasificarReclamo } from '@/lib/reclamos-store';
import type { Reclamo, CategoriaReclamo, ClasificacionReclamo } from '@/lib/types';

// Bloque de gestión que va en /reclamos/[id] del admin.
// Permite clasificar el reclamo (uso y goce vs desperfecto, lo que define
// quién paga) y asignar un profesional de la red curada.

// Mapeo simple de categoría de reclamo → categoría de profesional sugerida.
// El admin igual puede cambiarlo cuando elige.
const sugerenciaCategoria: Partial<Record<CategoriaReclamo, string>> = {
  PLOMERIA: 'PLOMERO',
  ELECTRICIDAD: 'ELECTRICISTA',
  CERRADURA: 'CERRAJERO',
  CALEFACCION: 'GASISTA',
};

export function GestionReclamo({
  reclamo,
  onUpdate,
}: {
  reclamo: Reclamo;
  onUpdate: (r: Reclamo) => void;
}) {
  const [profesionales, setProfesionales] = useState<ProfesionalAdmin[]>([]);
  const [seleccionProf, setSeleccionProf] = useState<string>('');

  useEffect(() => {
    setProfesionales(listarProfesionalesAdmin().filter((p) => p.activo));
  }, []);

  const sugerida = sugerenciaCategoria[reclamo.categoria];

  const handleClasificar = (clasificacion: ClasificacionReclamo) => {
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

  const handleAsignar = () => {
    if (!seleccionProf) {
      toast({ title: 'Elegí un profesional', variant: 'destructive' });
      return;
    }
    const prof = profesionales.find((p) => p.id === seleccionProf);
    if (!prof) return;
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
              <button
                onClick={() => onUpdate({ ...reclamo, clasificacion: null })}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Antes de asignar un profesional, decidí quién se hace cargo del costo.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
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

      {/* 2) Asignar profesional */}
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
            <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{reclamo.profesionalAsignadoNombre}</p>
                <Badge variant="outline" className="text-[10px]">
                  {reclamo.profesionalAsignadoCategoria}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Tel: {reclamo.profesionalAsignadoTelefono}
              </p>
              <p className="text-xs text-muted-foreground">
                Le compartimos al inquilino los datos para coordinar.
              </p>
              <button
                onClick={() =>
                  onUpdate({
                    ...reclamo,
                    profesionalAsignadoId: null,
                    profesionalAsignadoNombre: null,
                    profesionalAsignadoTelefono: null,
                    profesionalAsignadoCategoria: null,
                  })
                }
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cambiar profesional
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Asigná uno de tu red. El inquilino lo ve y coordina con él, pero la
                autorización del trabajo es tuya.
              </p>
              <select
                value={seleccionProf}
                onChange={(e) => setSeleccionProf(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Elegí un profesional…</option>
                {sugerida &&
                  profesionales
                    .filter((p) => p.categoria === sugerida)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        ⭐ {p.nombre} · {profesionalCategoriaLabelAdmin[p.categoria]} · {p.zona}
                      </option>
                    ))}
                {profesionales
                  .filter((p) => !sugerida || p.categoria !== sugerida)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} · {profesionalCategoriaLabelAdmin[p.categoria]} · {p.zona}
                    </option>
                  ))}
              </select>
              {sugerida && (
                <p className="text-[10px] text-muted-foreground">
                  ⭐ = sugeridos por la categoría del reclamo
                </p>
              )}
              <Button size="sm" onClick={handleAsignar} disabled={!seleccionProf}>
                Asignar y avisar al inquilino
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
