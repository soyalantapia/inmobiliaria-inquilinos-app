'use client';

/**
 * Las piezas que comparten las pestañas del portal.
 *
 * Vivían todas en una sola pantalla. Al partir el portal en pestañas —Pagos, Unidades,
 * Reclamos y Mi perfil— se movieron acá TAL CUAL estaban: el cambio es de navegación, no de
 * comportamiento, y mezclar las dos cosas en el mismo diff hace imposible revisar cuál rompió
 * qué.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, Mail, Phone } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { ImprimirRendicion } from '@/components/imprimir-rendicion';
import { money, fecha, periodoLargo } from '@/lib/format';
import {
  apiFetch,
  type MiCartera,
  type PropiedadPortal,
  type ReclamoPortal,
  type RendicionDetalle,
  type RendicionPortal,
} from '@/lib/api';

/**
 * Los reclamos de sus unidades, de a diez.
 *
 * Antes era un `slice(0, 10)` pelado: la API manda hasta 50 y la pantalla mostraba diez sin
 * decir nada de los otros cuarenta. El dueño con varias unidades leía diez reclamos y se iba
 * creyendo que ésos eran todos. Mismo tope silencioso que tenían los períodos de la propiedad.
 */
export function ListaReclamos({ reclamos }: { reclamos: ReclamoPortal[] }) {
  const [todos, setTodos] = useState(false);
  const visibles = todos ? reclamos : reclamos.slice(0, 10);
  const restantes = reclamos.length - visibles.length;
  return (
    <div className="space-y-2">
      {visibles.map((r) => (
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
            {r.costo != null && ` · costó ${money(r.costo, r.monedaCosto)}`}
            {r.pagador && ` · lo paga: ${r.pagador.toLowerCase()}`}
          </p>
        </Card>
      ))}
      {restantes > 0 && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setTodos(true)}>
          Ver los {restantes} reclamos restantes
        </Button>
      )}
    </div>
  );
}

/**
 * Cómo llegar a la inmobiliaria cuando el portal no alcanza.
 *
 * Sólo se muestra lo que existe: si no hay teléfono cargado no aparece un link muerto, y si no
 * hay ninguno de los dos no aparece nada. Un "Contactanos" que no lleve a ningún lado sería
 * exactamente lo contrario de lo que este portal viene a hacer.
 */
export function ContactoInmo({ inmo }: { inmo?: MiCartera['inmobiliaria'] }) {
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

export function FilaRendicion({
  r,
  propietario,
  inmobiliaria,
}: {
  r: RendicionPortal;
  propietario: string;
  inmobiliaria: string;
}) {
  const [abierto, setAbierto] = useState(false);
  // El detalle se pide RECIÉN al abrir, no con la lista: son todos los gastos y todos los
  // alquileres de ese período, y traerlos para las 12 rendiciones que nadie va a abrir es
  // pagar una respuesta enorme para mostrar cinco números. Es la razón por la que el endpoint
  // está separado (ver el comentario de /portal/rendiciones en el backend).
  // Toda la plata de esta tarjeta se formatea con la moneda de ESTA rendición. Antes se usaba
  // el default (ARS) en los nueve montos: una rendición en dólares se le mostraba al dueño con
  // signo de pesos, que es la misma enfermedad que ya se corrigió en el cierre de caja.
  const plata = (x: number) => money(x, r.moneda);
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
          <span className="text-lg font-semibold tabular-nums">{plata(r.teDepositamos)}</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {abierto && (
        <div className="space-y-1 border-t bg-muted/20 p-4 text-sm">
          <Linea label="Se cobró de alquiler" valor={plata(r.cobrado)} />
          <Linea label={`Comisión de la inmobiliaria (${r.comisionPct}%)`} valor={`− ${plata(r.comision)}`} />
          {r.gastos > 0 && <Linea label="Gastos de tus unidades" valor={`− ${plata(r.gastos)}`} />}
          {r.otrosIngresos > 0 && <Linea label="Otros ingresos" valor={`+ ${plata(r.otrosIngresos)}`} />}
          <div className="mt-2 flex items-center justify-between border-t pt-2 font-semibold">
            <span>Te depositamos</span>
            <span className="tabular-nums">{plata(r.teDepositamos)}</span>
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
                  monto: plata(a.monto),
                }))}
                // Decir "no tiene alquileres imputados" arriba de un total de $237.960 es una
                // contradicción en la misma tarjeta. Las rendiciones anteriores a julio de 2026
                // son de antes de que existiera `alquileres_rendidos`: el total es correcto, lo
                // que no hay es el desglose. Eso es lo que dice el texto.
                vacio="De esta rendición no quedó guardado el desglose por unidad. El total de arriba es el que se te depositó."
              />

              {detalle.data.detalleGastos.length > 0 && (
                <Desglose
                  titulo="Qué se descontó"
                  filas={detalle.data.detalleGastos.map((g, i) => ({
                    clave: `${g.fecha}-${i}`,
                    principal: g.descripcion,
                    secundario: [fecha(g.fecha), g.tipo.toLowerCase(), g.proveedor].filter(Boolean).join(' · '),
                    monto: `− ${plata(g.monto)}`,
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
                    monto: `+ ${plata(x.monto)}`,
                  }))}
                  vacio=""
                />
              )}

              {/* Recién acá, con el detalle ya en mano: imprimir un resumen sin el desglose
                  sería darle al contador el mismo número que ya tenía y ninguna explicación. */}
              <div className="pt-1">
                <ImprimirRendicion
                  rendicion={detalle.data}
                  propietario={propietario}
                  inmobiliaria={inmobiliaria}
                  periodoLargo={periodoLargo(r.periodo)}
                  money={plata}
                  fecha={fecha}
                />
              </div>
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
/**
 * Cuánto le queda al contrato.
 *
 * Se calcula con la fecha civil, no con `new Date()` a secas: comparar timestamps con hora
 * hacía que el último día del contrato ya contara como vencido a la mañana.
 */
