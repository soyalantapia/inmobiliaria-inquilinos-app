'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Edit2,
  Info,
  Plus,
  Star,
  TrendingDown,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import {
  CONDICION_FISCAL_LABEL,
  type Sociedad,
  type CondicionFiscalSociedad,
  actualizarSociedad,
  agregarSociedad,
  desactivarSociedad,
  listarSociedades,
  marcarComoPrincipal,
  reactivarSociedad,
} from '@/lib/sociedades-storage';
import { propiedadesMock } from '@/lib/mock-data';

/**
 * Gestor de sociedades en /configuracion → tab "Sociedades".
 *
 * Habilita el caso multi-sociedad: la misma inmobiliaria gestiona
 * propiedades bajo distintas razones sociales (SRL, SA, fideicomiso).
 * Para cada una: razón social, CUIT, condición fiscal, ARCA, CBU.
 */
export function SociedadesManager() {
  const [hidratado, setHidratado] = useState(false);
  const [lista, setLista] = useState<Sociedad[]>([]);
  const [crearOpen, setCrearOpen] = useState(false);
  const [editando, setEditando] = useState<Sociedad | null>(null);
  const [bajaSociedad, setBajaSociedad] = useState<Sociedad | null>(null);

  const recargar = () => setLista(listarSociedades({ incluirInactivas: true }));

  useEffect(() => {
    recargar();
    setHidratado(true);
  }, []);

  if (!hidratado) return null;

  const principalId = lista.find((s) => s.esPrincipal && s.activa)?.id ?? null;
  const propiedadesPorSociedad = (sociedadId: string) =>
    propiedadesMock.filter(
      (p) =>
        (p.sociedadId ?? principalId) === sociedadId && p.estado !== 'EN_EDICION',
    ).length;

  const handleMarcarPrincipal = (s: Sociedad) => {
    marcarComoPrincipal(s.id);
    recargar();
    toast({
      variant: 'success',
      title: `${s.nombreComercial} ahora es la sociedad principal`,
      description:
        'Las propiedades sin sociedad asignada van a usar esta por defecto.',
    });
  };

  const handleBaja = () => {
    if (!bajaSociedad) return;
    desactivarSociedad(bajaSociedad.id);
    recargar();
    toast({
      title: `${bajaSociedad.nombreComercial} dada de baja`,
      description:
        'Queda en el historial pero no se usa para nuevas operaciones.',
    });
    setBajaSociedad(null);
  };

  const handleReactivar = (s: Sociedad) => {
    reactivarSociedad(s.id);
    recargar();
    toast({ variant: 'success', title: `${s.nombreComercial} reactivada` });
  };

  const activas = lista.filter((s) => s.activa);
  const inactivas = lista.filter((s) => !s.activa);

  return (
    <div className="space-y-4">
      {/* Explicación / contexto */}
      {activas.length === 1 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">¿Operás con varias sociedades?</p>
              <p className="text-xs text-muted-foreground">
                Sumá las S.R.L., S.A. o fideicomisos que usás para administrar
                propiedades. Cada una se factura con su propio CUIT, tiene su
                CBU para cobrar y su punto de venta en ARCA. Los reportes
                (rendiciones, PDF de morosos) salen agrupados por sociedad
                correctamente.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header con botón */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">
            {activas.length} sociedad{activas.length === 1 ? '' : 'es'} activa
            {activas.length === 1 ? '' : 's'}
          </p>
          {inactivas.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {inactivas.length} dada{inactivas.length === 1 ? '' : 's'} de baja
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setCrearOpen(true)}>
          <Plus className="h-4 w-4" />
          Agregar sociedad
        </Button>
      </div>

      {/* Cards de sociedades activas */}
      <div className="space-y-3">
        {activas.map((s) => (
          <SociedadCard
            key={s.id}
            sociedad={s}
            propiedades={propiedadesPorSociedad(s.id)}
            onEditar={() => setEditando(s)}
            onPrincipal={() => handleMarcarPrincipal(s)}
            onBaja={() => setBajaSociedad(s)}
            puedeBaja={activas.length > 1}
          />
        ))}
      </div>

      {/* Inactivas (colapsado visual) */}
      {inactivas.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Dadas de baja
          </p>
          {inactivas.map((s) => (
            <Card key={s.id} className="border-dashed bg-muted/20 opacity-70">
              <CardContent className="flex items-center justify-between p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.razonSocial}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    CUIT {s.cuit}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleReactivar(s)}>
                  Reactivar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog crear / editar */}
      <SociedadDialog
        open={crearOpen || editando !== null}
        editando={editando}
        onClose={() => {
          setCrearOpen(false);
          setEditando(null);
        }}
        onGuardado={() => {
          recargar();
          setCrearOpen(false);
          setEditando(null);
        }}
      />

      <ConfirmDialog
        open={bajaSociedad !== null}
        onOpenChange={(v) => !v && setBajaSociedad(null)}
        title="Dar de baja sociedad"
        description={
          bajaSociedad
            ? `${bajaSociedad.razonSocial} va a dejar de aparecer en los selectores. Las propiedades que estaban asociadas mantienen sus datos históricos.`
            : ''
        }
        confirmLabel="Dar de baja"
        onConfirm={handleBaja}
        variant="destructive"
      />
    </div>
  );
}

/* ============================================================
 * Card de una sociedad
 * ============================================================ */
function SociedadCard({
  sociedad,
  propiedades,
  onEditar,
  onPrincipal,
  onBaja,
  puedeBaja,
}: {
  sociedad: Sociedad;
  propiedades: number;
  onEditar: () => void;
  onPrincipal: () => void;
  onBaja: () => void;
  puedeBaja: boolean;
}) {
  const arcaOn = sociedad.afip?.conectado ?? false;
  const tieneCbu = !!sociedad.cuentaCobranza?.cbu;
  return (
    <Card
      className={
        sociedad.esPrincipal
          ? 'border-primary/40 bg-primary/[0.03]'
          : ''
      }
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate text-sm font-semibold">
                  {sociedad.nombreComercial}
                </p>
                {sociedad.esPrincipal && (
                  <Badge variant="default" className="text-[10px]">
                    <Star className="mr-1 h-2.5 w-2.5" />
                    Principal
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {sociedad.razonSocial}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                CUIT {sociedad.cuit} · {CONDICION_FISCAL_LABEL[sociedad.condicionFiscal]}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="ghost" onClick={onEditar}>
              <Edit2 className="h-3.5 w-3.5" />
              Editar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/20 p-2 text-xs">
          <Stat
            label="Propiedades"
            valor={propiedades.toString()}
            highlight={propiedades > 0}
          />
          <Stat
            label="ARCA"
            valor={arcaOn ? `${sociedad.afip?.puntoVenta} · ${sociedad.afip?.tipoComprobante?.replace('_', ' ')}` : 'Sin conectar'}
            highlight={arcaOn}
            warn={!arcaOn}
          />
          <Stat
            label="CBU cobranza"
            valor={tieneCbu ? sociedad.cuentaCobranza!.alias : 'Sin cargar'}
            highlight={tieneCbu}
            warn={!tieneCbu}
          />
        </div>

        {/* Acciones secundarias */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {!sociedad.esPrincipal ? (
            <Button size="sm" variant="outline" onClick={onPrincipal}>
              <Star className="h-3 w-3" />
              Marcar como principal
            </Button>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              Es la sociedad principal · default para nuevas propiedades
            </span>
          )}
          {puedeBaja && !sociedad.esPrincipal && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onBaja}
              className="text-destructive hover:text-destructive"
            >
              <TrendingDown className="h-3 w-3" />
              Dar de baja
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  valor,
  highlight,
  warn,
}: {
  label: string;
  valor: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`truncate text-[11px] font-medium ${
          highlight && !warn
            ? 'text-foreground'
            : warn
              ? 'text-amber-700 dark:text-amber-300'
              : 'text-muted-foreground'
        }`}
      >
        {valor}
      </p>
    </div>
  );
}

/* ============================================================
 * Dialog crear / editar sociedad
 * ============================================================ */
function SociedadDialog({
  open,
  editando,
  onClose,
  onGuardado,
}: {
  open: boolean;
  editando: Sociedad | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [razonSocial, setRazonSocial] = useState('');
  const [nombreComercial, setNombreComercial] = useState('');
  const [cuit, setCuit] = useState('');
  const [condicionFiscal, setCondicionFiscal] =
    useState<CondicionFiscalSociedad>('RESPONSABLE_INSCRIPTO');
  const [domicilioFiscal, setDomicilioFiscal] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cbuAlias, setCbuAlias] = useState('');
  const [bancoNombre, setBancoNombre] = useState('');
  const [arcaConectado, setArcaConectado] = useState(false);
  const [arcaPuntoVenta, setArcaPuntoVenta] = useState('');
  const [arcaTipoComp, setArcaTipoComp] = useState<
    'FACTURA_A' | 'FACTURA_B' | 'FACTURA_C' | 'RECIBO_X'
  >('FACTURA_B');

  useEffect(() => {
    if (editando) {
      setRazonSocial(editando.razonSocial);
      setNombreComercial(editando.nombreComercial);
      setCuit(editando.cuit);
      setCondicionFiscal(editando.condicionFiscal);
      setDomicilioFiscal(editando.domicilioFiscal);
      setEmail(editando.email);
      setTelefono(editando.telefono);
      setCbuAlias(editando.cuentaCobranza?.alias ?? '');
      setBancoNombre(editando.cuentaCobranza?.banco ?? '');
      setArcaConectado(editando.afip?.conectado ?? false);
      setArcaPuntoVenta(editando.afip?.puntoVenta ?? '');
      setArcaTipoComp(editando.afip?.tipoComprobante ?? 'FACTURA_B');
    } else if (open) {
      setRazonSocial('');
      setNombreComercial('');
      setCuit('');
      setCondicionFiscal('RESPONSABLE_INSCRIPTO');
      setDomicilioFiscal('');
      setEmail('');
      setTelefono('');
      setCbuAlias('');
      setBancoNombre('');
      setArcaConectado(false);
      setArcaPuntoVenta('');
      setArcaTipoComp('FACTURA_B');
    }
  }, [editando, open]);

  const puedeGuardar =
    razonSocial.trim().length >= 3 && cuit.replace(/\D/g, '').length === 11;

  const guardar = () => {
    if (!puedeGuardar) return;
    const cuentaCobranza =
      cbuAlias.trim() || bancoNombre.trim()
        ? {
            banco: bancoNombre.trim() || 'Sin especificar',
            titular: razonSocial.trim(),
            cbu: '',
            alias: cbuAlias.trim(),
            cuit: cuit.trim(),
          }
        : undefined;
    const afip = {
      conectado: arcaConectado,
      ...(arcaConectado && {
        puntoVenta: arcaPuntoVenta.trim() || '0001',
        tipoComprobante: arcaTipoComp,
        conectadoDesde: new Date().toISOString().slice(0, 10),
      }),
    };
    if (editando) {
      actualizarSociedad(editando.id, {
        razonSocial: razonSocial.trim(),
        nombreComercial: nombreComercial.trim() || razonSocial.trim(),
        cuit: cuit.trim(),
        condicionFiscal,
        domicilioFiscal: domicilioFiscal.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        cuentaCobranza,
        afip,
      });
      toast({ variant: 'success', title: 'Sociedad actualizada' });
    } else {
      agregarSociedad({
        razonSocial: razonSocial.trim(),
        nombreComercial: nombreComercial.trim() || razonSocial.trim(),
        cuit: cuit.trim(),
        condicionFiscal,
        domicilioFiscal: domicilioFiscal.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        cuentaCobranza,
        afip,
      });
      toast({
        variant: 'success',
        title: '¡Sociedad agregada!',
        description: 'Ya podés asignarla a las propiedades que correspondan.',
      });
    }
    onGuardado();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {editando ? 'Editar sociedad' : 'Nueva sociedad'}
          </DialogTitle>
          <DialogDescription>
            {editando
              ? 'Cambios en los datos legales no modifican contratos ya emitidos.'
              : 'Datos para emitir facturas y recibir cobros bajo esta sociedad.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Datos legales
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="rs-razon">Razón social</Label>
                <Input
                  id="rs-razon"
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  placeholder="Inmobiliaria del Sol S.R.L."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rs-comercial">
                  Nombre comercial{' '}
                  <span className="text-[10px] font-normal text-muted-foreground">opcional</span>
                </Label>
                <Input
                  id="rs-comercial"
                  value={nombreComercial}
                  onChange={(e) => setNombreComercial(e.target.value)}
                  placeholder="Inmobiliaria del Sol"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rs-cuit">CUIT</Label>
                <Input
                  id="rs-cuit"
                  inputMode="numeric"
                  value={cuit}
                  onChange={(e) =>
                    setCuit(e.target.value.replace(/\D/g, '').slice(0, 11))
                  }
                  placeholder="30712345678"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Condición fiscal</Label>
                <Select
                  value={condicionFiscal}
                  onValueChange={(v) =>
                    setCondicionFiscal(v as CondicionFiscalSociedad)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(CONDICION_FISCAL_LABEL) as CondicionFiscalSociedad[]
                    ).map((c) => (
                      <SelectItem key={c} value={c}>
                        {CONDICION_FISCAL_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="rs-dom">
                  Domicilio fiscal{' '}
                  <span className="text-[10px] font-normal text-muted-foreground">opcional</span>
                </Label>
                <Input
                  id="rs-dom"
                  value={domicilioFiscal}
                  onChange={(e) => setDomicilioFiscal(e.target.value)}
                  placeholder="Av. Santa Fe 1234, CABA"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rs-email">
                  Email{' '}
                  <span className="text-[10px] font-normal text-muted-foreground">opcional</span>
                </Label>
                <Input
                  id="rs-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contacto@…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rs-tel">
                  Teléfono{' '}
                  <span className="text-[10px] font-normal text-muted-foreground">opcional</span>
                </Label>
                <Input
                  id="rs-tel"
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+54 11 …"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cuenta de cobranza{' '}
              <span className="font-normal normal-case text-muted-foreground">(opcional)</span>
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rs-banco">Banco</Label>
                <Input
                  id="rs-banco"
                  value={bancoNombre}
                  onChange={(e) => setBancoNombre(e.target.value)}
                  placeholder="Banco Galicia"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rs-alias">Alias</Label>
                <Input
                  id="rs-alias"
                  value={cbuAlias}
                  onChange={(e) => setCbuAlias(e.target.value)}
                  placeholder="delsol.cobranzas"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              ARCA · Facturación electrónica
            </p>
            <label className="flex items-start gap-3 rounded-md border bg-muted/20 p-3 text-sm">
              <input
                type="checkbox"
                checked={arcaConectado}
                onChange={(e) => setArcaConectado(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
              />
              <div>
                <p className="font-medium">Sociedad conectada con ARCA</p>
                <p className="text-xs text-muted-foreground">
                  Al cobrar bajo esta sociedad, emitimos factura
                  electrónica automática.
                </p>
              </div>
            </label>
            {arcaConectado && (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rs-pv">Punto de venta</Label>
                  <Input
                    id="rs-pv"
                    value={arcaPuntoVenta}
                    onChange={(e) => setArcaPuntoVenta(e.target.value)}
                    placeholder="0001"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de comprobante</Label>
                  <Select
                    value={arcaTipoComp}
                    onValueChange={(v) =>
                      setArcaTipoComp(v as 'FACTURA_A' | 'FACTURA_B' | 'FACTURA_C' | 'RECIBO_X')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FACTURA_A">Factura A</SelectItem>
                      <SelectItem value="FACTURA_B">Factura B</SelectItem>
                      <SelectItem value="FACTURA_C">Factura C</SelectItem>
                      <SelectItem value="RECIBO_X">Recibo X</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!puedeGuardar}>
            <CheckCircle2 className="h-4 w-4" />
            {editando ? 'Guardar cambios' : 'Crear sociedad'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

