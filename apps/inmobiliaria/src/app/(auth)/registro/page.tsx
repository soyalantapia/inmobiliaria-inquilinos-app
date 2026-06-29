'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Zap } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { AuthShell } from '@/components/auth-shell';
import { apiEnabled } from '@/lib/api/client';
import { registrar } from '@/lib/api/registro';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Datos = {
  nombre: string; // nombre de la inmobiliaria
  email: string;
  telefono: string;
  adminNombre: string;
  adminApellido: string;
};

type Errores = Partial<Record<keyof Datos, string>>;

export default function RegistroPage() {
  return (
    <AuthShell>
      <RegistroForm />
    </AuthShell>
  );
}

function RegistroForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  // Si llegó redirigido desde el login (email sin cuenta) mostramos el cartel
  // con copy contextual ("no encontramos una cuenta…").
  const [desdeLogin, setDesdeLogin] = useState(false);

  const [datos, setDatos] = useState<Datos>({
    nombre: '',
    email: '',
    telefono: '',
    adminNombre: '',
    adminApellido: '',
  });
  const [errores, setErrores] = useState<Errores>({});

  // Prefill desde la landing o el login: ?email=…&nombre=…&nueva=1. Se setea
  // tras montar (evita mismatch de hidratación) y no pisa lo ya tipeado.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const email = sp.get('email')?.trim();
    const nombre = sp.get('nombre')?.trim();
    if (sp.get('nueva') === '1') setDesdeLogin(true);
    if (!email && !nombre) return;
    setDatos((prev) => ({
      ...prev,
      email: email && !prev.email ? email : prev.email,
      nombre: nombre && !prev.nombre ? nombre : prev.nombre,
    }));
  }, []);

  const set = (campo: keyof Datos, valor: string) => {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: undefined }));
  };

  const validar = (): boolean => {
    const e: Errores = {};
    if (!datos.nombre.trim()) e.nombre = 'Ingresá el nombre de la inmobiliaria.';
    if (!datos.email.trim()) e.email = 'Ingresá un email.';
    else if (!EMAIL_RE.test(datos.email.trim())) e.email = 'El email no parece válido.';
    // Teléfono es OPCIONAL — bajamos la fricción del alta. Sólo validamos el
    // formato si el usuario escribió algo.
    if (datos.telefono.trim() && datos.telefono.trim().length < 5)
      e.telefono = 'El teléfono no parece válido.';
    if (!datos.adminNombre.trim()) e.adminNombre = 'Ingresá tu nombre.';
    if (!datos.adminApellido.trim()) e.adminApellido = 'Ingresá tu apellido.';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const crearCuenta = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    if (!validar()) return;
    setLoading(true);
    try {
      if (!apiEnabled) {
        // Demo sin backend: no hay alta real, entramos directo.
        router.push('/?bienvenida=1');
        return;
      }
      await registrar({
        inmobiliaria: {
          nombre: datos.nombre.trim(),
          email: datos.email.trim().toLowerCase(),
          telefono: datos.telefono.trim(),
        },
        admin: {
          nombre: datos.adminNombre.trim(),
          apellido: datos.adminApellido.trim(),
        },
      });
      router.push('/?bienvenida=1');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-7">
      {/* Cartel: armá tu cuenta en segundos */}
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/40 dark:bg-violet-900/10">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-primary">Armá tu cuenta en segundos</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {desdeLogin
                ? 'No encontramos una cuenta con ese email. Creala acá: sin tarjeta y sin contraseña.'
                : 'Sin tarjeta y sin contraseña. Entrás con un código que te mandamos por mail.'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Probá My Alquiler gratis
        </h1>
        <p className="text-sm text-muted-foreground">Gratis hasta el lanzamiento. Cancelás cuando quieras.</p>
      </div>

      {serverError && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {serverError}
        </p>
      )}

      <form onSubmit={crearCuenta} className="space-y-5" noValidate>
        <Field
          id="inmo-nombre"
          label="Nombre de la inmobiliaria"
          value={datos.nombre}
          onChange={(v) => set('nombre', v)}
          placeholder="Inmobiliaria Ejemplo"
          error={errores.nombre}
        />
        <Field
          id="inmo-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={datos.email}
          onChange={(v) => set('email', v)}
          placeholder="contacto@tuinmobiliaria.com"
          error={errores.email}
        />
        <Field
          id="inmo-telefono"
          label="Teléfono"
          optional
          type="tel"
          autoComplete="tel"
          value={datos.telefono}
          onChange={(v) => set('telefono', v)}
          placeholder="+54 9 11 5555 5555"
          error={errores.telefono}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            id="admin-nombre"
            label="Tu nombre"
            autoComplete="given-name"
            value={datos.adminNombre}
            onChange={(v) => set('adminNombre', v)}
            placeholder="Juan"
            error={errores.adminNombre}
          />
          <Field
            id="admin-apellido"
            label="Tu apellido"
            autoComplete="family-name"
            value={datos.adminApellido}
            onChange={(v) => set('adminApellido', v)}
            placeholder="Pérez"
            error={errores.adminApellido}
          />
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? 'Creando…' : 'Crear cuenta gratis'}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Mail className="h-3.5 w-3.5" />
          Sin contraseñas: entrás siempre con un código que te mandamos por mail.
        </p>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  error,
  optional,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  optional?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
