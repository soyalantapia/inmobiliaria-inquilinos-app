'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileText, FileUp, Home, Loader2, Sparkles, X } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Progress } from '@llave/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { Topbar } from '@/components/topbar';
import { apiEnabled, apiFetch, ApiError } from '@/lib/api/client';
import { ensureApiSession } from '@/lib/api/session';
import type { PersonaListado } from '@/lib/api/use-inquilinos';
import { usePropiedades, useMercado, useCobranza } from '@/lib/api/hooks';
import {
  calcularMora,
  descripcionMora,
  MoraSelector,
  type MoraSeleccion,
} from '@/components/mora-selector';
import { contratoExtraidoMock } from '@/lib/mock-data';
import { formatFechaCorta, formatMonto } from '@/lib/format';
import type {
  ContratoExtraido,
  IndiceAjuste,
  Moneda,
  TipoContrato,
  TipoMora,
} from '@/lib/types';

const MAX_PDF_MB = 10;

type Paso = 1 | 2 | 3 | 4;

const pasos = [
  { id: 1, label: 'Subir PDF' },
  { id: 2, label: 'Extracción IA' },
  { id: 3, label: 'Revisar y editar' },
  { id: 4, label: 'Confirmar' },
] as const;

const confianzaVariant = {
  alto: 'success',
  medio: 'warning',
  bajo: 'destructive',
} as const;

const confianzaLabel = {
  alto: 'Alta confianza',
  medio: 'Revisar',
  bajo: 'Bajo — completar',
} as const;

// Campos agrupados por categoría — antes era una lista plana de 13 campos
// mezclando datos del inquilino, contrato y comisión que se leían como
// una sopa. Ahora la inmobiliaria puede revisar bloque por bloque.
type Campo = { key: keyof ContratoExtraido; label: string; tipo: 'text' | 'number' | 'date' };

const camposGrupos: Array<{ titulo: string; descripcion: string; campos: Campo[] }> = [
  {
    titulo: 'Inquilino y propiedad',
    descripcion: 'Quién alquila y qué.',
    campos: [
      { key: 'inquilino', label: 'Inquilino', tipo: 'text' },
      { key: 'cuit', label: 'CUIT', tipo: 'text' },
      { key: 'direccion', label: 'Dirección', tipo: 'text' },
    ],
  },
  {
    titulo: 'Plazos y monto',
    descripcion: 'Cuándo empieza, cuándo termina y cuánto se paga.',
    campos: [
      { key: 'montoInicial', label: 'Monto inicial', tipo: 'number' },
      { key: 'moneda', label: 'Moneda', tipo: 'text' },
      { key: 'fechaInicio', label: 'Fecha inicio', tipo: 'date' },
      { key: 'fechaFin', label: 'Fecha fin', tipo: 'date' },
      { key: 'diaPago', label: 'Día de pago', tipo: 'number' },
    ],
  },
  {
    titulo: 'Ajuste',
    descripcion: 'Cómo y cada cuánto sube el alquiler.',
    campos: [
      { key: 'indiceAjuste', label: 'Índice de ajuste', tipo: 'text' },
      { key: 'frecuenciaAjusteMeses', label: 'Frecuencia ajuste (meses)', tipo: 'number' },
    ],
  },
  {
    titulo: 'Comisión y garantías',
    descripcion: 'Lo que cobra la inmobiliaria y lo que cubre al propietario.',
    campos: [
      { key: 'comisionInmobiliaria', label: 'Comisión inmobiliaria %', tipo: 'number' },
      { key: 'depositoGarantia', label: 'Depósito en garantía', tipo: 'number' },
      { key: 'tasaPunitorioDiaria', label: 'Tasa punitorio diaria %', tipo: 'number' },
    ],
  },
];

export default function CargarContratoPage() {
  // En prod ya existe POST /contratos: cableamos un wizard real que elige una
  // propiedad DISPONIBLE, carga inquilino + términos y da de alta contra el API.
  // En demo (!apiEnabled) seguimos con el wizard mock de extracción por PDF
  // intacto (escribe a los stores locales, byte-for-byte como antes).
  // `apiEnabled` es constante de módulo, así que el return temprano no altera
  // el orden de hooks.
  if (apiEnabled) {
    return <CargarContratoApiWizard />;
  }

  return <CargarContratoWizard />;
}

function CargarContratoWizard() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>(1);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [progreso, setProgreso] = useState(0);
  const [datos, setDatos] = useState<ContratoExtraido>(contratoExtraidoMock);
  const [cancelarAbierto, setCancelarAbierto] = useState(false);

  const subir = async (file: File) => {
    setArchivo(file);
    setPaso(2);
    setProgreso(10);
    // mock IA: en Sprint 1 esto pega a /api/contratos/parse
    await delay(400);
    setProgreso(45);
    await delay(700);
    setProgreso(80);
    await delay(500);
    setProgreso(100);
    await delay(300);
    setDatos(contratoExtraidoMock);
    setPaso(3);
  };

  // Volver al paso 1 limpiando el archivo. Necesario si el usuario se da
  // cuenta tarde que subió el PDF equivocado — antes la única forma era
  // navegar fuera y volver a entrar.
  const cambiarArchivo = () => {
    setArchivo(null);
    setProgreso(0);
    setPaso(1);
  };

  return (
    <>
      <Topbar titulo="Cargar contrato" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/contratos"
              className="mb-2 inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              Volver
            </Link>
            <Steps actual={paso} />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => {
              // Si todavía no empezó (paso 1 sin archivo) no hay nada que
              // perder: navegamos directo. En cualquier otro caso pedimos
              // confirmación para evitar perder el progreso accidentalmente.
              if (paso === 1 && !archivo) {
                router.push('/contratos');
              } else {
                setCancelarAbierto(true);
              }
            }}
          >
            <X className="h-4 w-4" />
            Cancelar carga
          </Button>
        </div>

        {paso === 1 && <PasoSubir onArchivo={subir} />}
        {paso === 2 && <PasoIa archivo={archivo} progreso={progreso} onCancelar={cambiarArchivo} />}
        {paso === 3 && (
          <PasoRevisar
            datos={datos}
            setDatos={setDatos}
            archivo={archivo}
            onVolver={cambiarArchivo}
            onContinuar={() => {
              setPaso(4);
            }}
          />
        )}
        {paso === 4 && (
          <PasoConfirmar
            datos={datos}
            archivo={archivo}
            onVolver={() => setPaso(3)}
            onConfirmar={() => {
              toast({
                title: 'Contrato dado de alta',
                description: 'Generamos la primera liquidación y mandamos invitación al inquilino.',
              });
              router.push('/contratos');
            }}
          />
        )}
      </main>

      {/* Confirmación antes de cancelar — antes el Link iba directo a /contratos
          sin avisar. Si el operador estaba en paso 3 revisando los datos
          extraídos por la IA y hacía clic sin querer, perdía todo. */}
      <ConfirmDialog
        open={cancelarAbierto}
        onOpenChange={setCancelarAbierto}
        title="¿Cancelar la carga?"
        description="Vas a perder el progreso de este contrato. Esta acción no se puede deshacer."
        confirmLabel="Sí, cancelar"
        onConfirm={() => router.push('/contratos')}
      />
    </>
  );
}

