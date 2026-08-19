'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronDown, Loader2, LogOut, Mail, Phone, Receipt, Wrench } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { SelectorCartera } from '@/components/selector-cartera';
import {
  apiFetch,
  cerrarSesion,
  leerSesion,
  leerToken,
  type MiCartera,
  type PropiedadPortal,
  type ReclamoPortal,
  type RendicionDetalle,
  type RendicionPortal,
} from '@/lib/api';

const money = (n: number, moneda: 'ARS' | 'USD' = 'ARS'): string =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: moneda, maximumFractionDigits: 0 }).format(n);

const fecha = (iso: string): string =>
  new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

const periodoLargo = (p: string): string => {
  const [y, m] = p.split('-');
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${meses[Number(m) - 1] ?? p} ${y}`;
};

export default function PortalHome() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const sesion = typeof window !== 'undefined' ? leerSesion() : null;

  // El chequeo de sesión va en un effect: leer localStorage durante el render rompe la
  // hidratación (el server no lo tiene) y hacía parpadear el portal antes de redirigir.
  useEffect(() => {
    if (!leerToken()) router.replace('/login');
    else setListo(true);
  }, [router]);

  const cartera = useQuery({
    queryKey: ['mi-cartera'],
    queryFn: () => apiFetch<MiCartera>('/portal/mi-cartera'),
    enabled: listo,
  });
  const propiedades = useQuery({
    queryKey: ['portal-propiedades'],
    queryFn: () => apiFetch<PropiedadPortal[]>('/portal/propiedades'),
    enabled: listo,
  });
  const rendiciones = useQuery({
    queryKey: ['portal-rendiciones'],
    queryFn: () => apiFetch<RendicionPortal[]>('/portal/rendiciones'),
    enabled: listo,
  });
  const reclamos = useQuery({
    queryKey: ['portal-reclamos'],
    queryFn: () => apiFetch<ReclamoPortal[]>('/portal/reclamos'),
    enabled: listo,
  });

  // Cualquier 401 (sesión vencida o revocada) manda al login: apiFetch ya limpió el storage.
  useEffect(() => {
    if (cartera.isError) router.replace('/login');
  }, [cartera.isError, router]);

  if (!listo || cartera.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Cargando" />
      </main>
    );
  }

  const salir = () => {
    cerrarSesion();
    router.replace('/login');
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 pb-16 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tus propiedades</p>
          <h1 className="truncate text-2xl font-semibold">{cartera.data?.nombre ?? sesion?.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            Administra {cartera.data?.inmobiliaria.nombre ?? sesion?.inmobiliaria}
            {cartera.data ? ` · comisión ${cartera.data.comisionPct}%` : ''}
          </p>
          {/* El teléfono y el mail de la inmobiliaria YA venían en /portal/mi-cartera y la
              pantalla los tiraba. El portal existe para que el dueño no tenga que llamar, pero
              para lo que el portal NO cubre —un gasto que no reconoce, avisar que vende— seguía
              sin tener a dónde escribir: tenía que salir a buscar el número afuera de la app.
              En el celular, `tel:` es un toque. */}
          <ContactoInmo inmo={cartera.data?.inmobiliaria} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Sólo aparece si esta persona administra con más de una inmobiliaria. */}
          <SelectorCartera />
          <Button variant="outline" size="sm" onClick={salir}>
            <LogOut className="h-4 w-4" />
            Salir
          </Button>
        </div>
      </header>

      <Seccion titulo="Lo que te rindieron" icono={<Receipt className="h-4 w-4" />}>
        {rendiciones.isPending ? (
          <Cargando />
        ) : rendiciones.data && rendiciones.data.length > 0 ? (
          <div className="space-y-2">
            {rendiciones.data.map((r) => (
              <FilaRendicion key={r.id} r={r} />
            ))}
          </div>
        ) : (
          <Vacio texto="Todavía no hay rendiciones cargadas. Cuando tu inmobiliaria te rinda un período, lo vas a ver acá con el detalle." />
        )}
      </Seccion>

      <Seccion titulo="Tus unidades" icono={<Building2 className="h-4 w-4" />}>
        {propiedades.isPending ? (
          <Cargando />
        ) : propiedades.data && propiedades.data.length > 0 ? (
          <div className="space-y-3">
            {propiedades.data.map((p) => (
              <FilaPropiedad key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <Vacio texto="No hay propiedades asociadas a tu cuenta." />
        )}
      </Seccion>

      <Seccion titulo="Reclamos de tus unidades" icono={<Wrench className="h-4 w-4" />}>
        {reclamos.isPending ? (
          <Cargando />
        ) : reclamos.data && reclamos.data.length > 0 ? (
          <div className="space-y-2">
            {reclamos.data.slice(0, 10).map((r) => (
              <Card key={r.id} className="space-y-1 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={r.estado === 'RESUELTO' || r.estado === 'CERRADO' ? 'success' : 'warning'}>
                    {r.estado.toLowerCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{r.categoria.toLowerCase()}</span>
                  <span className="text-xs text-muted-foreground">· {r.complejo ?? r.direccion}</span>
                </div>
                <p className="text-sm">{r.descripcion}</p>
                <p className="text-xs text-muted-foreground">
                  {fecha(r.creadoAt)}
                  {r.costo != null && ` · costó ${money(r.costo)}`}
                  {r.pagador && ` · lo paga: ${r.pagador.toLowerCase()}`}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          // "No hay reclamos" era una afirmación que el backend no puede sostener: la consulta
          // se recorta al CONTRATO VIGENTE de cada unidad (portal-propietario.ts), así que una
          // unidad vacía hoy devuelve cero aunque el mes pasado se haya roto el termotanque. El
          // texto dice lo que realmente cubre.
          <Vacio texto="No hay reclamos abiertos ni resueltos del inquilino que vive hoy en tus unidades. Los de inquilinos anteriores no se muestran acá." />
        )}
      </Seccion>
    </main>
  );
}

/**
 * Cómo llegar a la inmobiliaria cuando el portal no alcanza.
 *
 * Sólo se muestra lo que existe: si no hay teléfono cargado no aparece un link muerto, y si no
 * hay ninguno de los dos no aparece nada. Un "Contactanos" que no lleve a ningún lado sería
 * exactamente lo contrario de lo que este portal viene a hacer.
 */
function ContactoInmo({ inmo }: { inmo?: MiCartera['inmobiliaria'] }) {
  const tel = inmo?.telefono?.trim();
  const mail = inmo?.email?.trim();
  if (!tel && !mail) return null;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {tel && (
        <a href={`tel:${tel.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1 text-primary hover:underline">
          <Phone className="h-3 w-3" />
          {tel}
        </a>
      )}
      {mail && (
        <a href={`mailto:${mail}`} className="inline-flex items-center gap-1 text-primary hover:underline">
          <Mail className="h-3 w-3" />
          {mail}
        </a>
      )}
    </p>
  );
}

