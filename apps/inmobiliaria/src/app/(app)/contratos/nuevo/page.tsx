'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileText, FileUp, Loader2, Sparkles, X } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Progress } from '@llave/ui/progress';
import { toast } from '@llave/ui/use-toast';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { Topbar } from '@/components/topbar';
import { Proximamente } from '@/components/proximamente';
import { apiEnabled } from '@/lib/api/client';
import { contratoExtraidoMock } from '@/lib/mock-data';
import { formatFechaCorta, formatMonto } from '@/lib/format';
import type { ContratoExtraido } from '@/lib/types';

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
  // En prod no hay POST de contrato (ni el parse IA) en el API: mostramos
  // "Próximamente" en lugar del wizard mock que daría de alta en localStorage.
  // En demo (!apiEnabled) el wizard sigue intacto. `apiEnabled` es constante de
  // módulo, así que el return temprano no altera el orden de hooks.
  if (apiEnabled) {
    return (
      <>
        <Topbar titulo="Cargar contrato" />
        <Proximamente
          titulo="La carga de contratos estará disponible pronto"
          descripcion="La lectura del contrato con IA y el alta automática se están conectando con el sistema. Por ahora podés consultar y operar sobre los contratos ya cargados."
          volverHref="/contratos"
          volverLabel="Volver a contratos"
        />
      </>
    );
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
          <li key={p.id} className="flex items-center gap-2 sm:gap-3">
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
            <Button onClick={onContinuar}>
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