function Steps({ actual }: { actual: Paso }) {
  return (
    <ol role="list" className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {pasos.map((p, i) => {
        const completado = p.id < actual;
        const activo = p.id === actual;
        return (
          <li key={p.id} aria-current={activo ? 'step' : undefined} className="flex items-center gap-2 sm:gap-3">
            <div
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                completado
                  ? 'bg-primary text-primary-foreground'
                  : activo
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {completado ? <CheckCircle2 className="h-4 w-4" /> : p.id}
            </div>
            <span
              className={`text-xs sm:text-sm ${activo ? 'font-medium' : completado ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              {p.label}
            </span>
            {i < pasos.length - 1 && <span className="hidden h-px w-8 bg-border sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}

function PasoSubir({ onArchivo }: { onArchivo: (file: File) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  // Validamos antes de aceptar: tipo PDF + tamaño ≤10MB. Antes no había
  // validación: si el usuario soltaba un .docx o un PDF de 50MB la app
  // pasaba al paso 2 igual y "extraía" datos basura del mock.
  const validar = (file: File): string | null => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return 'Solo aceptamos PDF. Subí el archivo en ese formato.';
    }
    const mb = file.size / 1024 / 1024;
    if (mb > MAX_PDF_MB) {
      return `El PDF pesa ${mb.toFixed(1)} MB. Máximo ${MAX_PDF_MB} MB. Comprimilo o pediselo al equipo en formato más liviano.`;
    }
    return null;
  };

  const intentarAbrir = (file: File) => {
    const err = validar(file);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onArchivo(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subí el PDF del contrato</CardTitle>
        <CardDescription>
          Aceptamos contratos digitales y fotos del contrato firmado. Si es una foto, lo leemos igual con OCR.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Drag-and-drop real (antes el copy decía "arrastrá acá" pero no
            estaban implementados los handlers, sólo funcionaba el click). */}
        <label
          htmlFor="file"
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastrando(false);
            const f = e.dataTransfer.files?.[0];
            if (f) intentarAbrir(f);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
            arrastrando
              ? 'border-primary bg-primary/10'
              : 'border-primary/30 bg-primary/5 hover:border-primary/60'
          }`}
        >
          <FileUp className="h-10 w-10 text-primary" />
          <div>
            <p className="font-medium">Arrastrá el PDF acá o hacé clic</p>
            <p className="text-xs text-muted-foreground">PDF de hasta {MAX_PDF_MB} MB</p>
          </div>
          <input
            id="file"
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) intentarAbrir(f);
            }}
          />
        </label>
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PasoIa({
  archivo,
  progreso,
  onCancelar,
}: {
  archivo: File | null;
  progreso: number;
  onCancelar: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Extrayendo datos con IA
          </CardTitle>
          <CardDescription className="mt-1.5">
            {archivo?.name ?? 'PDF'} · Claude está leyendo el contrato.
          </CardDescription>
        </div>
        {/* Cancelar — útil si te diste cuenta que subiste el PDF equivocado.
            Antes había que esperar a que termine la "extracción" para poder
            cambiar el archivo. */}
        <Button variant="ghost" size="sm" onClick={onCancelar}>
          <X className="h-4 w-4" />
          Cancelar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress aria-label="Progreso de extracción del contrato" value={progreso} />
        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <Tarea done={progreso >= 25} label="Extrayendo texto del PDF" />
          <Tarea done={progreso >= 50} label="Identificando cláusulas" />
          <Tarea done={progreso >= 75} label="Extrayendo campos estructurados" />
          <Tarea done={progreso >= 100} label="Calculando confianza por campo" />
        </div>
      </CardContent>
    </Card>
  );
}

function Tarea({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : (
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
      )}
      <span className={done ? 'text-foreground' : ''}>{label}</span>
    </div>
  );
}

function PasoRevisar({
  datos,
  setDatos,
  archivo,
  onContinuar,
  onVolver,
}: {
  datos: ContratoExtraido;
  setDatos: (d: ContratoExtraido) => void;
  archivo: File | null;
  onContinuar: () => void;
  onVolver: () => void;
}) {
  const update = (key: keyof ContratoExtraido, valor: string | number) => {
    setDatos({ ...datos, [key]: { ...datos[key], valor } });
  };

  // Validación de términos (espejo del wizard API): no dejar avanzar con monto
  // <= 0, fechas incompletas, fin <= inicio, o día de pago fuera de 1-31.
  const fInicio = String(datos.fechaInicio?.valor ?? '');
  const fFin = String(datos.fechaFin?.valor ?? '');
  const diaPagoNum = Number(datos.diaPago?.valor ?? 0);
  const terminosValidos =
    Number(datos.montoInicial?.valor ?? 0) > 0 &&
    fInicio.length === 10 &&
    fFin.length === 10 &&
    fFin > fInicio &&
    diaPagoNum >= 1 &&
    diaPagoNum <= 31;

  // Cuenta campos con confianza baja/media: el operador necesita saber
  // de un vistazo cuánto va a tener que revisar antes de empezar.
  const aRevisar = Object.values(datos).filter(
    (c) => c.confianza === 'medio' || c.confianza === 'bajo',
  ).length;

  return (
    <div className="space-y-4">
      {/* Pill con resumen del archivo + botón "cambiar PDF" — antes una vez
          en paso 3 no había forma de volver y cambiar el archivo sin
          perder lo editado. Ahora se ve qué subiste y un atajo. */}
      {archivo && (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{archivo.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              · {(archivo.size / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onVolver}>
            Cambiar PDF
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Revisá los datos extraídos</CardTitle>
          <CardDescription>
            {aRevisar > 0
              ? `${aRevisar} campo${aRevisar === 1 ? ' tiene' : 's tienen'} confianza media o baja. Revisalos antes de continuar.`
              : 'La IA leyó todo con confianza alta. Igual revisá cualquier campo que quieras antes de continuar.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Agrupados por categoría — antes los 13 campos venían en una
              lista plana 2-col mezclando inquilino + contrato + comisión.
              El cerebro tenía que filtrar por tipo solo. Ahora cada bloque
              tiene su propio título y se procesa de a 3-5 campos. */}
          {camposGrupos.map((grupo) => (
            <section key={grupo.titulo} className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">{grupo.titulo}</h3>
                <p className="text-xs text-muted-foreground">{grupo.descripcion}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {grupo.campos.map((c) => {
                  const campo = datos[c.key];
                  return (
                    <div key={c.key} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor={c.key}>{c.label}</Label>
                        <Badge variant={confianzaVariant[campo.confianza]} className="shrink-0">
                          {confianzaLabel[campo.confianza]}
                        </Badge>
                      </div>
                      <Input
                        id={c.key}
                        type={c.tipo}
                        value={campo.valor ?? ''}
                        onChange={(e) =>
                          update(
                            c.key,
                            c.tipo === 'number' ? Number(e.target.value) : e.target.value,
                          )
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="ghost" onClick={onVolver}>
              <ArrowLeft className="h-4 w-4" />
              Cambiar PDF
            </Button>
            <Button onClick={onContinuar} disabled={!terminosValidos}>
              Continuar
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PasoConfirmar({
  datos,
  archivo,
  onConfirmar,
  onVolver,
}: {
  datos: ContratoExtraido;
  archivo: File | null;
  onConfirmar: () => void;
  onVolver: () => void;
}) {
  // Resumen de los datos clave — antes el paso 4 era una pantalla genérica
  // con un único CTA "Confirmar" sin recordar al usuario qué iba a dar de
  // alta. Ahora vemos el inquilino, dirección, monto, plazo y comisión.
  const monedaSimbolo = String(datos.moneda?.valor ?? 'ARS') === 'USD' ? 'US$' : '$';
  const monto = Number(datos.montoInicial?.valor ?? 0);
  const comision = Number(datos.comisionInmobiliaria?.valor ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          Listo para dar de alta
        </CardTitle>
        <CardDescription>
          Revisá un último resumen antes de confirmar. Generamos la primera
          liquidación y mandamos invitación al inquilino por WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm md:grid-cols-2">
          <ResumenItem label="Inquilino" value={String(datos.inquilino?.valor ?? '—')} />
          <ResumenItem label="CUIT" value={String(datos.cuit?.valor ?? '—')} />
          <ResumenItem
            label="Dirección"
            value={String(datos.direccion?.valor ?? '—')}
            className="md:col-span-2"
          />
          <ResumenItem
            label="Monto inicial"
            value={`${monedaSimbolo} ${formatMonto(monto).replace(/[^\d.,]/g, '')}`}
          />
          <ResumenItem
            label="Día de pago"
            value={`Día ${datos.diaPago?.valor ?? '—'} de cada mes`}
          />
          <ResumenItem
            label="Vigencia"
            value={`${formatFechaDeInput(datos.fechaInicio?.valor)} → ${formatFechaDeInput(datos.fechaFin?.valor)}`}
            className="md:col-span-2"
          />
          <ResumenItem
            label="Comisión inmobiliaria"
            value={`${comision}%`}
          />
          <ResumenItem
            label="Índice de ajuste"
            value={`${String(datos.indiceAjuste?.valor ?? '—')} · cada ${datos.frecuenciaAjusteMeses?.valor ?? '—'} meses`}
          />
        </div>

        {archivo && (
          <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span className="truncate">PDF: {archivo.name}</span>
          </div>
        )}

        <div className="flex flex-col-reverse justify-end gap-2 border-t pt-4 sm:flex-row">
          <Button variant="ghost" onClick={onVolver}>
            <ArrowLeft className="h-4 w-4" />
            Volver a editar
          </Button>
          <Button size="lg" onClick={onConfirmar}>
            Confirmar y dar de alta
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResumenItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Acepta YYYY-MM-DD del <input type="date"> y devuelve "31 ago 2025".
// Devuelve "—" si no hay valor o no parsea — evita render "Invalid Date".
function formatFechaDeInput(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  const str = String(valor);
  // Agregamos T12:00 para que JS no aplique offset UTC y corra la fecha un día.
  const d = new Date(`${str}T12:00:00`);
  if (Number.isNaN(d.getTime())) return str;
  return formatFechaCorta(d.toISOString());
}

// ============================================================================
// Wizard REAL (prod, apiEnabled): elige propiedad DISPONIBLE + inquilino +
// términos y da de alta contra POST /contratos. No usa el flujo de extracción
// por PDF (eso vive en el wizard mock de arriba, sólo demo).
// ============================================================================

// El paso 4 (Períodos anteriores) es CONDICIONAL: sólo existe cuando la fecha
// de inicio es pasada y ya venció al menos un período. Si no aplica, el wizard
// salta 3 → 5 y el header de pasos no lo muestra.
type PasoApi = 1 | 2 | 3 | 4 | 5;

const pasosApi: ReadonlyArray<{ id: PasoApi; label: string }> = [
  { id: 1, label: 'Propiedad' },
  { id: 2, label: 'Inquilino' },
  { id: 3, label: 'Términos' },
  { id: 4, label: 'Períodos anteriores' },
  { id: 5, label: 'Confirmar' },
];

const indicesAjuste: Array<{ value: IndiceAjuste; label: string }> = [
  { value: 'ICL', label: 'ICL (BCRA)' },
  { value: 'IPC', label: 'IPC (INDEC)' },
  { value: 'CASA_PROPIA', label: 'Casa Propia' },
  { value: 'UVA', label: 'UVA' },
  { value: 'CAC', label: 'CAC (Construcción)' },
  { value: 'RIPTE', label: 'RIPTE' },
  { value: 'FIJO', label: 'Monto fijo (sin ajuste)' },
];

// Índices que el Select ofrece (para validar el default que viene de Mercado).
const INDICES_DISPONIBLES = new Set(indicesAjuste.map((i) => i.value as string));

const tiposContrato: Array<{ value: TipoContrato; label: string }> = [
  { value: 'ALQUILER', label: 'Solo alquiler' },
  { value: 'ALQUILER_Y_EXPENSAS', label: 'Alquiler + expensas' },
  { value: 'SOLO_EXPENSAS', label: 'Solo expensas' },
];

const frecuenciasAjuste = [
  { value: '3', label: 'Cada 3 meses' },
  { value: '4', label: 'Cada 4 meses' },
  { value: '6', label: 'Cada 6 meses' },
  { value: '12', label: 'Cada 12 meses' },
];

type ModoCobranza = 'INMOBILIARIA' | 'PROPIETARIO_DIRECTO';

interface ContratoNuevoApi {
  id: string;
}

// ---- Períodos anteriores (contratos con fecha de inicio pasada) ----

type EstadoPeriodoAnterior = 'PAGADO' | 'PARCIAL' | 'ADEUDA';

interface PeriodoVencido {
  periodo: string; // 'YYYY-MM'
  vencimiento: string; // 'YYYY-MM-DD'
  diasAtraso: number; // días de atraso contados a HOY
}

interface PeriodoAnteriorForm {
  estado: EstadoPeriodoAnterior;
  montoPagado: string;
  moraManual: string;
  /** Si el usuario editó la mora a mano, no la pisamos con el prefill. */
  moraEditada: boolean;
}

const PERIODO_FORM_DEFAULT: PeriodoAnteriorForm = {
  estado: 'PAGADO',
  montoPagado: '',
  moraManual: '',
  moraEditada: false,
};

/**
 * Períodos ya vencidos entre el mes de `fechaInicio` y hoy. Por cada mes, el
 * vencimiento es min(diaPago, último día del mes); se incluye si ese
 * vencimiento ya pasó. Cálculo 100% client-side con fechas locales.
 */
function calcularPeriodosVencidos(fechaInicio: string, diaPago: number): PeriodoVencido[] {
  if (fechaInicio.length !== 10 || !(diaPago >= 1 && diaPago <= 31)) return [];
  const [anio, mes] = fechaInicio.split('-').map(Number);
  if (!anio || !mes) return [];
  const hoy = new Date();
  const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const out: PeriodoVencido[] = [];
  let cursor = new Date(anio, mes - 1, 1);
  // Tope de 10 años por las dudas (input basura no debe colgar el wizard).
  for (let i = 0; i < 120 && cursor <= hoyLocal; i++) {
    const ultimoDia = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const venc = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(diaPago, ultimoDia));
    if (venc < hoyLocal) {
      const mm = String(cursor.getMonth() + 1).padStart(2, '0');
      const dd = String(venc.getDate()).padStart(2, '0');
      out.push({
        periodo: `${cursor.getFullYear()}-${mm}`,
        vencimiento: `${cursor.getFullYear()}-${mm}-${dd}`,
        diasAtraso: Math.floor((hoyLocal.getTime() - venc.getTime()) / 86_400_000),
      });
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return out;
}

// 'YYYY-MM' → "Marzo 2026".
function labelPeriodo(periodo: string): string {
  const [anio = 0, mes = 1] = periodo.split('-').map(Number);
  const nombre = new Date(anio, mes - 1, 1).toLocaleDateString('es-AR', { month: 'long' });
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}

function CargarContratoApiWizard() {
  const router = useRouter();
  const qc = useQueryClient();
  const { propiedades, cargando } = usePropiedades();
  // Config de Mercado de la inmobiliaria → define el índice y la moneda por
  // defecto de un contrato nuevo (lo que la inmo eligió en /configuracion#mercado).
  const { config: mercado } = useMercado();
  // Default de mora de la inmobiliaria (GET /cobranza → mora): es lo que
  // hereda el contrato si el usuario no elige un esquema explícito.
  const { mora: moraDefault } = useCobranza();

  const [paso, setPaso] = useState<PasoApi>(1);

  // Propiedad
  const [propiedadId, setPropiedadId] = useState('');

  // Inquilino
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [dni, setDni] = useState('');

  // Reuso (req 3): traer un inquilino que ya está en la cartera. `personaId` no-null =
  // el alta se agrupa bajo esa Persona existente (historial) en vez de crear una nueva.
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [busquedaPersona, setBusquedaPersona] = useState('');
  const [resultadosPersona, setResultadosPersona] = useState<PersonaListado[]>([]);

  // Buscar personas por texto (debounce) para el autocomplete del reuso.
  useEffect(() => {
    const t = busquedaPersona.trim();
    if (t.length < 2) {
      setResultadosPersona([]);
      return;
    }
    let vivo = true;
    const timer = setTimeout(async () => {
      try {
        await ensureApiSession();
        const r = await apiFetch<PersonaListado[]>(`/personas?q=${encodeURIComponent(t)}`);
        if (vivo) setResultadosPersona(r.slice(0, 8));
      } catch {
        if (vivo) setResultadosPersona([]);
      }
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [busquedaPersona]);

  const elegirPersona = (p: PersonaListado) => {
    setPersonaId(p.id);
    setNombre(p.nombre);
    setApellido(p.apellido ?? '');
    setDni(p.dni ?? '');
    setTelefono(p.telefono ?? '');
    // Email NO se precarga: el @@unique([inmobiliariaId,email]) impide repetir el email
    // en un 2º contrato. La identidad de login vive en su 1er contrato; acá va vacío.
    setEmail('');
    setBusquedaPersona('');
    setResultadosPersona([]);
  };

  const limpiarReuso = () => {
    setPersonaId(null);
    setNombre('');
    setApellido('');
    setDni('');
    setTelefono('');
    setEmail('');
  };

  // Términos
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('ARS');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [diaPago, setDiaPago] = useState('10');
  const [indiceAjuste, setIndiceAjuste] = useState<IndiceAjuste>('ICL');
  const [frecuenciaAjusteMeses, setFrecuenciaAjusteMeses] = useState('12');
  const [tipoContrato, setTipoContrato] = useState<TipoContrato>('ALQUILER');
  const [montoExpensas, setMontoExpensas] = useState('');
  const [depositoGarantia, setDepositoGarantia] = useState('');
  const [comisionInmobiliaria, setComisionInmobiliaria] = useState('');
  const [modoCobranza, setModoCobranza] = useState<ModoCobranza>('INMOBILIARIA');

  // Interés por mora: 'HEREDAR' = usa el default de la inmobiliaria y NO se
  // manda moraTipo/moraValor al API (la cascada la resuelve el backend).
  const [moraSel, setMoraSel] = useState<MoraSeleccion>('HEREDAR');
  const [moraValor, setMoraValor] = useState('');

  // Períodos anteriores (sólo si fechaInicio es pasada): estado por período,
  // keyed por 'YYYY-MM'. Los que no aparecen quedan en el default (PAGADO).
  const [periodosForm, setPeriodosForm] = useState<Record<string, PeriodoAnteriorForm>>({});

  // Defaults desde la config de Mercado (índice + moneda), una sola vez al
  // llegar la config y antes de que el usuario edite los términos.
  const defaultsMercadoAplicados = useRef(false);
  useEffect(() => {
    if (!mercado || defaultsMercadoAplicados.current) return;
    defaultsMercadoAplicados.current = true;
    if (INDICES_DISPONIBLES.has(mercado.indiceDefault)) {
      setIndiceAjuste(mercado.indiceDefault as IndiceAjuste);
    }
    if (mercado.moneda === 'ARS' || mercado.moneda === 'USD') {
      setMoneda(mercado.moneda);
    }
  }, [mercado]);

  // Flow
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [cancelarAbierto, setCancelarAbierto] = useState(false);

  // Sólo se puede dar de alta sobre propiedades DISPONIBLES: una ALQUILADA ya
  // tiene contrato y el server respondería 409.
  const disponibles = useMemo(
    () => propiedades.filter((p) => p.propiedad.estado === 'DISPONIBLE'),
    [propiedades],
  );
  const propiedadElegida = useMemo(
    () => propiedades.find((p) => p.propiedad.id === propiedadId) ?? null,
    [propiedades, propiedadId],
  );

  // Encadenado desde "cargar propiedad": /contratos/nuevo?propiedad=<id> llega
  // con la propiedad recién creada. La preseleccionamos y saltamos al paso del
  // inquilino. Leemos de window (no useSearchParams) para no exigir Suspense en
  // el export estático. Una sola vez, cuando ya cargaron las propiedades.
  const preseleccionAplicada = useRef(false);
  useEffect(() => {
    if (preseleccionAplicada.current || cargando) return;
    let pid = '';
    try {
      pid = new URLSearchParams(window.location.search).get('propiedad') ?? '';
    } catch {
      /* ignore */
    }
    if (!pid) {
      preseleccionAplicada.current = true;
      return;
    }
    if (disponibles.some((p) => p.propiedad.id === pid)) {
      preseleccionAplicada.current = true;
      setPropiedadId(pid);
      setPaso(2);
    }
  }, [cargando, disponibles]);

  const incluyeExpensas =
    tipoContrato === 'ALQUILER_Y_EXPENSAS' || tipoContrato === 'SOLO_EXPENSAS';
  const requiereAlquiler = tipoContrato !== 'SOLO_EXPENSAS';

  // Base sobre la que se calcula la mora: lo que se debe por mes (alquiler +
  // expensas si el contrato las incluye). Para el preview y los prefills.
  const montoBaseMora =
    (requiereAlquiler ? Number(monto) || 0 : 0) +
    (incluyeExpensas ? Number(montoExpensas) || 0 : 0);

  // Esquema de mora EFECTIVO del wizard (elegido o heredado) — se usa para el
  // prefill de la mora de los períodos anteriores.
  const moraEfectivaWizard: { tipo: TipoMora; valor: number } =
    moraSel === 'HEREDAR'
      ? { tipo: moraDefault?.tipoDefault ?? 'SIN_MORA', valor: moraDefault?.valorDefault ?? 0 }
      : { tipo: moraSel, valor: Number(moraValor) || 0 };

  // Períodos ya vencidos entre el inicio del contrato y hoy. Si hay al menos
  // uno, aparece el paso 4 "Períodos anteriores".
  const periodosVencidos = useMemo(
    () => calcularPeriodosVencidos(fechaInicio, Number(diaPago)),
    [fechaInicio, diaPago],
  );
  const hayPeriodos = periodosVencidos.length > 0;
  const pasosVisibles = useMemo(
    () => pasosApi.filter((p) => p.id !== 4 || hayPeriodos),
    [hayPeriodos],
  );

  const formDePeriodo = (periodo: string): PeriodoAnteriorForm =>
    periodosForm[periodo] ?? PERIODO_FORM_DEFAULT;

  // Mora sugerida para un período, calculada a HOY con el esquema elegido.
  // Redondeo a CENTAVOS (no a pesos): mismo r2 que el backend (punitorios.ts),
  // para que el prefill coincida con lo que el esquema calcularía server-side.
  const moraSugerida = (diasAtraso: number): number =>
    Math.round(
      calcularMora(moraEfectivaWizard.tipo, moraEfectivaWizard.valor, montoBaseMora, diasAtraso) * 100,
    ) / 100;

  const pasoPropiedadValido = !!propiedadId;
  const pasoInquilinoValido = nombre.trim().length >= 2;
  const pasoTerminosValido =
    (!requiereAlquiler || Number(monto) > 0) &&
    fechaInicio.length === 10 &&
    fechaFin.length === 10 &&
    fechaFin > fechaInicio &&
    Number(diaPago) >= 1 &&
    Number(diaPago) <= 31 &&
    Number(frecuenciaAjusteMeses) > 0 &&
    // Si eligió un esquema con valor, el valor tiene que ser > 0.
    (moraSel === 'HEREDAR' || moraSel === 'SIN_MORA' || Number(moraValor) > 0);
  // Períodos: todo PARCIAL necesita monto pagado > 0 (la mora es opcional).
  const pasoPeriodosValido = periodosVencidos.every((p) => {
    const f = formDePeriodo(p.periodo);
    return f.estado !== 'PARCIAL' || Number(f.montoPagado) > 0;
  });

  // Saltamos el paso 4 cuando no hay períodos vencidos que declarar.
  const avanzar = () =>
    setPaso((p) => {
      const sig = Math.min(5, p + 1) as PasoApi;
      return sig === 4 && !hayPeriodos ? 5 : sig;
    });
  const retroceder = () =>
    setPaso((p) => {
      const ant = Math.max(1, p - 1) as PasoApi;
      return ant === 4 && !hayPeriodos ? 3 : ant;
    });

  const setEstadoPeriodo = (p: PeriodoVencido, estado: EstadoPeriodoAnterior) => {
    setPeriodosForm((forms) => {
      const actual = forms[p.periodo] ?? PERIODO_FORM_DEFAULT;
      const sig: PeriodoAnteriorForm = { ...actual, estado };
      // Prefill de la mora calculada a HOY con el esquema elegido. Es
      // editable (override manual para migraciones); si el usuario ya la
      // tocó, no se la pisamos.
      if (estado !== 'PAGADO' && !actual.moraEditada) {
        sig.moraManual = String(moraSugerida(p.diasAtraso));
      }
      return { ...forms, [p.periodo]: sig };
    });
  };
  const setMontoPagadoPeriodo = (periodo: string, v: string) => {
    setPeriodosForm((forms) => ({
      ...forms,
      [periodo]: { ...(forms[periodo] ?? PERIODO_FORM_DEFAULT), montoPagado: v },
    }));
  };
  const setMoraPeriodo = (periodo: string, v: string) => {
    setPeriodosForm((forms) => ({
      ...forms,
      [periodo]: { ...(forms[periodo] ?? PERIODO_FORM_DEFAULT), moraManual: v, moraEditada: true },
    }));
  };

  // Resumen de deuda inicial (footer del paso 4 + resumen del confirmar).
  const deudaCapital = periodosVencidos.reduce((acc, p) => {
    const f = formDePeriodo(p.periodo);
    if (f.estado === 'ADEUDA') return acc + montoBaseMora;
    if (f.estado === 'PARCIAL') return acc + Math.max(0, montoBaseMora - (Number(f.montoPagado) || 0));
    return acc;
  }, 0);
  const deudaMora = periodosVencidos.reduce((acc, p) => {
    const f = formDePeriodo(p.periodo);
    return f.estado === 'PAGADO' ? acc : acc + (Number(f.moraManual) || 0);
  }, 0);

  // Si el usuario vuelve al paso 3 y cambia el esquema de mora o el monto,
  // refrescamos las moras SUGERIDAS de los períodos que no editó a mano.
  useEffect(() => {
    setPeriodosForm((forms) => {
      let cambio = false;
      const sig = { ...forms };
      for (const p of periodosVencidos) {
        const f = forms[p.periodo];
        if (!f || f.estado === 'PAGADO' || f.moraEditada) continue;
        const sugerida = String(moraSugerida(p.diasAtraso));
        if (f.moraManual !== sugerida) {
          sig[p.periodo] = { ...f, moraManual: sugerida };
          cambio = true;
        }
      }
      return cambio ? sig : forms;
    });
    // moraSugerida se recrea por render pero sólo depende de estas deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moraEfectivaWizard.tipo, moraEfectivaWizard.valor, montoBaseMora, periodosVencidos]);

  const dar_de_alta = async () => {
    setEnviando(true);
    setErrorServidor(null);
    try {
      await ensureApiSession();
      // Mapeo del estado del wizard al contrato del API. Montos => number;
      // los opcionales sólo se mandan cuando tienen valor real.
      const body = {
        propiedadId,
        inquilino: {
          nombre: nombre.trim(),
          ...(apellido.trim() ? { apellido: apellido.trim() } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(telefono.trim() ? { telefono: telefono.trim() } : {}),
          ...(dni.trim() ? { dni: dni.trim() } : {}),
        },
        // Reuso: agrupa el contrato bajo la Persona elegida (trae su historial a la ficha).
        ...(personaId ? { personaId } : {}),
        monto: requiereAlquiler ? Number(monto) : 0,
        moneda,
        fechaInicio,
        fechaFin,
        diaPago: Number(diaPago),
        indiceAjuste,
        frecuenciaAjusteMeses: Number(frecuenciaAjusteMeses),
        tipoContrato,
        modoCobranza,
        ...(incluyeExpensas && Number(montoExpensas) > 0
          ? { montoExpensas: Number(montoExpensas) }
          : {}),
        ...(Number(depositoGarantia) > 0
          ? { depositoGarantia: Number(depositoGarantia) }
          : {}),
        ...(comisionInmobiliaria.trim() !== '' && Number(comisionInmobiliaria) >= 0
          ? { comisionInmobiliaria: Number(comisionInmobiliaria) }
          : {}),
        // Mora: sólo si eligió un esquema explícito. 'HEREDAR' no manda nada
        // y el backend aplica el default de la inmobiliaria (cascada).
        ...(moraSel !== 'HEREDAR'
          ? {
              moraTipo: moraSel,
              ...(moraSel !== 'SIN_MORA' ? { moraValor: Number(moraValor) } : {}),
            }
          : {}),
        // Períodos anteriores: se mandan TODOS (también los pagados — el
        // backend los cierra con pagos sintéticos).
        ...(hayPeriodos
          ? {
              periodosAnteriores: periodosVencidos.map((p) => {
                const f = formDePeriodo(p.periodo);
                return {
                  periodo: p.periodo,
                  estado: f.estado,
                  ...(f.estado === 'PARCIAL' && Number(f.montoPagado) > 0
                    ? { montoPagado: Number(f.montoPagado) }
                    : {}),
                  ...(f.estado !== 'PAGADO' && f.moraManual.trim() !== ''
                    ? { moraManual: Number(f.moraManual) }
                    : {}),
                };
              }),
            }
          : {}),
      };
      await apiFetch<ContratoNuevoApi>('/contratos', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      // La propiedad pasa a ALQUILADA y el contrato aparece en la lista.
      void qc.invalidateQueries({ queryKey: ['contratos'] });
      void qc.invalidateQueries({ queryKey: ['propiedades'] });
      setConfirmando(false);
      toast({
        variant: 'success',
        title: 'Contrato dado de alta',
        description: 'Generamos la primera liquidación y la propiedad pasó a alquilada.',
      });
      router.push('/contratos');
    } catch (e) {
      // Mostramos el mensaje del server (ej. 409 propiedad ya tiene contrato).
      const msg =
        e instanceof ApiError
          ? e.message
          : 'No pudimos dar de alta el contrato. Reintentá en un momento.';
      setErrorServidor(msg);
      setEnviando(false);
      setConfirmando(false);
      toast({
        variant: 'destructive',
        title: 'No se pudo dar de alta el contrato',
        description: msg,
      });
    }
  };

  const monedaSimbolo = moneda === 'USD' ? 'US$' : '$';

  return (
    <>
      <Topbar titulo="Cargar contrato" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/contratos"
              className="mb-2 inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              Volver
            </Link>
            <StepsApi actual={paso} pasos={pasosVisibles} />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => {
              if (paso === 1 && !propiedadId) {
                router.push('/contratos');
              } else {
                setCancelarAbierto(true);
              }
            }}
          >
            <X className="h-4 w-4" />
            Cancelar carga
          </Button>
        </div>

        {errorServidor && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorServidor}</span>
          </div>
        )}

        {paso === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Elegí la propiedad</CardTitle>
              <CardDescription>
                Sólo aparecen las propiedades disponibles (sin contrato activo).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {cargando ? (
                <p className="text-sm text-muted-foreground">Cargando propiedades…</p>
              ) : disponibles.length === 0 ? (
                <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  <Home className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    No hay propiedades disponibles para alquilar.{' '}
                    <Link href="/propiedades/nueva" className="text-primary underline-offset-2 hover:underline">
                      Cargá una propiedad
                    </Link>{' '}
                    primero.
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="propiedad">Propiedad disponible</Label>
                  <Select value={propiedadId} onValueChange={setPropiedadId}>
                    <SelectTrigger id="propiedad">
                      <SelectValue placeholder="Elegí una propiedad…" />
                    </SelectTrigger>
                    <SelectContent>
                      {disponibles.map((p) => (
                        <SelectItem key={p.propiedad.id} value={p.propiedad.id}>
                          {p.propiedad.direccion} · {p.propiedad.ciudad}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex justify-end border-t pt-4">
                <Button onClick={avanzar} disabled={!pasoPropiedadValido}>
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {paso === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Datos del inquilino</CardTitle>
              <CardDescription>
                Sólo el nombre es obligatorio; el resto ayuda a contactarlo e invitarlo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Reuso (req 3): traer un inquilino existente por su historial. */}
              <div className="space-y-1.5">
                <Label htmlFor="buscar-persona">¿Ya está en tu cartera?</Label>
                {personaId ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                    <span>
                      Reusando el historial de{' '}
                      <strong>{`${nombre} ${apellido}`.trim()}</strong>
                      {dni ? ` · DNI ${dni}` : ''}
                    </span>
                    <Button variant="ghost" size="sm" onClick={limpiarReuso}>
                      Cargar uno nuevo
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      id="buscar-persona"
                      value={busquedaPersona}
                      onChange={(e) => setBusquedaPersona(e.target.value)}
                      placeholder="Buscá por nombre, DNI o email para traer su historial…"
                      autoComplete="off"
                    />
                    {resultadosPersona.length > 0 && (
                      <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover shadow-md">
                        {resultadosPersona.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => elegirPersona(p)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                          >
                            <span className="truncate">
                              {`${p.nombre} ${p.apellido ?? ''}`.trim()}
                              {p.dni ? ` · DNI ${p.dni}` : p.email ? ` · ${p.email}` : ''}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {p.totalContratos} contrato{p.totalContratos === 1 ? '' : 's'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Opcional. Si es un inquilino nuevo, completá los datos abajo.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nombre">
                    Nombre <span aria-hidden="true" className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Juan"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="apellido">Apellido</Label>
                  <Input
                    id="apellido"
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    placeholder="Pérez"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="juan@email.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="11 5555 5555"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dni">DNI</Label>
                  <Input
                    id="dni"
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    inputMode="numeric"
                    placeholder="30111222"
                  />
                </div>
              </div>

              <div className="flex justify-between border-t pt-4">
                <Button variant="ghost" onClick={retroceder}>
                  <ArrowLeft className="h-4 w-4" />
                  Volver
                </Button>
                <Button onClick={avanzar} disabled={!pasoInquilinoValido}>
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {paso === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Términos del contrato</CardTitle>
              <CardDescription>
                Monto, vigencia, ajuste y forma de cobranza.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="tipoContrato">Tipo de contrato</Label>
                <Select
                  value={tipoContrato}
                  onValueChange={(v) => setTipoContrato(v as TipoContrato)}
                >
                  <SelectTrigger id="tipoContrato">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposContrato.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_140px]">
                <div className="space-y-1.5">
                  <Label htmlFor="monto">
                    {requiereAlquiler ? (
                      <>Alquiler mensual <span aria-hidden="true" className="text-destructive">*</span></>
                    ) : (
                      'Alquiler mensual'
                    )}
                  </Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {monedaSimbolo}
                    </span>
                    <Input
                      id="monto"
                      inputMode="numeric"
                      value={monto ? Number(monto).toLocaleString('es-AR') : ''}
                      onChange={(e) => setMonto(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder="480.000"
                      className="pl-9"
                      disabled={!requiereAlquiler}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="moneda">Moneda</Label>
                  <Select value={moneda} onValueChange={(v) => setMoneda(v as Moneda)}>
                    <SelectTrigger id="moneda">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">ARS — Pesos</SelectItem>
                      <SelectItem value="USD">USD — Dólares</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {incluyeExpensas && (
                <div className="space-y-1.5 md:max-w-xs">
                  <Label htmlFor="montoExpensas">Expensas mensuales</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {monedaSimbolo}
                    </span>
                    <Input
                      id="montoExpensas"
                      inputMode="numeric"
                      value={montoExpensas ? Number(montoExpensas).toLocaleString('es-AR') : ''}
                      onChange={(e) => setMontoExpensas(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder="90.000"
                      className="pl-9"
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fechaInicio">
                    Inicio <span aria-hidden="true" className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="fechaInicio"
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fechaFin">
                    Fin <span aria-hidden="true" className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="fechaFin"
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="diaPago">Día de pago</Label>
                  <Input
                    id="diaPago"
                    inputMode="numeric"
                    value={diaPago}
                    onChange={(e) => {
                      const n = e.target.value.replace(/\D/g, '').slice(0, 2);
                      setDiaPago(n);
                    }}
                    placeholder="10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="indiceAjuste">Índice de ajuste</Label>
                  <Select
                    value={indiceAjuste}
                    onValueChange={(v) => setIndiceAjuste(v as IndiceAjuste)}
                  >
                    <SelectTrigger id="indiceAjuste">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {indicesAjuste.map((i) => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="frecuenciaAjuste">Frecuencia ajuste</Label>
                  <Select
                    value={frecuenciaAjusteMeses}
                    onValueChange={setFrecuenciaAjusteMeses}
                  >
                    <SelectTrigger id="frecuenciaAjuste">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {frecuenciasAjuste.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5 md:max-w-xs">
                <Label htmlFor="comision">Comisión de la inmobiliaria (%)</Label>
                <div className="relative">
                  <Input
                    id="comision"
                    inputMode="decimal"
                    value={comisionInmobiliaria}
                    onChange={(e) => setComisionInmobiliaria(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))}
                    placeholder="8"
                    className="pr-8"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Es la comisión que cobrás por ESTE contrato. Si la dejás vacía, se usa la
                  comisión general en las rendiciones.
                </p>
              </div>

              {/* Interés por mora: por defecto hereda el esquema de la
                  inmobiliaria; si el usuario elige uno explícito, ese pisa al
                  default sólo para ESTE contrato. */}
              <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                <div>
                  <p className="text-sm font-medium">Interés por mora</p>
                  <p className="text-[11px] text-muted-foreground">
                    Punitorio que se suma cuando el inquilino paga tarde. Si no elegís
                    nada, se usa el esquema por defecto de la inmobiliaria.
                  </p>
                </div>
                <MoraSelector
                  seleccion={moraSel}
                  valor={moraValor}
                  onSeleccionChange={setMoraSel}
                  onValorChange={setMoraValor}
                  heredado={
                    moraDefault
                      ? { tipo: moraDefault.tipoDefault, valor: moraDefault.valorDefault }
                      : null
                  }
                  conHeredar
                  montoBase={montoBaseMora}
                  moneda={moneda}
                  idPrefix="mora-contrato"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="deposito">Depósito en garantía</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {monedaSimbolo}
                    </span>
                    <Input
                      id="deposito"
                      inputMode="numeric"
                      value={depositoGarantia ? Number(depositoGarantia).toLocaleString('es-AR') : ''}
                      onChange={(e) => setDepositoGarantia(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder="480.000"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="modoCobranza">Cobranza</Label>
                  <Select
                    value={modoCobranza}
                    onValueChange={(v) => setModoCobranza(v as ModoCobranza)}
                  >
                    <SelectTrigger id="modoCobranza">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INMOBILIARIA">Cobra la inmobiliaria</SelectItem>
                      <SelectItem value="PROPIETARIO_DIRECTO">Cobra el propietario directo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between border-t pt-4">
                <Button variant="ghost" onClick={retroceder}>
                  <ArrowLeft className="h-4 w-4" />
                  Volver
                </Button>
                <Button onClick={avanzar} disabled={!pasoTerminosValido}>
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {paso === 4 && hayPeriodos && (
          <Card>
            <CardHeader>
              <CardTitle>Períodos anteriores</CardTitle>
              <CardDescription>
                El contrato arranca en el pasado: contanos cómo quedó cada mes ya
                vencido. Lo pagado se cierra solo; lo parcial o adeudado queda como
                deuda inicial del inquilino.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="divide-y rounded-lg border">
                {periodosVencidos.map((p) => {
                  const f = formDePeriodo(p.periodo);
                  return (
                    <div key={p.periodo} className="space-y-3 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{labelPeriodo(p.periodo)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Venció el {formatFechaDeInput(p.vencimiento)} · hace{' '}
                            {p.diasAtraso} día{p.diasAtraso === 1 ? '' : 's'}
                          </p>
                        </div>
                        <div
                          role="radiogroup"
                          aria-label={`Estado de ${labelPeriodo(p.periodo)}`}
                          className="flex gap-1"
                        >
                          {(
                            [
                              { value: 'PAGADO', label: 'Pagado' },
                              { value: 'PARCIAL', label: 'Parcial' },
                              { value: 'ADEUDA', label: 'Adeuda' },
                            ] as const
                          ).map((e) => (
                            <button
                              key={e.value}
                              type="button"
                              role="radio"
                              aria-checked={f.estado === e.value}
                              onClick={() => setEstadoPeriodo(p, e.value)}
                              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                                f.estado !== e.value
                                  ? 'text-muted-foreground hover:bg-muted/40'
                                  : e.value === 'PAGADO'
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : e.value === 'PARCIAL'
                                      ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                      : 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                              }`}
                            >
                              {e.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {f.estado !== 'PAGADO' && (
                        <div className="grid gap-3 md:grid-cols-2">
                          {f.estado === 'PARCIAL' && (
                            <div className="space-y-1.5">
                              <Label htmlFor={`pagado-${p.periodo}`}>Monto pagado</Label>
                              <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                  {monedaSimbolo}
                                </span>
                                <Input
                                  id={`pagado-${p.periodo}`}
                                  inputMode="numeric"
                                  value={f.montoPagado ? Number(f.montoPagado).toLocaleString('es-AR') : ''}
                                  onChange={(e) =>
                                    setMontoPagadoPeriodo(p.periodo, e.target.value.replace(/\D/g, '').slice(0, 12))
                                  }
                                  placeholder="200.000"
                                  className="pl-9"
                                />
                              </div>
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <Label htmlFor={`mora-${p.periodo}`}>Mora acumulada</Label>
                            <div className="relative">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                {monedaSimbolo}
                              </span>
                              <Input
                                id={`mora-${p.periodo}`}
                                inputMode="numeric"
                                value={f.moraManual ? Number(f.moraManual).toLocaleString('es-AR') : ''}
                                onChange={(e) =>
                                  setMoraPeriodo(p.periodo, e.target.value.replace(/\D/g, '').slice(0, 12))
                                }
                                placeholder="0"
                                className="pl-9"
                              />
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Sugerida con el esquema elegido, calculada a hoy. Editala si
                              venís con otra mora acordada.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Resumen de la deuda que arrastra el contrato al darse de alta. */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Deuda inicial</span>
                <span className="font-medium tabular-nums">
                  {monedaSimbolo} {deudaCapital.toLocaleString('es-AR')} (capital) +{' '}
                  {monedaSimbolo} {deudaMora.toLocaleString('es-AR')} (mora)
                </span>
              </div>

              <div className="flex justify-between border-t pt-4">
                <Button variant="ghost" onClick={retroceder}>
                  <ArrowLeft className="h-4 w-4" />
                  Volver
                </Button>
                <Button onClick={avanzar} disabled={!pasoPeriodosValido}>
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {paso === 5 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Listo para dar de alta
              </CardTitle>
              <CardDescription>
                Revisá el resumen antes de confirmar. Generamos la primera
                liquidación y la propiedad pasa a alquilada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm md:grid-cols-2">
                <ResumenItem
                  label="Propiedad"
                  value={
                    propiedadElegida
                      ? `${propiedadElegida.propiedad.direccion} · ${propiedadElegida.propiedad.ciudad}`
                      : '—'
                  }
                  className="md:col-span-2"
                />
                <ResumenItem
                  label="Inquilino"
                  value={`${nombre} ${apellido}`.trim() || '—'}
                />
                <ResumenItem label="DNI" value={dni || '—'} />
                <ResumenItem
                  label="Alquiler"
                  value={
                    requiereAlquiler
                      ? `${monedaSimbolo} ${formatMonto(Number(monto || 0)).replace(/[^\d.,]/g, '')}`
                      : 'Solo expensas'
                  }
                />
                <ResumenItem
                  label="Día de pago"
                  value={`Día ${diaPago || '—'} de cada mes`}
                />
                <ResumenItem
                  label="Vigencia"
                  value={`${formatFechaDeInput(fechaInicio)} → ${formatFechaDeInput(fechaFin)}`}
                  className="md:col-span-2"
                />
                <ResumenItem
                  label="Ajuste"
                  value={`${indiceAjuste} · cada ${frecuenciaAjusteMeses} meses`}
                />
                <ResumenItem
                  label="Cobranza"
                  value={
                    modoCobranza === 'INMOBILIARIA'
                      ? 'Inmobiliaria'
                      : 'Propietario directo'
                  }
                />
                <ResumenItem
                  label="Interés por mora"
                  value={
                    moraSel === 'HEREDAR' && !moraDefault
                      ? 'Heredado de la inmobiliaria'
                      : `${descripcionMora(moraEfectivaWizard.tipo, moraEfectivaWizard.valor, moneda)}${
                          moraSel === 'HEREDAR' ? ' (heredada)' : ''
                        }`
                  }
                />
                {hayPeriodos && (
                  <ResumenItem
                    label="Períodos anteriores"
                    value={`${periodosVencidos.length} período${periodosVencidos.length === 1 ? '' : 's'} · Deuda inicial: ${monedaSimbolo} ${deudaCapital.toLocaleString('es-AR')} (capital) + ${monedaSimbolo} ${deudaMora.toLocaleString('es-AR')} (mora)`}
                  />
                )}
              </div>

              <div className="flex flex-col-reverse justify-end gap-2 border-t pt-4 sm:flex-row">
                <Button variant="ghost" onClick={retroceder}>
                  <ArrowLeft className="h-4 w-4" />
                  Volver a editar
                </Button>
                <Button size="lg" onClick={() => setConfirmando(true)}>
                  Confirmar y dar de alta
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <ConfirmDialog
        open={cancelarAbierto}
        onOpenChange={setCancelarAbierto}
        title="¿Cancelar la carga?"
        description="Vas a perder el progreso de este contrato. Esta acción no se puede deshacer."
        confirmLabel="Sí, cancelar"
        onConfirm={() => router.push('/contratos')}
      />

      <ConfirmDialog
        open={confirmando}
        onOpenChange={setConfirmando}
        title="¿Dar de alta el contrato?"
        description="Vamos a crear el contrato, generar la primera liquidación y marcar la propiedad como alquilada."
        confirmLabel="Sí, dar de alta"
        loading={enviando}
        onConfirm={dar_de_alta}
      />
    </>
  );
}

// Recibe los pasos VISIBLES (el 4 "Períodos anteriores" sólo cuando aplica) y
// numera por posición, así el flujo corto se ve 1-2-3-4 sin hueco.
function StepsApi({
  actual,
  pasos,
}: {
  actual: PasoApi;
  pasos: ReadonlyArray<{ id: PasoApi; label: string }>;
}) {
  return (
    <ol role="list" className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {pasos.map((p, i) => {
        const completado = p.id < actual;
        const activo = p.id === actual;
        return (
          <li key={p.id} aria-current={activo ? 'step' : undefined} className="flex items-center gap-2 sm:gap-3">
            <div
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                completado
                  ? 'bg-primary text-primary-foreground'
                  : activo
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {completado ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`text-xs sm:text-sm ${activo ? 'font-medium' : completado ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              {p.label}
            </span>
            {i < pasos.length - 1 && <span className="hidden h-px w-8 bg-border sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}
