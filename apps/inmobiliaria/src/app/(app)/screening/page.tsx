'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  Building2,
  Car,
  Check,
  Clock,
  Database,
  Download,
  FileText,
  Fingerprint,
  Globe,
  Home,
  IdCard,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RotateCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@llave/ui/avatar';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Separator } from '@llave/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@llave/ui/tabs';
import { toast } from '@llave/ui/use-toast';
import { Topbar } from '@/components/topbar';
import { screeningMock } from '@/lib/mock-data';
import { formatMonto, formatFecha, formatPeriodo } from '@/lib/format';
import { formatearCuit, validarCuit } from '@/lib/cuit';
import { abrirReporteImprimible } from '@/lib/reportes-pdf';
import { sociedadPrincipal } from '@/lib/sociedades-storage';
import type {
  CoherenciaHuella,
  EstadoPerfilDigital,
  HuellaDigital,
  PerfilDigital,
  PlataformaDigital,
  Recomendacion,
  ResumenBcra,
  RiesgoBcra,
  ScreeningResultado,
  VinculoFamiliar,
} from '@/lib/types';

const ETAPAS = [
  {
    key: 'perfil',
    label: 'Analizando el perfil',
    detalle: 'Validando identidad contra RENAPER y ARCA',
    icon: UserRound,
    duracion: 1200,
  },
  {
    key: 'creditos',
    label: 'Cruzando datos crediticios',
    detalle: 'BCRA · Nosis · Veraz · cheques rechazados últimos 4 años',
    icon: Database,
    duracion: 1400,
  },
  {
    key: 'bienes',
    label: 'Consultando bienes y vehículos',
    detalle: 'Registro de la Propiedad · DNRPA · catastros municipales',
    icon: Home,
    duracion: 1100,
  },
  {
    key: 'redes',
    label: 'Rastreando redes sociales y medios digitales',
    detalle: 'LinkedIn · Instagram · Facebook · X · Threads · TikTok · Google · menciones públicas',
    icon: Globe,
    duracion: 1700,
  },
  {
    key: 'referencias',
    label: 'Validando familia, vecinos y referencias',
    detalle: 'Grupo familiar · referencias laborales · vecinos referenciables',
    icon: Users,
    duracion: 1200,
  },
] as const;

type EtapaKey = (typeof ETAPAS)[number]['key'];
type Estado = 'idle' | 'loading' | 'done';

export default function ScreeningPage() {
  const [cuit, setCuit] = useState('');
  const [nombre, setNombre] = useState('');
  const [estado, setEstado] = useState<Estado>('idle');
  const [etapaActual, setEtapaActual] = useState<EtapaKey | null>(null);
  const [completadas, setCompletadas] = useState<Set<EtapaKey>>(new Set());
  const [resultado, setResultado] = useState<ScreeningResultado | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const validacionCuit = validarCuit(cuit);
  const cuitDirty = cuit.length > 0;
  const formValido = validacionCuit.valido && nombre.trim().length >= 3;

  const limpiarTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => () => limpiarTimers(), []);

  const verificar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValido) return;
    setEstado('loading');
    setEtapaActual(ETAPAS[0].key);
    setCompletadas(new Set());
    setResultado(null);

    let acumulado = 0;
    ETAPAS.forEach((etapa, idx) => {
      acumulado += etapa.duracion;
      const t = setTimeout(() => {
        setCompletadas((prev) => {
          const next = new Set(prev);
          next.add(etapa.key);
          return next;
        });
        const proxima = ETAPAS[idx + 1];
        if (proxima) {
          setEtapaActual(proxima.key);
        } else {
          setEtapaActual(null);
          setResultado({ ...screeningMock, cuit, nombre: nombre.split(' ')[0] ?? nombre });
          setEstado('done');
          toast({
            title: 'Informe del inquilino listo',
            description: `${nombre} — recomendación ${screeningMock.recomendacion.replace('_', ' ').toLowerCase()}.`,
          });
        }
      }, acumulado);
      timersRef.current.push(t);
    });
  };

  const reiniciar = () => {
    limpiarTimers();
    setEstado('idle');
    setEtapaActual(null);
    setCompletadas(new Set());
    setResultado(null);
  };

  return (
    <>
      <Topbar titulo="Verificar inquilino" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        {estado === 'idle' && (
          <ScreeningHome
            cuit={cuit}
            nombre={nombre}
            cuitDirty={cuitDirty}
            validacionCuit={validacionCuit}
            formValido={formValido}
            onCuitChange={setCuit}
            onNombreChange={setNombre}
            onSubmit={verificar}
          />
        )}

        {estado === 'loading' && (
          <LoadingEtapas etapaActual={etapaActual} completadas={completadas} nombre={nombre} />
        )}

        {estado === 'done' && resultado && (
          <Informe resultado={resultado} onReiniciar={reiniciar} />
        )}
      </main>
    </>
  );
}

// ────────────────────────────── Pantalla inicial ───────────────────────────

