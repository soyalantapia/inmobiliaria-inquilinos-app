'use client';

import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Archive, ArchiveRestore, Landmark, Star, X } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@llave/ui/select';
import { Skeleton } from '@llave/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@llave/ui/dialog';
import { toast } from '@llave/ui/use-toast';
import { Topbar } from '@/components/topbar';
import { ApiError } from '@/lib/api/client';
import { useMe } from '@/lib/api/hooks';
import { rolTienePermiso } from '@/lib/permisos';
import type { Rol } from '@/lib/permisos';
import { formatMonto, formatFechaCorta } from '@/lib/format';
import {
  useCuentas,
  useMovimientosDeCuenta,
  crearCuenta,
  editarCuenta,
  borrarCuenta,
  type CuentaCaja,
  type DireccionCuenta,
} from '@/lib/api/use-cuentas';

const DIRECCION_LABEL: Record<DireccionCuenta, string> = {
  ENTRADA: 'Solo entradas',
  SALIDA: 'Solo salidas',
  AMBAS: 'Entradas y salidas',
};

export default function CuentasPage() {
  const { me } = useMe();
  const puedeGestionar = !!me && rolTienePermiso(me.rol as Rol, 'cuentas.gestionar');
  const { cuentas, cargando, refrescar } = useCuentas();
  const [editando, setEditando] = useState<CuentaCaja | 'nueva' | null>(null);
  const [verMovimientos, setVerMovimientos] = useState<CuentaCaja | null>(null);

  const activas = cuentas.filter((c) => c.activa);
  const archivadas = cuentas.filter((c) => !c.activa);

  return (
    <>
      <Topbar titulo="Cuentas" />
      <main className="flex-1 space-y-5 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-prose text-sm text-muted-foreground">
            Tus cuentas de caja: de dónde sale y a dónde entra la plata (Mercado Pago,
            efectivo, banco…). Al cargar un movimiento en Caja, elegís la cuenta.
          </p>
          {puedeGestionar && (
            <Button size="sm" onClick={() => setEditando('nueva')}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nueva cuenta
            </Button>
          )}
        </div>

        {cargando && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="space-y-2 py-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!cargando && cuentas.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Landmark className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Todavía no cargaste cuentas</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Creá una por cada lugar donde manejás plata (ej. “Gaspar Mercado Pago”,
                  “Efectivo”), y marcá si es de entrada, de salida o ambas.
                </p>
              </div>
              {puedeGestionar && (
                <Button size="sm" onClick={() => setEditando('nueva')}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Crear la primera cuenta
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {activas.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activas.map((c) => (
              <CuentaCard
                key={c.id}
                cuenta={c}
                puedeGestionar={puedeGestionar}
                onVer={() => setVerMovimientos(c)}
                onEditar={() => setEditando(c)}
                onArchivar={async () => {
                  await archivar(c, refrescar);
                }}
                onPredeterminar={async () => {
                  const quitando = c.esPredeterminada;
                  try {
                    await editarCuenta(c.id, { esPredeterminada: !quitando });
                    toast(
                      quitando
                        ? {
                            variant: 'default',
                            title: 'Los cobros automáticos ya no tienen cuenta',
                            description:
                              'Se van a seguir registrando en la caja, pero sin imputarse a ninguna cuenta. Marcá otra cuando quieras.',
                          }
                        : {
                            variant: 'success',
                            title: `Los cobros automáticos entran a "${c.nombre}"`,
                            description:
                              'Es la cuenta donde se registra la plata que cobrás desde un cargo al inquilino.',
                          },
                    );
                    refrescar();
                  } catch (e) {
                    toast({
                      variant: 'destructive',
                      title: quitando ? 'No se pudo quitar la marca' : 'No se pudo marcar la cuenta',
                      description: e instanceof ApiError ? e.message : 'Probá de nuevo.',
                    });
                  }
                }}
              />
            ))}
          </div>
        )}

        {archivadas.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Archivadas</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {archivadas.map((c) => (
                <CuentaCard
                  key={c.id}
                  cuenta={c}
                  puedeGestionar={puedeGestionar}
                  onVer={() => setVerMovimientos(c)}
                  onEditar={() => setEditando(c)}
                  onArchivar={async () => {
                    await editarCuenta(c.id, { activa: true });
                    toast({ variant: 'success', title: 'Cuenta reactivada' });
                    refrescar();
                  }}
                  // Una cuenta archivada no puede ser la predeterminada: la card ni
                  // muestra el botón, así que esto nunca se llama.
                  onPredeterminar={() => {}}
                  archivada
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {editando && (
        <EditarCuentaDialog
          cuenta={editando === 'nueva' ? null : editando}
          onClose={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null);
            refrescar();
          }}
        />
      )}
      {verMovimientos && (
        <MovimientosDialog cuenta={verMovimientos} onClose={() => setVerMovimientos(null)} />
      )}
    </>
  );
}

async function archivar(c: CuentaCaja, refrescar: () => void) {
  try {
    const r = await borrarCuenta(c.id);
    if (r.archivada) {
      toast({ variant: 'default', title: 'Cuenta archivada', description: `Tiene ${r.movimientos} movimientos, así que se guarda el historial.` });
    } else {
      toast({ variant: 'default', title: 'Cuenta eliminada' });
    }
    refrescar();
  } catch (e) {
    toast({ variant: 'destructive', title: 'No se pudo archivar', description: e instanceof ApiError ? e.message : undefined });
  }
}

function CuentaCard({
  cuenta,
  puedeGestionar,
  onVer,
  onEditar,
  onArchivar,
  onPredeterminar,
  archivada,
}: {
  cuenta: CuentaCaja;
  puedeGestionar: boolean;
  onVer: () => void;
  onEditar: () => void;
  onArchivar: () => void;
  onPredeterminar: () => void;
  archivada?: boolean;
}) {
  // Sólo puede ser predeterminada una cuenta activa que acepte entradas: ahí caen los
  // cobros que registra el sistema solo, y son ingresos. Es la misma regla que valida
  // la API — acá se aplica para no ofrecer un botón que va a devolver error.
  const puedeSerPredeterminada = !archivada && cuenta.direccion !== 'SALIDA';
  return (
    <Card className={archivada ? 'opacity-70' : ''}>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={onVer} className="min-w-0 text-left">
            <p className="truncate font-medium hover:underline">{cuenta.nombre}</p>
            <span className="text-xs text-muted-foreground">{DIRECCION_LABEL[cuenta.direccion]}</span>
            {/* `!archivada` a propósito: archivar limpia la marca en el server, pero
                mientras tanto esta card no puede afirmar que ahí entran los cobros. */}
            {cuenta.esPredeterminada && !archivada && (
              <span className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Star className="h-3 w-3 fill-current" />
                Acá entran los cobros automáticos
              </span>
            )}
          </button>
          {puedeGestionar && (
            <div className="flex shrink-0 gap-1">
              {/* La estrella es un INTERRUPTOR, no un botón de una sola dirección. Si sólo
                  se pudiera marcar, no habría manera de decir "no quiero cuenta
                  predeterminada" — y como la primera cuenta que acepta entradas se marca
                  sola, alguien podía quedar con una marca que nunca pidió y sin forma
                  de sacarla. */}
              {puedeSerPredeterminada && (
                <button
                  type="button"
                  onClick={onPredeterminar}
                  aria-pressed={cuenta.esPredeterminada}
                  aria-label={
                    cuenta.esPredeterminada
                      ? 'Que los cobros automáticos ya no entren acá'
                      : 'Marcar como cuenta de los cobros automáticos'
                  }
                  title={
                    cuenta.esPredeterminada
                      ? 'Quitar: los cobros que registra el sistema van a quedar sin cuenta'
                      : 'Que los cobros que registra el sistema entren acá'
                  }
                  className={`rounded p-1 hover:bg-muted ${
                    cuenta.esPredeterminada
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Star className={`h-3.5 w-3.5 ${cuenta.esPredeterminada ? 'fill-current' : ''}`} />
                </button>
              )}
              <button type="button" onClick={onEditar} aria-label="Editar" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={onArchivar} aria-label={archivada ? 'Reactivar' : 'Archivar'} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                {archivada ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
        </div>
        {/* Un bloque POR MONEDA. Con una sola —el caso normal— se ve igual que antes;
            con dos, el saldo deja de ser un número inventado que mezcla pesos y dólares. */}
        {cuenta.totales.map((t) => (
          <div key={t.moneda} className="flex items-end justify-between">
            <div className="space-y-0.5 text-xs">
              {cuenta.direccion !== 'SALIDA' && (
                <p className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <ArrowDownLeft className="h-3.5 w-3.5" /> {formatMonto(t.entradas, t.moneda)}
                </p>
              )}
              {cuenta.direccion !== 'ENTRADA' && (
                <p className="flex items-center gap-1 text-destructive">
                  <ArrowUpRight className="h-3.5 w-3.5" /> {formatMonto(t.salidas, t.moneda)}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Saldo{cuenta.totales.length > 1 ? ` · ${t.moneda}` : ''}
              </p>
              <p className={`text-lg font-bold tabular-nums ${t.saldo < 0 ? 'text-destructive' : ''}`}>
                {formatMonto(t.saldo, t.moneda)}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EditarCuentaDialog({
  cuenta,
  onClose,
  onGuardado,
}: {
  cuenta: CuentaCaja | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState(cuenta?.nombre ?? '');
  const [direccion, setDireccion] = useState<DireccionCuenta>(cuenta?.direccion ?? 'AMBAS');
  const [guardando, setGuardando] = useState(false);
  const valido = nombre.trim().length >= 2;

  const guardar = async () => {
    if (!valido || guardando) return;
    setGuardando(true);
    try {
      const creada = cuenta
        ? null
        : await crearCuenta({ nombre: nombre.trim(), direccion });
      if (cuenta) await editarCuenta(cuenta.id, { nombre: nombre.trim(), direccion });
      // La primera cuenta que acepta entradas queda predeterminada sola. Es lo correcto
      // —sino los cobros automáticos siguen sin cuenta— pero tiene que decirse: es una
      // decisión sobre dónde va a caer plata.
      if (creada?.esPredeterminada) {
        toast({
          variant: 'success',
          title: `Cuenta creada — los cobros automáticos entran a "${creada.nombre}"`,
          description:
            'Es la primera cuenta que acepta entradas, así que ahí se van a registrar los cobros que hagas desde un cargo al inquilino. Podés cambiarla con la estrella.',
        });
        onGuardado();
        return;
      }
      // Pasar la predeterminada a "solo salidas" le saca la marca del lado del server
      // (ahí no pueden caer los cobros automáticos, que son ingresos). Decirlo acá, en
      // vez de dejar que el usuario lo descubra cuando los totales no cierren.
      const perdioLaMarca = !!cuenta && cuenta.esPredeterminada && direccion === 'SALIDA';
      toast(
        perdioLaMarca
          ? {
              variant: 'default',
              title: 'Cuenta actualizada — ya no recibe los cobros automáticos',
              description:
                'Una cuenta de solo salidas no puede recibirlos. Marcá otra que acepte entradas para que esa plata quede imputada.',
            }
          : { variant: 'success', title: cuenta ? 'Cuenta actualizada' : 'Cuenta creada' },
      );
      onGuardado();
    } catch (e) {
      toast({ variant: 'destructive', title: 'No se pudo guardar', description: e instanceof ApiError ? e.message : 'Reintentá.' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{cuenta ? 'Editar cuenta' : 'Nueva cuenta'}</DialogTitle>
          <DialogDescription>Un nombre para reconocerla y qué tipo de movimientos admite.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cta-nombre">Nombre</Label>
            <Input id="cta-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Gaspar Mercado Pago" maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cta-dir">Movimientos que admite</Label>
            <Select value={direccion} onValueChange={(v) => setDireccion(v as DireccionCuenta)}>
              <SelectTrigger id="cta-dir">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AMBAS">Entradas y salidas</SelectItem>
                <SelectItem value="ENTRADA">Solo entradas</SelectItem>
                <SelectItem value="SALIDA">Solo salidas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button onClick={guardar} disabled={!valido || guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MovimientosDialog({ cuenta, onClose }: { cuenta: CuentaCaja; onClose: () => void }) {
  const { movimientos, cargando } = useMovimientosDeCuenta(cuenta.id);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{cuenta.nombre}</DialogTitle>
          <DialogDescription>
            Movimientos de esta cuenta · saldo{' '}
            {cuenta.totales.map((t, i) => (
              <span key={t.moneda}>
                {i > 0 ? ' · ' : ''}
                {formatMonto(t.saldo, t.moneda)}
              </span>
            ))}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-1.5 overflow-auto">
          {cargando && <Skeleton className="h-16 w-full" />}
          {!cargando && movimientos.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Esta cuenta todavía no tiene movimientos.</p>
          )}
          {movimientos.map((m) => {
            const esIngreso = m.tipo === 'INGRESO_EXTRA';
            return (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.descripcion}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatFechaCorta(m.fecha)}
                    {m.propiedad ? ` · ${m.propiedad.direccion}` : ''}
                    {m.proveedor ? ` · ${m.proveedor}` : ''}
                  </p>
                </div>
                <span className={`shrink-0 tabular-nums font-medium ${esIngreso ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                  {esIngreso ? '+' : '−'}{formatMonto(m.monto, m.moneda)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            <X className="mr-1.5 h-4 w-4" /> Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
