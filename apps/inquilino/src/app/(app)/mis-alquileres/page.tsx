'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Check, Loader2, MapPin, RotateCcw } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { toast } from '@llave/ui/use-toast';
import { NavBar } from '@/components/nav-bar';
import { apiEnabled, ApiError } from '@/lib/api/client';
import { leerSesion } from '@/lib/auth-otp';
import { elegirAlquiler, listarAlquileres, type Alquiler } from '@/lib/auth-otp-api';

/**
 * Switcher "Mis alquileres": una persona (email) con varios contratos puede
 * cambiar de alquiler sin re-loguear. Lista los alquileres con el persona-token
 * (vigente 15 días desde el login) y al elegir uno emite un token de contrato
 * nuevo + actualiza la sesión local. Si el persona-token venció, ofrece volver
 * a entrar (la sesión del alquiler actual sigue intacta hasta entonces).
 */
export default function MisAlquileresPage() {
  const router = useRouter();
  const [alquileres, setAlquileres] = useState<Alquiler[] | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'vencido' | 'error'>('cargando');
  const [cambiando, setCambiando] = useState<string | null>(null);
  const [actualId, setActualId] = useState<string | null>(null);

  // En demo (sin API) este flujo no aplica: volvemos a la cuenta.
  useEffect(() => {
    if (!apiEnabled) router.replace('/cuenta');
  }, [router]);

  const cargar = useCallback(async () => {
    setEstado('cargando');
    setActualId(leerSesion()?.inquilinoId ?? null);
    try {
      const lista = await listarAlquileres();
      setAlquileres(lista);
      setEstado('ok');
    } catch (e) {
      // 401 = persona-token vencido → re-login. Otro error = reintentable.
      setEstado(e instanceof ApiError && e.status === 401 ? 'vencido' : 'error');
    }
  }, []);

  useEffect(() => {
    if (apiEnabled) void cargar();
  }, [cargar]);

  const onCambiar = async (a: Alquiler) => {
    if (cambiando || a.inquilinoId === actualId) return;
    setCambiando(a.inquilinoId);
    try {
      const sesion = await elegirAlquiler(a.inquilinoId, alquileres?.length ?? 1);
      toast({ title: 'Cambiaste de alquiler', description: sesion.direccion || a.direccion });
      router.replace('/');
    } catch (e) {
      setCambiando(null);
      if (e instanceof ApiError && e.status === 401) {
        setEstado('vencido');
        return;
      }
      toast({
        title: 'No pudimos cambiar de alquiler',
        description: 'Probá de nuevo en un momento.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <header className="flex items-center gap-3 p-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Mis alquileres</h1>
          <p className="text-sm text-muted-foreground">Cambiá de alquiler sin volver a entrar</p>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-5 pb-6 md:px-8">
        {estado === 'cargando' && (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando tus alquileres…</span>
          </div>
        )}

        {estado === 'vencido' && (
          <Card className="space-y-3 p-5 text-center">
            <p className="text-sm text-muted-foreground">
              Para cambiar de alquiler necesitás volver a entrar con tu email.
            </p>
            <Button className="w-full" onClick={() => router.push('/login?force=1')}>
              Volver a entrar
            </Button>
          </Card>
        )}

        {estado === 'error' && (
          <Card className="space-y-3 p-5 text-center">
            <p className="text-sm text-muted-foreground">No pudimos cargar tus alquileres.</p>
            <Button variant="outline" className="w-full" onClick={() => void cargar()}>
              <RotateCcw className="h-4 w-4" />
              Reintentar
            </Button>
          </Card>
        )}

        {estado === 'ok' && alquileres && (
          <ul role="list" className="space-y-2.5">
            {alquileres.map((a) => {
              const esActual = a.inquilinoId === actualId;
              const cargando = cambiando === a.inquilinoId;
              return (
                <li key={a.inquilinoId}>
                  <button
                    type="button"
                    onClick={() => onCambiar(a)}
                    disabled={cambiando !== null || esActual}
                    aria-current={esActual ? 'true' : undefined}
                    className={`group flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-all focus:outline-none focus:ring-4 focus:ring-primary/20 ${
                      esActual
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-background hover:border-primary hover:bg-primary/5 disabled:opacity-60'
                    }`}
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{a.direccion || 'Tu alquiler'}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {a.inmobiliaria}
                          {a.ciudad ? ` · ${a.ciudad}` : ''}
                        </span>
                      </p>
                    </div>
                    {cargando ? (
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                    ) : esActual ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                        <Check className="h-3 w-3" />
                        Actual
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        Entrar
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <NavBar />
    </>
  );
}