function Seccion({ titulo, icono, children }: { titulo: string; icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icono}
        {titulo}
      </h2>
      {children}
    </section>
  );
}

const Cargando = () => (
  <Card className="p-6 text-center">
    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" aria-label="Cargando" />
  </Card>
);

const Vacio = ({ texto }: { texto: string }) => (
  <Card className="p-6 text-center text-sm text-muted-foreground">{texto}</Card>
);

/**
 * Una rendición. Los cinco números son exactamente los que Camila enumeró `[1:05:10]`:
 * lo que se cobró, la comisión, lo que se gastó, otros ingresos y lo que se depositó.
 */
function FilaRendicion({ r }: { r: RendicionPortal }) {
  const [abierto, setAbierto] = useState(false);
  // El detalle se pide RECIÉN al abrir, no con la lista: son todos los gastos y todos los
  // alquileres de ese período, y traerlos para las 12 rendiciones que nadie va a abrir es
  // pagar una respuesta enorme para mostrar cinco números. Es la razón por la que el endpoint
  // está separado (ver el comentario de /portal/rendiciones en el backend).
  const detalle = useQuery({
    queryKey: ['portal-rendicion', r.id],
    queryFn: () => apiFetch<RendicionDetalle>(`/portal/rendiciones/${r.id}`),
    enabled: abierto,
    staleTime: 5 * 60_000,
  });
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40"
        aria-expanded={abierto}
      >
        <div className="min-w-0">
          <p className="font-medium">{periodoLargo(r.periodo)}</p>
          <p className="text-xs text-muted-foreground">
            Te depositamos el {fecha(r.rendidoAt)} · {r.metodo.toLowerCase()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-lg font-semibold tabular-nums">{money(r.teDepositamos)}</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {abierto && (
        <div className="space-y-1 border-t bg-muted/20 p-4 text-sm">
          <Linea label="Se cobró de alquiler" valor={money(r.cobrado)} />
          <Linea label={`Comisión de la inmobiliaria (${r.comisionPct}%)`} valor={`− ${money(r.comision)}`} />
          {r.gastos > 0 && <Linea label="Gastos de tus unidades" valor={`− ${money(r.gastos)}`} />}
          {r.otrosIngresos > 0 && <Linea label="Otros ingresos" valor={`+ ${money(r.otrosIngresos)}`} />}
          <div className="mt-2 flex items-center justify-between border-t pt-2 font-semibold">
            <span>Te depositamos</span>
            <span className="tabular-nums">{money(r.teDepositamos)}</span>
          </div>

          {/* El desglose. Los cinco números de arriba contestan "cuánto", esto contesta "por
              qué" — que es la pregunta con la que el dueño levanta el teléfono. Sobre todo el
              renglón de gastos: ver "− $85.000" sin saber de qué es garantiza la llamada. */}
          {detalle.isPending ? (
            <p className="pt-3 text-xs text-muted-foreground">Buscando el detalle…</p>
          ) : detalle.isError ? (
            // Los totales de arriba ya están y son correctos: el error es sólo del desglose.
            // Decirlo evita que el dueño desconfíe del número que sí tiene delante.
            <p className="pt-3 text-xs text-muted-foreground">
              No pudimos traer el detalle en este momento. Los montos de arriba son los de tu
              rendición: probá de nuevo en un rato.
            </p>
          ) : detalle.data ? (
            <div className="space-y-4 pt-3">
              <Desglose
                titulo="De dónde salió el alquiler"
                filas={detalle.data.detalleAlquileres.map((a) => ({
                  clave: `${a.periodo}-${a.direccion}`,
                  principal: a.direccion,
                  // La participación sólo cuando NO es dueño único: con 100% es ruido, y con
                  // menos es justo el dato que explica por qué el monto no es el alquiler entero.
                  secundario:
                    a.participacionPct < 100
                      ? `${periodoLargo(a.periodo)} · te toca el ${a.participacionPct}%`
                      : periodoLargo(a.periodo),
                  monto: money(a.monto),
                }))}
                vacio="Esta rendición no tiene alquileres imputados."
              />

              {detalle.data.detalleGastos.length > 0 && (
                <Desglose
                  titulo="Qué se descontó"
                  filas={detalle.data.detalleGastos.map((g, i) => ({
                    clave: `${g.fecha}-${i}`,
                    principal: g.descripcion,
                    secundario: [fecha(g.fecha), g.tipo.toLowerCase(), g.proveedor].filter(Boolean).join(' · '),
                    monto: `− ${money(g.monto)}`,
                  }))}
                  vacio=""
                />
              )}

              {detalle.data.detalleIngresos.length > 0 && (
                <Desglose
                  titulo="Otros ingresos"
                  filas={detalle.data.detalleIngresos.map((x, i) => ({
                    clave: `${x.fecha}-${i}`,
                    principal: x.descripcion,
                    secundario:
                      x.participacionPct < 100
                        ? `${fecha(x.fecha)} · te toca el ${x.participacionPct}%`
                        : fecha(x.fecha),
                    monto: `+ ${money(x.monto)}`,
                  }))}
                  vacio=""
                />
              )}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}

/** Una lista de renglones "concepto · cuándo · monto" dentro del desglose de una rendición. */
function Desglose({
  titulo,
  filas,
  vacio,
}: {
  titulo: string;
  filas: { clave: string; principal: string; secundario: string; monto: string }[];
  vacio: string;
}) {
  if (filas.length === 0) {
    return vacio ? (
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <p className="text-xs text-muted-foreground">{vacio}</p>
      </div>
    ) : null;
  }
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <div className="space-y-1.5">
        {filas.map((f) => (
          <div key={f.clave} className="flex items-start justify-between gap-3 text-xs">
            <span className="min-w-0">
              <span className="block truncate text-foreground">{f.principal}</span>
              <span className="block text-muted-foreground">{f.secundario}</span>
            </span>
            <span className="shrink-0 tabular-nums">{f.monto}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const Linea = ({ label, valor }: { label: string; valor: string }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-muted-foreground">{label}</span>
    <span className="tabular-nums">{valor}</span>
  </div>
);

/**
 * Una unidad con el estado de su inquilino.
 *
 * La fecha de pago va explícita porque es justo lo que Camila quiere que el propietario pueda
 * auditar `[1:05:30]`: *"vos también me estás auditando a mí… que ves el día que pagó esa
 * persona"*.
 */
function FilaPropiedad({ p }: { p: PropiedadPortal }) {
  const c = p.contrato;
  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{p.complejo ?? p.direccion}</p>
          <p className="text-xs text-muted-foreground">
            {p.complejo ? `${p.direccion} · ` : ''}
            {p.ciudad}
          </p>
        </div>
        {/* Sólo si no es dueño único: en el caso normal el 100% es ruido. */}
        {p.participacionPct < 100 && (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            Te corresponde el {p.participacionPct}%
          </Badge>
        )}
      </div>

      {c ? (
        <>
          <p className="text-sm">
            {c.inquilino ? <strong>{c.inquilino}</strong> : 'Sin inquilino cargado'}
            {c.tipoContrato === 'SOLO_EXPENSAS' ? ' · sólo expensas' : ` · ${money(c.monto, c.moneda)} por mes`}
            {/* Con más de un dueño, la pantalla mezclaba dos bases sin decirlo: acá el alquiler
                ENTERO que paga el inquilino, y en la rendición la parte de este propietario.
                Los dos números son correctos y son distintos; el que falta es el puente. */}
            {c.tipoContrato !== 'SOLO_EXPENSAS' && p.participacionPct < 100 && (
              <span className="text-muted-foreground">
                {' · '}tu parte: {money((c.monto * p.participacionPct) / 100, c.moneda)}
              </span>
            )}
          </p>
          {/* El backend manda los últimos 6 períodos (`take: 6`) y la pantalla los listaba sin
              decir que había más: el dueño que quiere revisar el año leía seis meses y creía
              que eso era todo. Se deriva del largo real para que no mienta si el tope cambia. */}
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Últimos {c.periodos.length} {c.periodos.length === 1 ? 'mes' : 'meses'}
          </p>
          <div className="space-y-1">
            {c.periodos.map((per) => (
              <div key={per.periodo} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{periodoLargo(per.periodo)}</span>
                <span className="flex items-center gap-2">
                  {per.pagoAt ? (
                    <span className="text-muted-foreground">pagó el {fecha(per.pagoAt)}</span>
                  ) : (
                    <span className="text-muted-foreground">vence el {fecha(per.vence)}</span>
                  )}
                  <Badge
                    variant={per.estado === 'PAGADO' ? 'success' : per.estado === 'VENCIDO' ? 'destructive' : 'warning'}
                    className="text-[10px]"
                  >
                    {per.estado.toLowerCase()}
                  </Badge>
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Sin contrato vigente.</p>
      )}
    </Card>
  );
}
