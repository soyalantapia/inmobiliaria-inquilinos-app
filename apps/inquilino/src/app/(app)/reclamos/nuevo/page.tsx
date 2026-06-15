'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, Phone, Trash2 } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Textarea } from '@llave/ui/textarea';
import { NavBar } from '@/components/nav-bar';
import { useMisReclamos } from '@/lib/api/use-mis-reclamos';
import { categoriaLabel } from '@/lib/reclamos-config';
import type { Categoria, Urgencia } from '@/lib/types';

const MAX_FOTO_MB = 4;
// Tel de la inmobiliaria para el atajo "Llamar" cuando el inquilino marca
// urgencia EMERGENCIA. Mismo número que usa el FAB de WhatsApp.
const TELEFONO_INMO = '541145321100';

// Autosave del borrador en localStorage — antes si el usuario rotaba el teléfono,
// recibía una llamada, o salía a buscar info por error, perdía TODO lo escrito.
// La foto NO se persiste (los File no son serializables y el dataURL puede ser
// muy grande para localStorage). El resto sí (M3 del audit).
const DRAFT_KEY = 'llave-inquilino:nuevo-reclamo-draft:v1';

type Draft = {
  categoria: Categoria | '';
  tituloOtro: string;
  urgencia: Urgencia | '';
  descripcion: string;
};

function leerDraft(): Draft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object') return null;
    return {
      categoria: d.categoria ?? '',
      tituloOtro: typeof d.tituloOtro === 'string' ? d.tituloOtro : '',
      urgencia: d.urgencia ?? '',
      descripcion: typeof d.descripcion === 'string' ? d.descripcion : '',
    };
  } catch {
    return null;
  }
}

function tieneContenido(d: Draft): boolean {
  return (
    d.categoria !== '' ||
    d.tituloOtro.trim() !== '' ||
    d.urgencia !== '' ||
    d.descripcion.trim() !== ''
  );
}

const categorias: Array<{ value: Categoria; label: string; emoji: string }> = [
  { value: 'PLOMERIA', label: 'Plomería', emoji: '🚰' },
  { value: 'ELECTRICIDAD', label: 'Electricidad', emoji: '💡' },
  { value: 'CERRADURA', label: 'Cerradura', emoji: '🔑' },
  // Label "Calefacción / A/C" es menos ambiguo que "Calefacción / aire" —
  // el slash + "aire" se leía como "aire de ventilación" en algunos casos.
  // A/C = aire acondicionado, término común en AR.
  { value: 'CALEFACCION', label: 'Calefacción / A/C', emoji: '🔥' },
  { value: 'OTRO', label: 'Otro', emoji: '🛠️' },
];

const urgencias: Array<{ value: Urgencia; label: string; descripcion: string }> = [
  { value: 'BAJA', label: 'Puede esperar', descripcion: 'No urge, podés resolverlo cuando puedas' },
  { value: 'MEDIA', label: 'Esta semana', descripcion: 'Me molesta pero no es grave' },
  { value: 'ALTA', label: 'Urgente', descripcion: 'Necesito una solución hoy o mañana' },
  { value: 'EMERGENCIA', label: 'Emergencia', descripcion: 'Hay riesgo o no puedo vivir así' },
];

