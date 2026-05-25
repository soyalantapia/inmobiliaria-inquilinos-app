'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  Home,
  Landmark,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  PlugZap,
  Receipt,
  Wallet,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@llave/ui/avatar';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@llave/ui/card';
import {
  ConectarArcaTrigger,
  CuentaCobranzaTrigger,
  EditarPropietarioTrigger,
} from '@/components/editar-propietario-trigger';
import { Topbar } from '@/components/topbar';
import {
  contratosMock,
  propiedadesMock,
  propietariosMock,
} from '@/lib/mock-data';
import { formatFechaCorta, formatMonto, formatPeriodo, formatRangoVigencia } from '@/lib/format';
import { aplicarOverride as aplicarOverridePropietario } from '@/lib/propietarios-overrides-storage';
import { descargarCsv } from '@/lib/csv-export';
import { toast } from '@llave/ui/use-toast';

export default function DetallePropietarioPage({ params }: { params: { id: string } }) {
  const raw = propietariosMock.find((p) => p.id === params.id);
  if (!raw) notFound();

  // SSR + primer render usan datos base (mock). Post-mount aplicamos
  // overrides locales para evitar hydration mismatch.
  const [propietario, setPropietario] = useState(raw);
  useEffect(() => {
    const aplicar = () => setPropietario(aplicarOverridePropietario(raw));
    aplicar();
    window.addEventListener('propietario-actualizado', aplicar);
    window.addEventListener('storage', aplicar);
    return () => {
      window.removeEventListener('propietario-actualizado', aplicar);
      window.removeEventListener('storage', aplicar);
    };
  }, [raw]);

  const propiedadesDelPropietario = propiedadesMock.filter((p) =>
    propietario.propiedadesIds.includes(p.id),
  );
  const contratosDelPropietario = contratosMock.filter((c) =>
    propiedadesDelPropietario.some((p) => p.contratoActualId === c.id),
  );

  const tel = propietario.telefono.replace(/[^\d]/g, '');
  const ingresoAnualEstimado = propietario.totalRecibirMes * 12;

  return (
    <>
      <Topbar titulo="Propietario" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Link
          href="/propietarios"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver a propietarios
        </Link>

        {/* Hero */}
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
                  {propietario.nombre[0]}
                  {propietario.apellido[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 space-y-1">
                <h1 className="text-2xl font-semibold">
                  {propietario.nombre} {propietario.apellido}
                </h1>
                <p className="text-sm text-muted-foreground">CUIT {propietario.cuit}</p>
                <div className="flex flex-wrap gap-3 pt-2 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {propietario.email}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {propietario.telefono}
                  </span>
                </div>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <Button variant="outline" asChild>
                  <a
                    href={`https://wa.me/${tel}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </a>
                </Button>
                <EditarPropietarioTrigger propietario={propietario} />
              </div>
            </div>

            {!propietario.cbuAlias && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">No tiene CBU/alias cargado</p>
                  <p className="text-xs">
                    Necesitás los datos para transferir la rendición mensual. Pediselos por
                    WhatsApp.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label={propietario.propiedadesIds.length === 1 ? 'Propiedad' : 'Propiedades'}
            value={propietario.propiedadesIds.length.toString()}
            icon={<Home className="h-4 w-4" />}
          />
          <Kpi
            label="Bruto cobrado/mes"
            value={formatMonto(propietario.totalCobradoMes)}
            icon={<Wallet className="h-4 w-4" />}
          />
          <Kpi
            label="A rendir/mes"
            value={formatMonto(propietario.totalRecibirMes)}
            icon={<Wallet className="h-4 w-4" />}
            highlight
          />
          <Kpi
            label="Ingreso anual est."
            value={formatMonto(ingresoAnualEstimado)}
            icon={<Building2 className="h-4 w-4" />}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Datos bancarios + comisión */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Datos bancarios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">CBU / Alias</p>
                <p className="font-medium font-mono">
                  {propietario.cbuAlias ?? <span className="italic text-muted-foreground">No cargado</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Comisión inmobiliaria</p>
                <p className="text-lg font-semibold tabular-nums">{propietario.comisionPct}%</p>
                <p className="text-[10px] text-muted-foreground">del alquiler bruto</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cuenta desde</p>
                <p className="text-sm font-medium">{formatFechaCorta(propietario.createdAt)}</p>
              </div>
              {propietario.notas && (
                <div>
                  <p className="text-xs text-muted-foreground">Notas internas</p>
                  <p className="rounded-md bg-muted/50 p-2 text-xs">{propietario.notas}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Propiedades */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Propiedades
              </CardTitle>
              <Badge variant="secondary">{propiedadesDelPropietario.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-2 p-6 pt-0">
              {propiedadesDelPropietario.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin propiedades asociadas.</p>
              ) : (
                propiedadesDelPropietario.map((p) => {
                  const contrato = contratosMock.find((c) => c.id === p.contratoActualId);
                  return (
                    <Link
                      key={p.id}
                      href={`/propiedades/${p.id}`}
                      className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                        <Home className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{p.direccion}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {contrato
                            ? `${contrato.inquilino} · ${formatMonto(contrato.monto, contrato.moneda)}`
                            : 'Sin contrato vigente'}
                        </p>
                      </div>
                      <Badge variant={p.estado === 'ALQUILADA' ? 'success' : 'outline'}>
                        {p.estado}
                      </Badge>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* ARCA + cuenta de cobranza directa */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <Receipt className="h-4 w-4" />
                  Facturación ARCA
                </CardTitle>
              </div>
              {propietario.afip?.conectado ? (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="outline">Desconectado</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {propietario.afip?.conectado ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Cuando aprobás un pago, el sistema emite automáticamente factura/recibo a
                    nombre del propietario y se lo envía al inquilino por WhatsApp y mail.
                  </p>
                  <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Condición fiscal</p>
                      <p className="font-medium">
                        {propietario.afip.condicionFiscal === 'MONOTRIBUTO'
                          ? 'Monotributo'
                          : propietario.afip.condicionFiscal === 'RESPONSABLE_INSCRIPTO'
                            ? 'Resp. Inscripto'
                            : 'Exento'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tipo de comprobante</p>
                      <p className="font-medium">
                        {propietario.afip.tipoComprobante?.replace('_', ' ')}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Punto de venta</p>
                      <p className="font-mono font-medium">{propietario.afip.puntoVenta}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Conectado desde</p>
                      <p className="font-medium">
                        {propietario.afip.conectadoDesde &&
                          formatFechaCorta(propietario.afip.conectadoDesde)}
                      </p>
                    </div>
                  </div>
                  <ConectarArcaTrigger
                    propietario={propietario}
                    variant="outline"
                    className="w-full"
                  />
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">ARCA no conectada</p>
                      <p>
                        Si conectás la ARCA, al aprobar el pago se emite la factura automáticamente
                        y se manda al inquilino por WhatsApp/mail.
                      </p>
                    </div>
                  </div>
                  <ConectarArcaTrigger propietario={propietario} className="w-full" />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Landmark className="h-4 w-4" />
                Cuenta de cobranza directa
              </CardTitle>
              {propietario.cuentaCobranza ? (
                <Badge variant="secondary">Configurada</Badge>
              ) : (
                <Badge variant="outline">No configurada</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {propietario.cuentaCobranza ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Si un contrato está en modo <strong>cobranza directa</strong>, el inquilino
                    deposita acá y el propietario confirma recepción. La inmobiliaria no toca la
                    plata, solo audita.
                  </p>
                  <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Banco</p>
                      <p className="font-medium">{propietario.cuentaCobranza.banco}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Titular</p>
                      <p className="font-medium">{propietario.cuentaCobranza.titular}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">CBU</p>
                      <p className="font-mono font-medium">{propietario.cuentaCobranza.cbu}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Alias</p>
                      <p className="font-mono font-medium">{propietario.cuentaCobranza.alias}</p>
                    </div>
                  </div>
                  <CuentaCobranzaTrigger propietario={propietario} className="w-full" />
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Por defecto los alquileres se cobran a la <strong>cuenta recaudadora de la
                    inmobiliaria</strong>. Si querés que el inquilino deposite directo al
                    propietario, cargá su cuenta.
                  </p>
                  <CuentaCobranzaTrigger propietario={propietario} className="w-full" />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Rendiciones */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Últimas rendiciones
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const rendiciones = generarRendiciones(
                  propietario.totalCobradoMes,
                  propietario.comisionPct,
                );
                descargarCsv({
                  filename: `rendiciones-${propietario.apellido.toLowerCase()}-${propietario.nombre.toLowerCase()}`,
                  headers: ['Período', 'Cobrado', 'Comisión', 'Rendido', 'Estado', 'Fecha pago'],
                  rows: rendiciones.map((r) => [
                    formatPeriodo(r.periodo),
                    r.cobrado,
                    r.comision,
                    r.rendido,
                    r.estado,
                    r.fecha ?? '—',
                  ]),
                });
                toast({
                  variant: 'success',
                  title: 'CSV descargado',
                  description: `${rendiciones.length} rendiciones de ${propietario.nombre}. Abrilo en Excel o Sheets.`,
                });
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Exportar todo
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {generarRendiciones(propietario.totalCobradoMes, propietario.comisionPct).map((r) => (
                <RendicionRow key={r.periodo} rendicion={r} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contratos vigentes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Contratos
            </CardTitle>
            <Badge variant="secondary">{contratosDelPropietario.length}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {contratosDelPropietario.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Sin contratos asociados.</p>
            ) : (
              <div className="divide-y">
                {contratosDelPropietario.map((c) => (
                  <Link
                    key={c.id}
                    href={`/contratos/${c.id}`}
                    className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/40"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{c.inquilino}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.direccion} · {formatRangoVigencia(c.fechaInicio, c.fechaFin)}
                      </p>
                    </div>
                    <Badge variant={c.estado === 'ACTIVO' ? 'success' : 'outline'}>
                      {c.estado}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function Kpi({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-primary/30 bg-primary/5' : ''}>
      <CardContent className="space-y-2 p-4">
        <div className="inline-grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-lg font-semibold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface Rendicion {
  periodo: string;
  cobrado: number;
  comision: number;
  rendido: number;
  estado: 'PAGADO' | 'PENDIENTE';
  fecha: string | null;
}

// Rendiciones simuladas: últimos 6 meses. El mes actual queda PENDIENTE.
function generarRendiciones(cobradoMes: number, comisionPct: number): Rendicion[] {
  const hoy = new Date();
  const rendiciones: Rendicion[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 10);
    const periodo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const comision = Math.round(cobradoMes * (comisionPct / 100));
    rendiciones.push({
      periodo,
      cobrado: cobradoMes,
      comision,
      rendido: cobradoMes - comision,
      estado: i === 0 ? 'PENDIENTE' : 'PAGADO',
      fecha: i === 0 ? null : `${periodo}-12`,
    });
  }
  return rendiciones.reverse();
}

function RendicionRow({ rendicion: r }: { rendicion: Rendicion }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted">
        <Landmark className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{formatPeriodo(r.periodo)}</p>
        <p className="text-xs text-muted-foreground">
          Cobrado {formatMonto(r.cobrado)} − comisión {formatMonto(r.comision)}
          {r.fecha && ` · Transferido el ${formatFechaCorta(r.fecha)}`}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className="text-sm font-semibold tabular-nums">{formatMonto(r.rendido)}</p>
        <Badge variant={r.estado === 'PAGADO' ? 'success' : 'warning'} className="text-[10px]">
          {r.estado === 'PAGADO' ? (
            <>
              <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
              Pagado
            </>
          ) : (
            'Pendiente'
          )}
        </Badge>
      </div>
    </div>
  );
}
