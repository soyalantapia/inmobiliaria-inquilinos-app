'use client';

import { useEffect, useState } from 'react';
import { Building2, Landmark, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@llave/ui/card';
import { Badge } from '@llave/ui/badge';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { toast } from '@llave/ui/use-toast';
import { ApiError } from '@/lib/api/client';
import {
  setCobranza,
  setEmpresa,
  useCobranza,
  useEmpresa,
  useMe,
  type CobranzaCuenta,
  type EmpresaDatos,
} from '@/lib/api/hooks';
import { PinSeguridadCard } from '@/components/pin-seguridad-card';
import { SociedadesManager } from '@/components/sociedades-manager';
import { EquipoCard } from '@/components/equipo-card';
import { ConfiguracionPais } from '@/components/configuracion-pais';

/**
 * Configuración en PRODUCCIÓN. Antes toda la página se gateaba con "Disponible
 * pronto" porque ninguna sección tenía endpoint. Ahora las tres secciones
 * críticas para operar — datos de empresa (fiscales), cuenta de cobranza (el
 * CBU que ve el inquilino) y PIN de seguridad — persisten de verdad en la DB.
 * El resto del long-tail (equipo, plan, convenios, multi-sociedad, auditoría)
 * sigue como "pronto".
 */
export function ConfiguracionProd() {
  const { me } = useMe();
  // Configuración es territorio de Admin (las lecturas del backend están
  // gateadas a ADMIN). Un no-admin ve un estado claro en vez de cards rotas.
  if (!me) return null;
  if (me.rol !== 'ADMIN') {
    return (
      <main className="flex-1 p-4 md:p-6">
        <Card className="mx-auto max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-lg font-semibold">Configuración</h1>
              <p className="text-sm text-muted-foreground">
                Esta sección la maneja un <strong>Admin</strong> de la inmobiliaria. Pedile que
                cargue empresa, cobranza, sociedades o equipo.
              </p>
            </div>
            <Badge variant="secondary">Solo Admin</Badge>
          </CardContent>
        </Card>
      </main>
    );
  }
  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <EmpresaCard />
        <CuentaCobranzaCard />
        <div>
          <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Sociedades</h2>
          <SociedadesManager />
        </div>
        <EquipoCard />
        <div>
          <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Seguridad</h2>
          <PinSeguridadCard />
        </div>
        <div>
          <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Mercado y país</h2>
          <ConfiguracionPais />
        </div>
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Más opciones, pronto</p>
              <p className="text-xs text-muted-foreground">
                Plan y facturas, convenios, referidos, notificaciones y auditoría están en
                camino. Lo esencial para operar — empresa, sociedades, cobranza, equipo, PIN
                y mercado — ya está activo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

const EMPRESA_VACIA: Omit<EmpresaDatos, 'perfilFiscalCompleto'> = {
  nombre: '',
  email: '',
  cuit: '',
  matricula: '',
  telefono: '',
  direccionCalle: '',
  direccionAltura: '',
  direccionPiso: '',
  direccionCiudad: '',
  direccionProvincia: '',
  direccionCp: '',
};

function EmpresaCard() {
  const qc = useQueryClient();
  const { empresa, cargando } = useEmpresa();
  const [form, setForm] = useState(EMPRESA_VACIA);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (empresa) {
      const { perfilFiscalCompleto: _omit, ...rest } = empresa;
      setForm(rest);
    }
  }, [empresa]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const guardar = async () => {
    setError(null);
    setGuardando(true);
    try {
      await setEmpresa(form);
      toast({ variant: 'success', title: 'Datos de la empresa guardados' });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['empresa'] }),
        qc.invalidateQueries({ queryKey: ['me'] }),
      ]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudieron guardar los datos.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-5 w-5 text-primary" />
          Datos de la empresa
        </CardTitle>
        <Badge variant={empresa?.perfilFiscalCompleto ? 'secondary' : 'warning'}>
          {empresa?.perfilFiscalCompleto ? 'Completo' : 'Falta completar'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Tu CUIT y dirección fiscal figuran en las facturas y los contratos. Completalos para
          poder facturar.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Razón social" value={form.nombre} onChange={set('nombre')} />
          <Field label="Email" value={form.email} onChange={set('email')} placeholder="info@inmobiliaria.com" />
          <Field label="CUIT" value={form.cuit} onChange={set('cuit')} placeholder="30-XXXXXXXX-X" />
          <Field label="Matrícula" value={form.matricula} onChange={set('matricula')} placeholder="CUCICBA / CPI…" />
          <Field label="Teléfono" value={form.telefono} onChange={set('telefono')} />
          <Field label="Calle" value={form.direccionCalle} onChange={set('direccionCalle')} />
          <Field label="Altura" value={form.direccionAltura} onChange={set('direccionAltura')} />
          <Field label="Piso / Depto" value={form.direccionPiso} onChange={set('direccionPiso')} />
          <Field label="Ciudad" value={form.direccionCiudad} onChange={set('direccionCiudad')} />
          <Field label="Provincia" value={form.direccionProvincia} onChange={set('direccionProvincia')} />
          <Field label="Código postal" value={form.direccionCp} onChange={set('direccionCp')} />
        </div>
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{error}</p>
        )}
        <div className="flex justify-end">
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar empresa'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const COBRANZA_VACIA: CobranzaCuenta = { banco: '', titular: '', cbu: '', alias: '', cuit: '' };

function CuentaCobranzaCard() {
  const qc = useQueryClient();
  const { tieneCuenta, cuenta, cargando } = useCobranza();
  const [form, setForm] = useState(COBRANZA_VACIA);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cuenta) setForm(cuenta);
  }, [cuenta]);

  const set = (k: keyof CobranzaCuenta) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: k === 'cbu' ? e.target.value.replace(/\D/g, '').slice(0, 22) : e.target.value }));

  const guardar = async () => {
    setError(null);
    if (!/^\d{22}$/.test(form.cbu)) {
      setError('El CBU tiene que tener 22 dígitos.');
      return;
    }
    if (form.titular.trim().length < 2 || form.banco.trim().length < 2) {
      setError('Completá banco y titular.');
      return;
    }
    setGuardando(true);
    try {
      await setCobranza(form);
      toast({ variant: 'success', title: 'Cuenta de cobranza guardada' });
      await qc.invalidateQueries({ queryKey: ['cobranza'] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar la cuenta.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-5 w-5 text-primary" />
          Cuenta de cobranza
        </CardTitle>
        <Badge variant={tieneCuenta ? 'secondary' : 'warning'}>
          {tieneCuenta ? (
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Cargada
            </span>
          ) : (
            'Sin cargar'
          )}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Esto es <strong>exactamente lo que el inquilino ve</strong> para transferirte. Sin esto,
          le pedimos que te solicite los datos por privado.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Banco" value={form.banco} onChange={set('banco')} placeholder="Banco Galicia" />
          <Field label="Titular" value={form.titular} onChange={set('titular')} placeholder="Tu razón social" />
          <Field label="CBU (22 dígitos)" value={form.cbu} onChange={set('cbu')} placeholder="0070…" inputMode="numeric" />
          <Field label="Alias" value={form.alias} onChange={set('alias')} placeholder="mi.inmo.cobranzas" />
          <Field label="CUIT del titular" value={form.cuit} onChange={set('cuit')} placeholder="30-XXXXXXXX-X" />
        </div>
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{error}</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" /> Nunca mostramos un CBU inventado al inquilino.
          </span>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cobranza'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  inputMode?: 'numeric' | 'text';
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={onChange} placeholder={placeholder} inputMode={inputMode} />
    </div>
  );
}