export default function NuevoReclamoPage() {
  const router = useRouter();
  const { crearReclamo } = useMisReclamos();
  const fileRef = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [tituloOtro, setTituloOtro] = useState(''); // título libre cuando categoría === 'OTRO'
  const [urgencia, setUrgencia] = useState<Urgencia | ''>('');
  const [descripcion, setDescripcion] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [draftRestaurado, setDraftRestaurado] = useState(false);
  const [hidratado, setHidratado] = useState(false);

  // Hidratar borrador al montar — si el usuario salió por error o el browser
  // se cerró, recupera lo que estaba escribiendo. La foto NO se persiste.
  useEffect(() => {
    const d = leerDraft();
    if (d && tieneContenido(d)) {
      setCategoria(d.categoria);
      setTituloOtro(d.tituloOtro);
      setUrgencia(d.urgencia);
      setDescripcion(d.descripcion);
      setDraftRestaurado(true);
    }
    setHidratado(true);
  }, []);

  // Guardar borrador cada vez que cambia algo. Saltamos antes de hidratar
  // para no pisar el draft con valores vacíos del state inicial.
  useEffect(() => {
    if (!hidratado || typeof window === 'undefined') return;
    const draft: Draft = { categoria, tituloOtro, urgencia, descripcion };
    if (tieneContenido(draft)) {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        /* quota o storage deshabilitado — ignorar silenciosamente */
      }
    } else {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, [categoria, tituloOtro, urgencia, descripcion, hidratado]);

  // El reclamo es válido si tiene categoría, urgencia, descripción >= 10 chars
  // y, en caso de "OTRO", el título aclaratorio también con >= 3 chars.
  const tituloOtroValido = categoria !== 'OTRO' || tituloOtro.trim().length >= 3;
  const puedeEnviar =
    !!categoria && !!urgencia && descripcion.trim().length >= 10 && tituloOtroValido && !enviando;

  const handleFoto = (file: File) => {
    setErrorFoto(null);
    if (!file.type.startsWith('image/')) {
      setErrorFoto('Solo aceptamos imágenes (JPG o PNG).');
      return;
    }
    const mb = file.size / 1024 / 1024;
    if (mb > MAX_FOTO_MB) {
      setErrorFoto(`Pesa ${mb.toFixed(1)} MB. Máximo ${MAX_FOTO_MB} MB.`);
      return;
    }
    setFotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setFotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const limpiarFoto = () => {
    setFotoFile(null);
    setFotoPreview(null);
    setErrorFoto(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const enviar = async () => {
    if (!puedeEnviar) return;
    setEnviando(true);
    // El título: en "Otro" lo escribe el usuario, si no usamos el label de la
    // categoría (el API exige titulo ≥3). La descripción va cruda — el hook
    // combina título+descripción para el panel de la inmo igual que antes.
    const titulo =
      categoria === 'OTRO' && tituloOtro.trim().length > 0
        ? tituloOtro.trim()
        : categoriaLabel[categoria as Categoria];
    let nuevo;
    try {
      nuevo = await crearReclamo({
        titulo,
        categoria: categoria as Categoria,
        descripcion: descripcion.trim(),
        urgencia: urgencia as Urgencia,
        fotoDataUrl: fotoPreview,
      });
    } catch {
      // El POST falló (sin conexión / error del server): liberamos el botón
      // para que el usuario pueda reintentar sin quedar trabado en "Enviando…".
      setEnviando(false);
      return;
    }
    setEnviando(false);
    // Limpiar borrador — el reclamo ya está persistido, no queremos que al
    // crear el siguiente aparezca con datos del anterior pre-cargados.
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DRAFT_KEY);
    }
    // No mostramos toast: el banner verde en /reclamos cumple la confirmación.
    // Antes había banner + toast con copy casi idéntico (P7 de la auditoría).
    // Volvemos a la lista pasando el ID nuevo por query — la lista lo resalta.
    // No navegamos a /reclamos/[id] porque los IDs nuevos no tienen página
    // pre-renderizada en el static export (devolverían 404).
    router.push(`/reclamos?nuevo=${nuevo.id}`);
  };

  // Permite al usuario descartar el borrador restaurado y empezar de cero.
  const descartarBorrador = () => {
    setCategoria('');
    setTituloOtro('');
    setUrgencia('');
    setDescripcion('');
    setDraftRestaurado(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  };

  return (
    <>
      <header className="flex items-center gap-3 p-5">
        <Link href="/reclamos" className="rounded-full p-2 hover:bg-muted" aria-label="Volver">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">Nuevo reclamo</h1>
      </header>

      {/* pb-40 (no pb-28) porque el mensaje "Te falta: elegir de qué se
          trata · contar un poco más · elegir la urgencia" queda al fondo
          y con pb-28 el bottom-tab-bar fixed lo tapaba en mobile. */}
      <main className="flex-1 space-y-5 px-5 pb-40 md:pb-8">
        {/* Banner sutil cuando hidratamos un borrador. Le decimos al usuario
            que recuperamos lo que tenía escrito y le damos la opción de
            descartarlo para empezar de cero. */}
        {draftRestaurado && (
          <Card className="flex items-start gap-3 border-amber-200 bg-amber-50/60 p-3 animate-fade-in dark:border-amber-900/40 dark:bg-amber-950/20">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-xs font-semibold leading-tight text-amber-900 dark:text-amber-100">
                Recuperamos tu borrador
              </p>
              <p className="text-[11px] leading-snug text-amber-800/80 dark:text-amber-200/80">
                Seguí donde dejaste. Si no era esto, descartalo y empezá de cero.
              </p>
              <button
                type="button"
                onClick={descartarBorrador}
                className="text-[11px] font-semibold text-amber-900 underline-offset-2 hover:underline dark:text-amber-100"
              >
                Descartar borrador
              </button>
            </div>
          </Card>
        )}

        <div role="group" aria-labelledby="recnuevo-categoria-label" className="space-y-2">
          <p id="recnuevo-categoria-label" className="text-sm font-medium leading-none">¿De qué se trata?</p>
          <div className="grid grid-cols-2 gap-2">
            {categorias.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-pressed={categoria === c.value}
                onClick={() => setCategoria(c.value)}
                className={`flex min-h-[3.25rem] items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                  c.value === 'OTRO' ? 'col-span-2' : ''
                } ${
                  categoria === c.value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <span className="text-xl">{c.emoji}</span>
                <span className="font-medium leading-tight">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cuando elige "Otro", pedimos un título breve para aclarar */}
        {categoria === 'OTRO' && (
          <div className="space-y-2 animate-fade-in">
            <Label htmlFor="titulo-otro">¿Qué tipo de reclamo?</Label>
            <Input
              id="titulo-otro"
              aria-describedby="titulo-otro-hint"
              placeholder="Ej: Humedad en la pared, Internet, Ascensor…"
              value={tituloOtro}
              onChange={(e) => setTituloOtro(e.target.value)}
              maxLength={60}
            />
            <p id="titulo-otro-hint" className="text-xs text-muted-foreground">
              {tituloOtro.trim().length < 3
                ? `Mínimo 3 caracteres (te faltan ${3 - tituloOtro.trim().length})`
                : `${tituloOtro.length}/60`}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="desc">Contanos un poco</Label>
          <Textarea
            id="desc"
            placeholder="Ej: Pierde la canilla del baño desde anoche."
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={4}
            maxLength={1000}
          />
          {/* Mostramos el contador solo si el usuario ya empezó a escribir.
              Antes aparecía "te faltan 10" desde el render inicial, lo que
              sonaba a regaño antes de tocar el campo (P9 de la auditoría). */}
          {descripcion.length > 0 && (
            <p className={`text-xs ${descripcion.length >= 950 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
              {descripcion.length < 10
                ? `Mínimo 10 caracteres (te faltan ${10 - descripcion.length})`
                : `${descripcion.length}/1000`}
            </p>
          )}
        </div>

        {fotoPreview ? (
          <Card className="space-y-2 border-dashed p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fotoPreview}
              alt="Foto del reclamo"
              className="max-h-72 w-full rounded-md object-contain"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate">{fotoFile?.name}</span>
              <Button size="sm" variant="ghost" onClick={limpiarFoto}>
                <Trash2 className="h-3.5 w-3.5" />
                Cambiar
              </Button>
            </div>
          </Card>
        ) : (
          <label
            htmlFor="foto"
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-primary/40"
          >
            <Camera className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">Subí una foto</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Opcional
                </span>
              </div>
              <p className="text-xs">JPG o PNG · hasta {MAX_FOTO_MB} MB · Podés enviar sin foto</p>
            </div>
            <input
              ref={fileRef}
              id="foto"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFoto(f);
              }}
            />
          </label>
        )}
        {errorFoto && <p className="text-xs text-destructive">{errorFoto}</p>}

        {/* Urgencia: 2x2 grid SIEMPRE (también en mobile angosto).
            Antes era `grid-cols-1 sm:grid-cols-2` y en mobile real
            (375px) quedaba apilado: "Emergencia" caía fuera del primer
            viewport y un usuario con urgencia real podía marcar
            "Urgente" sin descubrir el nivel más alto. Ahora las 4
            opciones caben en una sola pantalla. */}
        <div role="group" aria-labelledby="recnuevo-urgencia-label" className="space-y-2">
          <p id="recnuevo-urgencia-label" className="text-sm font-medium leading-none">Urgencia</p>
          <div className="grid grid-cols-2 gap-2">
            {urgencias.map((u) => {
              const seleccionado = urgencia === u.value;
              const esEmergencia = u.value === 'EMERGENCIA';
              return (
                <button
                  key={u.value}
                  type="button"
                  aria-pressed={seleccionado}
                  onClick={() => setUrgencia(u.value)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    seleccionado
                      ? esEmergencia
                        ? 'border-destructive bg-destructive/5 text-destructive'
                        : 'border-primary bg-primary/5 text-primary'
                      : esEmergencia
                        ? 'border-destructive/30 hover:border-destructive/60'
                        : 'border-border hover:border-primary/40'
                  }`}
                >
                  <p className="text-sm font-medium">{u.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {u.descripcion}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nota destacada si la urgencia es EMERGENCIA (R11): para casos de
            riesgo real, mandar un reclamo y esperar no alcanza. Le damos un
            atajo a llamar a la inmobiliaria YA. */}
        {urgencia === 'EMERGENCIA' && (
          <Card className="space-y-3 border-destructive/40 bg-destructive/5 p-4 animate-fade-in">
            <div className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">¿Hay riesgo real ahora?</p>
                <p className="text-xs">
                  Para fugas, gas, agua corriendo o incendio: llamá a la
                  inmobiliaria YA. El reclamo escrito va igual, pero el
                  teléfono va más rápido.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="w-full"
              asChild
            >
              <a href={`tel:+${TELEFONO_INMO}`}>
                <Phone className="h-4 w-4" />
                Llamar a la inmobiliaria
              </a>
            </Button>
          </Card>
        )}

        {/* Indicador de qué falta para enviar (sólo cuando falta algo y NO está enviando) */}
        {!puedeEnviar && !enviando && (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-center text-xs text-muted-foreground">
            Te falta:{' '}
            {[
              !categoria && 'elegir de qué se trata',
              categoria === 'OTRO' &&
                tituloOtro.trim().length < 3 &&
                'aclarar el título',
              descripcion.trim().length < 10 && 'contar un poco más',
              !urgencia && 'elegir la urgencia',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        {/* className extra "disabled:bg-muted disabled:text-muted-foreground"
            sobreescribe el opacity-50 por defecto del Button shadcn —
            cuando disabled, en vez de violeta apagado al 50% (que se
            seguía leyendo como "casi activo"), se muestra gris claro
            inequívoco. */}
        <Button
          size="xl"
          className="w-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
          disabled={!puedeEnviar}
          onClick={enviar}
        >
          {enviando ? 'Enviando…' : 'Enviar reclamo'}
        </Button>
      </main>
      <NavBar />
    </>
  );
}
