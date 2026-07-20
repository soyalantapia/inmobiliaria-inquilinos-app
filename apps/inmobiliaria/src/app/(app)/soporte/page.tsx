'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronRight,
  Clock,
  EyeOff,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@llave/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Badge } from '@llave/ui/badge';
import { Label } from '@llave/ui/label';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import {
  getSoporteConfig,
  getIssue,
  listarIssues,
  patchIssue,
  soporteHabilitado,
  type PatchSoporteBody,
  type SoporteConfig,
  type SoporteEvent,
  type SoporteIssueDetail,
  type SoporteIssueListItem,
  type SoporteSeverity,
  type SoporteStatus,
} from '@/lib/soporte-api';
import { ApiError } from '@/lib/api/client';

type StatusTab = SoporteStatus | 'all';

/* ── helpers ── */

function fmtCuando(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-AR');
}

function fmtRelativo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'hace instantes';
  if (secs < 3600) return `hace ${Math.floor(secs / 60)} min`;
  if (secs < 86400) return `hace ${Math.floor(secs / 3600)} h`;
  return `hace ${Math.floor(secs / 86400)} d`;
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const SEV_LABELS: Record<SoporteSeverity, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
};

const STATUS_LABELS: Record<SoporteStatus, string> = {
  open: 'Abierto',
  resolved: 'Resuelto',
  snoozed: 'Silenciado',
  ignored: 'Ignorado',
};

function SevBadge({ sev }: { sev: SoporteSeverity }) {
  const cls =
    sev === 'critical'
      ? 'bg-red-100 text-red-700 border-red-300'
      : sev === 'high'
        ? 'bg-amber-100 text-amber-700 border-amber-300'
        : sev === 'medium'
          ? 'bg-orange-100 text-orange-700 border-orange-300'
          : 'bg-muted text-muted-foreground border-border';
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {SEV_LABELS[sev]}
    </span>
  );
}

