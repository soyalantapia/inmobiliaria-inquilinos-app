'use client';

/**
 * Editor MÍNIMO de un contrato en BORRADOR (PUT /contratos/:id/borrador).
 *
 * Nace de la Tarea 3 del plan "corregir contrato rechazado": el wizard de alta
 * (contratos/nuevo) está armado alrededor del flujo de extracción por IA (subir
 * PDF → revisar campos con confianza → confirmar) y meterle un "modo edición"
 * ahí adentro es más de lo que entra en esta tarea — hubiese significado tocar
 * un flujo de 2400 líneas que hoy funciona. Esta pantalla es deliberadamente
 * chica: los mismos campos que pide `contratoBodySchema` en el back, sin pasos
 * ni IA, para que un borrador rechazado se pueda corregir y (en la próxima
 * tarea) reenviar a aprobación.
 *
 * Gate real: el servidor (no esta pantalla) es quien decide si se puede editar
 * — PUT /contratos/:id/borrador da 409 fuera de BORRADOR. Acá replicamos el
 * gate solo para no mostrar un formulario que el server va a rechazar.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import { Topbar } from '@/components/topbar';
import { apiEnabled, apiFetch, ApiError } from '@/lib/api/client';
import { ensureApiSession } from '@/lib/api/session';
import { useCobranza } from '@/lib/api/hooks';
import { MoraSelector, type MoraSeleccion } from '@/components/mora-selector';
import type { IndiceAjuste, Moneda, TipoContrato, TipoMora } from '@/lib/types';

const monedas: Array<{ value: Moneda; label: string }> = [
  { value: 'ARS', label: 'Pesos (ARS)' },
  { value: 'USD', label: 'Dólares (USD)' },
];

const tiposContrato: Array<{ value: TipoContrato; label: string }> = [
  { value: 'ALQUILER', label: 'Solo alquiler' },
  { value: 'ALQUILER_Y_EXPENSAS', label: 'Alquiler + expensas' },
  { value: 'SOLO_EXPENSAS', label: 'Solo expensas' },
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

const modosCobranza: Array<{ value: 'INMOBILIARIA' | 'PROPIETARIO_DIRECTO'; label: string }> = [
  { value: 'INMOBILIARIA', label: 'Por inmobiliaria (cobra la inmobiliaria y rinde al propietario)' },
  { value: 'PROPIETARIO_DIRECTO', label: 'Directa al propietario (transfiere al dueño)' },
];

/** Shape de lib/estado-inicial-contrato.ts (PeriodoAnterior) — solo lo pasamos
 * de vuelta tal cual, no lo edita esta pantalla (ver nota en el submit). */
interface PeriodoAnteriorRaw {
  periodo: string;
  estado: 'PAGADO' | 'PARCIAL' | 'ADEUDA';
  montoPagado?: number;
  moraManual?: number;
}

// ---- Shape de la respuesta cruda del API (GET /contratos/:id) que este editor
// necesita — deliberadamente NO reusamos useContrato()/ContratoListado: esa capa
// mapea y PIERDE campos que el editor sí necesita (propiedadId crudo, dni del
// titular, periodosAnterioresPendientes tal cual está en la DB). ----
interface ContratoBorradorApi {
  id: string;
  estado: string;
  propiedadId: string;
  monto: string | number;
  moneda: Moneda;
  fechaInicio: string;
  fechaFin: string;
  diaPago: number;
  indiceAjuste: IndiceAjuste | null;
  frecuenciaAjusteMeses: number | null;
  montoExpensas: string | number | null;
  tipoContrato: TipoContrato;
  depositoGarantia: string | number | null;
  comisionInmobiliaria: number | null;
  modoCobranza: 'INMOBILIARIA' | 'PROPIETARIO_DIRECTO';
  moraTipo: TipoMora | null;
  moraValor: string | number | null;
  periodosAnterioresPendientes: PeriodoAnteriorRaw[] | null;
  decisionAprobacion?: { estado: 'APROBADA' | 'RECHAZADA'; comentario: string | null } | null;
  propiedad: { id: string; direccion: string } | null;
  inquilinoTitular: {
    id: string;
    nombre: string;
    apellido: string | null;
    email: string | null;
    telefono: string | null;
    dni: string | null;
  } | null;
}

function numOrUndefined(s: string): number | undefined {
  const n = Number(s.replace(',', '.'));
  return s.trim() !== '' && Number.isFinite(n) ? n : undefined;
}

