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
  Save,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { toast } from '@llave/ui/use-toast';
import { NavBar } from '@/components/nav-bar';
import { relanzarOnboarding } from '@/components/onboarding';
import { cerrarSesion } from '@/lib/auth-otp';
import { contratoMock } from '@/lib/mock-data';
import { useCurrentUser } from '@/lib/use-current-user';

// Datos editables persistidos en localStorage. En backend real esto pega
// contra el endpoint del propio usuario.
const PROFILE_KEY = 'llave-inquilino:profile:v1';

interface ProfileOverride {
  fullName?: string;
  phone?: string;
  email?: string;
}

function leerProfile(): ProfileOverride {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as ProfileOverride) : {};
  } catch {
    return {};
  }
}

function guardarProfile(p: ProfileOverride): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

export default function CuentaPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [confirmandoLogout, setConfirmandoLogout] = useState(false);
  const [override, setOverride] = useState<ProfileOverride>({});
  const [dialogAbierto, setDialogAbierto] = useState(false);

  // Hidratación del override desde localStorage (post-mount)
  useEffect(() => {
    setOverride(leerProfile());
  }, []);

  // Datos efectivos: override > user del hook > defaults
  const fullName = override.fullName ?? user.fullName;
  const phone = override.phone ?? user.phone ?? '';
  const email = override.email ?? 'mariela.sosa@gmail.com';

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
              <p className="truncate text-xs text-muted-foreground">
                Inquilino · {contratoMock.direccion}
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <Field icon={<Phone className="h-4 w-4" />} label="Teléfono" value={phone || '—'} />
            <Field icon={<Mail className="h-4 w-4" />} label="Email" value={email} />
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setDialogAbierto(true)}
          >
            <User className="h-4 w-4" />
            Editar datos
          </Button>
        </Card>

        <EditarDatosDialog
          open={dialogAbierto}
          onOpenChange={setDialogAbierto}
          initial={{ fullName, phone, email }}
          onGuardar={(nuevo) => {
            setOverride(nuevo);
            guardarProfile(nuevo);
            setDialogAbierto(false);
            toast({
              title: 'Datos actualizados',
              description: 'Le avisamos a la inmobiliaria con tus nuevos datos.',
            });
          }}
        />

        {/* Ayuda y soporte */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ayuda
          </h2>
          <Card className="divide-y">
            <button
              onClick={relanzarOnboarding}
              className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <GraduationCap className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Ver tutorial otra vez</p>
                <p className="text-xs text-muted-foreground">Recorré las funciones principales paso a paso</p>
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
            <LinkRow
              icon={<FileText className="h-4 w-4" />}
              label="Mi contrato"
              descripcion="Ver los términos completos"
              href="/contrato"
            />
            <LinkRow
              icon={<FileText className="h-4 w-4" />}
              label="Mis documentos"
              descripcion="DNI, recibos, garantes — listos para renovar o mudarte"
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
              descripcion="Compartí el contrato con tu pareja, hermano o amigo"
              href="/co-inquilinos"
            />
            <LinkRow
              icon={<Wrench className="h-4 w-4" />}
              label="Profesionales recomendados"
              descripcion="Plomeros, electricistas y técnicos verificados"
              href="/profesionales"
            />
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
            Sobre Llave
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
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
        <p className="truncate text-xs text-muted-foreground">{descripcion}</p>
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

// ============================================================
// DIALOG: Editar datos personales
// ============================================================
function EditarDatosDialog({
  open,
  onOpenChange,
  initial,
  onGuardar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: { fullName: string; phone: string; email: string };
  onGuardar: (data: { fullName: string; phone: string; email: string }) => void;
}) {
  const [fullName, setFullName] = useState(initial.fullName);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [guardando, setGuardando] = useState(false);

  // Resetear los valores cada vez que se abre el dialog
  useEffect(() => {
    if (open) {
      setFullName(initial.fullName);
      setPhone(initial.phone);
      setEmail(initial.email);
    }
  }, [open, initial.fullName, initial.phone, initial.email]);

  // Validación básica
  const nombreOk = fullName.trim().length >= 3;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const telOk = phone.trim().length === 0 || phone.trim().length >= 6;
  const puedeGuardar = nombreOk && emailOk && telOk && !guardando;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeGuardar) return;
    setGuardando(true);
    // Simulación de delay de red
    await new Promise((r) => setTimeout(r, 350));
    onGuardar({
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });
    setGuardando(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar tus datos</DialogTitle>
          <DialogDescription>
            Si cambiás algún dato, la inmobiliaria lo recibe automáticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre completo</Label>
            <Input
              id="nombre"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Mariela Sosa"
              maxLength={80}
            />
            {!nombreOk && fullName.length > 0 && (
              <p className="text-xs text-destructive">Mínimo 3 caracteres</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+54 9 11 1234 5678"
              maxLength={30}
            />
            {!telOk && (
              <p className="text-xs text-destructive">Teléfono inválido</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vos@correo.com"
              maxLength={80}
            />
            {!emailOk && email.length > 0 && (
              <p className="text-xs text-destructive">Email inválido</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={!puedeGuardar}>
              <Save className="h-4 w-4" />
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

