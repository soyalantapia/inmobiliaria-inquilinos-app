'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, UserMinus } from 'lucide-react';
import { Button } from '@llave/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import { ApiError, apiEnabled, apiFetch, varianteError } from '@/lib/api/client';
import { ensureApiSession } from '@/lib/api/session';
import { useCargarDeudaHistorica } from '@/lib/api/use-ajustes';
import type { PersonaListado } from '@/lib/api/use-inquilinos';

/**
 * Cargar la deuda de un inquilino ANTERIOR que se fue debiendo.
 *
 * Nace del pedido de Camila: arranca con ~50 morosos históricos y el alta normal
 * no los admite (rechaza si la propiedad ya tiene contrato activo, y la propiedad
 * del moroso de hace tres años hoy está alquilada a otro). Por eso este diálogo
 * vive en la PROPIEDAD y no en "nuevo contrato": el operador está parado donde
 * pasó la deuda.
 *
 * Lo que se carga NO es un alquiler: es la ventana de meses adeudados. Si alquiló
 * dos años y se fue debiendo los últimos tres, se cargan esos tres.
 */

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  propiedadId: string;
  direccion: string;
}

/** Primer día del mes de un input type="month" ("2024-03" → "2024-03-01"). */
function inicioDeMes(periodo: string): string {
  return `${periodo}-01`;
}