export default function EditarBorradorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const qc = useQueryClient();
  const { mora: moraDefault } = useCobranza();

  const q = useQuery({
    queryKey: ['contrato-borrador-editar', id],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<ContratoBorradorApi>(`/contratos/${id}`);
    },
    enabled: apiEnabled && id.length > 0,
    staleTime: 0,
  });

  const data = q.data ?? null;

  // ---- Estado del formulario (se inicializa una vez que carga `data`) ----
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [dni, setDni] = useState('');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('ARS');
  const [tipoContrato, setTipoContrato] = useState<TipoContrato>('ALQUILER');
  const [montoExpensas, setMontoExpensas] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [diaPago, setDiaPago] = useState('10');
  const [indiceAjuste, setIndiceAjuste] = useState<IndiceAjuste>('ICL');
  const [frecuenciaAjusteMeses, setFrecuenciaAjusteMeses] = useState('12');
  const [depositoGarantia, setDepositoGarantia] = useState('');
  const [comisionInmobiliaria, setComisionInmobiliaria] = useState('');
  const [modoCobranza, setModoCobranza] = useState<'INMOBILIARIA' | 'PROPIETARIO_DIRECTO'>('INMOBILIARIA');
  const [moraSeleccion, setMoraSeleccion] = useState<MoraSeleccion>('HEREDAR');
  const [moraValor, setMoraValor] = useState('');
  const [guardando, setGuardando] = useState(false);

  // periodosAnterioresPendientes: esta pantalla NO los edita, pero el endpoint
  // manda el MISMO body que el alta (no un PATCH parcial) — si no los
  // reenviamos tal cual vinieron, el server los borra (Prisma.DbNull). Sin
  // esto, "corregir el monto" de un contrato con un período declarado como
  // ADEUDA le borraría esa declaración en silencio.
  const [periodosPendientes, setPeriodosPendientes] = useState<PeriodoAnteriorRaw[] | null>(null);

  useEffect(() => {
    if (!data) return;
    setNombre(data.inquilinoTitular?.nombre ?? '');
    setApellido(data.inquilinoTitular?.apellido ?? '');
    setEmail(data.inquilinoTitular?.email ?? '');
    setTelefono(data.inquilinoTitular?.telefono ?? '');
    setDni(data.inquilinoTitular?.dni ?? '');
    setMonto(String(Number(data.monto)));
    setMoneda(data.moneda ?? 'ARS');
    setTipoContrato(data.tipoContrato ?? 'ALQUILER');
    setMontoExpensas(data.montoExpensas != null ? String(Number(data.montoExpensas)) : '');
    setFechaInicio((data.fechaInicio ?? '').slice(0, 10));
    setFechaFin((data.fechaFin ?? '').slice(0, 10));
    setDiaPago(String(data.diaPago ?? 10));
    setIndiceAjuste(data.indiceAjuste ?? 'ICL');
    setFrecuenciaAjusteMeses(String(data.frecuenciaAjusteMeses ?? 12));
    setDepositoGarantia(data.depositoGarantia != null ? String(Number(data.depositoGarantia)) : '');
    setComisionInmobiliaria(data.comisionInmobiliaria != null ? String(data.comisionInmobiliaria) : '');
    setModoCobranza(data.modoCobranza ?? 'INMOBILIARIA');
    setMoraSeleccion(data.moraTipo ?? 'HEREDAR');
    setMoraValor(data.moraValor != null ? String(Number(data.moraValor)) : '');
    setPeriodosPendientes(
      Array.isArray(data.periodosAnterioresPendientes) && data.periodosAnterioresPendientes.length > 0
        ? data.periodosAnterioresPendientes
        : null,
    );
  }, [data]);

  if (!apiEnabled) {
    return (
      <>
        <Topbar titulo="Editar contrato" />
        <main className="flex-1 p-4 md:p-6">
          <Card>
            <CardContent className="p-10 text-center">
              <p className="text-sm font-medium">Disponible en la versión conectada.</p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  if (q.isPending) {
    return (
      <>
        <Topbar titulo="Editar contrato" />
        <main className="flex-1 space-y-4 p-4 md:p-6">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </main>
      </>
    );
  }

  if (q.isError || !data) {
    return (
      <>
        <Topbar titulo="Editar contrato" />
        <main className="flex-1 space-y-4 p-4 md:p-6">
          <Link
            href="/contratos"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver a contratos
          </Link>
          <Card>
            <CardContent className="p-10 text-center">
              <AlertCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No encontramos este contrato.</p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  // Gate por estado: mismo motivo que el 409 del server. No es la única
  // defensa (el server lo exige igual), pero evita mostrar un formulario que
  // el back va a rechazar.
  if (data.estado !== 'BORRADOR') {
    return (
      <>
        <Topbar titulo="Editar contrato" />
        <main className="flex-1 space-y-4 p-4 md:p-6">
          <Link
            href={`/contratos/${id}`}
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver al contrato
          </Link>
          <Card>
            <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Este contrato ya no está en borrador.</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Un contrato activo se corrige desde sus acciones puntuales (ajustar
                monto, mora, modo de cobranza), no reescribiéndolo entero.
              </p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  const requiereExpensas = tipoContrato === 'ALQUILER_Y_EXPENSAS' || tipoContrato === 'SOLO_EXPENSAS';
  const montoNum = Number(monto);
  const diaPagoNum = Number(diaPago);
  const frecuenciaNum = Number(frecuenciaAjusteMeses);
  const fechasValidas = fechaInicio.length === 10 && fechaFin.length === 10 && fechaFin > fechaInicio;
  const valido =
    nombre.trim().length >= 2 &&
    Number.isFinite(montoNum) &&
    (tipoContrato === 'SOLO_EXPENSAS' ? montoNum >= 0 : montoNum > 0) &&
    fechasValidas &&
    Number.isInteger(diaPagoNum) &&
    diaPagoNum >= 1 &&
    diaPagoNum <= 31 &&
    Number.isInteger(frecuenciaNum) &&
    frecuenciaNum > 0 &&
    (!requiereExpensas || numOrUndefined(montoExpensas) != null) &&
    (moraSeleccion === 'HEREDAR' || moraSeleccion === 'SIN_MORA' || Number(moraValor) > 0);

  async function guardar() {
    if (!valido || !data) return;
    setGuardando(true);
    try {
      await ensureApiSession();
      await apiFetch(`/contratos/${id}/borrador`, {
        method: 'PUT',
        body: JSON.stringify({
          propiedadId: data.propiedadId,
          inquilino: {
            nombre: nombre.trim(),
            ...(apellido.trim() ? { apellido: apellido.trim() } : {}),
            ...(email.trim() ? { email: email.trim() } : {}),
            ...(telefono.trim() ? { telefono: telefono.trim() } : {}),
            ...(dni.trim() ? { dni: dni.trim() } : {}),
          },
          monto: montoNum,
          moneda,
          fechaInicio,
          fechaFin,
          diaPago: diaPagoNum,
          indiceAjuste,
          frecuenciaAjusteMeses: frecuenciaNum,
          ...(numOrUndefined(montoExpensas) != null ? { montoExpensas: numOrUndefined(montoExpensas) } : {}),
          tipoContrato,
          ...(numOrUndefined(depositoGarantia) != null ? { depositoGarantia: numOrUndefined(depositoGarantia) } : {}),
          modoCobranza,
          ...(numOrUndefined(comisionInmobiliaria) != null
            ? { comisionInmobiliaria: numOrUndefined(comisionInmobiliaria) }
            : {}),
          ...(moraSeleccion !== 'HEREDAR'
            ? { moraTipo: moraSeleccion, ...(moraSeleccion === 'SIN_MORA' ? {} : { moraValor: Number(moraValor) }) }
            : {}),
          // Se reenvían TAL CUAL vinieron — esta pantalla no los toca (ver comentario arriba).
          ...(periodosPendientes ? { periodosAnteriores: periodosPendientes } : {}),
        }),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['contrato', id] }),
        qc.invalidateQueries({ queryKey: ['contrato-borrador-editar', id] }),
        qc.invalidateQueries({ queryKey: ['contratos'] }),
      ]);
      toast({ variant: 'success', title: 'Contrato actualizado' });
      router.push(`/contratos/${id}`);
    } catch (e) {
      toast({
        variant: e instanceof ApiError && e.status === 409 ? 'warning' : 'destructive',
        title: 'No se pudo guardar',
        description: e instanceof ApiError ? e.message : 'Reintentá en un momento.',
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Topbar titulo="Editar contrato" />
      <main className="flex-1 space-y-6 p-4 pb-24 md:p-6">
        <Link
          href={`/contratos/${id}`}
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver al contrato
        </Link>

        {data.decisionAprobacion?.estado === 'RECHAZADA' && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Este contrato fue rechazado.</p>
              {data.decisionAprobacion.comentario && (
                <p className="mt-0.5 text-xs">{data.decisionAprobacion.comentario}</p>
              )}
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Propiedad</CardTitle>
            <CardDescription>No se puede cambiar la propiedad desde acá.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{data.propiedad?.direccion ?? '—'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inquilino</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ed-nombre">
                Nombre <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <Input id="ed-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-apellido">Apellido</Label>
              <Input id="ed-apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-email">Email</Label>
              <Input id="ed-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-telefono">Teléfono</Label>
              <Input id="ed-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-dni">DNI</Label>
              <Input id="ed-dni" value={dni} onChange={(e) => setDni(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contrato</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ed-tipo">Tipo de contrato</Label>
              <Select value={tipoContrato} onValueChange={(v) => setTipoContrato(v as TipoContrato)}>
                <SelectTrigger id="ed-tipo">
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
            <div className="space-y-1.5">
              <Label htmlFor="ed-moneda">Moneda</Label>
              <Select value={moneda} onValueChange={(v) => setMoneda(v as Moneda)}>
                <SelectTrigger id="ed-moneda">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monedas.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tipoContrato !== 'SOLO_EXPENSAS' && (
              <div className="space-y-1.5">
                <Label htmlFor="ed-monto">
                  Monto del alquiler <span aria-hidden="true" className="text-destructive">*</span>
                </Label>
                <Input
                  id="ed-monto"
                  type="number"
                  inputMode="decimal"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                />
              </div>
            )}
            {requiereExpensas && (
              <div className="space-y-1.5">
                <Label htmlFor="ed-expensas">
                  Monto de expensas <span aria-hidden="true" className="text-destructive">*</span>
                </Label>
                <Input
                  id="ed-expensas"
                  type="number"
                  inputMode="decimal"
                  value={montoExpensas}
                  onChange={(e) => setMontoExpensas(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ed-inicio">
                Fecha de inicio <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <Input id="ed-inicio" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-fin">
                Fecha de fin <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <Input
                id="ed-fin"
                type="date"
                value={fechaFin}
                min={fechaInicio || undefined}
                onChange={(e) => setFechaFin(e.target.value)}
                aria-invalid={fechaFin.length === 10 && fechaInicio.length === 10 && fechaFin <= fechaInicio}
              />
              {fechaFin.length === 10 && fechaInicio.length === 10 && fechaFin <= fechaInicio && (
                <p className="text-[11px] text-destructive">
                  La fecha de fin tiene que ser posterior a la de inicio.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-diapago">Día de pago</Label>
              <Input
                id="ed-diapago"
                type="number"
                inputMode="numeric"
                value={diaPago}
                onChange={(e) => setDiaPago(e.target.value.replace(/\D/g, '').slice(0, 2))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-indice">Índice de ajuste</Label>
              <Select value={indiceAjuste} onValueChange={(v) => setIndiceAjuste(v as IndiceAjuste)}>
                <SelectTrigger id="ed-indice">
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
              <Label htmlFor="ed-frecuencia">Frecuencia de ajuste (meses)</Label>
              <Input
                id="ed-frecuencia"
                type="number"
                inputMode="numeric"
                value={frecuenciaAjusteMeses}
                onChange={(e) => setFrecuenciaAjusteMeses(e.target.value.replace(/\D/g, '').slice(0, 3))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-deposito">Depósito en garantía</Label>
              <Input
                id="ed-deposito"
                type="number"
                inputMode="decimal"
                value={depositoGarantia}
                onChange={(e) => setDepositoGarantia(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-comision">Comisión de la inmobiliaria (%)</Label>
              <Input
                id="ed-comision"
                type="number"
                inputMode="decimal"
                value={comisionInmobiliaria}
                onChange={(e) => setComisionInmobiliaria(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cobranza</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label htmlFor="ed-cobranza">Modo de cobranza</Label>
              <Select
                value={modoCobranza}
                onValueChange={(v) => setModoCobranza(v as 'INMOBILIARIA' | 'PROPIETARIO_DIRECTO')}
              >
                <SelectTrigger id="ed-cobranza">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modosCobranza.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {modoCobranza === 'PROPIETARIO_DIRECTO' && (
                <p className="text-[11px] text-muted-foreground">
                  El propietario principal de la propiedad necesita su cuenta de cobro
                  cargada; si no, el guardado va a fallar con el detalle de qué falta.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interés por mora</CardTitle>
            <CardDescription>
              Punitorio que se suma cuando el inquilino paga tarde. Elegí un esquema
              para este contrato o heredá el default de la inmobiliaria.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MoraSelector
              seleccion={moraSeleccion}
              valor={moraValor}
              onSeleccionChange={setMoraSeleccion}
              onValorChange={setMoraValor}
              heredado={moraDefault ? { tipo: moraDefault.tipoDefault, valor: moraDefault.valorDefault } : null}
              conHeredar
              montoBase={montoNum + (numOrUndefined(montoExpensas) ?? 0)}
              moneda={moneda}
              idPrefix="mora-editar-borrador"
            />
          </CardContent>
        </Card>

        {periodosPendientes && (
          <p className="text-xs text-muted-foreground">
            Este contrato tiene {periodosPendientes.length} período
            {periodosPendientes.length === 1 ? '' : 's'} anterior
            {periodosPendientes.length === 1 ? '' : 'es'} declarado
            {periodosPendientes.length === 1 ? '' : 's'} (pagado/parcial/adeuda). Esta
            pantalla no los toca: se guardan tal cual estaban.
          </p>
        )}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="ghost" onClick={() => router.push(`/contratos/${id}`)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={guardando || !valido}>
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </main>
    </>
  );
}
