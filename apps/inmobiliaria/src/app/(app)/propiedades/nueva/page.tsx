'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Camera,
  CheckCircle2,
  Home,
  Info,
  Store,
  Trash2,
  Warehouse,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@llave/ui/select';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { Topbar } from '@/components/topbar';
import { propietariosMock } from '@/lib/mock-data';
import { COSTO_PROPIEDAD_MENSUAL, calcularResumenPlan } from '@/lib/plan';
import { formatMonto } from '@/lib/format';
import type { TipoPropiedad } from '@/lib/types';

const tipos: Array<{ value: TipoPropiedad; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: 'DEPARTAMENTO', label: 'Departamento', icon: Home },
  { value: 'CASA', label: 'Casa', icon: Home },
  { value: 'LOCAL', label: 'Local comercial', icon: Store },
  { value: 'GALPON', label: 'Galpón', icon: Warehouse },
];

const provincias = [
  'Buenos Aires',
  'CABA',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
] as const;

export default function NuevaPropiedadPage() {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoPropiedad | ''>('');
  const [calle, setCalle] = useState('');
  const [altura, setAltura] = useState('');
  const [pisoDpto, setPisoDpto] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [provincia, setProvincia] = useState('Buenos Aires');
  const [ambientes, setAmbientes] = useState('');
  const [m2, setM2] = useState('');
  const [propietarioId, setPropietarioId] = useState('');
  const [notas, setNotas] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const planActual = useMemo(() => calcularResumenPlan(), []);
  const propiedadesNuevas = planActual.propiedadesActivas + 1;
  const costoNuevoTotal = propiedadesNuevas * COSTO_PROPIEDAD_MENSUAL;

  const formValido =
    !!tipo &&
    calle.trim().length >= 3 &&
    altura.trim().length >= 1 &&
    ciudad.trim().length >= 2 &&
    !!propietarioId;

  const guardar = async () => {
    setEnviando(true);
    await new Promise((r) => setTimeout(r, 600));
    setEnviando(false);
    setConfirmando(false);
    toast({
      title: 'Propiedad cargada',
      description: 'Ya forma parte de tu cartera. Podés cargarle un contrato.',
    });
    router.push('/propiedades');
  };

  return (
    <>
      <Topbar titulo="Cargar propiedad" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Link
          href="/propiedades"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver a propiedades
        </Link>

        {/* Aviso de costos arriba */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-start gap-4 p-5 md:flex-nowrap">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Info className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="font-semibold">Al sumar esta propiedad pasás a pagar</p>
                <Badge variant="default">
                  +{formatMonto(COSTO_PROPIEDAD_MENSUAL)} / mes
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Tu plan {planActual.plan} cobra{' '}
                <strong className="text-foreground">
                  {formatMonto(COSTO_PROPIEDAD_MENSUAL)} ARS
                </strong>{' '}
                por cada propiedad activa por mes. Hoy tenés{' '}
                <strong className="text-foreground">{planActual.propiedadesActivas}</strong>{' '}
                propiedades ({formatMonto(planActual.costoMensualTotal)} mensual). Si confirmás,
                tu próxima factura va a ser de{' '}
                <strong className="text-foreground">{formatMonto(costoNuevoTotal)}</strong>{' '}
                ({propiedadesNuevas} × {formatMonto(COSTO_PROPIEDAD_MENSUAL)}).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Card>
              <CardContent className="space-y-4 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Tipo de propiedad
                </h3>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {tipos.map((t) => {
                    const Icon = t.icon;
                    const activo = tipo === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTipo(t.value)}
                        className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                          activo
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Dirección
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="calle">Calle</Label>
                    <Input
                      id="calle"
                      value={calle}
                      onChange={(e) => setCalle(e.target.value)}
                      placeholder="Av. Rivadavia"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="altura">Altura</Label>
                    <Input
                      id="altura"
                      value={altura}
                      onChange={(e) => setAltura(e.target.value)}
                      placeholder="6420"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pisoDpto">Piso / Dto (opcional)</Label>
                    <Input
                      id="pisoDpto"
                      value={pisoDpto}
                      onChange={(e) => setPisoDpto(e.target.value)}
                      placeholder="8°C"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ciudad">Ciudad / Localidad</Label>
                    <Input
                      id="ciudad"
                      value={ciudad}
                      onChange={(e) => setCiudad(e.target.value)}
                      placeholder="Caballito"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provincia">Provincia</Label>
                    <Select value={provincia} onValueChange={setProvincia}>
                      <SelectTrigger id="provincia">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {provincias.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Características
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ambientes">Ambientes</Label>
                    <Input
                      id="ambientes"
                      value={ambientes}
                      onChange={(e) => setAmbientes(e.target.value.replace(/\D/g, ''))}
                      placeholder="3"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="m2">Metros cuadrados</Label>
                    <Input
                      id="m2"
                      value={m2}
                      onChange={(e) => setM2(e.target.value.replace(/\D/g, ''))}
                      placeholder="75"
                      inputMode="numeric"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notas">Notas internas (opcional)</Label>
                  <Textarea
                    id="notas"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Ej: SUM en planta baja, parrilla, cochera fija nro 12..."
                    rows={3}
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-primary/40">
                  <Camera className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Subir foto principal (opcional)</p>
                    <p className="text-xs">JPG o PNG, hasta 5 MB</p>
                  </div>
                  <input type="file" accept="image/*" className="hidden" />
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Propietario
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="propietario">Asignar propietario</Label>
                  <Select value={propietarioId} onValueChange={setPropietarioId}>
                    <SelectTrigger id="propietario">
                      <SelectValue placeholder="Elegí un propietario..." />
                    </SelectTrigger>
                    <SelectContent>
                      {propietariosMock.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.nombre} {o.apellido}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Si es un propietario nuevo, primero cargalo desde el panel{' '}
                    <Link href="/propietarios" className="text-primary hover:underline">
                      Propietarios
                    </Link>
                    .
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar resumen */}
          <aside className="space-y-4">
            <Card className="lg:sticky lg:top-20">
              <CardContent className="space-y-4 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Resumen
                </h3>

                <div className="space-y-2 text-sm">
                  <ResumenRow label="Tipo" value={tipos.find((t) => t.value === tipo)?.label ?? '—'} />
                  <ResumenRow
                    label="Dirección"
                    value={
                      calle && altura
                        ? `${calle} ${altura}${pisoDpto ? ` ${pisoDpto}` : ''}`
                        : '—'
                    }
                  />
                  <ResumenRow label="Ciudad" value={ciudad || '—'} />
                  <ResumenRow
                    label="Propietario"
                    value={
                      propietariosMock.find((o) => o.id === propietarioId)
                        ? `${propietariosMock.find((o) => o.id === propietarioId)!.nombre} ${propietariosMock.find((o) => o.id === propietarioId)!.apellido}`
                        : '—'
                    }
                  />
                </div>

                <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      Tu plan pasará a
                    </span>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-primary">
                    {formatMonto(costoNuevoTotal)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {propiedadesNuevas} propiedades × {formatMonto(COSTO_PROPIEDAD_MENSUAL)}
                  </p>
                </div>

                <Button
                  size="lg"
                  className="w-full"
                  disabled={!formValido}
                  onClick={() => setConfirmando(true)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Cargar propiedad
                </Button>
                <Button variant="ghost" className="w-full" asChild>
                  <Link href="/propiedades">
                    <Trash2 className="h-4 w-4" />
                    Cancelar
                  </Link>
                </Button>

                <p className="text-center text-[11px] text-muted-foreground">
                  Aceptás que esta acción modifica tu próxima factura.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      <ConfirmDialog
        open={confirmando}
        onOpenChange={setConfirmando}
        title={`¿Sumar esta propiedad?`}
        description={
          <div className="space-y-2 pt-2 text-sm">
            <p>Tu próxima factura será de:</p>
            <p className="text-2xl font-bold tabular-nums text-primary">
              {formatMonto(costoNuevoTotal)}
            </p>
            <p className="text-xs text-muted-foreground">
              {propiedadesNuevas} propiedades × {formatMonto(COSTO_PROPIEDAD_MENSUAL)} c/u. Podés
              bajar propiedades cuando quieras desde el panel.
            </p>
          </div>
        }
        confirmLabel="Sí, cargar propiedad"
        loading={enviando}
        onConfirm={guardar}
      />
    </>
  );
}

function ResumenRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium truncate">{value}</span>
    </div>
  );
}