/** Último día del mes de un input type="month" ("2024-05" → "2024-05-31"). */
function finDeMes(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number);
  if (!y || !m) return `${periodo}-28`;
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${periodo}-${String(ultimo).padStart(2, '0')}`;
}

/** El mes anterior al actual, en formato "YYYY-MM". */
function mesPasado(): string {
  const hoy = new Date();
  const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function CargarDeudaHistoricaDialog({ open, onOpenChange, propiedadId, direccion }: Props) {
  const cargar = useCargarDeudaHistorica(propiedadId);

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');
  const [expensas, setExpensas] = useState('');

  /**
   * La coincidencia encontrada, GUARDADA JUNTO AL DNI QUE SE CONSULTÓ.
   *
   * El texto de ayuda prometía desde el día uno que "si esta persona ya está en tu cartera se
   * une a su ficha", pero nada lo verificaba: el merge pasaba adentro de la transacción y el
   * operador se enteraba nunca. Camila lo pidió textual: su sistema le avisa "ya estás
   * registrado" al tipear el DNI de alguien de hace seis años.
   *
   * POR QUÉ EL PAR Y NO LA PERSONA SOLA: guardando sólo la persona, entre que el operador
   * corrige un dígito y vuelve la consulta nueva quedan 350 ms + red en los que el cartel
   * seguía nombrando a la persona del DNI ANTERIOR. En esa ventana un click en "Usar sus
   * datos" armaba `personaId` de A con el DNI de B —y el backend, cuando recibe `personaId`,
   * ni mira el DNI— así que la deuda terminaba colgada de un inocente. Con el par, la
   * coincidencia es estado DERIVADO: si el DNI de la pantalla no es el que se consultó, no hay
   * cartel. Es imposible que quede viejo.
   */
  const [match, setMatch] = useState<{ dni: string; persona: PersonaListado } | null>(null);
  const yaEnCartera = match && match.dni === dni ? match.persona : null;
  /** Se manda sólo si el operador confirmó la coincidencia. Ver el aviso, más abajo. */
  const [personaId, setPersonaId] = useState<string | null>(null);

  const tope = mesPasado();

  /**
   * Aviso por DNI tipeado. AVISA, NO BLOQUEA, y no es una omisión: el merge por DNI es
   * deliberado —lo sostiene el `@@unique([inmobiliariaId, dni])` de Persona— y es lo que
   * permite que el mismo inquilino tenga varios alquileres. Bloquearlo rompería justo eso.
   *
   * El `!apiEnabled` NO es defensivo de más: este diálogo se monta SIN gate de apiEnabled en
   * la ficha de la propiedad (sólo el botón que lo abre está gateado), así que su cuerpo corre
   * en el build demo igual. Sin esta línea, en demo le pegaríamos a `/personas?q=` con
   * `API_URL === ''`, o sea una URL relativa contra el host del panel.
   */
  useEffect(() => {
    if (!apiEnabled || dni.length < 7) {
      setMatch(null);
      return;
    }
    let vivo = true;
    const consultado = dni;
    const timer = setTimeout(async () => {
      try {
        await ensureApiSession();
        const r = await apiFetch<PersonaListado[]>(`/personas?q=${encodeURIComponent(consultado)}`);
        // Comparación EXACTA, no la del endpoint: `/personas?q=` filtra con `contains`, así que
        // un DNI a medio tipear (2845678) trae al 28456789. Avisar por un match parcial sería
        // avisar de alguien que no es, justo en una pantalla que crea deuda.
        const encontrada = r.find((p) => p.dni === consultado);
        if (vivo) setMatch(encontrada ? { dni: consultado, persona: encontrada } : null);
      } catch {
        // Sin conexión no inventamos un aviso ni damos el DNI por limpio: no decimos nada,
        // igual que antes de este cambio.
        if (vivo) setMatch(null);
      }
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [dni]);

  // Cuántos meses se van a generar, para que el operador lo vea ANTES de
  // confirmar: está creando deuda y el número tiene que ser el que espera.
  const meses = useMemo(() => {
    if (!desde || !hasta) return null;
    const [ya, ma] = desde.split('-').map(Number);
    const [yb, mb] = hasta.split('-').map(Number);
    if (!ya || !ma || !yb || !mb) return null;
    const n = (yb - ya) * 12 + (mb - ma) + 1;
    return n > 0 ? n : null;
  }, [desde, hasta]);

  const montoNum = Number(monto.replace(',', '.'));
  const expensasNum = expensas.trim() === '' ? null : Number(expensas.replace(',', '.'));
  const totalMes = montoNum > 0 ? montoNum + (expensasNum ?? 0) : null;

  const puedeGuardar =
    nombre.trim().length > 0 &&
    montoNum > 0 &&
    meses !== null &&
    desde <= tope &&
    hasta <= tope &&
    !cargar.isPending;

  function limpiar() {
    setNombre('');
    setApellido('');
    setDni('');
    setTelefono('');
    setDesde('');
    setHasta('');
    setMonto('');
    setMoneda('ARS');
    setExpensas('');
    setMatch(null);
    setPersonaId(null);
  }

  /**
   * Trae los datos de la ficha que ya existe, para no guardar el nombre mal tipeado.
   *
   * Sólo pisa lo que la ficha TIENE. Con `p.apellido ?? ''` le borraba al operador el apellido
   * que acababa de tipear de su planilla cada vez que la ficha vieja no lo tenía cargado —
   * quedándose con menos datos que antes de apretar el botón, que es lo contrario de lo que
   * promete.
   */
  function usarFichaExistente(p: PersonaListado) {
    setPersonaId(p.id);
    setNombre(p.nombre);
    if (p.apellido) setApellido(p.apellido);
    if (p.telefono) setTelefono(p.telefono);
  }

  async function guardar() {
    if (!puedeGuardar) return;
    try {
      const r = await cargar.mutateAsync({
        propiedadId,
        ...(personaId ? { personaId } : {}),
        inquilino: {
          nombre: nombre.trim(),
          ...(apellido.trim() ? { apellido: apellido.trim() } : {}),
          ...(dni.trim() ? { dni: dni.trim() } : {}),
          ...(telefono.trim() ? { telefono: telefono.trim() } : {}),
        },
        monto: montoNum,
        moneda,
        ...(expensasNum && expensasNum > 0 ? { montoExpensas: expensasNum } : {}),
        fechaInicio: inicioDeMes(desde),
        fechaFin: finDeMes(hasta),
        // El día no cambia cuánto debe, sólo la fecha de vencimiento de cuotas ya
        // vencidas. 10 es el default del sistema y no se le pregunta al operador:
        // una pregunta más en una carga de 50 filas, sin consecuencia real.
        diaPago: 10,
      });
      // Si había coincidencia, la deuda cayó en esa ficha, la haya confirmado el operador o
      // no. Son dos caminos distintos del backend que van al mismo lado: con `personaId` usa
      // esa Persona directo; sin él, `buscarOCrearPersona` la encuentra por DNI exacto. Y son
      // la misma porque `yaEnCartera` es estado derivado: sólo existe cuando el DNI de la
      // pantalla es el que se consultó.
      //
      // El toast nombra la ficha en los dos casos, y ESO ES LO QUE HAY QUE DECIR: si tipeó
      // "Juan Peres" y la ficha dice "Juan Pérez", ver el nombre de la ficha es lo que le
      // muestra que se unieron. Mostrarle su propio tipeo le esconde justamente el hecho.
      const ficha = yaEnCartera
        ? `${yaEnCartera.nombre} ${yaEnCartera.apellido ?? ''}`.trim()
        : null;
      toast({
        title: 'Deuda cargada',
        description: ficha
          ? `${r.periodosAdeudados} período(s) adeudado(s). Se sumaron a la ficha de ${ficha}, que ya estaba en tu cartera. La propiedad no cambió de estado.`
          : `${r.periodosAdeudados} período(s) adeudado(s) de ${nombre.trim()}. La propiedad no cambió de estado.`,
      });
      limpiar();
      onOpenChange(false);
    } catch (e) {
      toast({
        variant: varianteError(e),
        title: 'No se pudo cargar la deuda',
        description: e instanceof ApiError ? e.message : 'Probá de nuevo en unos segundos.',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserMinus className="h-4 w-4" />
            Deuda de un inquilino anterior
          </DialogTitle>
          <DialogDescription>
            Para alguien que ya se fue de {direccion} y quedó debiendo. Queda registrado como
            contrato terminado: <strong>no ocupa la propiedad</strong> ni afecta al inquilino que
            vive ahí hoy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dh-nombre">Nombre *</Label>
              <Input id="dh-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dh-apellido">Apellido</Label>
              <Input id="dh-apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dh-dni">DNI</Label>
              <Input
                id="dh-dni"
                value={dni}
                // Sólo dígitos, igual que el alta normal. No es cosmética: el backend guarda el
                // DNI con un `.trim()` y nada más, así que un "20.123.456" tipeado con puntos
                // queda como una Persona distinta de "20123456" y no se une nunca a su ficha.
                onChange={(e) => {
                  setDni(e.target.value.replace(/\D/g, '').slice(0, 9));
                  setPersonaId(null);
                }}
                inputMode="numeric"
                placeholder="20123456"
                aria-describedby={yaEnCartera ? 'dh-dni-ya-existe' : 'dh-dni-ayuda'}
              />
              {yaEnCartera ? (
                <div
                  id="dh-dni-ya-existe"
                  // role="status": el cartel aparece 350 ms después de dejar de tipear, cuando el
                  // foco ya está en el campo. Cambiar el aria-describedby de un input que ya
                  // tiene el foco no se vuelve a anunciar, así que sin esto un lector de
                  // pantalla no se entera de nada.
                  role="status"
                  className="space-y-1.5 rounded-md border border-amber-300 bg-amber-50 p-2 dark:border-amber-900/40 dark:bg-amber-950/30"
                >
                  <p className="flex items-start gap-1.5 text-xs text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    {/* Dice lo que VA A PASAR, no lo que podría pasar: con este DNI la deuda
                        cae en esa ficha sí o sí. Un "ojo, puede que ya exista" haría dudar al
                        operador sobre algo que ya está decidido.
                        Y la salida que se nombra es la ÚNICA que existe de verdad: el DNI es
                        opcional y sin DNI el backend crea una ficha aparte. Decirle "revisá el
                        número" y nada más lo dejaba en un callejón cuando el número está bien
                        y la persona es otra. */}
                    <span>
                      Ya tenés a{' '}
                      <strong>
                        {yaEnCartera.nombre} {yaEnCartera.apellido ?? ''}
                      </strong>{' '}
                      con este DNI
                      {yaEnCartera.propiedad ? ` (${yaEnCartera.propiedad})` : ''}. Esta deuda se
                      suma a su ficha, no se duplica el inquilino. Si no es la misma persona,
                      revisá el número; si el número está bien, dejá el DNI vacío y cargala
                      aparte.
                    </span>
                  </p>
                  {personaId ? (
                    <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                      {/* Lo que realmente pasa: la Persona NO se actualiza (el backend con
                          `personaId` sólo la busca). Lo que se guarda con el contrato es lo que
                          quede en el formulario, así que la frase habla del formulario. */}
                      Traído de su ficha. Podés corregirlo antes de guardar.
                    </p>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => usarFichaExistente(yaEnCartera)}
                    >
                      Usar sus datos
                    </Button>
                  )}
                </div>
              ) : (
                <p id="dh-dni-ayuda" className="text-xs text-muted-foreground">
                  {/* Antes decía "se une a su ficha en vez de duplicarse", una garantía que el
                      sistema NO puede dar: las fichas importadas con el DNI en otro formato
                      ("20.123.456", o un CUIT) no matchean ni acá ni en el backend. Ahora
                      describe lo que hace, no lo que garantiza. Ver T-24-N2-N1. */}
                  Poné el DNI y te decimos si esa persona ya está en tu cartera.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dh-telefono">Teléfono</Label>
              <Input id="dh-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dh-desde">Debe desde *</Label>
              <Input
                id="dh-desde"
                type="month"
                max={tope}
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dh-hasta">Debe hasta *</Label>
              <Input
                id="dh-hasta"
                type="month"
                max={tope}
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dh-monto">Alquiler por mes *</Label>
              <Input
                id="dh-monto"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dh-expensas">Expensas por mes</Label>
              <Input
                id="dh-expensas"
                inputMode="decimal"
                value={expensas}
                onChange={(e) => setExpensas(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dh-moneda">Moneda</Label>
              <Select value={moneda} onValueChange={(v) => setMoneda(v as 'ARS' | 'USD')}>
                <SelectTrigger id="dh-moneda">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">Pesos</SelectItem>
                  <SelectItem value="USD">Dólares</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lo que se va a crear, en criollo y antes de confirmar. */}
          {meses !== null && totalMes !== null && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              Se van a cargar <strong>{meses}</strong> mes(es) adeudado(s) de{' '}
              <strong>
                {moneda === 'USD' ? 'US$' : '$'}
                {totalMes.toLocaleString('es-AR')}
              </strong>{' '}
              cada uno.
            </div>
          )}
          {(desde > tope || hasta > tope) && (
            <p className="text-sm text-destructive">
              La deuda histórica es de meses ya terminados. Si el inquilino sigue viviendo ahí,
              cargalo como contrato normal.
            </p>
          )}
          {desde && hasta && meses === null && (
            <p className="text-sm text-destructive">
              El mes &quot;hasta&quot; tiene que ser igual o posterior al mes &quot;desde&quot;.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cargar.isPending}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!puedeGuardar}>
            {cargar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cargar deuda
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
