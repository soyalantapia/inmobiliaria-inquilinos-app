'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronRight, Search, Users, X } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { Input } from '@llave/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@llave/ui/table';
import { Topbar } from '@/components/topbar';
import { usePersonas, type EstadoInquilino, type PersonaListado } from '@/lib/api/use-inquilinos';

type Filtro = 'TODOS' | 'ACTIVO' | 'INACTIVO';

const ESTADO_LABEL: Record<EstadoInquilino, string> = {
  ACTIVO: 'Activo',
  INACTIVO: 'Inactivo',
};

const ESTADO_VARIANT: Record<EstadoInquilino, React.ComponentProps<typeof Badge>['variant']> = {
  ACTIVO: 'success',
  INACTIVO: 'secondary',
};

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'ACTIVO', label: 'Activos' },
  { key: 'INACTIVO', label: 'Inactivos' },
];

function contacto(p: PersonaListado): string {
  return p.dni ? `DNI ${p.dni}` : p.email ?? p.telefono ?? '—';
}

export default function InquilinosPage() {
  const router = useRouter();
  const { personas, cargando, error } = usePersonas();
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('TODOS');

  const counts = useMemo(
    () => ({
      TODOS: personas.length,
      ACTIVO: personas.filter((p) => p.estado === 'ACTIVO').length,
      INACTIVO: personas.filter((p) => p.estado !== 'ACTIVO').length,
    }),
    [personas],
  );

  const filtradas = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return personas.filter((p) => {
      const matchFiltro = filtro === 'TODOS' || p.estado === filtro;
      if (!matchFiltro) return false;
      if (!texto) return true;
      return (
        p.nombre.toLowerCase().includes(texto) ||
        (p.dni ?? '').toLowerCase().includes(texto) ||
        (p.email ?? '').toLowerCase().includes(texto) ||
        (p.propiedad ?? '').toLowerCase().includes(texto)
      );
    });
  }, [personas, filtro, q]);

  return (
    <>
      <Topbar titulo="Inquilinos" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <p className="text-sm text-muted-foreground">
          Todos los inquilinos que pasaron por tu cartera, activos e inactivos. Entrá a la ficha
          para ver su historial: contratos, propiedades, reclamos y si tuvo morosidad.
        </p>

        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFiltro(f.key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                filtro === f.key
                  ? 'border-primary bg-primary/10 font-medium text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {f.label}
              <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{counts[f.key]}</span>
            </button>
          ))}
        </div>

        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, DNI, email o propiedad"
            className="pl-9 pr-9"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-muted"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {error ? (
          <Card className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5 text-destructive" />
            No pudimos cargar los inquilinos. Revisá tu conexión e intentá de nuevo.
          </Card>
        ) : cargando ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((n) => (
              <div key={n} className="h-14 animate-pulse rounded-lg border bg-muted/50" />
            ))}
          </div>
        ) : filtradas.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">
              {personas.length === 0 ? 'Todavía no hay inquilinos' : 'Sin resultados'}
            </p>
            <p className="text-sm text-muted-foreground">
              {personas.length === 0
                ? 'Cuando cargues un contrato, su inquilino aparece acá.'
                : 'Probá con otro texto o cambiá el filtro.'}
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inquilino</TableHead>
                  <TableHead className="hidden sm:table-cell">Contacto</TableHead>
                  <TableHead className="hidden md:table-cell">Propiedad</TableHead>
                  <TableHead className="text-center">Contratos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((p) => {
                  const ir = () => router.push(`/inquilinos/${p.id}`);
                  const nombre = `${p.nombre} ${p.apellido ?? ''}`.trim();
                  return (
                    <TableRow
                      key={p.id}
                      onClick={ir}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          ir();
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      className="cursor-pointer"
                    >
                      <TableCell className="font-medium">{nombre}</TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{contacto(p)}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {p.propiedad ?? '—'}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{p.totalContratos}</TableCell>
                      <TableCell>
                        <Badge variant={ESTADO_VARIANT[p.estado]}>{ESTADO_LABEL[p.estado]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </main>
    </>
  );
}
