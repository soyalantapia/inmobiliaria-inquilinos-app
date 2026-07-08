'use client';

/**
 * "Mi Inmobiliaria" — panorama consolidado de TODOS los datos de la inmobiliaria:
 * identidad, comisión, reglas de negocio (mora + rescisión), mercado/ajuste, cuenta
 * de cobranza y plan. Reúne en un solo lugar lo que estaba disperso en /configuracion.
 * Reusa las tarjetas reales/editables (EmpresaCard, MoraDefaultCard, CuentaCobranzaCard,
 * ConfiguracionPais) y agrega Comisión / Rescisión / Plan. Solo ADMIN (como config).
 * En demo (!apiEnabled) la config real no aplica → linkea a Configuración.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Landmark,
  Percent,
  Receipt,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { toast } from '@llave/ui/use-toast';
import { Topbar } from '@/components/topbar';
import {
  CuentaCobranzaCard,
  EmpresaCard,
  MoraDefaultCard,
} from '@/components/configuracion-prod';
import { ConfiguracionPais } from '@/components/configuracion-pais';
import { apiEnabled, ApiError } from '@/lib/api/client';
import {
  setRescisionDefault,
  useReglasMiInmobiliaria,
  type ReglasMiInmobiliaria,
} from '@/lib/api/use-mi-inmobiliaria';

export default function MiInmobiliariaPage() {
  return (
    <>
      <Topbar titulo="Mi Inmobiliaria" />
      {apiEnabled ? <MiInmobiliariaReal /> : <MiInmobiliariaDemo />}
    </>
  );
}

function MiInmobiliariaReal() {
  const { reglas, cargando, isError } = useReglasMiInmobiliaria();

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Mi Inmobiliaria</p>
              <p className="text-xs text-muted-foreground">
                Todos los datos, comisiones y reglas de negocio de tu inmobiliaria en un solo lugar.
              </p>
            </div>
          </CardContent>
        </Card>

        {isError ? (
          <SoloAdmin />
        ) : (
          <>
            <EmpresaCard />
            <ComisionCard reglas={reglas} cargando={cargando} />
            <MoraDefaultCard />
            <RescisionCard reglas={reglas} />
            <section>
              <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">
                Mercado y ajuste
              </h2>
              <ConfiguracionPais />
            </section>
            <CuentaCobranzaCard />
            <PlanCard reglas={reglas} />
            <MasConfiguracion />
          </>
        )}
      </div>
    </main>
  );
}

// ===== Comisión (resumen, se edita por propietario) =====
function ComisionCard({
  reglas,
  cargando,
}: {
  reglas: ReglasMiInmobiliaria | null;
  cargando: boolean;
}) {
  const c = reglas?.comision;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Percent className="h-5 w-5 text-primary" />
          Comisión
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          La comisión se cobra <strong>sobre el alquiler</strong> (no sobre expensas ni punitorios)
          — regla fija de la plataforma. El porcentaje se define <strong>por propietario</strong>.
        </p>
        {cargando ? (
          <div className="h-16 animate-pulse rounded-lg bg-muted/50" />
        ) : c && c.propietarios > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Propietarios" value={String(c.propietarios)} />
            <Stat label="Promedio" value={c.promedioPct != null ? `${c.promedioPct}%` : '—'} />
            <Stat
              label="Rango"
              value={c.minPct != null ? `${c.minPct}–${c.maxPct}%` : '—'}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Todavía no cargaste propietarios con comisión. El default es 8%.
          </p>
        )}
        <Link
          href="/propietarios"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Ver y editar la comisión por propietario
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

// ===== Rescisión por defecto (editable) =====
function RescisionCard({ reglas }: { reglas: ReglasMiInmobiliaria | null }) {
  const qc = useQueryClient();
  const [preaviso, setPreaviso] = useState('');
  const [penalidad, setPenalidad] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reglas) {
      setPreaviso(String(reglas.rescision.preavisoMeses));
      setPenalidad(String(reglas.rescision.penalidadMeses));
    }
  }, [reglas]);

  if (!reglas) return null;

  const guardar = async () => {
    setError(null);
    const p = Number(preaviso);
    const m = Number(penalidad);
    if (!Number.isInteger(p) || p < 0 || p > 12) {
      setError('Preaviso: un entero de 0 a 12 meses.');
      return;
    }
    if (!Number.isFinite(m) || m < 0 || m > 12) {
      setError('Penalidad: de 0 a 12 cánones de alquiler.');
      return;
    }
    setGuardando(true);
    try {
      await setRescisionDefault({ preavisoMeses: p, penalidadMeses: m });
      toast({ variant: 'success', title: 'Rescisión por defecto guardada' });
      await qc.invalidateQueries({ queryKey: ['mi-inmobiliaria-reglas'] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar la rescisión.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-5 w-5 text-primary" />
          Rescisión anticipada
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Valores por defecto cuando un contrato se da de baja antes de tiempo. Los heredan los
          contratos que no definan lo suyo; podés pisarlo contrato por contrato.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="resc-preaviso" className="text-xs">
              Preaviso (meses)
            </Label>
            <Input
              id="resc-preaviso"
              value={preaviso}
              onChange={(e) => setPreaviso(e.target.value)}
              inputMode="numeric"
              placeholder="2"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resc-penalidad" className="text-xs">
              Penalidad (cánones de alquiler)
            </Label>
            <Input
              id="resc-penalidad"
              value={penalidad}
              onChange={(e) => setPenalidad(e.target.value)}
              inputMode="decimal"
              placeholder="1.5"
            />
          </div>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar rescisión'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Plan (lectura) =====
function PlanCard({ reglas }: { reglas: ReglasMiInmobiliaria | null }) {
  const p = reglas?.plan;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-primary" />
          Plan
        </CardTitle>
        {p && <Badge variant={p.esPiloto ? 'warning' : 'secondary'}>{p.esPiloto ? 'Piloto' : 'Activo'}</Badge>}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-xs text-muted-foreground">
          {p?.esPiloto
            ? 'Estás en el programa piloto (sin cargo mientras dure).'
            : 'Plan activo.'}
        </p>
        {p && p.mesesGratisGanados > 0 && (
          <p className="text-xs">
            Meses gratis ganados por referidos: <strong>{p.mesesGratisGanados}</strong>
          </p>
        )}
        <Link
          href="/configuracion#plan"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Ver plan y facturación
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

// ===== Más configuración (links a las tabs secundarias) =====
function MasConfiguracion() {
  const items: { href: string; icon: typeof Users; label: string; desc: string }[] = [
    { href: '/configuracion#sociedades', icon: Landmark, label: 'Sociedades', desc: 'Cuentas de cobranza por sociedad' },
    { href: '/configuracion#equipo', icon: Users, label: 'Equipo y permisos', desc: 'Usuarios y roles del panel' },
    { href: '/configuracion#referidos', icon: Sparkles, label: 'Referidos', desc: 'Programa de referidos' },
    { href: '/configuracion#convenios', icon: Receipt, label: 'Convenios', desc: 'Cupones y convenios' },
    { href: '/configuracion#auditoria', icon: ShieldAlert, label: 'Auditoría', desc: 'Registro de acciones sensibles' },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Más configuración</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{it.label}</p>
                <p className="truncate text-xs text-muted-foreground">{it.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-center">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function SoloAdmin() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Solo para Admin</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Los datos y la configuración de la inmobiliaria (comisiones, reglas, cuentas) solo los
          puede ver y editar un usuario con rol Admin.
        </p>
      </CardContent>
    </Card>
  );
}

function MiInmobiliariaDemo() {
  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Building2 className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium">Mi Inmobiliaria</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Esta página muestra los datos reales de tu inmobiliaria (identidad, comisiones, reglas
              de mora y rescisión, mercado, cuentas y plan). Disponible en producción. En este modo
              demo, la configuración vive en Configuración.
            </p>
            <Link
              href="/configuracion"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Ir a Configuración
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