function StatusBadge({ status }: { status: SoporteStatus }) {
  const cls =
    status === 'open'
      ? 'bg-amber-100 text-amber-700 border-amber-300'
      : status === 'resolved'
        ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
        : 'bg-muted text-muted-foreground border-border';
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

/* ── Página principal ── */

export default function SoportePage() {
  const backend = soporteHabilitado();
  const [cfg, setCfg] = useState<SoporteConfig | null>(null);
  const [cfgErr, setCfgErr] = useState<string | null>(null);
  const [tab, setTab] = useState<StatusTab>('open');
  const [severity, setSeverity] = useState<SoporteSeverity | ''>('');
  const [rows, setRows] = useState<SoporteIssueListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const timerRef = useRef<number | null>(null);
  const flash = useCallback((msg: string, ok = true) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    toast({ variant: ok ? 'success' : 'destructive', title: msg });
  }, []);

  const bump = () => setRefreshKey((k) => k + 1);

  // Config (una vez + al refrescar)
  useEffect(() => {
    if (!backend) return;
    let alive = true;
    getSoporteConfig()
      .then((c) => { if (alive) { setCfg(c); setCfgErr(null); } })
      .catch((e: unknown) => {
        if (alive)
          setCfgErr(e instanceof ApiError ? e.message : 'Error al cargar la configuración');
      });
    return () => { alive = false; };
  }, [backend, refreshKey]);

  // Lista de tickets
  useEffect(() => {
    if (!backend) { setLoading(false); return; }
    if (!cfg) return; // config aún cargando
    if (!cfg.configured) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    listarIssues({
      status: tab === 'all' ? undefined : tab,
      severity: severity || undefined,
      limit: 200,
    })
      .then((r) => { if (alive) setRows(r.issues); })
      .catch((e: unknown) => {
        if (alive)
          setError(e instanceof ApiError ? e.message : 'Error al cargar los tickets');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [backend, cfg, tab, severity, refreshKey]);

  const configured = cfg?.configured === true;
  const openCount = cfg?.configured ? cfg.project.counts.open : null;

  const tabs: { id: StatusTab; label: string }[] = [
    { id: 'open', label: 'Abiertos' },
    { id: 'resolved', label: 'Resueltos' },
    { id: 'snoozed', label: 'Silenciados' },
    { id: 'ignored', label: 'Ignorados' },
    { id: 'all', label: 'Todos' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Bug className="h-6 w-6 text-violet-600" />
            Soporte — Bugs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tickets de error capturados por Sonar en My Alquiler
          </p>
        </div>
        {backend && (
          <div className="flex items-center gap-3">
            {openCount != null && openCount > 0 && (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                {openCount} abierto{openCount !== 1 ? 's' : ''}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={bump} disabled={loading}>
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        )}
      </div>

      {!backend ? (
        <div className="rounded-lg border bg-muted/30 p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
          <p className="font-medium">El panel solo funciona con el backend real</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Seteá NEXT_PUBLIC_API_URL para conectarte al API de My Alquiler.
          </p>
        </div>
      ) : cfg && !configured ? (
        <div className="rounded-lg border bg-amber-50 p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
          <p className="font-medium">Sonar no está configurado</p>
          <p className="mt-1 max-w-md mx-auto text-sm text-muted-foreground">
            Seteá las variables de entorno{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">SONAR_API_URL</code>,{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">SONAR_LOGIN_EMAIL</code> y{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">SONAR_LOGIN_SECRET</code> en
            el API de My Alquiler.
          </p>
        </div>
      ) : (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Tabs de estado */}
            <div className="flex rounded-lg border bg-muted/40 p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === t.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {/* Filtro de severidad */}
            <select
              className="rounded-md border bg-background px-3 py-1.5 text-sm text-foreground"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as SoporteSeverity | '')}
              aria-label="Filtrar por severidad"
            >
              <option value="">Todas las severidades</option>
              <option value="critical">Crítico</option>
              <option value="high">Alto</option>
              <option value="medium">Medio</option>
              <option value="low">Bajo</option>
            </select>
          </div>

          {cfgErr && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {cfgErr}
            </div>
          )}

          {/* Tabla */}
          <div className="rounded-lg border bg-background">
            {loading ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Cargando tickets…</p>
            ) : error ? (
              <p className="p-8 text-center text-sm text-destructive">{error}</p>
            ) : !rows || rows.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
                <p className="font-medium">Sin tickets en este estado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cuando Sonar capture errores van a aparecer acá.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3">Severidad</th>
                      <th className="px-4 py-3">Ticket</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Ocurrencias</th>
                      <th className="px-4 py-3 font-medium">Último visto</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r) => (
                      <tr
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => setDetailId(r.id)}
                      >
                        <td className="px-4 py-3">
                          <SevBadge sev={r.severity} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{r.title}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="rounded bg-muted px-1.5 py-0.5">{humanize(r.kind)}</span>
                            {r.route && <span className="font-mono">{r.route}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{r.occurrenceCount}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {r.lastSeenAt ? fmtRelativo(r.lastSeenAt) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de detalle */}
      {detailId && (
        <DetalleModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onChanged={bump}
          flash={flash}
        />
      )}
    </div>
  );
}

/* ── Modal de detalle ── */

function DetalleModal({
  id,
  onClose,
  onChanged,
  flash,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  flash: (msg: string, ok?: boolean) => void;
}) {
  const [d, setD] = useState<SoporteIssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getIssue(id)
      .then((r) => { if (alive) setD(r.issue); })
      .catch((e: unknown) => {
        if (alive)
          setError(e instanceof ApiError ? e.message : 'Error al cargar el ticket');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, reload]);

  async function act(body: PatchSoporteBody, doneMsg: string) {
    if (busy || !d) return;
    setBusy(true);
    try {
      await patchIssue(d.id, { ...body, note: nota.trim() || undefined });
      setNota('');
      flash(doneMsg);
      setReload((k) => k + 1);
      onChanged();
    } catch (e: unknown) {
      flash(e instanceof ApiError ? e.message : 'Error al actualizar el ticket', false);
    } finally {
      setBusy(false);
    }
  }

  const latest = d?.occurrences[0];
  const rawObj = latest
    ? { payload: latest.payload, serverContext: latest.serverContext ?? undefined }
    : { context: d?.context };
  const hasPayload = latest ? latest.payload != null || latest.serverContext != null : d?.context != null;
  const rawJson = (() => {
    try { return JSON.stringify(rawObj, null, 2); } catch { return ''; }
  })();

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {d ? d.title : 'Detalle del ticket'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : error ? (
          <p className="py-8 text-center text-sm text-destructive">{error}</p>
        ) : d ? (
          <div className="space-y-4">
            {/* Chips de estado */}
            <div className="flex flex-wrap items-center gap-2">
              <SevBadge sev={d.severity} />
              <StatusBadge status={d.status} />
              <span className="rounded bg-muted px-2 py-0.5 text-xs">{humanize(d.kind)}</span>
              <span className="rounded bg-muted px-2 py-0.5 text-xs">{d.environment}</span>
            </div>

            {/* Metadata */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 text-sm">
              {[
                ['Tipo', humanize(d.kind)],
                ['Entorno', d.environment],
                ['Ruta', d.route ?? '—'],
                ['Release', d.release ?? '—'],
                ['Primera vez', d.firstSeenAt ? fmtCuando(d.firstSeenAt) : '—'],
                ['Última vez', d.lastSeenAt ? fmtCuando(d.lastSeenAt) : '—'],
                ['Ocurrencias', String(d.occurrenceCount)],
                ['Usuarios afectados', String(d.usersAffected)],
                ...(d.resolvedAt ? [['Resuelto', fmtCuando(d.resolvedAt)] as [string, string]] : []),
                ...(d.muteUntil ? [['Silenciado hasta', fmtCuando(d.muteUntil)] as [string, string]] : []),
              ].map(([label, val]) => (
                <div key={label}>
                  <dt className="text-[11px] text-muted-foreground">{label}</dt>
                  <dd className="font-medium text-foreground">{val}</dd>
                </div>
              ))}
            </dl>

            {/* Timeline */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Timeline
              </p>
              {d.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>
              ) : (
                <ol className="space-y-2">
                  {d.events.map((ev) => (
                    <EventoRow key={ev.id} ev={ev} />
                  ))}
                </ol>
              )}
            </div>

            {/* Payload colapsable */}
            <div className="rounded-lg border">
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/30"
              >
                <span>Payload del error{latest ? ` · ${fmtCuando(latest.createdAt)}` : ''}</span>
                <ChevronRight
                  className={`h-4 w-4 text-muted-foreground transition-transform ${showRaw ? 'rotate-90' : ''}`}
                />
              </button>
              {showRaw && (
                hasPayload && rawJson ? (
                  <pre className="max-h-72 overflow-auto border-t bg-muted/30 px-3 py-2 text-[11px] leading-relaxed">
                    {rawJson}
                  </pre>
                ) : (
                  <p className="border-t px-3 py-2 text-sm text-muted-foreground">Sin payload disponible.</p>
                )
              )}
            </div>

            {/* Acciones */}
            <div className="space-y-3 border-t pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="soporte-nota">Nota (opcional)</Label>
                <Textarea
                  id="soporte-nota"
                  rows={2}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Contexto, decisión o próximos pasos…"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {d.status !== 'resolved' && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => act({ status: 'resolved' }, 'Ticket marcado como resuelto')}
                    disabled={busy}
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Resolver
                  </Button>
                )}
                {d.status !== 'open' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act({ status: 'open' }, 'Ticket reabierto')}
                    disabled={busy}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Reabrir
                  </Button>
                )}
                {d.status !== 'snoozed' && d.status !== 'resolved' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act({ status: 'snoozed', snoozeHours: 24 }, 'Silenciado por 24 hs')}
                    disabled={busy}
                  >
                    <Clock className="mr-1.5 h-3.5 w-3.5" />
                    Silenciar 24 hs
                  </Button>
                )}
                {d.status !== 'ignored' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act({ status: 'ignored' }, 'Ticket ignorado')}
                    disabled={busy}
                  >
                    <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                    Ignorar
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EventoRow({ ev }: { ev: SoporteEvent }) {
  const label = humanize(ev.type);
  const transition =
    ev.fromStatus && ev.toStatus
      ? `${STATUS_LABELS[ev.fromStatus as SoporteStatus] ?? ev.fromStatus} → ${STATUS_LABELS[ev.toStatus as SoporteStatus] ?? ev.toStatus}`
      : ev.toStatus
        ? STATUS_LABELS[ev.toStatus as SoporteStatus] ?? ev.toStatus
        : null;

  return (
    <li className="flex gap-3 rounded-lg border bg-muted/30 px-3 py-2">
      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-500" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-[11px] text-muted-foreground">{fmtCuando(ev.createdAt)}</span>
        </div>
        {transition && <div className="text-xs text-muted-foreground">{transition}</div>}
        {ev.note && <div className="mt-0.5 text-sm text-foreground">{ev.note}</div>}
      </div>
    </li>
  );
}
