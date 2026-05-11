'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  ChevronRight,
  CircleHelp,
  FileText,
  Globe,
  Languages,
  LifeBuoy,
  LogOut,
  Mail,
  MessageCircle,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
  User,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@llave/ui/avatar';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { toast } from '@llave/ui/use-toast';
import { NavBar } from '@/components/nav-bar';
import { contratoMock } from '@/lib/mock-data';
import { useCurrentUser } from '@/lib/use-current-user';

// Preferencias guardadas en localStorage
const PREFS_KEY = 'llave:prefs:v1';

interface Prefs {
  notifWhatsapp: boolean;
  notifEmail: boolean;
  notifPush: boolean;
  idioma: 'es-AR' | 'en-US';
}

const PREFS_DEFAULT: Prefs = {
  notifWhatsapp: true,
  notifEmail: true,
  notifPush: false,
  idioma: 'es-AR',
};

function leerPrefs(): Prefs {
  if (typeof window === 'undefined') return PREFS_DEFAULT;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return PREFS_DEFAULT;
    return { ...PREFS_DEFAULT, ...JSON.parse(raw) };
  } catch {
    return PREFS_DEFAULT;
  }
}

function guardarPrefs(p: Prefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

export default function CuentaPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [prefs, setPrefs] = useState<Prefs>(() => leerPrefs());
  const [confirmandoLogout, setConfirmandoLogout] = useState(false);

  const setPref = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    guardarPrefs(next);
    toast({ title: 'Preferencia guardada' });
  };

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
              <p className="truncate text-lg font-semibold">{user.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">
                Inquilino · {contratoMock.direccion}
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <Field icon={<Phone className="h-4 w-4" />} label="Teléfono" value={user.phone ?? '—'} />
            <Field
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value="mariela.sosa@gmail.com"
            />
          </div>

          <Button variant="outline" size="sm" className="w-full">
            <User className="h-4 w-4" />
            Editar datos
          </Button>
        </Card>

        {/* Notificaciones */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notificaciones
          </h2>
          <Card className="divide-y">
            <ToggleRow
              icon={<MessageCircle className="h-4 w-4 text-emerald-600" />}
              label="WhatsApp"
              descripcion="Avisos de pago, ajustes y respuestas a reclamos"
              checked={prefs.notifWhatsapp}
              onChange={(v) => setPref('notifWhatsapp', v)}
            />
            <ToggleRow
              icon={<Mail className="h-4 w-4 text-blue-600" />}
              label="Email"
              descripcion="Comprobantes de pago y novedades del contrato"
              checked={prefs.notifEmail}
              onChange={(v) => setPref('notifEmail', v)}
            />
            <ToggleRow
              icon={<Bell className="h-4 w-4 text-amber-600" />}
              label="Push en la app"
              descripcion="Mientras tengas la PWA instalada"
              checked={prefs.notifPush}
              onChange={(v) => setPref('notifPush', v)}
            />
          </Card>
        </section>

        {/* Apariencia */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Apariencia
          </h2>
          <Card>
            <ThemeRow />
          </Card>
        </section>

        {/* Idioma */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Idioma
          </h2>
          <Card>
            <div className="flex items-center gap-3 p-4">
              <Languages className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">Idioma de la app</p>
                <p className="text-xs text-muted-foreground">
                  {prefs.idioma === 'es-AR' ? 'Español (Argentina)' : 'English (US)'}
                </p>
              </div>
              <select
                value={prefs.idioma}
                onChange={(e) => setPref('idioma', e.target.value as Prefs['idioma'])}
                className="rounded-md border bg-background px-2 py-1 text-sm"
              >
                <option value="es-AR">Español</option>
                <option value="en-US">English</option>
              </select>
            </div>
          </Card>
        </section>

        {/* Ayuda y soporte */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ayuda
          </h2>
          <Card className="divide-y">
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
        description="Vas a tener que ingresar de nuevo con tu número."
        confirmLabel="Cerrar sesión"
        variant="destructive"
        onConfirm={() => router.push('/login')}
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

function ToggleRow({
  icon,
  label,
  descripcion,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  descripcion: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{descripcion}</p>
      </div>
      <Toggle checked={checked} />
    </button>
  );
}

function Toggle({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
        checked ? 'bg-primary' : 'bg-muted',
      )}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </span>
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

// ThemeRow client-side: lee/escribe el theme directamente para mostrar el toggle
function ThemeRow() {
  const STORAGE_KEY = 'llave:theme';
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // hidratar tema
  useState(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial =
      stored === 'dark' || stored === 'light'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    setTheme(initial as 'light' | 'dark');
  });

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', next === 'dark');
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  return (
    <button onClick={toggle} className="flex w-full items-center gap-3 p-4 text-left">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted">
        {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Tema {theme === 'dark' ? 'oscuro' : 'claro'}</p>
        <p className="text-xs text-muted-foreground">
          Tocá para alternar al tema {theme === 'dark' ? 'claro' : 'oscuro'}
        </p>
      </div>
      <Toggle checked={theme === 'dark'} />
    </button>
  );
}
