'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@llave/ui/button';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { AuthShell } from '@/components/auth-shell';
import { apiEnabled } from '@/lib/api/client';
import { registrar } from '@/lib/api/registro';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Paso1 = {
  nombre: string;
  email: string;
  telefono: string;
  ciudad: string;
  provincia: string;
};

type Paso2 = {
  nombre: string;
  apellido: string;
  password: string;
  confirmar: string;
};

type Errores = Partial<Record<string, string>>;

export default function RegistroPage() {
  return (
    <AuthShell>
      <RegistroWizard />
    </AuthShell>
  );
}

function RegistroWizard() {
  const router = useRouter();
  const [paso, setPaso] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [inmo, setInmo] = useState<Paso1>({
    nombre: '',
    email: '',
    telefono: '',
    ciudad: '',
    provincia: '',
  });
  const [admin, setAdmin] = useState<Paso2>({
    nombre: '',
    apellido: '',
    password: '',
    confirmar: '',
  });
  const [errores, setErrores] = useState<Errores>({});

  // Prefill desde la landing: el hero manda /registro?email=…&nombre=… para que
  // el alta arranque con lo que ya escribió. Se setea tras montar (evita
  // mismatch de hidratación) y no pisa lo que el usuario haya tipeado.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const email = sp.get('email')?.trim();
    const nombre = sp.get('nombre')?.trim();
    if (!email && !nombre) return;
    setInmo((prev) => ({
      ...prev,
      email: email && !prev.email ? email : prev.email,
      nombre: nombre && !prev.nombre ? nombre : prev.nombre,
    }));
  }, []);

  const validarPaso1 = (): boolean => {
    const e: Errores = {};
    if (!inmo.nombre.trim()) e.nombre = 'Ingresá el nombre de la inmobiliaria.';
    if (!inmo.email.trim()) e.email = 'Ingresá un email.';
    else if (!EMAIL_RE.test(inmo.email.trim())) e.email = 'El email no parece válido.';
    if (!inmo.telefono.trim()) e.telefono = 'Ingresá un teléfono.';
    if (!inmo.ciudad.trim()) e.ciudad = 'Ingresá la ciudad.';
    if (!inmo.provincia.trim()) e.provincia = 'Ingresá la provincia.';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const validarPaso2 = (): boolean => {
    const e: Errores = {};
    if (!admin.nombre.trim()) e.aNombre = 'Ingresá tu nombre.';
    if (!admin.apellido.trim()) e.aApellido = 'Ingresá tu apellido.';
    if (!admin.password) e.password = 'Ingresá una contraseña.';
    else if (admin.password.length < 8) e.password = 'Mínimo 8 caracteres.';
    if (admin.confirmar !== admin.password) e.confirmar = 'Las contraseñas no coinciden.';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const irAPaso2 = (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    if (validarPaso1()) {
      setErrores({});
      setPaso(2);
    }
  };

  const volver = () => {
    setServerError(null);
    setErrores({});
    setPaso(1);
  };

  const crearCuenta = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    if (!validarPaso2()) return;
    setLoading(true);
    try {
      if (!apiEnabled) {
        // Demo sin backend: no hay alta real, entramos directo.
        router.push('/?bienvenida=1');
        return;
      }
      await registrar({
        inmobiliaria: {
          nombre: inmo.nombre.trim(),
          email: inmo.email.trim().toLowerCase(),
          telefono: inmo.telefono.trim(),
          ciudad: inmo.ciudad.trim(),
          provincia: inmo.provincia.trim(),
        },
        admin: {
          nombre: admin.nombre.trim(),
          apellido: admin.apellido.trim(),
          password: admin.password,
        },
      });
      router.push('/?bienvenida=1');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Probá My Alquiler gratis
        </h1>
        <ProgresoPasos paso={paso} />
      </div>

      {serverError && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {serverError}
        </p>
      )}

      {paso === 1 ? (
        <form onSubmit={irAPaso2} className="space-y-5" noValidate>
          <Field
            id="inmo-nombre"
            label="Nombre de la inmobiliaria"
            value={inmo.nombre}
            onChange={(v) => setInmo({ ...inmo, nombre: v })}
            placeholder="Inmobiliaria Ejemplo"
            error={errores.nombre}
          />
          <Field
            id="inmo-email"
            label="Email"
            type="email"
            autoComplete="email"
            value={inmo.email}
            onChange={(v) => setInmo({ ...inmo, email: v })}
            placeholder="contacto@tuinmobiliaria.com"
            error={errores.email}
          />
          <Field
            id="inmo-telefono"
            label="Teléfono"
            type="tel"
            autoComplete="tel"
            value={inmo.telefono}
            onChange={(v) => setInmo({ ...inmo, telefono: v })}
            placeholder="+54 9 11 5555 5555"
            error={errores.telefono}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              id="inmo-ciudad"
              label="Ciudad"
              autoComplete="address-level2"
              value={inmo.ciudad}
              onChange={(v) => setInmo({ ...inmo, ciudad: v })}
              placeholder="Córdoba"
              error={errores.ciudad}
            />
            <Field
              id="inmo-provincia"
              label="Provincia"
              autoComplete="address-level1"
              value={inmo.provincia}
              onChange={(v) => setInmo({ ...inmo, provincia: v })}
              placeholder="Córdoba"
              error={errores.provincia}
            />
          </div>
          <Button type="submit" className="w-full" size="lg">
            Siguiente
          </Button>
        </form>
      ) : (
        <form onSubmit={crearCuenta} className="space-y-5" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field
              id="admin-nombre"
              label="Nombre"
              autoComplete="given-name"
              value={admin.nombre}
              onChange={(v) => setAdmin({ ...admin, nombre: v })}
              placeholder="Juan"
              error={errores.aNombre}
            />
            <Field
              id="admin-apellido"
              label="Apellido"
              autoComplete="family-name"
              value={admin.apellido}
              onChange={(v) => setAdmin({ ...admin, apellido: v })}
              placeholder="Pérez"
              error={errores.aApellido}
            />
          </div>
          <Field
            id="admin-password"
            label="Contraseña"
            type="password"
            autoComplete="new-password"
            value={admin.password}
            onChange={(v) => setAdmin({ ...admin, password: v })}
            placeholder="Mínimo 8 caracteres"
            error={errores.password}
          />
          <Field
            id="admin-confirmar"
            label="Confirmar contraseña"
            type="password"
            autoComplete="new-password"
            value={admin.confirmar}
            onChange={(v) => setAdmin({ ...admin, confirmar: v })}
            placeholder="Repetí la contraseña"
            error={errores.confirmar}
          />
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={volver}
              disabled={loading}
            >
              Atrás
            </Button>
            <Button type="submit" size="lg" className="flex-1" disabled={loading}>
              {loading ? 'Creando…' : 'Crear cuenta'}
            </Button>
          </div>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}

function ProgresoPasos({ paso }: { paso: 1 | 2 }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            paso >= 1 ? 'bg-primary' : 'bg-violet-100'
          }`}
        />
        <span
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            paso >= 2 ? 'bg-primary' : 'bg-violet-100'
          }`}
        />
      </div>
      <p className="text-xs font-medium text-muted-foreground">
        {paso === 1 ? 'Paso 1 de 2 · Tu inmobiliaria' : 'Paso 2 de 2 · Tu acceso'}
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
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