const FUENTES_CRUZADAS = [
  {
    icon: Fingerprint,
    label: 'RENAPER · ARCA',
    descripcion: 'Identidad, CUIT, situación impositiva',
  },
  {
    icon: Wallet,
    label: 'BCRA · Nosis · Veraz',
    descripcion: 'Historial crediticio, mora, cheques',
  },
  {
    icon: Home,
    label: 'Registro de la Propiedad · DNRPA',
    descripcion: 'Inmuebles y vehículos patentados',
  },
  {
    icon: Globe,
    label: 'Redes sociales · medios digitales',
    descripcion: 'LinkedIn, Instagram, X, Facebook, menciones públicas',
  },
  {
    icon: Users,
    label: 'Grupo familiar · referencias',
    descripcion: 'Composición familiar, vecinos, historial laboral',
  },
] as const;

function ScreeningHome({
  cuit,
  nombre,
  cuitDirty,
  validacionCuit,
  formValido,
  onCuitChange,
  onNombreChange,
  onSubmit,
}: {
  cuit: string;
  nombre: string;
  cuitDirty: boolean;
  validacionCuit: { valido: boolean; motivo?: string };
  formValido: boolean;
  onCuitChange: (v: string) => void;
  onNombreChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Hero + form */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary via-primary to-primary/70 text-primary-foreground shadow-xl shadow-primary/30">
        {/* Glow decorativo */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-white/5 blur-3xl" />

        <CardContent className="relative grid gap-8 p-8 md:grid-cols-[1fr_1.2fr] md:p-10">
          {/* Columna izquierda: propuesta de valor */}
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Verificación 360°
            </div>
            <h1 className="text-3xl font-bold leading-tight md:text-4xl">
              Verificá un inquilino en menos de{' '}
              <span className="whitespace-nowrap">30 segundos</span>
            </h1>
            <p className="text-sm leading-relaxed opacity-90">
              Cruzamos identidad, BCRA, ARCA, registros de bienes, redes sociales y referencias.
              Recibís un informe completo con recomendación accionable.
            </p>

            <div className="flex flex-wrap gap-4 pt-2 text-xs opacity-90">
              <Trust icon={Clock} label="< 30 seg" />
              <Trust icon={ShieldCheck} label="Cache 30 días" />
              <Trust icon={Lock} label="Ley 25.326" />
            </div>
          </div>

          {/* Columna derecha: form */}
          <div className="rounded-xl bg-background p-6 text-foreground shadow-2xl">
            <div className="mb-4 space-y-1">
              <h2 className="text-lg font-semibold">Datos del inquilino</h2>
              <p className="text-xs text-muted-foreground">
                Necesitamos el CUIT/CUIL y el nombre completo.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cuit" aria-required>
                  CUIT / CUIL <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cuit"
                  inputMode="numeric"
                  placeholder="20-31256789-0"
                  value={formatearCuit(cuit)}
                  onChange={(e) => onCuitChange(e.target.value)}
                  aria-invalid={cuitDirty && !validacionCuit.valido}
                  aria-describedby="cuit-error"
                  className="h-12 text-base font-mono tabular-nums"
                  required
                />
                {cuitDirty && !validacionCuit.valido ? (
                  <p id="cuit-error" className="text-xs text-destructive">
                    {validacionCuit.motivo}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Validamos el dígito verificador automáticamente.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre" aria-required>
                  Nombre completo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nombre"
                  placeholder="Carlos Eduardo Méndez"
                  value={nombre}
                  onChange={(e) => onNombreChange(e.target.value)}
                  className="h-12 text-base"
                  required
                />
              </div>

              <Button
                type="submit"
                size="xl"
                className="mt-2 w-full text-base shadow-lg shadow-primary/20"
                disabled={!formValido}
              >
                <Search className="h-4 w-4" />
                Iniciar verificación
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Qué cruzamos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Qué consultamos automáticamente
          </h3>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Database className="h-3 w-3" />
            5 fuentes de datos integradas
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {FUENTES_CRUZADAS.map((f, i) => {
            const Icon = f.icon;
            return (
              <Card
                key={f.label}
                className="animate-fade-in transition-shadow hover:shadow-md"
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
              >
                <CardContent className="space-y-2 p-4">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold leading-tight">{f.label}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{f.descripcion}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Lo que recibís */}
      <Card className="border-primary/10 bg-primary/5">
        <CardContent className="grid gap-4 p-6 md:grid-cols-[auto_1fr_auto]">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <FileText className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Recibís un informe completo</p>
            <p className="text-xs text-muted-foreground">
              Identidad · BCRA del titular, familiar y empleador · bienes · ingresos · redes sociales ·
              referencias · recomendación accionable (APTO / APTO con garantía / NO APTO) con
              razonamiento.
            </p>
          </div>
          <div className="flex items-center gap-2 self-center">
            <Badge variant="success">APTO</Badge>
            <Badge variant="warning">APTO c/ garantía</Badge>
            <Badge variant="destructive">NO APTO</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Trust({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}

// ────────────────────────────── Loading multietapa ──────────────────────────

function LoadingEtapas({
  etapaActual,
  completadas,
  nombre,
}: {
  etapaActual: EtapaKey | null;
  completadas: Set<EtapaKey>;
  nombre: string;
}) {
  const total = ETAPAS.length;
  const hechas = completadas.size;

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-6 p-6">
        <div className="space-y-2 text-center">
          <Sparkles className="mx-auto h-8 w-8 animate-pulse text-primary" />
          <p className="text-lg font-semibold">Generando informe del inquilino</p>
          <p className="text-sm text-muted-foreground">{nombre || 'Inquilino'}</p>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${(hechas / total) * 100}%` }}
          />
        </div>

        <ol className="space-y-3">
          {ETAPAS.map((etapa) => {
            const completada = completadas.has(etapa.key);
            const actual = etapaActual === etapa.key && !completada;
            const Icon = etapa.icon;
            return (
              <li
                key={etapa.key}
                className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
                  completada
                    ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-900/10'
                    : actual
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border'
                }`}
              >
                <div
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                    completada
                      ? 'bg-emerald-500 text-white'
                      : actual
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {completada ? (
                    <Check className="h-4 w-4" />
                  ) : actual ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      !completada && !actual ? 'text-muted-foreground' : ''
                    }`}
                  >
                    {etapa.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{etapa.detalle}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────── Informe ─────────────────────────────────────

const recoConfig: Record<
  Recomendacion,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    border: string;
    bg: string;
    accent: string;
  }
> = {
  APTO: {
    label: 'APTO',
    icon: ShieldCheck,
    border: 'border-emerald-200 dark:border-emerald-900/40',
    bg: 'bg-emerald-50 dark:bg-emerald-900/10',
    accent: 'text-emerald-700 dark:text-emerald-300',
  },
  APTO_CON_GARANTIA: {
    label: 'APTO con garantía',
    icon: ShieldAlert,
    border: 'border-amber-200 dark:border-amber-900/40',
    bg: 'bg-amber-50 dark:bg-amber-900/10',
    accent: 'text-amber-700 dark:text-amber-300',
  },
  NO_APTO: {
    label: 'NO APTO',
    icon: ShieldX,
    border: 'border-red-200 dark:border-red-900/40',
    bg: 'bg-red-50 dark:bg-red-900/10',
    accent: 'text-red-700 dark:text-red-300',
  },
};

const vinculoLabel: Record<VinculoFamiliar, string> = {
  CONYUGE: 'Cónyuge',
  PADRE_MADRE: 'Padre/Madre',
  CONVIVIENTE: 'Conviviente',
  HIJO: 'Hijo/a',
  HERMANO: 'Hermano/a',
};

const riesgoConfig: Record<
  RiesgoBcra,
  { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }
> = {
  bajo: { label: 'Bajo', variant: 'success' },
  medio: { label: 'Medio', variant: 'warning' },
  alto: { label: 'Alto', variant: 'destructive' },
  irrecuperable: { label: 'Irrecuperable', variant: 'destructive' },
};

function Informe({
  resultado,
  onReiniciar,
}: {
  resultado: ScreeningResultado;
  onReiniciar: () => void;
}) {
  const reco = recoConfig[resultado.recomendacion];
  const RIcon = reco.icon;
  const iniciales = `${resultado.nombre[0] ?? ''}${resultado.apellido[0] ?? ''}`;
  const edad =
    new Date().getFullYear() - new Date(resultado.fechaNacimiento).getFullYear();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <Card className={`${reco.border} ${reco.bg}`}>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                {iniciales}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 space-y-1">
              <h2 className="text-2xl font-semibold">
                {resultado.nombre} {resultado.apellido}
              </h2>
              <p className="text-sm text-muted-foreground">
                DNI {resultado.dni} · CUIT {resultado.cuit} · {edad} años
              </p>
            </div>
            <div className={`flex items-center gap-2 rounded-full bg-background/70 px-4 py-1.5`}>
              <RIcon className={`h-5 w-5 ${reco.accent}`} />
              <span className={`font-semibold ${reco.accent}`}>{reco.label}</span>
            </div>
          </div>

          <p className="text-sm leading-relaxed">{resultado.recomendacionRazon}</p>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <div className="flex flex-wrap gap-6 text-sm">
              <ScoreInline
                label="Score Nosis"
                valor={resultado.scoreNosis.toString()}
                hint="0-1000"
              />
              <ScoreInline
                label="BCRA"
                valor={`Sit ${Object.keys(resultado.bcra.situaciones)[0] ?? '—'}`}
                hint={riesgoConfig[resultado.bcra.riesgo].label}
              />
              <ScoreInline
                label="Patrimonio"
                valor={`${resultado.inmuebles.length} inm. · ${resultado.vehiculos.length} auto${resultado.vehiculos.length === 1 ? '' : 's'}`}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  abrirReporteImprimible({
                    titulo: `Verificación de inquilino — ${resultado.nombre} ${resultado.apellido}`,
                    subtitulo: `DNI ${resultado.dni} · CUIT ${resultado.cuit} · Score Nosis ${resultado.scoreNosis}`,
                    inmobiliaria: sociedadPrincipal().razonSocial,
                    columnas: [
                      { header: 'Sección', width: '30%' },
                      { header: 'Dato', width: '70%' },
                    ],
                    filas: [
                      ['Recomendación', reco.label],
                      ['Razón', resultado.recomendacionRazon],
                      ['BCRA · titular', `Riesgo ${resultado.bcra.riesgo.toLowerCase()}`],
                      [
                        'BCRA · familia',
                        `Riesgo ${resultado.bcraFamiliar.riesgo.toLowerCase()}`,
                      ],
                      [
                        'Patrimonio',
                        `${resultado.inmuebles.length} inmueble${resultado.inmuebles.length === 1 ? '' : 's'} · ${resultado.vehiculos.length} vehículo${resultado.vehiculos.length === 1 ? '' : 's'}`,
                      ],
                      [
                        'Ingreso ARCA',
                        `${formatearCategoria(resultado.ingresos.categoriaArca)} · ${resultado.ingresos.actividadDescripcion}`,
                      ],
                      [
                        'Empleador',
                        resultado.empleador
                          ? `${resultado.empleador.razonSocial} (CUIT ${resultado.empleador.cuit})`
                          : 'Sin empleador registrado',
                      ],
                      [
                        'Cheques BCRA (4a)',
                        `${resultado.cheques.rechazadosCount} rechazado${resultado.cheques.rechazadosCount === 1 ? '' : 's'} · ${resultado.cheques.levantadosCount} levantado${resultado.cheques.levantadosCount === 1 ? '' : 's'}`,
                      ],
                    ],
                    notaFinal: `Informe generado el ${new Date().toLocaleDateString('es-AR')}. Fuentes: Nosis, BCRA, ARCA. Vigencia 30 días.`,
                  })
                }
              >
                <Download className="h-4 w-4" />
                PDF
              </Button>
              <Button variant="ghost" size="sm" onClick={onReiniciar}>
                <RotateCw className="h-4 w-4" />
                Nueva consulta
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="resumen">
        <TabsList className="flex-wrap">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="identidad">Identidad</TabsTrigger>
          <TabsTrigger value="bcra">BCRA</TabsTrigger>
          <TabsTrigger value="bienes">Bienes</TabsTrigger>
          <TabsTrigger value="ingresos">Ingresos</TabsTrigger>
          <TabsTrigger value="familia">Familia</TabsTrigger>
          <TabsTrigger value="laboral">Laboral</TabsTrigger>
          <TabsTrigger value="redes">Redes</TabsTrigger>
          <TabsTrigger value="contacto">Contacto</TabsTrigger>
        </TabsList>

        {/* RESUMEN */}
        <TabsContent value="resumen" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard icon={<Wallet className="h-4 w-4" />} title="Score y BCRA">
              <Row label="Score Nosis" value={`${resultado.scoreNosis} / 1000`} />
              <Row
                label="Entidades activas"
                value={resultado.bcra.entidadesCount.toString()}
              />
              <Row label="Deuda total" value={formatMonto(resultado.bcra.deudaTomada)} />
              <Row label="Deuda en mora" value={formatMonto(resultado.bcra.deudaEnMora)} />
              <Row
                label="Riesgo"
                value={
                  <Badge variant={riesgoConfig[resultado.bcra.riesgo].variant}>
                    {riesgoConfig[resultado.bcra.riesgo].label}
                  </Badge>
                }
              />
              <Row
                label="Cheques rechazados"
                value={resultado.cheques.rechazadosCount.toString()}
              />
            </SectionCard>

            <SectionCard icon={<Home className="h-4 w-4" />} title="Patrimonio">
              <Row label="Inmuebles" value={resultado.inmuebles.length.toString()} />
              <Row label="Vehículos" value={resultado.vehiculos.length.toString()} />
              <Row
                label="Último auto"
                value={
                  resultado.vehiculos[0]
                    ? `${resultado.vehiculos[0].marca} ${resultado.vehiculos[0].modelo} (${resultado.vehiculos[0].anio})`
                    : '—'
                }
              />
            </SectionCard>

            <SectionCard icon={<Briefcase className="h-4 w-4" />} title="Laboral">
              {resultado.empleador ? (
                <>
                  <Row label="Empleador" value={resultado.empleador.razonSocial} />
                  <Row label="CUIT" value={resultado.empleador.cuit} />
                  <Row label="ART vigente" value={resultado.empleador.artVigente ? 'Sí' : 'No'} />
                  <Row label="Actividad" value={resultado.empleador.actividad} />
                </>
              ) : (
                <p className="text-sm italic text-muted-foreground">Sin empleador registrado</p>
              )}
            </SectionCard>

            <SectionCard icon={<Users className="h-4 w-4" />} title="Grupo familiar">
              <Row label="Vínculos detectados" value={resultado.familia.length.toString()} />
              <Row label="Rango ingreso familiar" value={resultado.rangoIngresoFamiliar} />
              <Row
                label="BCRA familia"
                value={
                  <Badge variant={riesgoConfig[resultado.bcraFamiliar.riesgo].variant}>
                    Riesgo {riesgoConfig[resultado.bcraFamiliar.riesgo].label.toLowerCase()}
                  </Badge>
                }
              />
            </SectionCard>
          </div>
        </TabsContent>

        {/* IDENTIDAD */}
        <TabsContent value="identidad" className="space-y-4">
          <SectionCard icon={<IdCard className="h-4 w-4" />} title="Datos personales">
            <Row label="Nombre completo" value={`${resultado.nombre} ${resultado.apellido}`} />
            <Row label="DNI" value={resultado.dni} />
            <Row label="CUIT/CUIL" value={resultado.cuit} />
            <Row label="Fecha de nacimiento" value={formatFecha(resultado.fechaNacimiento)} />
            <Row label="Sexo" value={resultado.sexo === 'F' ? 'Femenino' : 'Masculino'} />
          </SectionCard>

          <SectionCard icon={<MapPin className="h-4 w-4" />} title="Domicilio">
            <Row
              label="Calle"
              value={`${resultado.domicilio.calle} ${resultado.domicilio.altura}`}
            />
            {resultado.domicilio.pisoDpto && (
              <Row label="Piso/Dto" value={resultado.domicilio.pisoDpto} />
            )}
            <Row label="Localidad" value={resultado.domicilio.localidad} />
            <Row label="Partido" value={resultado.domicilio.partido} />
            <Row label="Provincia" value={resultado.domicilio.provincia} />
            <Row label="CP" value={resultado.domicilio.codigoPostal} />
          </SectionCard>
        </TabsContent>

        {/* BCRA */}
        <TabsContent value="bcra" className="space-y-4">
          <BcraDetail title="Titular" resumen={resultado.bcra} />
          <SectionCard icon={<FileText className="h-4 w-4" />} title="Cheques (últimos 4 años)">
            <Row label="Rechazados" value={`${resultado.cheques.rechazadosCount} cheque${resultado.cheques.rechazadosCount === 1 ? '' : 's'}`} />
            <Row label="Monto rechazado" value={formatMonto(resultado.cheques.rechazadosMonto)} />
            <Row label="Levantados" value={`${resultado.cheques.levantadosCount} cheque${resultado.cheques.levantadosCount === 1 ? '' : 's'}`} />
            <Row label="Monto levantado" value={formatMonto(resultado.cheques.levantadosMonto)} />
          </SectionCard>
          <BcraDetail title="Grupo familiar" resumen={resultado.bcraFamiliar} />
          {resultado.empleador && (
            <BcraDetail
              title={`Empleador — ${resultado.empleador.razonSocial}`}
              resumen={resultado.empleador.bcra}
            />
          )}
        </TabsContent>

        {/* BIENES */}
        <TabsContent value="bienes" className="space-y-4">
          <SectionCard icon={<Home className="h-4 w-4" />} title="Inmuebles">
            {resultado.inmuebles.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">Sin inmuebles registrados</p>
            ) : (
              <div className="space-y-2">
                {resultado.inmuebles.map((i) => (
                  <div key={i.partidoCatastral} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{i.ubicacion}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.tipo.charAt(0) + i.tipo.slice(1).toLowerCase()} · partido{' '}
                      {i.partidoCatastral} · adquirido{' '}
                      {formatFecha(i.fechaAdquisicion)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard icon={<Car className="h-4 w-4" />} title="Vehículos">
            {resultado.vehiculos.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">Sin vehículos patentados</p>
            ) : (
              <div className="space-y-2">
                {resultado.vehiculos.map((v) => (
                  <div
                    key={(v.patente ?? '') + v.modelo}
                    className="flex items-center justify-between rounded-md border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {v.marca} {v.modelo}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Año {v.anio} · comprado {formatFecha(v.fechaCompra)}
                      </p>
                    </div>
                    {v.patente && <Badge variant="secondary">{v.patente}</Badge>}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* INGRESOS */}
        <TabsContent value="ingresos" className="space-y-4">
          <SectionCard icon={<Wallet className="h-4 w-4" />} title="ARCA">
            <Row label="Categoría" value={formatearCategoria(resultado.ingresos.categoriaArca)} />
            <Row label="Ganancias" value={resultado.ingresos.impuestoGanancias} />
            <Row label="IVA" value={resultado.ingresos.impuestoIva} />
            <Row label="Empleador" value={resultado.ingresos.empleador ? 'Sí' : 'No'} />
            <Row
              label="Integrante societario"
              value={resultado.ingresos.integranteSocietario ? 'Sí' : 'No'}
            />
            <Row
              label="CIIU"
              value={`${resultado.ingresos.ciiu} — ${resultado.ingresos.actividadDescripcion}`}
            />
            {resultado.ingresos.obraSocialNombre && (
              <Row
                label="Obra social"
                value={`${resultado.ingresos.obraSocialCodigo} — ${resultado.ingresos.obraSocialNombre}`}
              />
            )}
          </SectionCard>

          {resultado.ingresos.nominaUltimos6m.length > 0 && (
            <SectionCard icon={<TrendingUp className="h-4 w-4" />} title="Nómina últimos 6 meses">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 text-left font-normal">Período</th>
                      <th className="py-2 text-left font-normal">Rango ingreso</th>
                      <th className="py-2 text-left font-normal">Fecha pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.ingresos.nominaUltimos6m.map((n) => (
                      <tr key={n.periodo} className="border-b last:border-0">
                        <td className="py-2 font-medium">{formatPeriodo(n.periodo)}</td>
                        <td className="py-2">
                          <Badge variant="secondary">{n.rangoIngreso}</Badge>
                        </td>
                        <td className="py-2 text-muted-foreground">{formatFecha(n.fechaPago)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </TabsContent>

        {/* FAMILIA */}
        <TabsContent value="familia" className="space-y-4">
          <Card className="bg-muted/30">
            <CardContent className="flex items-center gap-3 p-4 text-sm">
              <Users className="h-4 w-4 text-primary" />
              <p>
                Rango de ingreso del grupo familiar:{' '}
                <span className="font-semibold">{resultado.rangoIngresoFamiliar}</span>
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            {resultado.familia.map((f, i) => (
              <Card key={i}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{vinculoLabel[f.vinculo]}</Badge>
                  </div>
                  <p className="font-medium">{f.nombreCompleto}</p>
                  {f.telefonos.length === 0 && !f.email ? (
                    <p className="text-xs italic text-muted-foreground">Sin datos de contacto</p>
                  ) : (
                    <div className="space-y-1 text-xs">
                      {f.telefonos.map((t) => (
                        <TelefonoLine key={t.numero} t={t} />
                      ))}
                      {f.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{f.email}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* LABORAL */}
        <TabsContent value="laboral" className="space-y-4">
          {resultado.empleador ? (
            <>
              <SectionCard icon={<Briefcase className="h-4 w-4" />} title="Empleador">
                <Row label="Razón social" value={resultado.empleador.razonSocial} />
                <Row label="CUIT" value={resultado.empleador.cuit} />
                <Row label="Tipo" value={resultado.empleador.tipoEmpresa} />
                <Row
                  label="Actividad"
                  value={`${resultado.empleador.ciiu} — ${resultado.empleador.actividad}`}
                />
                <Row
                  label="ART vigente"
                  value={
                    resultado.empleador.artVigente ? (
                      <Badge variant="success">Sí</Badge>
                    ) : (
                      <Badge variant="destructive">No</Badge>
                    )
                  }
                />
              </SectionCard>

              <SectionCard icon={<Phone className="h-4 w-4" />} title="Contacto del empleador">
                {resultado.empleador.telefonos.map((t) => (
                  <Row key={t} label="Teléfono" value={t} />
                ))}
                {resultado.empleador.email && (
                  <Row label="Email" value={resultado.empleador.email} />
                )}
                {resultado.empleador.paginaWeb && (
                  <Row
                    label="Web"
                    value={
                      <a
                        href={resultado.empleador.paginaWeb}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Globe className="h-3 w-3" />
                        {resultado.empleador.paginaWeb.replace(/^https?:\/\//, '')}
                      </a>
                    }
                  />
                )}
              </SectionCard>
            </>
          ) : (
            <Card>
              <CardContent className="space-y-2 p-10 text-center text-muted-foreground">
                <Briefcase className="mx-auto h-10 w-10" />
                <p className="font-medium">Sin empleador registrado</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* REDES */}
        <TabsContent value="redes" className="space-y-4">
          <HuellaDigitalView huella={resultado.huellaDigital} />
        </TabsContent>

        {/* CONTACTO */}
        <TabsContent value="contacto" className="space-y-4">
          <SectionCard icon={<Phone className="h-4 w-4" />} title="Teléfonos del titular">
            <div className="space-y-1.5">
              {resultado.telefonos.map((t) => (
                <TelefonoLine key={t.numero} t={t} />
              ))}
            </div>
          </SectionCard>

          {resultado.email && (
            <SectionCard icon={<Mail className="h-4 w-4" />} title="Email">
              <div className="flex items-center gap-2 text-sm">
                <span>{resultado.email}</span>
                <Badge variant="success">verificado</Badge>
              </div>
            </SectionCard>
          )}

          <SectionCard icon={<Building2 className="h-4 w-4" />} title="Vecinos referenciables">
            <div className="space-y-2">
              {resultado.vecinos.map((v) => (
                <div
                  key={v.nombreCompleto}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{v.nombreCompleto}</p>
                    <p className="truncate text-xs text-muted-foreground">{v.direccion}</p>
                  </div>
                  <a
                    href={`tel:${v.telefono.replace(/\s/g, '')}`}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    {v.telefono}
                  </a>
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ────────────────────────────── Subcomponentes ──────────────────────────────

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2 text-primary">
          {icon}
          <h3 className="text-xs font-semibold uppercase tracking-wide">{title}</h3>
        </div>
        <Separator />
        <div className="space-y-2 text-sm">{children}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function ScoreInline({ label, valor, hint }: { label: string; valor: string; hint?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-semibold tabular-nums">{valor}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TelefonoLine({
  t,
}: {
  t: { numero: string; tipo: 'CELULAR' | 'FIJO'; whatsappActivo: boolean };
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-background p-2 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{t.numero}</span>
        <Badge variant="outline" className="text-[10px]">
          {t.tipo === 'CELULAR' ? 'Celular' : 'Fijo'}
        </Badge>
      </div>
      {t.whatsappActivo && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          <MessageCircle className="h-2.5 w-2.5" />
          WhatsApp
        </span>
      )}
    </div>
  );
}

function BcraDetail({ title, resumen }: { title: string; resumen: ResumenBcra }) {
  const sitsOrdenadas = ([1, 2, 3, 4, 5] as const).filter(
    (s) => (resumen.situaciones[s] ?? 0) > 0,
  );
  return (
    <SectionCard icon={<Wallet className="h-4 w-4" />} title={`BCRA — ${title}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Row label="Entidades" value={resumen.entidadesCount.toString()} />
        <Row label="Deuda tomada" value={formatMonto(resumen.deudaTomada)} />
        <Row
          label="Deuda en mora"
          value={
            resumen.deudaEnMora > 0 ? (
              <span className="text-destructive">{formatMonto(resumen.deudaEnMora)}</span>
            ) : (
              '—'
            )
          }
        />
        <Row
          label="Riesgo"
          value={
            <Badge variant={riesgoConfig[resumen.riesgo].variant}>
              {riesgoConfig[resumen.riesgo].label}
            </Badge>
          }
        />
      </div>

      {sitsOrdenadas.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Distribución por situación
            </p>
            <div className="space-y-1.5">
              {sitsOrdenadas.map((s) => (
                <div key={s} className="flex items-center justify-between text-xs">
                  <span>
                    Situación {s} —{' '}
                    <span className="text-muted-foreground">{labelSituacion(s)}</span>
                  </span>
                  <Badge variant={s === 1 ? 'success' : s === 2 ? 'warning' : 'destructive'}>
                    {resumen.situaciones[s]} entidad
                    {(resumen.situaciones[s] ?? 0) === 1 ? '' : 'es'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator />

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Entidades con las que opera
        </p>
        <div className="space-y-1.5">
          {resumen.entidades.map((e) => {
            const pct = resumen.deudaTomada > 0 ? (e.deuda / resumen.deudaTomada) * 100 : 0;
            return (
              <div key={e.codigo} className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="truncate font-medium">
                    {e.nombre} <span className="text-muted-foreground">({e.codigo})</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatMonto(e.deuda)}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {resumen.deudaUltimos24m
          ? '✓ Información disponible en BCRA (últimos 24 meses)'
          : 'Sin información en los últimos 24 meses'}
      </p>
    </SectionCard>
  );
}

function labelSituacion(s: 1 | 2 | 3 | 4 | 5): string {
  return {
    1: 'sin atraso (<31d)',
    2: 'atraso 31-90d',
    3: 'atraso 90-180d',
    4: 'atraso 180d-1a',
    5: 'atraso >1a',
  }[s];
}

function formatearCategoria(
  c: 'AUTONOMO' | 'MONOTRIBUTO' | 'RELACION_DEPENDENCIA' | 'NO_INSCRIPTO',
): string {
  return {
    AUTONOMO: 'Autónomo',
    MONOTRIBUTO: 'Monotributo',
    RELACION_DEPENDENCIA: 'Relación de dependencia',
    NO_INSCRIPTO: 'No inscripto',
  }[c];
}

// ────────────────────────────── Huella digital ──────────────────────────────

const plataformaConfig: Record<
  PlataformaDigital,
  { label: string; emoji: string; color: string }
> = {
  LINKEDIN: { label: 'LinkedIn', emoji: '💼', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  INSTAGRAM: { label: 'Instagram', emoji: '📷', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
  FACEBOOK: { label: 'Facebook', emoji: '👥', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  X: { label: 'X (Twitter)', emoji: '🐦', color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300' },
  TIKTOK: { label: 'TikTok', emoji: '🎵', color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300' },
  THREADS: { label: 'Threads', emoji: '🧵', color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300' },
  YOUTUBE: { label: 'YouTube', emoji: '▶️', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  GOOGLE: { label: 'Google · menciones', emoji: '🔎', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
};

const estadoPerfilConfig: Record<
  EstadoPerfilDigital,
  { label: string; variant: 'success' | 'warning' | 'secondary' | 'destructive' }
> = {
  ACTIVO: { label: 'Activa', variant: 'success' },
  INACTIVO: { label: 'Inactiva', variant: 'warning' },
  PRIVADO: { label: 'Privada', variant: 'secondary' },
  NO_ENCONTRADO: { label: 'No encontrada', variant: 'secondary' },
};

const coherenciaConfig: Record<
  CoherenciaHuella,
  { label: string; variant: 'success' | 'warning' | 'destructive' }
> = {
  alta: { label: 'Alta', variant: 'success' },
  media: { label: 'Media', variant: 'warning' },
  baja: { label: 'Baja', variant: 'destructive' },
};

function HuellaDigitalView({ huella }: { huella: HuellaDigital }) {
  const activos = huella.perfiles.filter((p) => p.estado === 'ACTIVO').length;
  const encontrados = huella.perfiles.filter((p) => p.estado !== 'NO_ENCONTRADO').length;
  return (
    <>
      {/* Stats overview */}
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-4">
          <Stat
            label="Coherencia"
            value={coherenciaConfig[huella.scoreCoherencia].label}
            badge={coherenciaConfig[huella.scoreCoherencia].variant}
          />
          <Stat
            label="Plataformas con perfil"
            value={`${encontrados} / ${huella.perfiles.length}`}
            hint={`${activos} activa${activos === 1 ? '' : 's'}`}
          />
          <Stat
            label="Antigüedad online"
            value={`${huella.antiguedadAnios} año${huella.antiguedadAnios === 1 ? '' : 's'}`}
            hint="desde el perfil más viejo"
          />
          <Stat
            label="Menciones en Google"
            value={huella.mencionesGoogle.toString()}
            hint={`Email en ${huella.emailEnSitios} sitio${huella.emailEnSitios === 1 ? '' : 's'} público${huella.emailEnSitios === 1 ? '' : 's'}`}
          />
        </CardContent>
      </Card>

      {/* Hallazgos IA */}
      {huella.hallazgos.length > 0 && (
        <SectionCard
          icon={<Sparkles className="h-4 w-4" />}
          title="Lo que detectó el análisis"
        >
          <ul className="space-y-2">
            {huella.hallazgos.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                    h.tipo === 'positivo'
                      ? 'bg-emerald-500'
                      : h.tipo === 'alerta'
                        ? 'bg-destructive'
                        : 'bg-muted-foreground'
                  }`}
                />
                <span
                  className={
                    h.tipo === 'alerta' ? 'text-destructive font-medium' : 'text-foreground'
                  }
                >
                  {h.texto}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Cards de perfiles */}
      <div className="grid gap-3 md:grid-cols-2">
        {huella.perfiles.map((p) => (
          <PerfilDigitalCard key={p.plataforma} perfil={p} />
        ))}
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  badge,
}: {
  label: string;
  value: string;
  hint?: string;
  badge?: 'success' | 'warning' | 'destructive';
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      {badge ? (
        <Badge variant={badge} className="mt-1">
          {value}
        </Badge>
      ) : (
        <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      )}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PerfilDigitalCard({ perfil }: { perfil: PerfilDigital }) {
  const cfg = plataformaConfig[perfil.plataforma];
  const estadoCfg = estadoPerfilConfig[perfil.estado];
  const noEncontrado = perfil.estado === 'NO_ENCONTRADO';
  return (
    <Card className={noEncontrado ? 'opacity-60' : ''}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg ${cfg.color}`}>
            {cfg.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium">{cfg.label}</span>
              {perfil.verificado && (
                <Badge variant="default" className="text-[10px]">
                  ✓ verificado
                </Badge>
              )}
            </div>
            {perfil.handle && (
              <p className="truncate font-mono text-xs text-muted-foreground">{perfil.handle}</p>
            )}
          </div>
          <Badge variant={estadoCfg.variant} className="shrink-0">
            {estadoCfg.label}
          </Badge>
        </div>

        {!noEncontrado && (
          <>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {perfil.seguidores !== null && (
                <span>
                  <strong className="text-foreground tabular-nums">
                    {perfil.seguidores.toLocaleString('es-AR')}
                  </strong>{' '}
                  seguidores
                </span>
              )}
              {perfil.ultimaActividad && (
                <span>Última actividad: {formatFecha(perfil.ultimaActividad)}</span>
              )}
            </div>

            {perfil.notas && (
              <p className="rounded-md border bg-muted/40 p-2 text-xs leading-relaxed">
                {perfil.notas}
              </p>
            )}

            {perfil.url && (
              <a
                href={perfil.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Globe className="h-3 w-3" />
                Abrir perfil
              </a>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
