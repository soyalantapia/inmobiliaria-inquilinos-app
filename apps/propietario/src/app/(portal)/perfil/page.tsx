'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, User } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { Cargando, ErrorCarga, Seccion } from '@/components/bloques';
import { ContactoInmo } from '@/components/portal-piezas';
import { SelectorCartera } from '@/components/selector-cartera';
import { apiFetch, ApiError, cerrarSesion, type MiCartera } from '@/lib/api';
import { cuit as formatearCuit } from '@/lib/format';

/**
 * Pestaña MI PERFIL: sus datos, quién le administra y la salida.
 *
 * Son los datos que la inmobiliaria tiene cargados de él. **Se muestran, no se editan**: el
 * portal es de sólo lectura de punta a punta y no hay ningún endpoint de escritura. Un
 * formulario que no guarda sería peor que no tenerlo, así que el texto dice a quién pedirle el
 * cambio y le deja el contacto ahí mismo.
 *
 * El CBU NO aparece, y es a propósito: el backend no lo devuelve para no agrandar lo que se
 * filtra si le roban el token, y el dueño ya se lo sabe.
 */
export default function PerfilPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const cartera = useQuery({ queryKey: ['mi-cartera'], queryFn: () => apiFetch<MiCartera>('/portal/mi-cartera') });

  const salir = () => {
    cerrarSesion();
    // Borrar el token no alcanza: el cache de react-query vive en memoria y sobrevive al
    // logout. En la computadora de la inmobiliaria, donde dos propietarios entran uno
    // después del otro, el segundo veía las rendiciones del primero hasta que llegara el
    // refetch. Es plata de otra persona en pantalla.
    qc.clear();
    router.replace('/login');
  };

  if (cartera.isPending) return <Cargando />;
  if (cartera.isError) {
    return <ErrorCarga mensaje={cartera.error instanceof ApiError ? cartera.error.message : undefined} />;
  }
  const c = cartera.data;

  return (
    <div className="space-y-6">
      <Seccion titulo="Tus datos" icono={<User className="h-4 w-4" />}>
        <Card className="divide-y">
          <Dato label="Nombre" valor={c.nombre} />
          <Dato label="Email" valor={c.email || '—'} />
          <Dato label="Teléfono" valor={c.telefono || '—'} />
          <Dato label="CUIT" valor={c.cuit ? formatearCuit(c.cuit) : '—'} />
          <Dato
            label="Comisión de la inmobiliaria"
            valor={`${c.comisionPct}%`}
            nota="Es la que se descuenta de cada rendición."
          />
        </Card>
        <p className="px-1 text-xs text-muted-foreground">
          Estos datos los administra {c.inmobiliaria.nombre}. Si alguno está mal o cambió, pedíselo a
          ellos y lo corrigen.
        </p>
      </Seccion>

      <Seccion titulo="Quién administra tus unidades" icono={<User className="h-4 w-4" />}>
        <Card className="space-y-2 p-4">
          <p className="font-medium">{c.inmobiliaria.nombre}</p>
          <ContactoInmo inmo={c.inmobiliaria} />
        </Card>
      </Seccion>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        {/* Sólo aparece si esta persona es propietaria en más de una inmobiliaria. */}
        <SelectorCartera />
        <Button variant="outline" onClick={salir}>
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}

function Dato({ label, valor, nota }: { label: string; valor: string; nota?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        {nota && <p className="text-xs text-muted-foreground/80">{nota}</p>}
      </div>
      <p className="shrink-0 text-sm font-medium">{valor}</p>
    </div>
  );
}
