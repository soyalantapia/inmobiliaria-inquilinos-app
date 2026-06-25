'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  CreditCard,
  Eye,
  Loader2,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { apiEnabled } from '@/lib/api/client';
import {
  aceptarInvitacionCoInquilino,
  leerInvitacionCoInquilino,
  type CoInvitacionDetalle,
} from '@/lib/auth-otp-api';

const PERMISO: Record<
  CoInvitacionDetalle['permiso'],
  { titulo: string; desc: string; Icon: typeof Eye }
> = {
  VER: {
    titulo: 'Solo lectura',
    desc: 'Vas a ver el contrato, las liquidaciones y los pagos. No vas a poder informar pagos.',
    Icon: Eye,
  },
  PAGAR: {
    titulo: 'Puede pagar',
    desc: 'Vas a ver todo y además podés informar los pagos del alquiler.',
    Icon: CreditCard,
  },
  COMPLETO: {
    titulo: 'Acceso completo',
    desc: 'Vas a ver todo, informar pagos y gestionar la cuenta del contrato.',
    Icon: ShieldCheck,
  },
};

export default function InvitacionPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const [detalle, setDetalle] = useState<CoInvitacionDetalle | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [aceptando, setAceptando] = useState(false);

  useEffect(() => {
    if (!apiEnabled) {
      setEstado('error');
      setErrorMsg('Las invitaciones funcionan en la app en vivo.');
      return;
    }
    if (!token) {
      setEstado('error');
      setErrorMsg('Falta el código de la invitación.');
      return;
    }
    let activo = true;
    leerInvitacionCoInquilino(token)
      .then((d) => {
        if (!activo) return;
        setDetalle(d);
        setEstado('ok');
      })
      .catch(() => {
        if (!activo) return;
        setEstado('error');
        setErrorMsg('La invitación no es válida o venció. Pedile al titular que te reenvíe el link.');
      });
    return () => {
      activo = false;
    };
  }, [token]);

  const aceptar = async () => {
    if (!token) return;
    setAceptando(true);
    setErrorMsg('');
    try {
      await aceptarInvitacionCoInquilino(token);
      router.replace('/');
    } catch {
      setAceptando(false);
      setErrorMsg('No pudimos confirmar la invitación. Probá de nuevo.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center px-5 py-10">
      {estado === 'cargando' && (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Cargando la invitación…</p>
        </div>
      )}

      {estado === 'error' && (
        <Card className="mx-auto w-full max-w-md space-y-4 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">No pudimos abrir la invitación</h1>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => router.replace('/login')}>
            Ir al inicio
          </Button>
        </Card>
      )}

      {estado === 'ok' && detalle && (
        <Card className="mx-auto w-full max-w-md space-y-5 p-6">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">Hola {detalle.nombre} 👋</h1>
              <p className="text-sm text-muted-foreground">
                {detalle.inmobiliaria
                  ? `${detalle.inmobiliaria} te sumó como co-inquilino`
                  : 'Te sumaron como co-inquilino'}
                {detalle.relacion ? ` (${detalle.relacion})` : ''} a este contrato:
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">
                {detalle.direccion || 'Domicilio del contrato'}
                {detalle.ciudad ? `, ${detalle.ciudad}` : ''}
              </span>
            </div>
            {detalle.inmobiliaria && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4 shrink-0" />
                <span>{detalle.inmobiliaria}</span>
              </div>
            )}
          </div>

          {(() => {
            const p = PERMISO[detalle.permiso];
            return (
              <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p.Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">Tu acceso: {p.titulo}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
              </div>
            );
          })()}

          {detalle.estado === 'ACEPTADO' && (
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Ya habías aceptado esta invitación.
            </p>
          )}

          {errorMsg && <p className="text-center text-sm text-destructive">{errorMsg}</p>}

          <Button className="w-full" onClick={aceptar} disabled={aceptando}>
            {aceptando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando…
              </>
            ) : (
              <>Aceptar y entrar</>
            )}
          </Button>
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Al entrar vas a acceder a la información de este contrato según tu nivel de acceso.
          </p>
        </Card>
      )}
    </div>
  );
}
