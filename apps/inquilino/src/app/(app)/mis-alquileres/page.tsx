'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, Check, Loader2, MapPin, RotateCcw } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { toast } from '@llave/ui/use-toast';
import { NavBar } from '@/components/nav-bar';
import { apiEnabled, ApiError, setPersonaToken } from '@/lib/api/client';
import { leerSesion } from '@/lib/auth-otp';
import { elegirAlquiler, esAlquilerTerminado, listarAlquileres, type Alquiler } from '@/lib/auth-otp-api';

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

  // Esta pantalla es del TITULAR: lista los alquileres de SU email y deja
  // cambiar entre ellos. A un co-inquilino lo invitaron a UN contrato ajeno, así
  // que no tiene nada para elegir acá; y si quedó un persona-token en el
  // dispositivo, es del titular que lo usó antes. Lo limpiamos y lo sacamos con
  // un mensaje propio: mandarlo a /login?force=1 (lo que hace el estado
  // "vencido") lo dejaría en un loop, porque el OTP solo reconoce titulares y le
  // responde "Código inválido" para siempre.
  useEffect(() => {
    if (!apiEnabled) return;
    if (leerSesion()?.esCoInquilino === true) {
      setPersonaToken(null);
      toast({
        title: 'Esta sección es del titular del alquiler',
        description: 'Si además alquilás una propiedad a tu nombre, entrá con tu email para verla.',
      });
      router.replace('/');
      return;
    }
    void cargar();
  }, [cargar, router]);

  const onCambiar = async (a: Alquiler) => {
    if (cambiando || a.inquilinoId === actualId) return;
    setCambiando(a.inquilinoId);
    try {
      const sesion = await elegirAlquiler(a.inquilinoId, alquileres?.length ?? 1);
      toast({ title: 'Cambiaste de alquiler', description: sesion.direccion || a.direccion });
      // HARD nav a propósito (no router.replace): el QueryClient vive en el layout
      // raíz y sobrevive a la navegación client-side, así que con soft nav la home
      // se pintaba con la caché del alquiler ANTERIOR (deuda de la otra propiedad).
      // Recargar la app entera la destruye, y de paso mata el race de un refetch
      // disparado con el token viejo que resuelve después del setToken.
      window.location.assign('/');
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
        {/* href fijo, no router.back(): a esta pantalla se puede llegar desde el
            sidenav, el header mobile o Mi cuenta, y con back el destino era
            impredecible (o salía de la app si fue la primera pantalla). */}
        <Link
          href="/"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Volver al inicio"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
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

        {estado === 'ok' && alquileres && alquileres.length === 0 && (
          <Card className="space-y-2 p-5 text-center">
            <p className="text-sm font-medium">No encontramos alquileres con tu email</p>
            <p className="text-xs text-muted-foreground">
              Si acabás de firmar, puede que tu inmobiliaria todavía no lo haya cargado.
            </p>
          </Card>
        )}

        {estado === 'ok' && alquileres && alquileres.length > 0 && (
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
                      <p className="flex items-center gap-2 truncate font-semibold">
                        <span className="min-w-0 truncate">{a.direccion || 'Tu alquiler'}</span>
                        {esAlquilerTerminado(a.estado) && (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Finalizado
                          </span>
                        )}
                      </p>
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
