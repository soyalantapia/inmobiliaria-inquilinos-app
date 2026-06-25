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
import { usePropiedades, useMercado } from '@/lib/api/hooks';
import { contratoExtraidoMock } from '@/lib/mock-data';
import { formatFechaCorta, formatMonto } from '@/lib/format';
import type {
  ContratoExtraido,
  IndiceAjuste,
  Moneda,
  TipoContrato,
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

type PasoApi = 1 | 2 | 3 | 4;

const pasosApi = [
  { id: 1, label: 'Propiedad' },
  { id: 2, label: 'Inquilino' },
  { id: 3, label: 'Términos' },
  { id: 4, label: 'Confirmar' },
] as const;

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

function CargarContratoApiWizard() {
  const router = useRouter();
  const qc = useQueryClient();
  const { propiedades, cargando } = usePropiedades();
  // Config de Mercado de la inmobiliaria → define el índice y la moneda por
  // defecto de un contrato nuevo (lo que la inmo eligió en /configuracion#mercado).
  const { config: mercado } = useMercado();

  const [paso, setPaso] = useState<PasoApi>(1);

  // Propiedad
  const [propiedadId, setPropiedadId] = useState('');

  // Inquilino
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [dni, setDni] = useState('');

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
  const [modoCobranza, setModoCobranza] = useState<ModoCobranza>('INMOBILIARIA');

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

  const incluyeExpensas =
    tipoContrato === 'ALQUILER_Y_EXPENSAS' || tipoContrato === 'SOLO_EXPENSAS';
  const requiereAlquiler = tipoContrato !== 'SOLO_EXPENSAS';

  const pasoPropiedadValido = !!propiedadId;
  const pasoInquilinoValido = nombre.trim().length >= 2;
  const pasoTerminosValido =
    (!requiereAlquiler || Number(monto) > 0) &&
    fechaInicio.length === 10 &&
    fechaFin.length === 10 &&
    fechaFin > fechaInicio &&
    Number(diaPago) >= 1 &&
    Number(diaPago) <= 31 &&
    Number(frecuenciaAjusteMeses) > 0;

  const avanzar = () => setPaso((p) => Math.min(4, p + 1) as PasoApi);
  const retroceder = () => setPaso((p) => Math.max(1, p - 1) as PasoApi);

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
            <StepsApi actual={paso} />
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
                      value={monto}
                      onChange={(e) => setMonto(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder="480000"
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
                      value={montoExpensas}
                      onChange={(e) => setMontoExpensas(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder="90000"
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
                      value={depositoGarantia}
                      onChange={(e) => setDepositoGarantia(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder="480000"
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

        {paso === 4 && (
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

function StepsApi({ actual }: { actual: PasoApi }) {
  return (
    <ol role="list" className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {pasosApi.map((p, i) => {
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
            {i < pasosApi.length - 1 && <span className="hidden h-px w-8 bg-border sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}
