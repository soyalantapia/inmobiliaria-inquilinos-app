'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  Home,
  ImagePlus,
  Plus,
  Sparkles,
  Store,
  Trash2,
  UserPlus,
  Warehouse,
  X,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import { Topbar } from '@/components/topbar';
import { AutocompleteDireccion } from '@/components/autocomplete-direccion';
import {
  NuevoPropietarioDialog,
  type PropietarioCreado,
} from '@/components/nuevo-propietario-dialog';
import { apiEnabled, subirArchivo } from '@/lib/api/client';
import { useCrearPropiedad, useMercado, usePropiedades, usePropietarios } from '@/lib/api/hooks';
import { propietariosMock } from '@/lib/mock-data';
import {
  type PropietarioExtra,
  listarPropietariosExtra,
} from '@/lib/propietarios-extra-storage';
import { calcularResumenPlan, resumenPara } from '@/lib/plan';
import { formatMonto } from '@/lib/format';
import type { TipoPropiedad } from '@/lib/types';

// `llevaPiso`: solo las unidades DENTRO de un edificio piden piso/depto. Una
// casa o un galpón no → el campo se oculta cuando es false (pedido del usuario:
// "si pongo casa no ponga piso"). `ambientesLabel`: en un local/galpón "3
// ambientes" no aplica; se pide la superficie.
const tipos: Array<{
  value: TipoPropiedad;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  llevaPiso: boolean;
  llevaAmbientes: boolean;
}> = [
  { value: 'DEPARTAMENTO', label: 'Departamento', icon: Home, llevaPiso: true, llevaAmbientes: true },
  { value: 'CASA', label: 'Casa', icon: Home, llevaPiso: false, llevaAmbientes: true },
  { value: 'LOCAL', label: 'Local comercial', icon: Store, llevaPiso: true, llevaAmbientes: false },
  { value: 'GALPON', label: 'Galpón', icon: Warehouse, llevaPiso: false, llevaAmbientes: false },
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

interface PropietarioAsignado {
  /** UUID local en el form; no es el id del propietario. */
  rowId: string;
  /** id del propietario seleccionado (mock o extra). */
  propietarioId: string;
  porcentaje: number;
}

export default function NuevaPropiedadPage() {
  // El alta de propiedad ya está cableada al API: en prod hace POST /propiedades
  // con propietarios reales; en demo (!apiEnabled) sigue el flujo local de antes.
  return <NuevaPropiedadForm />;
}

function NuevaPropiedadForm() {
  const router = useRouter();
  const { crear: crearPropiedad } = useCrearPropiedad();
  // Propietarios reales del API (prod). En demo el hook devuelve propietariosMock,
  // pero ahí seguimos usando el catálogo local (mock + extras de localStorage).
  const { propietarios: propietariosApi } = usePropietarios();
  // País de la inmobiliaria (config Mercado): acota el autocompletado de
  // direcciones a ese país (default AR). Sin esto Nominatim mezclaba LatAm.
  const { config: mercado } = useMercado();
  const paisCodigo = mercado?.codigo ?? 'AR';
  // Cartera existente: para avisar (no bloquear) si la dirección ya está cargada.
  const { propiedades: propiedadesExistentes } = usePropiedades();

  // Tipo + dirección
  const [tipo, setTipo] = useState<TipoPropiedad | ''>('');
  const [calle, setCalle] = useState('');
  const [altura, setAltura] = useState('');
  const [pisoDpto, setPisoDpto] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [provincia, setProvincia] = useState('Buenos Aires');
  const [codigoPostal, setCodigoPostal] = useState('');

  // Características
  const [ambientes, setAmbientes] = useState('');
  const [m2, setM2] = useState('');

  // Foto (opcional): se elige acá con preview local (blob) y se SUBE recién al
  // guardar (POST /uploads → fotoUrl) — sin archivos huérfanos si abandona.
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  // El mapa eligió una calle sin número → resaltamos Altura para completarla.
  const [alturaPendiente, setAlturaPendiente] = useState(false);
  const alturaRef = useRef<HTMLInputElement>(null);
  // El tipo se pre-seleccionó desde el edificio de OSM (mostrable + pisable).
  const [tipoSugeridoPorMapa, setTipoSugeridoPorMapa] = useState(false);

  // Propietarios (multi)
  const [propietariosExtra, setPropietariosExtra] = useState<PropietarioExtra[]>(
    () => listarPropietariosExtra(),
  );
  const [asignados, setAsignados] = useState<PropietarioAsignado[]>([
    { rowId: rid(), propietarioId: '', porcentaje: 100 },
  ]);
  const [conDivision, setConDivision] = useState(false);
  const [nuevoPropOpen, setNuevoPropOpen] = useState(false);

  // Metadata del tipo elegido: qué campos aplican. Sin tipo aún, asumimos que
  // lleva todo (no ocultamos nada hasta que elija).
  const tipoMeta = tipos.find((t) => t.value === tipo);
  const llevaPiso = tipoMeta?.llevaPiso ?? true;
  const llevaAmbientes = tipoMeta?.llevaAmbientes ?? true;

  // Al pasar a un tipo que NO lleva piso (casa/galpón), limpiamos el valor para
  // no arrastrar "8°C" oculto al payload de la dirección.
  useEffect(() => {
    if (!llevaPiso && pisoDpto) setPisoDpto('');
    if (!llevaAmbientes && ambientes) setAmbientes('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llevaPiso, llevaAmbientes]);

  // El blob del preview vive hasta que se reemplaza la foto o se desmonta.
  useEffect(() => {
    return () => {
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    };
  }, [fotoPreview]);

  const elegirFoto = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Elegí una imagen', description: 'JPG, PNG, WEBP o HEIC.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Foto muy pesada', description: 'El máximo es 10 MB.' });
      return;
    }
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const quitarFoto = () => {
    setFotoFile(null);
    setFotoPreview(null);
    if (fotoInputRef.current) fotoInputRef.current.value = '';
  };

  // Altura: numérica, con la única excepción "S/N" (calles sin numerar). Se
  // permite el tipeo progresivo de S → S/ → S/N; cualquier otra letra no entra.
  const sanitizarAltura = (v: string) => {
    const up = v.toUpperCase();
    if (/^\d*$/.test(up) || 'S/N'.startsWith(up)) {
      setAltura(up);
      if (alturaPendiente && up) setAlturaPendiente(false);
    }
  };

  // El contrato (monto, vigencia, ajustes, comisión) NO se carga acá: el
  // endpoint POST /propiedades sólo da de alta la propiedad + participaciones, y
  // antes este form recolectaba el contrato pero en prod NO se persistía (trampa
  // de valor). Ahora, al guardar, encadenamos al alta del contrato con la
  // propiedad ya seleccionada (/contratos/nuevo?propiedad=<id>).

  // Flow
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Plan: comparamos actual vs después de sumar esta propiedad
  const planActual = useMemo(() => calcularResumenPlan(), []);
  const planNuevo = useMemo(
    () => resumenPara(planActual.propiedadesActivas + 1),
    [planActual.propiedadesActivas],
  );
  const haySaltoDePlan = planNuevo.key !== planActual.key;
  const diferenciaCosto = planNuevo.costoMensualTotal - planActual.costoMensualTotal;

  // Catálogo de propietarios para el selector:
  //  - Prod (apiEnabled): los propietarios REALES del API (usePropietarios).
  //  - Demo: mock + los creados al vuelo en localStorage (esNuevo).
  const todosLosPropietarios = useMemo(
    () =>
      apiEnabled
        ? propietariosApi.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            apellido: p.apellido,
            esNuevo: false,
          }))
        : [
            ...propietariosExtra.map((p) => ({
              id: p.id,
              nombre: p.nombre,
              apellido: p.apellido,
              esNuevo: true,
            })),
            ...propietariosMock.map((p) => ({
              id: p.id,
              nombre: p.nombre,
              apellido: p.apellido,
              esNuevo: false,
            })),
          ],
    [propietariosApi, propietariosExtra],
  );

  // Auto-redistribuir % cuando se cambia conDivision o se agrega/quita
  const propietariosVisibles = conDivision
    ? asignados
    : [{ ...asignados[0]!, porcentaje: 100 }];
  const totalPct = propietariosVisibles.reduce((s, p) => s + (p.porcentaje || 0), 0);
  const pctValido = !conDivision || totalPct === 100;

  // El mismo propietario no puede aparecer en dos slots: la PK compuesta
  // (propiedadId, propietarioId) lo rechaza en el backend → sin esta guarda el
  // alta pasaba la validación y reventaba con un toast genérico en prod.
  const propietarioIds = propietariosVisibles.map((p) => p.propietarioId).filter(Boolean);
  const hayPropietarioDuplicado = new Set(propietarioIds).size !== propietarioIds.length;

  // Validación
  const propietariosValidos =
    propietariosVisibles.every((p) => !!p.propietarioId) && pctValido && !hayPropietarioDuplicado;

  const formValido =
    !!tipo &&
    calle.trim().length >= 3 &&
    altura.trim().length >= 1 &&
    ciudad.trim().length >= 2 &&
    propietariosValidos;

  // Aviso (NO bloqueo) si ya hay una propiedad con la misma calle + altura en la
  // misma ciudad: evita el alta duplicada por tipeo, sin impedir un edificio con
  // varias unidades en la misma altura (por eso avisa, no frena).
  const direccionYaCargada = useMemo(() => {
    const c = calle.trim().toLowerCase();
    const a = altura.trim().toLowerCase();
    const ci = ciudad.trim().toLowerCase();
    if (c.length < 3 || !a) return false;
    // La altura tiene que coincidir como TOKEN entero, no como substring: sin
    // esto "Rivadavia 1" marcaba duplicado contra "Rivadavia 123" (el "1" está
    // dentro de "123"). Bordes = inicio/fin o cualquier no-alfanumérico.
    const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const alturaRe = new RegExp(`(^|[^0-9a-z])${escaped}([^0-9a-z]|$)`, 'i');
    return propiedadesExistentes.some(({ propiedad }) => {
      const dir = (propiedad.direccion ?? '').toLowerCase();
      const coincideCiudad = !ci || (propiedad.ciudad ?? '').toLowerCase() === ci;
      return coincideCiudad && dir.includes(c) && alturaRe.test(dir);
    });
  }, [calle, altura, ciudad, propiedadesExistentes]);

  // Qué falta para poder cargar — así el botón deshabilitado no es un misterio.
  const motivosFaltantes: string[] = [];
  if (!tipo) motivosFaltantes.push('Elegí el tipo de propiedad');
  if (calle.trim().length < 3) motivosFaltantes.push('Completá la calle');
  if (altura.trim().length < 1) motivosFaltantes.push('Completá la altura');
  if (ciudad.trim().length < 2) motivosFaltantes.push('Completá la ciudad / localidad');
  if (!propietariosVisibles.every((p) => !!p.propietarioId)) motivosFaltantes.push('Asigná un propietario');
  if (!pctValido) motivosFaltantes.push(`La división tiene que sumar 100% (hoy suma ${totalPct}%)`);
  if (hayPropietarioDuplicado) motivosFaltantes.push('El mismo propietario no puede aparecer dos veces');

  // Acciones propietarios
  const agregarSlotPropietario = () => {
    setAsignados((prev) => {
      const restante = Math.max(0, 100 - prev.reduce((s, p) => s + p.porcentaje, 0));
      return [
        ...prev,
        { rowId: rid(), propietarioId: '', porcentaje: restante },
      ];
    });
  };

  const removerSlot = (rowId: string) => {
    setAsignados((prev) => {
      const filtrado = prev.filter((p) => p.rowId !== rowId);
      if (filtrado.length === 0) {
        return [{ rowId: rid(), propietarioId: '', porcentaje: 100 }];
      }
      // Redistribuir el restante al primero
      const suma = filtrado.reduce((s, p) => s + p.porcentaje, 0);
      if (suma !== 100 && filtrado[0]) {
        filtrado[0] = { ...filtrado[0], porcentaje: filtrado[0].porcentaje + (100 - suma) };
      }
      return filtrado;
    });
  };

  const actualizarSlot = (rowId: string, patch: Partial<PropietarioAsignado>) => {
    setAsignados((prev) =>
      prev.map((p) => (p.rowId === rowId ? { ...p, ...patch } : p)),
    );
  };

  // Tras crear un propietario en el dialog, lo asignamos al slot vacío más reciente.
  // En demo lo sumamos al catálogo local; en prod ya entra por la invalidación de
  // ['propietarios'] del hook (no tocamos el state local de extras).
  const onPropietarioCreado = (nuevo: PropietarioCreado) => {
    if (!apiEnabled) {
      setPropietariosExtra((prev) => [nuevo as PropietarioExtra, ...prev]);
    }
    setAsignados((prev) => {
      const idxVacio = prev.findIndex((p) => !p.propietarioId);
      if (idxVacio === -1) {
        const restante = Math.max(0, 100 - prev.reduce((s, p) => s + p.porcentaje, 0));
        return [
          ...prev,
          { rowId: rid(), propietarioId: nuevo.id, porcentaje: restante },
        ];
      }
      const copia = [...prev];
      copia[idxVacio] = { ...copia[idxVacio]!, propietarioId: nuevo.id };
      return copia;
    });
  };

  const guardar = async () => {
    setEnviando(true);

    // Prod: POST /propiedades con el payload del contrato del API. El contrato
    // (sección opcional) NO se manda acá: este endpoint sólo da de alta la
    // propiedad + participaciones. En demo, simulamos y redirigimos como antes.
    if (apiEnabled) {
      const direccion = `${calle.trim()} ${altura.trim()}${
        pisoDpto.trim() ? ` ${pisoDpto.trim()}` : ''
      }`.trim();
      const participaciones = propietariosVisibles.map((p) => ({
        propietarioId: p.propietarioId,
        porcentaje: p.porcentaje,
      }));
      // Validación dura: porcentajes deben sumar 100 antes de enviar.
      const sumaPct = participaciones.reduce((s, p) => s + p.porcentaje, 0);
      if (sumaPct !== 100) {
        setEnviando(false);
        setConfirmando(false);
        toast({
          variant: 'destructive',
          title: 'La división no suma 100%',
          description: `Los porcentajes de los propietarios suman ${sumaPct}%. Ajustalos para que den 100%.`,
        });
        return;
      }
      const ambientesNum = Number(ambientes);
      const m2Num = Number(m2);
      // Foto: se sube AHORA (no al elegirla) → si el usuario abandonaba el form
      // no quedaban archivos huérfanos en el Volume. Si falla, avisamos y NO
      // creamos la propiedad a medias (que reintente).
      let fotoUrl: string | undefined;
      if (fotoFile) {
        try {
          fotoUrl = (await subirArchivo(fotoFile)).url;
        } catch (err) {
          setEnviando(false);
          setConfirmando(false);
          toast({
            variant: 'destructive',
            title: 'No pudimos subir la foto',
            description:
              err instanceof Error ? err.message : 'Probá de nuevo o quitá la foto para cargar sin ella.',
          });
          return;
        }
      }
      try {
        const creada = await crearPropiedad({
          direccion,
          ciudad: ciudad.trim(),
          provincia,
          tipo: tipo as TipoPropiedad,
          ...(ambientes && Number.isFinite(ambientesNum) ? { ambientes: ambientesNum } : {}),
          ...(m2 && Number.isFinite(m2Num) ? { m2: m2Num } : {}),
          ...(fotoUrl ? { fotoUrl } : {}),
          propietarios: participaciones,
        });
        setEnviando(false);
        setConfirmando(false);
        toast({
          variant: 'success',
          title: '¡Propiedad cargada!',
          description: 'Ahora cargale el alquiler para verla andando.',
        });
        // Encadenamos al alta del contrato con la propiedad ya elegida: es el
        // "momento ajá" (ver cobros/mora/agenda). Si todavía no hay inquilino,
        // desde ahí puede cancelar y la propiedad ya quedó en su cartera.
        router.push(`/contratos/nuevo?propiedad=${creada.id}`);
      } catch (err) {
        setEnviando(false);
        setConfirmando(false);
        toast({
          variant: 'destructive',
          title: 'No se pudo cargar la propiedad',
          description: err instanceof Error ? err.message : 'Probá de nuevo en un momento.',
        });
      }
      return;
    }

    await new Promise((r) => setTimeout(r, 600));
    setEnviando(false);
    setConfirmando(false);
    toast({
      variant: 'success',
      title: '¡Propiedad cargada!',
      description: 'Ya forma parte de tu cartera. Cuando tengas inquilino, cargale el contrato.',
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

        {/* Aviso de cambio de plan al sumar la propiedad */}
        <Card
          className={
            haySaltoDePlan
              ? 'border-amber-300 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10'
              : 'border-primary/30 bg-primary/5'
          }
        >
          <CardContent className="flex items-start gap-3 p-4">
            <div
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                haySaltoDePlan
                  ? 'bg-amber-500 text-white'
                  : 'bg-primary text-primary-foreground'
              }`}
            >
              <Building2 className="h-4 w-4" />
            </div>
            <div className="flex-1 text-sm">
              {haySaltoDePlan ? (
                <>
                  <p>
                    Con esta propiedad pasás de <strong>{planActual.plan}</strong>{' '}
                    a <strong>{planNuevo.plan}</strong>.
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Tu factura mensual sube de{' '}
                    <strong className="tabular-nums text-foreground">
                      {formatMonto(planActual.costoMensualTotal)}
                    </strong>{' '}
                    a{' '}
                    <strong className="tabular-nums text-foreground">
                      {formatMonto(planNuevo.costoMensualTotal)}
                    </strong>{' '}
                    (+{formatMonto(diferenciaCosto)}).{' '}
                    {planNuevo.topePlan !== null
                      ? `Incluye hasta ${planNuevo.topePlan} propiedades.`
                      : 'Sin tope de propiedades.'}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Seguís en <strong>{planActual.plan}</strong> ·{' '}
                    <strong className="tabular-nums">
                      {formatMonto(planActual.costoMensualTotal)}
                    </strong>{' '}
                    / mes (sin cambios).
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {planActual.topePlan !== null && planActual.propiedadesParaProximo
                      ? `Te quedan ${planActual.propiedadesParaProximo} propiedad${
                          planActual.propiedadesParaProximo === 1 ? '' : 'es'
                        } antes de pasar a ${planActual.proximoTramo?.nombre ?? 'el siguiente plan'}.`
                      : 'Sumá las que necesites, no cambia el precio del plan.'}
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            {/* Tipo */}
            <Card>
              <CardContent className="space-y-4 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Tipo de propiedad{' '}
                  <span aria-hidden="true" className="text-destructive">*</span>
                </h3>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {tipos.map((t) => {
                    const Icon = t.icon;
                    const activo = tipo === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => {
                          setTipo(t.value);
                          // Elección manual: la nota "sugerido por el mapa" ya no aplica.
                          setTipoSugeridoPorMapa(false);
                        }}
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
                {tipoSugeridoPorMapa && tipoMeta && (
                  <p className="flex items-center gap-1.5 text-[11px] text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Sugerido por el mapa: el edificio figura como{' '}
                    {tipoMeta.label.toLowerCase()}. Cambialo si no es así.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Dirección */}
            <Card>
              <CardContent className="space-y-4 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Dirección
                </h3>
                <AutocompleteDireccion
                  paisCodigo={paisCodigo}
                  onElegir={(d) => {
                    if (d.calle) setCalle(d.calle);
                    if (d.altura) setAltura(d.altura.toUpperCase());
                    if (d.ciudad) setCiudad(d.ciudad);
                    // provincia es un select cerrado: solo la seteamos si coincide con
                    // una de las opciones (AR); si no, el usuario la elige a mano.
                    const prov = d.provincia ? provincias.find((p) => p === d.provincia) : undefined;
                    if (prov) setProvincia(prov);
                    if (d.codigoPostal) setCodigoPostal(d.codigoPostal.replace(/[^A-Za-z0-9]/g, '').slice(0, 8));
                    // OSM conoce el edificio → pre-elegimos el tipo, SOLO si el
                    // usuario todavía no eligió uno (nunca pisamos su elección).
                    if (d.tipoSugerido && !tipo) {
                      setTipo(d.tipoSugerido);
                      setTipoSugeridoPorMapa(true);
                    }
                    // El mapa no trajo el número → resaltamos Altura y llevamos
                    // el foco ahí para que no quede la dirección a medias.
                    if (d.alturaFaltante && !d.altura) {
                      setAlturaPendiente(true);
                      setTimeout(() => alturaRef.current?.focus(), 50);
                    } else {
                      setAlturaPendiente(false);
                    }
                  }}
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="calle">
                      Calle{' '}
                      <span aria-hidden="true" className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="calle"
                      value={calle}
                      onChange={(e) => setCalle(e.target.value)}
                      placeholder="Av. Rivadavia"
                      required
                      aria-required="true"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="altura">
                      Altura{' '}
                      <span aria-hidden="true" className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="altura"
                      ref={alturaRef}
                      value={altura}
                      onChange={(e) => sanitizarAltura(e.target.value)}
                      placeholder="6420 o S/N"
                      inputMode="numeric"
                      required
                      aria-required="true"
                      className={
                        alturaPendiente
                          ? 'border-amber-400 ring-2 ring-amber-300/60 focus-visible:ring-amber-400'
                          : undefined
                      }
                    />
                    {alturaPendiente && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        El mapa no trajo el número — completalo (o poné S/N).
                      </p>
                    )}
                  </div>
                  {/* Piso/Dto solo para unidades dentro de un edificio (depto/
                      local). Una casa o galpón no lleva → se oculta. */}
                  {llevaPiso && (
                    <div className="space-y-2">
                      <Label htmlFor="pisoDpto" className="flex items-center gap-1.5">
                        Piso / Dto
                        <span className="text-[10px] font-normal text-muted-foreground">opcional</span>
                      </Label>
                      <Input
                        id="pisoDpto"
                        value={pisoDpto}
                        onChange={(e) => setPisoDpto(e.target.value)}
                        placeholder="8°C"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="ciudad">
                      Ciudad / Localidad{' '}
                      <span aria-hidden="true" className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="ciudad"
                      value={ciudad}
                      onChange={(e) => setCiudad(e.target.value)}
                      placeholder="Caballito"
                      required
                      aria-required="true"
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
                  <div className="space-y-2">
                    <Label htmlFor="codigoPostal">Código postal</Label>
                    <Input
                      id="codigoPostal"
                      value={codigoPostal}
                      onChange={(e) =>
                        setCodigoPostal(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 8))
                      }
                      placeholder="C1424"
                    />
                  </div>
                </div>
                {direccionYaCargada && (
                  <p className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Ya tenés una propiedad cargada en esta dirección. Si es otra unidad
                      del mismo edificio, seguí; si no, revisá para no duplicarla.
                    </span>
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Características */}
            <Card>
              <CardContent className="space-y-4 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Características
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Ambientes solo para vivienda (depto/casa). Un local o galpón
                      se mide por superficie, no por ambientes → se oculta. */}
                  {llevaAmbientes && (
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
                  )}
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
                {/* Foto (opcional): preview local; se sube al Volume al guardar. */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    Foto
                    <span className="text-[10px] font-normal text-muted-foreground">opcional</span>
                  </Label>
                  <input
                    ref={fotoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => elegirFoto(e.target.files?.[0] ?? null)}
                  />
                  {fotoPreview ? (
                    <div className="flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={fotoPreview}
                        alt="Foto de la propiedad"
                        className="h-24 w-32 rounded-lg border object-cover"
                      />
                      <div className="space-y-1.5">
                        <p className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {fotoFile?.name}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fotoInputRef.current?.click()}
                          >
                            Cambiar
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={quitarFoto}>
                            <X className="h-3.5 w-3.5" />
                            Quitar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fotoInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      <ImagePlus className="h-4 w-4" />
                      Subir una foto de la propiedad
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Propietarios (multi) */}
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Propietarios
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConDivision((v) => !v)}
                      aria-pressed={conDivision}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        conDivision
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      {conDivision ? 'Con división %' : 'Sin división'}
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setNuevoPropOpen(true)}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Nuevo propietario
                    </Button>
                  </div>
                </div>

                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {conDivision ? (
                    <>
                      <strong className="text-foreground">Con división %:</strong> indicá qué porcentaje
                      del alquiler le corresponde a cada propietario. Tiene que sumar 100%.
                    </>
                  ) : (
                    <>
                      Un solo dueño se queda con el 100% del alquiler. Si la propiedad tiene{' '}
                      <strong className="text-foreground">más de un propietario</strong>, activá{' '}
                      <strong className="text-foreground">«Con división %»</strong> para repartir el
                      alquiler entre ellos.
                    </>
                  )}
                </p>

                {todosLosPropietarios.length === 0 ? (
                  <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
                    <p className="text-sm">
                      Toda propiedad necesita al menos un dueño asignado, y todavía
                      no cargaste ninguno. Empecemos por ahí.
                    </p>
                    <Button type="button" onClick={() => setNuevoPropOpen(true)}>
                      <UserPlus className="h-4 w-4" />
                      Agregar el propietario
                    </Button>
                  </div>
                ) : (
                <div className="space-y-2">
                  {(conDivision ? asignados : asignados.slice(0, 1)).map((slot, idx) => (
                    <div
                      key={slot.rowId}
                      className="grid gap-2 rounded-lg border bg-muted/20 p-3 md:grid-cols-[1fr_120px_auto]"
                    >
                      <Select
                        value={slot.propietarioId}
                        onValueChange={(v) => actualizarSlot(slot.rowId, { propietarioId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Elegí un propietario..." />
                        </SelectTrigger>
                        <SelectContent>
                          {todosLosPropietarios.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              <span className="flex items-center gap-2">
                                {o.nombre} {o.apellido}
                                {o.esNuevo && (
                                  <Badge variant="outline" className="text-[9px]">
                                    nuevo
                                  </Badge>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {conDivision ? (
                        <div className="relative">
                          <Input
                            aria-label="Porcentaje de participación del propietario"
                            value={slot.porcentaje.toString()}
                            onChange={(e) =>
                              actualizarSlot(slot.rowId, {
                                porcentaje: Math.max(
                                  0,
                                  Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0),
                                ),
                              })
                            }
                            inputMode="numeric"
                            className="pr-8"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            %
                          </span>
                        </div>
                      ) : (
                        <p className="grid place-items-center rounded-md border bg-background px-3 text-xs text-muted-foreground">
                          100% (único)
                        </p>
                      )}
                      {conDivision && asignados.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removerSlot(slot.rowId)}
                          aria-label={`Quitar propietario ${idx + 1}`}
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                )}

                {conDivision && (
                  <div className="flex items-center justify-between">
                    <Button type="button" size="sm" variant="outline" onClick={agregarSlotPropietario}>
                      <Plus className="h-3.5 w-3.5" />
                      Sumar otro propietario
                    </Button>
                    <p
                      className={`text-xs tabular-nums ${
                        pctValido ? 'text-muted-foreground' : 'text-destructive'
                      }`}
                    >
                      Total: {totalPct}% {pctValido ? '✓' : '(debe sumar 100%)'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* El contrato (monto, vigencia, ajustes, comisión) NO se carga acá:
                este form sólo da de alta la propiedad + dueños. Antes recolectaba
                el contrato y en prod NO se persistía (trampa de valor). Ahora, al
                guardar, te llevamos al alta del contrato con la propiedad elegida. */}
            <Card className="border-dashed">
              <CardContent className="flex items-start gap-3 p-5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="text-sm">
                  <h3 className="font-semibold">El alquiler va en el próximo paso</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Primero cargás la propiedad y su dueño. Apenas la guardes, te
                    llevamos a cargar el contrato (monto, vigencia, ajustes) con esta
                    propiedad ya seleccionada.
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
                  <ResumenRow
                    label="Ciudad"
                    value={ciudad ? `${ciudad}${codigoPostal ? ` (${codigoPostal})` : ''}` : '—'}
                  />
                  <ResumenRow label="Foto" value={fotoFile ? 'Cargada ✓' : '—'} />
                  <ResumenRow
                    label="Propietarios"
                    value={
                      propietariosVisibles.filter((p) => p.propietarioId).length === 0
                        ? '—'
                        : propietariosVisibles
                            .filter((p) => p.propietarioId)
                            .map((p) => {
                              const o = todosLosPropietarios.find((x) => x.id === p.propietarioId);
                              if (!o) return '?';
                              const tag = conDivision ? ` (${p.porcentaje}%)` : '';
                              return `${o.nombre} ${o.apellido}${tag}`;
                            })
                            .join(', ')
                    }
                  />
                </div>

                <div
                  className={`space-y-1 rounded-lg border p-3 text-sm ${
                    haySaltoDePlan
                      ? 'border-amber-300 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10'
                      : 'border-primary/20 bg-primary/5'
                  }`}
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {haySaltoDePlan ? 'Cambio de plan' : 'Plan'}
                  </p>
                  {haySaltoDePlan ? (
                    <>
                      <p className="text-base font-semibold">
                        {planActual.plan} → {planNuevo.plan}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatMonto(planActual.costoMensualTotal)} →{' '}
                        <strong className="text-foreground tabular-nums">
                          {formatMonto(planNuevo.costoMensualTotal)}
                        </strong>{' '}
                        / mes
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-base font-semibold tabular-nums text-primary">
                        {planActual.plan} · {formatMonto(planActual.costoMensualTotal)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Sin cambios en tu factura.
                      </p>
                    </>
                  )}
                </div>

                {!formValido && motivosFaltantes.length > 0 && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-800">
                    <p className="font-semibold">Para cargar la propiedad falta:</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {motivosFaltantes.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button
                  size="lg"
                  className="w-full"
                  disabled={!formValido}
                  title={formValido ? undefined : `Falta: ${motivosFaltantes.join(' · ')}`}
                  // Sin salto de plan (caso típico de la 1ª propiedad) guardamos
                  // directo: no metemos un diálogo de confirmación de costo cuando
                  // no cambia la factura. El ConfirmDialog queda sólo para el salto.
                  onClick={() => (haySaltoDePlan ? setConfirmando(true) : guardar())}
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

                {haySaltoDePlan && (
                  <p className="text-center text-[11px] text-muted-foreground">
                    Aceptás que esta acción sube tu plan y modifica tu próxima factura.
                  </p>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      <NuevoPropietarioDialog
        open={nuevoPropOpen}
        onOpenChange={setNuevoPropOpen}
        onCreated={onPropietarioCreado}
      />

      <ConfirmDialog
        open={confirmando}
        onOpenChange={setConfirmando}
        title="¿Sumar esta propiedad?"
        description={
          <div className="space-y-1 pt-2 text-sm">
            {haySaltoDePlan ? (
              <>
                <p>
                  Con esta propiedad pasás de <strong>{planActual.plan}</strong>{' '}
                  a <strong>{planNuevo.plan}</strong>.
                </p>
                <p className="text-xs text-muted-foreground">
                  Tu factura mensual pasa de{' '}
                  {formatMonto(planActual.costoMensualTotal)} a{' '}
                  <strong className="text-foreground">
                    {formatMonto(planNuevo.costoMensualTotal)}
                  </strong>
                  . El cambio se aplica desde la próxima facturación.
                </p>
              </>
            ) : (
              <>
                <p>
                  Seguís en <strong>{planActual.plan}</strong>, no cambia el
                  precio del plan ({formatMonto(planActual.costoMensualTotal)} /
                  mes).
                </p>
                <p className="text-xs text-muted-foreground">
                  Podés bajarla cuando quieras desde el panel.
                </p>
              </>
            )}
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
      <span className="text-right text-sm font-medium break-words max-w-[60%]">
        {value}
      </span>
    </div>
  );
}

function rid() {
  return Math.random().toString(36).slice(2, 10);
}
