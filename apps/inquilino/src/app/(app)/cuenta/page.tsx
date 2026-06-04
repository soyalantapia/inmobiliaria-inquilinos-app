'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  ChevronRight,
  CircleHelp,
  FileText,
  Globe,
  GraduationCap,
  LifeBuoy,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  User,
  Users,
  Wrench,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@llave/ui/avatar';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { NavBar } from '@/components/nav-bar';
import { relanzarOnboarding } from '@/components/onboarding';
import { cerrarSesion } from '@/lib/auth-otp';
import { contratoMock } from '@/lib/mock-data';
import { leerProfile, type ProfileOverride } from '@/lib/profile-override';
import { useCurrentUser } from '@/lib/use-current-user';

export default function CuentaPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [confirmandoLogout, setConfirmandoLogout] = useState(false);
  const [override, setOverride] = useState<ProfileOverride>({});

  // Hidratación del override desde localStorage (post-mount)
  useEffect(() => {
    setOverride(leerProfile());
  }, []);

  // Datos efectivos: override > user del hook > defaults
  const fullName = override.fullName ?? user.fullName;
  const phone = override.phone ?? user.phone ?? '';
  const email = override.email ?? user.email ?? '';

  return (
    <>
      <header className="p-5">
        <h1 className="text-2xl font-semibold md:text-3xl">Mi cuenta</h1>
        <p className="text-sm text-muted-foreground">Datos personales y preferencias</p>
      </header>

      <main className="flex-1 space-y-5 px-5 pb-6 md:px-8">
        {/* Card de perfil */}
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-2xl font-semibold text-primary-foreground">
                {user.initial}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="truncate text-lg font-semibold">{fullName}</p>
              {/* "Inquilino" hardcoded en masculino sonaba descuidado
                  para usuarias femeninas (Mariela ve "Inquilino").
                  Neutro y más cálido: "Tu hogar · [dirección]". */}
              <p className="truncate text-xs text-muted-foreground">
                Tu hogar · {contratoMock.direccion}
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <Field
              icon={<Phone className="h-4 w-4" />}
              label="Teléfono"
              value={phone || 'Sin agregar'}
              vacio={!phone}
              onAgregar={!phone ? () => router.push('/cuenta/editar') : undefined}
            />
            <Field icon={<Mail className="h-4 w-4" />} label="Email" value={email} />
          </div>

          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/cuenta/editar">
              <User className="h-4 w-4" />
              Editar datos
            </Link>
          </Button>
        </Card>

        {/* Sección "Tu hogar" — accesos rápidos a las pantallas relacionadas
            al contrato actual. Antes estaba todo mezclado bajo "Ayuda"
            (contrato + documentos + calendario + co-inquilinos + profesionales +
            ayuda + privacidad). Ahora separamos por intención del usuario. */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tu hogar
          </h2>
          <Card className="divide-y">
            {/* "Mi contrato → Ver términos" se removió porque
                duplicaba al tab "Contrato" del NavBar inferior. Dos
                puntos de entrada al mismo contenido confunden. El
                acceso al contrato sigue al toque desde el NavBar. */}
            <LinkRow
              icon={<FileText className="h-4 w-4" />}
              label="Mis documentos"
              descripcion="DNI, recibos y garantes"
              href="/documentos"
            />
            <LinkRow
              icon={<CalendarDays className="h-4 w-4" />}
              label="Mi calendario"
              descripcion="Pagos, ajustes y vencimientos en un solo lugar"
              href="/calendario"
            />
            <LinkRow
              icon={<Users className="h-4 w-4" />}
              label="Co-inquilinos"
              descripcion="Compartí el contrato con tu pareja o familia"
              href="/co-inquilinos"
            />
            <LinkRow
              icon={<Wrench className="h-4 w-4" />}
              label="Profesionales recomendados"
              descripcion="Plomeros, electricistas y técnicos verificados"
              href="/profesionales"
            />
          </Card>
        </section>

        {/* Sección "Ayuda y soporte" — atajos para resolver dudas. */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ayuda y soporte
          </h2>
          <Card className="divide-y">
            <button
              type="button"
              onClick={relanzarOnboarding}
              className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <GraduationCap className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Ver tutorial otra vez</p>
                <p className="text-xs text-muted-foreground">
                  Recorré las funciones principales paso a paso
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <LinkRow
              icon={<CircleHelp className="h-4 w-4" />}
              label="Preguntas frecuentes"
              descripcion="Aumentos, depósito, mascotas, etc."
              href="/ayuda"
            />
            <LinkRow
              icon={<LifeBuoy className="h-4 w-4" />}
              label="Hablar con un humano"
              descripcion="WhatsApp con la inmobiliaria"
              href={`https://wa.me/541145321100?text=${encodeURIComponent('Hola! Tengo una consulta sobre mi contrato.')}`}
              external
            />
          </Card>
        </section>

        {/* Sección "Legal" — info legal y de privacidad. */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Legal
          </h2>
          <Card>
            <LinkRow
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Privacidad y términos"
              descripcion="Cómo manejamos tus datos"
              href="/ayuda#privacidad"
            />
          </Card>
        </section>

        {/* Acerca de */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sobre My Alquiler
          </h2>
          <Card>
            <div className="flex items-center gap-3 p-4">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 text-sm">
                <p className="font-medium">Versión 0.1.0</p>
                <p className="text-xs text-muted-foreground">Última actualización: hoy</p>
              </div>
            </div>
          </Card>
        </section>

        {/* Logout */}
        <Card className="border-destructive/20">
          <button
            type="button"
            onClick={() => setConfirmandoLogout(true)}
            className="flex w-full items-center gap-3 p-4 text-left text-destructive transition-colors hover:bg-destructive/5"
          >
            <LogOut className="h-4 w-4" />
            <span className="flex-1 font-medium">Cerrar sesión</span>
            <ChevronRight className="h-4 w-4 opacity-50" />
          </button>
        </Card>
      </main>

      <NavBar />

      <ConfirmDialog
        open={confirmandoLogout}
        onOpenChange={setConfirmandoLogout}
        title="¿Cerrar sesión?"
        description="Vas a tener que ingresar de nuevo con tu email y un código de 6 dígitos."
        confirmLabel="Cerrar sesión"
        variant="destructive"
        onConfirm={() => {
          cerrarSesion();
          router.push('/login');
        }}
      />
    </>
  );
}

function Field({
  icon,
  label,
  value,
  vacio,
  onAgregar,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  vacio?: boolean;
  /** Si está vacío, mostrar un mini-CTA inline para completarlo sin
      tener que abrir el dialog "Editar datos" desde más abajo. */
  onAgregar?: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`truncate ${
            vacio ? 'italic text-muted-foreground' : 'font-medium'
          }`}
        >
          {value}
        </p>
      </div>
      {vacio && onAgregar && (
        <button
          type="button"
          onClick={onAgregar}
          className="shrink-0 rounded-full border border-dashed border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
          + Agregar
        </button>
      )}
    </div>
  );
}

function LinkRow({
  icon,
  label,
  descripcion,
  href,
  external,
}: {
  icon: React.ReactNode;
  label: string;
  descripcion: string;
  href: string;
  external?: boolean;
}) {
  const content = (
    <div className="flex w-full items-center gap-3 p-4 transition-colors hover:bg-muted/40">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {/* line-clamp-2 en vez de truncate — las descripciones de "Tu hogar"
            son contextuales y se cortaban feo en mobile ("DNI, recibos,
            garantes — listos para r..."). 2 líneas permite leerlas completas
            sin descontrolar el alto de la lista. */}
        <p className="line-clamp-2 text-xs text-muted-foreground">{descripcion}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }
  return <Link href={href}>{content}</Link>;
}
