'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Home,
  Plus,
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
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { Topbar } from '@/components/topbar';
import {
  NuevoPropietarioDialog,
  type PropietarioCreado,
} from '@/components/nuevo-propietario-dialog';
import { apiEnabled } from '@/lib/api/client';
import { useCrearPropiedad, usePropietarios } from '@/lib/api/hooks';
import { propietariosMock } from '@/lib/mock-data';
import {
  type PropietarioExtra,
  listarPropietariosExtra,
} from '@/lib/propietarios-extra-storage';
import { calcularResumenPlan, resumenPara } from '@/lib/plan';
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

type Moneda = 'ARS' | 'USD';
type IndiceAjuste = 'ICL' | 'IPC' | 'CASA_PROPIA' | 'OTRO';

interface PropietarioAsignado {
  /** UUID local en el form; no es el id del propietario. */
  rowId: string;
  /** id del propietario seleccionado (mock o extra). */
  propietarioId: string;
  porcentaje: number;
}

const REQUISITOS_BASE = [
  { id: 'garantia_propietaria', label: 'Garantía propietaria' },
  { id: 'garante', label: 'Garante (recibo de sueldo)' },
  { id: 'seguro_caucion', label: 'Seguro de caución' },
  { id: 'deposito', label: 'Depósito (1 mes)' },
  { id: 'recibo_sueldo', label: 'Recibo de sueldo del inquilino' },
  { id: 'dni_frente_dorso', label: 'DNI frente y dorso' },
];

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
  const [notas, setNotas] = useState('');

  // Propietarios (multi)
  const [propietariosExtra, setPropietariosExtra] = useState<PropietarioExtra[]>(
    () => listarPropietariosExtra(),
  );
  const [asignados, setAsignados] = useState<PropietarioAsignado[]>([
    { rowId: rid(), propietarioId: '', porcentaje: 100 },
  ]);
  const [conDivision, setConDivision] = useState(false);
  const [nuevoPropOpen, setNuevoPropOpen] = useState(false);

  // Contrato (opcional)
  const [contratoActivado, setContratoActivado] = useState(false);
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('ARS');
  const [fechaInicio, setFechaInicio] = useState('');
  const [duracionMeses, setDuracionMeses] = useState('36');
  const [periodicidadAjuste, setPeriodicidadAjuste] = useState('3'); // meses
  const [indiceAjuste, setIndiceAjuste] = useState<IndiceAjuste>('ICL');
  const [comisionPct, setComisionPct] = useState('5');
  const [requisitos, setRequisitos] = useState<string[]>(['garantia_propietaria', 'recibo_sueldo']);
  const [requisitosExtra, setRequisitosExtra] = useState('');

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

  const contratoValido =
    !contratoActivado ||
    (Number(monto) > 0 &&
      fechaInicio.length === 10 &&
      Number(duracionMeses) > 0 &&
      Number(periodicidadAjuste) > 0 &&
      Number(comisionPct) >= 0);

  const formValido =
    !!tipo &&
    calle.trim().length >= 3 &&
    altura.trim().length >= 1 &&
    ciudad.trim().length >= 2 &&
    propietariosValidos &&
    contratoValido;

  // Qué falta para poder cargar — así el botón deshabilitado no es un misterio.
  const motivosFaltantes: string[] = [];
  if (!tipo) motivosFaltantes.push('Elegí el tipo de propiedad');
  if (calle.trim().length < 3) motivosFaltantes.push('Completá la calle');
  if (altura.trim().length < 1) motivosFaltantes.push('Completá la altura');
  if (ciudad.trim().length < 2) motivosFaltantes.push('Completá la ciudad / localidad');
  if (!propietariosVisibles.every((p) => !!p.propietarioId)) motivosFaltantes.push('Asigná un propietario');
  if (!pctValido) motivosFaltantes.push(`La división tiene que sumar 100% (hoy suma ${totalPct}%)`);
  if (hayPropietarioDuplicado) motivosFaltantes.push('El mismo propietario no puede aparecer dos veces');
  if (contratoActivado && !contratoValido) motivosFaltantes.push('Completá los datos del contrato (monto, fecha, duración)');

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

  const toggleRequisito = (id: string) => {
    setRequisitos((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
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
      try {
        const creada = await crearPropiedad({
          direccion,
          ciudad: ciudad.trim(),
          provincia,
          tipo: tipo as TipoPropiedad,
          ...(ambientes && Number.isFinite(ambientesNum) ? { ambientes: ambientesNum } : {}),
          ...(m2 && Number.isFinite(m2Num) ? { m2: m2Num } : {}),
          propietarios: participaciones,
        });
        setEnviando(false);
        setConfirmando(false);
        toast({
          variant: 'success',
          title: '¡Propiedad cargada!',
          description: 'Ya forma parte de tu cartera.',
        });
        router.push(`/propiedades/${creada.id}`);
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
      description: contratoActivado
        ? 'Propiedad + contrato listos. Ahora podés invitar al inquilino.'
        : 'Ya forma parte de tu cartera. Cuando tengas inquilino, cargale el contrato.',
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
                      ? `Te quedan ${planActual.propiedadesParaProximo - 1} propiedad${
                          planActual.propiedadesParaProximo - 1 === 1 ? '' : 'es'
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
                        aria-pressed={activo}
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

            {/* Dirección */}
            <Card>
              <CardContent className="space-y-4 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Dirección
                </h3>
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
                      value={altura}
                      onChange={(e) => setAltura(e.target.value)}
                      placeholder="6420"
                      inputMode="numeric"
                      required
                      aria-required="true"
                    />
                  </div>
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
              </CardContent>
            </Card>

            {/* Características */}
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
                  <Label htmlFor="notas" className="flex items-center gap-1.5">
                    Notas internas
                    <span className="text-[10px] font-normal text-muted-foreground">opcional</span>
                  </Label>
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

            {/* Contrato (opcional) */}
            <Card>
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => setContratoActivado((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 p-5 text-left"
                >
                  <div className="flex items-center gap-2">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">Datos del contrato</h3>
                      <p className="text-xs text-muted-foreground">
                        Si ya hay un alquiler firmado, cargá monto, vigencia, ajustes y comisión.
                      </p>
                    </div>
                  </div>
                  {contratoActivado ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {contratoActivado && (
                  <div className="space-y-5 border-t p-5">
                    {/* Monto */}
                    <div className="grid gap-3 md:grid-cols-[1fr_140px]">
                      <div className="space-y-1.5">
                        <Label htmlFor="monto">Alquiler mensual</Label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            $
                          </span>
                          <Input
                            id="monto"
                            inputMode="numeric"
                            value={monto}
                            onChange={(e) =>
                              setMonto(e.target.value.replace(/\D/g, '').slice(0, 12))
                            }
                            placeholder="480000"
                            className="pl-7"
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

                    {/* Vigencia */}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="fechaInicio">Inicio del contrato</Label>
                        <Input
                          id="fechaInicio"
                          type="date"
                          value={fechaInicio}
                          onChange={(e) => setFechaInicio(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="duracion">Duración total</Label>
                        <div className="flex gap-2">
                          <Input
                            id="duracion"
                            inputMode="numeric"
                            value={duracionMeses}
                            onChange={(e) =>
                              setDuracionMeses(e.target.value.replace(/\D/g, '').slice(0, 3))
                            }
                            placeholder="36"
                            className="w-24"
                          />
                          <p className="grid flex-1 place-items-center rounded-md border bg-muted/40 px-3 text-xs text-muted-foreground">
                            meses
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Ajustes */}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="periodicidad">Ajuste cada</Label>
                        <Select
                          value={periodicidadAjuste}
                          onValueChange={setPeriodicidadAjuste}
                        >
                          <SelectTrigger id="periodicidad">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3 meses</SelectItem>
                            <SelectItem value="4">4 meses</SelectItem>
                            <SelectItem value="6">6 meses</SelectItem>
                            <SelectItem value="12">12 meses</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="indice">Índice de ajuste</Label>
                        <Select
                          value={indiceAjuste}
                          onValueChange={(v) => setIndiceAjuste(v as IndiceAjuste)}
                        >
                          <SelectTrigger id="indice">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ICL">ICL (BCRA)</SelectItem>
                            <SelectItem value="IPC">IPC (INDEC)</SelectItem>
                            <SelectItem value="CASA_PROPIA">Casa Propia</SelectItem>
                            <SelectItem value="OTRO">Otro / a convenir</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Comisión */}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="comision">Comisión inmobiliaria</Label>
                        <div className="relative">
                          <Input
                            id="comision"
                            inputMode="numeric"
                            value={comisionPct}
                            onChange={(e) =>
                              setComisionPct(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))
                            }
                            placeholder="5"
                            className="pr-8"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            %
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Sobre cada cobranza del propietario.
                        </p>
                      </div>
                    </div>

                    {/* Requisitos */}
                    <div role="group" aria-labelledby="prop-requisitos-label" className="space-y-2">
                      <p id="prop-requisitos-label" className="text-sm font-medium leading-none">Requisitos al inquilino</p>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {REQUISITOS_BASE.map((r) => {
                          const activo = requisitos.includes(r.id);
                          return (
                            <button
                              key={r.id}
                              type="button"
                              aria-pressed={activo}
                              onClick={() => toggleRequisito(r.id)}
                              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                                activo
                                  ? 'border-primary bg-primary/5 text-primary'
                                  : 'border-border text-muted-foreground hover:border-primary/40'
                              }`}
                            >
                              <span
                                className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                                  activo
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border'
                                }`}
                              >
                                {activo && <CheckCircle2 className="h-3 w-3" />}
                              </span>
                              {r.label}
                            </button>
                          );
                        })}
                      </div>
                      <Textarea
                        aria-label="Otros requisitos o aclaraciones"
                        value={requisitosExtra}
                        onChange={(e) => setRequisitosExtra(e.target.value)}
                        placeholder="Otros requisitos o aclaraciones..."
                        rows={2}
                      />
                    </div>
                  </div>
                )}
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
                  {contratoActivado && (
                    <>
                      <ResumenRow
                        label="Alquiler"
                        value={monto ? `${moneda === 'USD' ? 'US$' : '$'} ${monto}` : '—'}
                      />
                      <ResumenRow
                        label="Vigencia"
                        value={
                          fechaInicio
                            ? `${fechaInicio} · ${duracionMeses}m`
                            : '—'
                        }
                      />
                      <ResumenRow
                        label="Ajuste"
                        value={`Cada ${periodicidadAjuste}m · ${indiceAjuste}`}
                      />
                      <ResumenRow label="Comisión" value={`${comisionPct || '0'}%`} />
                    </>
                  )}
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
