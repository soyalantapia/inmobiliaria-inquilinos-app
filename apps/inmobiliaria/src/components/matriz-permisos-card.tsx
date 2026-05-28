'use client';

import { useMemo } from 'react';
import {
  CheckCircle2,
  Eye,
  FileEdit,
  KeyRound,
  Settings2,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Card, CardContent } from '@llave/ui/card';
import {
  CAPACIDADES,
  GRUPO_LABEL,
  ROLES_ORDEN,
  ROL_LABEL,
  type Capacidad,
  type DefinicionCapacidad,
  type Rol,
} from '@/lib/permisos';

const ICONO_GRUPO: Record<DefinicionCapacidad['grupo'], typeof Eye> = {
  lectura: Eye,
  carga: FileEdit,
  operativa: Workflow,
  sensible: ShieldCheck,
};

export function MatrizPermisosCard() {
  const porGrupo = useMemo(() => {
    const map = new Map<DefinicionCapacidad['grupo'], DefinicionCapacidad[]>();
    for (const c of CAPACIDADES) {
      const arr = map.get(c.grupo) ?? [];
      arr.push(c);
      map.set(c.grupo, arr);
    }
    return map;
  }, []);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <Settings2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Matriz de permisos</p>
            <p className="text-xs text-muted-foreground">
              Quién puede ver y hacer qué en el panel. Las acciones marcadas con
              <KeyRound className="mx-1 inline-block h-3 w-3 text-primary" />
              piden el PIN del usuario. Las que tienen
              <Badge variant="warning" className="mx-1 align-middle text-[8px]">
                pendiente
              </Badge>
              quedan en bandeja del Admin si las carga un rol menor.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table aria-label="Matriz de permisos por rol" className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 bg-background px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Capacidad
                </th>
                {ROLES_ORDEN.map((r) => (
                  <th
                    key={r}
                    scope="col"
                    className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {ROL_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(porGrupo.entries()).map(([grupo, items]) => {
                const Icon = ICONO_GRUPO[grupo];
                return (
                  <FilasGrupo
                    key={grupo}
                    icon={Icon}
                    grupo={grupo}
                    items={items}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function FilasGrupo({
  icon: Icon,
  grupo,
  items,
}: {
  icon: typeof Eye;
  grupo: DefinicionCapacidad['grupo'];
  items: DefinicionCapacidad[];
}) {
  return (
    <>
      <tr>
        <td colSpan={5} className="px-2 pb-1 pt-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
            {GRUPO_LABEL[grupo]}
          </div>
        </td>
      </tr>
      {items.map((c) => (
        <FilaCapacidad key={c.key} cap={c} />
      ))}
    </>
  );
}

function FilaCapacidad({ cap }: { cap: DefinicionCapacidad }) {
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="sticky left-0 bg-background px-2 py-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span>{cap.label}</span>
          {cap.requierePin && (
            <KeyRound
              className="h-3 w-3 text-primary"
              aria-label="Requiere PIN"
            />
          )}
        </div>
      </td>
      {ROLES_ORDEN.map((r) => {
        const tiene = cap.roles.includes(r);
        const pendienteAprobacion = cap.rolesAprobacion?.includes(r) ?? false;
        return (
          <td key={r} className="px-2 py-2 text-center">
            {tiene ? (
              pendienteAprobacion ? (
                <Badge variant="warning" className="text-[9px]">
                  pendiente
                </Badge>
              ) : (
                <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" />
              )
            ) : (
              <span className="text-muted-foreground/50">·</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}
