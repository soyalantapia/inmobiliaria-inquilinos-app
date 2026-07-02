'use client';

import { useEffect, useId, useState } from 'react';
import { Building2, GraduationCap, Landmark, Lock, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
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
  setMoraDefault,
  useCobranza,
  useEmpresa,
  useMe,
  type CobranzaCuenta,
  type EmpresaDatos,
} from '@/lib/api/hooks';
import { descripcionMora, MoraSelector, type MoraSeleccion } from '@/components/mora-selector';
import type { TipoMora } from '@/lib/types';
import { SociedadesManager } from '@/components/sociedades-manager';
import { EquipoCard } from '@/components/equipo-card';
import { ConfiguracionPais } from '@/components/configuracion-pais';
import { relanzarOnboardingInmo } from '@/components/onboarding';

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
        {/* Relanzar el tour guiado. En prod esta es la ÚNICA vía para volver a
            verlo (el banner demo no se renderiza acá). */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Tutorial guiado</p>
              <p className="text-xs text-muted-foreground">
                Repasá las funciones principales del panel en menos de 1 minuto.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={relanzarOnboardingInmo}>
              Ver tutorial
            </Button>
          </CardContent>
        </Card>
        <EmpresaCard />
        <CuentaCobranzaCard />
        <MoraDefaultCard />
        <div>
          <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Sociedades</h2>
          <SociedadesManager />
        </div>
        <EquipoCard />
        <div>
          <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Mercado y país</h2>
          <ConfiguracionPais />
        </div>
        <AppInquilinoLinkCard />
      </div>
    </main>
  );
}

const APP_INQUILINO_URL =
  (process.env.NEXT_PUBLIC_INQUILINO_URL?.replace(/\/$/, '') || 'https://app.myalquiler.com');

/**
 * Link a la app del inquilino, a mano en Configuración: la inmobiliaria lo comparte
 * con sus inquilinos para que entren a pagar / ver su contrato.
 */
function AppInquilinoLinkCard() {
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(APP_INQUILINO_URL);
      toast({ title: 'Link copiado', description: 'Ya lo podés compartir con tus inquilinos.' });
    } catch {
      toast({ title: 'No pudimos copiar', variant: 'destructive' });
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-primary" />
          Link de la app para tus inquilinos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Compartí este link con tus inquilinos para que entren a pagar, ver su contrato y
          cargar reclamos. Ingresan con su email (les llega un código por mail).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={APP_INQUILINO_URL}
            target="_blank"
            rel="noreferrer"
            className="flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm text-primary hover:underline"
          >
            {APP_INQUILINO_URL}
          </a>
          <Button variant="outline" onClick={copiar}>
            Copiar link
          </Button>
        </div>
      </CardContent>
    </Card>
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
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{error}</p>
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
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{error}</p>
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

/**
 * Esquema de mora POR DEFECTO de la inmobiliaria (PUT /cobranza/mora, solo
 * Admin). Es lo que heredan los contratos nuevos que no definen su propio
 * interés; cada contrato puede pisarlo desde su detalle o desde el wizard.
 */
function MoraDefaultCard() {
  const qc = useQueryClient();
  const { mora, cargando } = useCobranza();
  const [tipo, setTipo] = useState<TipoMora>('SIN_MORA');
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mora) return;
    setTipo(mora.tipoDefault);
    setValor(mora.valorDefault != null ? String(mora.valorDefault) : '');
  }, [mora]);

  const guardar = async () => {
    setError(null);
    if (tipo !== 'SIN_MORA' && !(Number(valor) > 0)) {
      setError('Ingresá un valor mayor a 0 para el esquema elegido.');
      return;
    }
    setGuardando(true);
    try {
      await setMoraDefault({ tipo, valor: tipo === 'SIN_MORA' ? null : Number(valor) });
      toast({ variant: 'success', title: 'Mora por defecto guardada' });
      await qc.invalidateQueries({ queryKey: ['cobranza'] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar la mora por defecto.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-5 w-5 text-primary" />
          Mora por defecto
        </CardTitle>
        <Badge variant="secondary">
          {mora ? descripcionMora(mora.tipoDefault, mora.valorDefault) : 'Sin mora'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Se aplica a los contratos nuevos que no definan su propio interés.
          Podés pisarlo contrato por contrato.
        </p>
        <MoraSelector
          seleccion={tipo}
          valor={valor}
          onSeleccionChange={(s: MoraSeleccion) => {
            if (s !== 'HEREDAR') setTipo(s);
          }}
          onValorChange={setValor}
          montoBase={500_000}
          notaPreview="Ejemplo con un alquiler de $ 500.000"
          idPrefix="mora-default"
        />
        {error && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{error}</p>
        )}
        <div className="flex justify-end">
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar mora'}
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
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} value={value} onChange={onChange} placeholder={placeholder} inputMode={inputMode} />
    </div>
  );
}