export function diasHasta(hasta: string, hoy = new Date()): number {
  const [y, m, d] = hasta.split('-').map(Number);
  if (!y || !m || !d) return Number.NaN;
  const fin = Date.UTC(y, m - 1, d);
  const inicio = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((fin - inicio) / 86_400_000);
}

function VenceContrato({ hasta }: { hasta: string }) {
  const dias = diasHasta(hasta);
  if (Number.isNaN(dias)) return null;
  if (dias < 0) {
    return (
      <p className="text-xs text-muted-foreground">
        El contrato venció el {fecha(hasta)}. Si sigue viviendo ahí, preguntale a tu inmobiliaria
        cómo quedó.
      </p>
    );
  }
  // 90 días: es lo que necesita el dueño para decidir si renueva o sale a buscar inquilino.
  const cerca = dias <= 90;
  return (
    <p className={cerca ? 'text-xs font-medium text-amber-700 dark:text-amber-500' : 'text-xs text-muted-foreground'}>
      Contrato hasta el {fecha(hasta)}
      {cerca && ` · ${dias === 0 ? 'vence hoy' : dias === 1 ? 'queda 1 día' : `quedan ${dias} días`}`}
    </p>
  );
}

export function FilaPropiedad({ p }: { p: PropiedadPortal }) {
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
          {/* Hasta cuándo va el contrato. La API mandaba `desde` y `hasta` desde el día uno y la
              pantalla los tiraba — y es lo primero que un dueño quiere saber para decidir si
              renueva o si sale a buscar inquilino. El aviso aparece a 90 días, que es el tiempo
              que necesita para cualquiera de las dos cosas. */}
          <VenceContrato hasta={c.hasta} />
          {/* El backend manda los últimos 6 períodos (`take: 6`) y la pantalla los listaba sin
              decir que había más: el dueño que quiere revisar el año leía seis meses y creía
              que eso era todo. Se deriva del largo real para que no mienta si el tope cambia. */}
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {c.periodos.length === 1 ? 'Último mes' : `Últimos ${c.periodos.length} meses`}
          </p>
          <div className="space-y-1">
            {c.periodos.map((per) => (
              <div key={per.periodo} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{periodoLargo(per.periodo)}</span>
                <span className="flex items-center gap-2">
                  {/* La condonación manda sobre el resto del renglón: una cuota perdonada
                      figura PAGADO en la liquidación, así que sin esto el dueño veía un badge
                      verde "pagado" por plata que NUNCA le va a llegar —la rendición filtra los
                      pagos condonados y no se la deposita—. El backend ya mandaba el dato; era
                      el front el que lo tiraba. */}
                  {per.condonada ? (
                    <span className="text-muted-foreground">la inmobiliaria la condonó</span>
                  ) : per.pagoAt ? (
                    <span className="text-muted-foreground">pagó el {fecha(per.pagoAt)}</span>
                  ) : (
                    <span className="text-muted-foreground">vence el {fecha(per.vence)}</span>
                  )}
                  <Badge
                    variant={
                      per.condonada
                        ? 'outline'
                        : per.estado === 'PAGADO'
                          ? 'success'
                          : per.estado === 'VENCIDO'
                            ? 'destructive'
                            : 'warning'
                    }
                    className="text-[10px]"
                  >
                    {per.condonada ? 'condonada' : per.estado.toLowerCase()}
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

