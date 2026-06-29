'use client';

import { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import { apiEnabled } from '@/lib/api/client';
import {
  type CoInquilinoInvitado,
  type DocumentoAdjunto,
  crearInvitado,
  leerArchivoComoDataUrl,
} from '@/lib/inquilinos-invitados-storage';

type Paso = 1 | 2 | 3;

interface DocSlot {
  id: string;
  titulo: string;
  ayuda: string;
  requerido: boolean;
}

const SLOTS: DocSlot[] = [
  { id: 'dni-frente', titulo: 'DNI · frente', ayuda: 'Foto del frente del DNI', requerido: true },
  { id: 'dni-dorso', titulo: 'DNI · dorso', ayuda: 'Foto del dorso del DNI', requerido: true },
  { id: 'recibo-sueldo', titulo: 'Recibo de sueldo', ayuda: 'Último recibo cobrado', requerido: false },
  { id: 'garante', titulo: 'Documentación del garante', ayuda: 'Escritura o recibo del garante', requerido: false },
];

const PERMISOS: Array<{ value: CoInquilinoInvitado['permiso']; label: string; descripcion: string }> = [
  { value: 'VER', label: 'Solo ver', descripcion: 'Ve el contrato y los pagos, no puede operar' },
  { value: 'PAGAR', label: 'Ver y pagar', descripcion: 'Puede pagar el alquiler en nombre del inquilino' },
  { value: 'COMPLETO', label: 'Todo', descripcion: 'Mismo nivel que el inquilino principal' },
];

interface CargarInquilinoWizardProps {
  propiedadId: string;
  direccion: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}

export function CargarInquilinoWizard({
  propiedadId,
  direccion,
  open,
  onOpenChange,
  onCreated,
}: CargarInquilinoWizardProps) {
  const [paso, setPaso] = useState<Paso>(1);
  const [creando, setCreando] = useState(false);

  // Paso 1: datos principales
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fechaNac, setFechaNac] = useState('');

  // Paso 2: co-inquilinos
  const [coInquilinos, setCoInquilinos] = useState<CoInquilinoInvitado[]>([]);

  // Paso 3: documentos
  const [docsPorSlot, setDocsPorSlot] = useState<Record<string, DocumentoAdjunto>>({});

  const resetear = () => {
    setPaso(1);
    setNombre('');
    setApellido('');
    setEmail('');
    setDni('');
    setTelefono('');
    setFechaNac('');
    setCoInquilinos([]);
    setDocsPorSlot({});
  };

  const cerrar = (v: boolean) => {
    if (!v) {
      // Pequeño delay para que la animación del close termine antes de
      // resetear el estado interno
      setTimeout(resetear, 300);
    }
    onOpenChange(v);
  };

  // ===== Validación del paso 1 =====
  // WhatsApp es obligatorio (canal principal). Email opcional.
  const telefonoOk = telefono.replace(/[^\d]/g, '').length >= 8;
  const emailOk =
    email.trim().length === 0 ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const paso1Ok =
    nombre.trim().length >= 2 &&
    apellido.trim().length >= 2 &&
    telefonoOk &&
    emailOk &&
    dni.trim().length >= 7;

  const irPaso = (n: Paso) => setPaso(n);

  // ===== Crear el invitado =====
  const onCrear = async () => {
    // Salvaguarda en prod: el trigger ya deshabilita el botón, pero si por
    // algún camino se abre el wizard con el API activo, no persistimos nada
    // en localStorage — avisamos que el alta aún no está disponible.
    if (apiEnabled) {
      toast({
        title: 'Próximamente',
        description: 'La carga de inquilinos estará disponible pronto.',
      });
      cerrar(false);
      return;
    }
    if (!paso1Ok) {
      setPaso(1);
      return;
    }
    setCreando(true);
    try {
      await new Promise((r) => setTimeout(r, 400));
      const invitado = crearInvitado({
        propiedadId,
        nombre,
        apellido,
        telefono,
        email: email.trim() || undefined,
        dni,
        fechaNacimiento: fechaNac || null,
        coInquilinos,
        documentos: Object.values(docsPorSlot),
        invitadoPor: 'Roberto Tapia',
      });
      toast({
        title: '¡Inquilino cargado!',
        description: `Le mandamos a ${invitado.nombre} el link por WhatsApp para activar su cuenta.`,
      });
      onCreated?.();
      cerrar(false);
    } finally {
      setCreando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Nuevo inquilino
          </DialogTitle>
          <DialogDescription>
            Paso {paso} de 3 · {direccion}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper visual */}
        <Stepper actual={paso} />

        {paso === 1 && (
          <PasoDatos
            nombre={nombre}
            apellido={apellido}
            email={email}
            dni={dni}
            telefono={telefono}
            fechaNac={fechaNac}
            setNombre={setNombre}
            setApellido={setApellido}
            setEmail={setEmail}
            setDni={setDni}
            setTelefono={setTelefono}
            setFechaNac={setFechaNac}
            emailOk={emailOk}
            telefonoOk={telefonoOk}
          />
        )}

        {paso === 2 && (
          <PasoCoinquilinos
            coInquilinos={coInquilinos}
            setCoInquilinos={setCoInquilinos}
          />
        )}

        {paso === 3 && (
          <PasoDocumentos
            docsPorSlot={docsPorSlot}
            setDocsPorSlot={setDocsPorSlot}
          />
        )}

        {/* Footer con navegación */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
          {paso > 1 ? (
            <Button
              variant="outline"
              onClick={() => irPaso((paso - 1) as Paso)}
              disabled={creando}
            >
              <ArrowLeft className="h-4 w-4" />
              Atrás
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => cerrar(false)} disabled={creando}>
              Cancelar
            </Button>
          )}

          <div className="flex gap-2">
            {paso < 3 && (
              <Button
                variant={paso === 2 ? 'outline' : 'default'}
                onClick={() => irPaso((paso + 1) as Paso)}
                disabled={paso === 1 && !paso1Ok}
              >
                {/* En el paso de co-inquilinos: "Saltar" solo si no agregó
                    ninguno; si ya sumó alguno, "Continuar" (no estaría salteando). */}
                {paso === 2 ? (coInquilinos.length > 0 ? 'Continuar' : 'Saltar') : 'Siguiente'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {paso === 3 && (
              <>
                <Button variant="outline" onClick={onCrear} disabled={creando}>
                  Crear sin docs
                </Button>
                <Button onClick={onCrear} disabled={creando}>
                  {creando ? (
                    <>
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      Creando…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Crear inquilino
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================ */

function Stepper({ actual }: { actual: Paso }) {
  const pasos: Array<{ n: Paso; label: string }> = [
    { n: 1, label: 'Datos' },
    { n: 2, label: 'Co-inquilinos' },
    { n: 3, label: 'Documentos' },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {pasos.map((p, idx) => {
        const completo = actual > p.n;
        const activo = actual === p.n;
        return (
          <div key={p.n} className="flex flex-1 items-center gap-1.5">
            <div
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-colors ${
                completo
                  ? 'bg-emerald-500 text-white'
                  : activo
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {completo ? <CheckCircle2 className="h-3.5 w-3.5" /> : p.n}
            </div>
            <span
              className={`text-xs ${activo ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
            >
              {p.label}
            </span>
            {idx < pasos.length - 1 && (
              <div className={`h-px flex-1 ${completo ? 'bg-emerald-500' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
 * Paso 1: datos personales
 * ============================================================ */
function PasoDatos({
  nombre,
  apellido,
  email,
  dni,
  telefono,
  fechaNac,
  setNombre,
  setApellido,
  setEmail,
  setDni,
  setTelefono,
  setFechaNac,
  emailOk,
  telefonoOk,
}: {
  nombre: string;
  apellido: string;
  email: string;
  dni: string;
  telefono: string;
  fechaNac: string;
  setNombre: (v: string) => void;
  setApellido: (v: string) => void;
  setEmail: (v: string) => void;
  setDni: (v: string) => void;
  setTelefono: (v: string) => void;
  setFechaNac: (v: string) => void;
  emailOk: boolean;
  telefonoOk: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cargá los datos del inquilino principal. Después podés agregar co-inquilinos.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="María"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apellido">Apellido</Label>
          <Input
            id="apellido"
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            placeholder="González"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="telefono" className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1">💬 WhatsApp</span>
          <span className="text-[10px] font-medium text-primary">obligatorio</span>
        </Label>
        <Input
          id="telefono"
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="+54 9 11 1234 5678"
          className={
            telefono.length > 0 && !telefonoOk
              ? 'border-destructive focus-visible:ring-destructive'
              : ''
          }
        />
        {telefono.length > 0 && !telefonoOk && (
          <p className="text-[11px] text-destructive">
            Mínimo 8 dígitos (incluí código de área)
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">
          Le mandamos el link de activación por WhatsApp y toda la comunicación con el
          inquilino va por acá.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="dni">DNI</Label>
          <Input
            id="dni"
            inputMode="numeric"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            placeholder="32.456.789"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="flex items-center gap-1.5">
            Email
            <span className="text-[10px] font-normal text-muted-foreground">opcional</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="maria@correo.com"
            className={
              email.length > 0 && !emailOk
                ? 'border-destructive focus-visible:ring-destructive'
                : ''
            }
          />
          {email.length > 0 && !emailOk && (
            <p className="text-[11px] text-destructive">Email inválido</p>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fechaNac">Fecha de nacimiento (opcional)</Label>
        <Input
          id="fechaNac"
          type="date"
          value={fechaNac}
          onChange={(e) => setFechaNac(e.target.value)}
        />
      </div>
    </div>
  );
}

/* ============================================================
 * Paso 2: co-inquilinos
 * ============================================================ */
function PasoCoinquilinos({
  coInquilinos,
  setCoInquilinos,
}: {
  coInquilinos: CoInquilinoInvitado[];
  setCoInquilinos: React.Dispatch<React.SetStateAction<CoInquilinoInvitado[]>>;
}) {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [celularCo, setCelularCo] = useState('');
  const [emailCo, setEmailCo] = useState('');
  const [relacion, setRelacion] = useState('Conviviente');
  const [permiso, setPermiso] = useState<CoInquilinoInvitado['permiso']>('PAGAR');

  const celularCoOk = celularCo.replace(/[^\d]/g, '').length >= 8;
  const emailCoOk =
    emailCo.trim().length === 0 ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCo.trim());
  const puedeAgregar =
    nombre.trim().length >= 2 &&
    apellido.trim().length >= 2 &&
    celularCoOk &&
    emailCoOk;

  const agregar = () => {
    setCoInquilinos((arr) => [
      ...arr,
      {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        celular: celularCo.trim(),
        email: emailCo.trim().toLowerCase() || undefined,
        relacion,
        permiso,
      },
    ]);
    setNombre('');
    setApellido('');
    setCelularCo('');
    setEmailCo('');
    setRelacion('Conviviente');
    setPermiso('PAGAR');
  };

  const eliminar = (idx: number) => {
    setCoInquilinos((arr) => arr.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        ¿Vive alguien más con el inquilino? Sumalo acá. También va a recibir su propio acceso a la app.
      </p>

      {coInquilinos.length > 0 && (
        <div className="space-y-2">
          {coInquilinos.map((c, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 rounded-md border bg-muted/30 p-3"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {c.nombre.charAt(0)}
                {c.apellido.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">
                  {c.nombre} {c.apellido}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.relacion} · 💬 {c.celular}
                  {c.email ? ` · ${c.email}` : ''}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {PERMISOS.find((p) => p.value === c.permiso)?.label}
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => eliminar(idx)}
                aria-label="Eliminar co-inquilino"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Agregar co-inquilino
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre"
          />
          <Input
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            placeholder="Apellido"
          />
        </div>
        <Input
          type="tel"
          value={celularCo}
          onChange={(e) => setCelularCo(e.target.value)}
          placeholder="💬 WhatsApp (obligatorio) · +54 11 5555-5555"
          className={
            celularCo.length > 0 && !celularCoOk
              ? 'border-destructive focus-visible:ring-destructive'
              : ''
          }
        />
        <Input
          type="email"
          value={emailCo}
          onChange={(e) => setEmailCo(e.target.value)}
          placeholder="Email (opcional)"
          className={
            emailCo.length > 0 && !emailCoOk
              ? 'border-destructive focus-visible:ring-destructive'
              : ''
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ciw-relacion" className="text-xs">Relación</Label>
            <Select value={relacion} onValueChange={setRelacion}>
              <SelectTrigger id="ciw-relacion">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Conviviente">Conviviente</SelectItem>
                <SelectItem value="Cónyuge">Cónyuge</SelectItem>
                <SelectItem value="Hijo/a">Hijo/a</SelectItem>
                <SelectItem value="Hermano/a">Hermano/a</SelectItem>
                <SelectItem value="Padre/Madre">Padre / Madre</SelectItem>
                <SelectItem value="Otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ciw-permiso" className="text-xs">Permiso</Label>
            <Select
              value={permiso}
              onValueChange={(v) => setPermiso(v as CoInquilinoInvitado['permiso'])}
            >
              <SelectTrigger id="ciw-permiso">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISOS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          size="sm"
          className="w-full"
          onClick={agregar}
          disabled={!puedeAgregar}
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </Button>
      </div>
    </div>
  );
}

/* ============================================================
 * Paso 3: documentos iniciales
 * ============================================================ */
function PasoDocumentos({
  docsPorSlot,
  setDocsPorSlot,
}: {
  docsPorSlot: Record<string, DocumentoAdjunto>;
  setDocsPorSlot: React.Dispatch<React.SetStateAction<Record<string, DocumentoAdjunto>>>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [slotActivo, setSlotActivo] = useState<string | null>(null);

  const onElegirArchivo = (slotId: string) => {
    setSlotActivo(slotId);
    setTimeout(() => inputRef.current?.click(), 0);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !slotActivo) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Archivo muy grande',
        description: 'Máximo 2 MB por archivo en esta demo.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const dataUrl = await leerArchivoComoDataUrl(file);
      setDocsPorSlot((prev) => ({
        ...prev,
        [slotActivo]: {
          nombre: file.name,
          tipoMime: file.type || 'application/octet-stream',
          tamanioBytes: file.size,
          dataUrl,
          subidoAt: new Date().toISOString(),
        },
      }));
    } catch {
      toast({ title: 'No pudimos subir el archivo', variant: 'destructive' });
    } finally {
      setSlotActivo(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Subí los documentos iniciales del inquilino. Podés saltear y completarlos después.
      </p>
      <div className="space-y-2">
        {SLOTS.map((slot) => {
          const doc = docsPorSlot[slot.id];
          return (
            <div
              key={slot.id}
              className="flex items-center gap-3 rounded-md border p-3"
            >
              <div
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${
                  doc ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
                }`}
              >
                {doc ? (
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium">{slot.titulo}</p>
                  {!slot.requerido && (
                    <Badge variant="outline" className="text-[10px]">
                      Opcional
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {doc ? doc.nombre : slot.ayuda}
                </p>
              </div>
              <Button
                size="sm"
                variant={doc ? 'outline' : 'default'}
                onClick={() => onElegirArchivo(slot.id)}
              >
                <Upload className="h-3.5 w-3.5" />
                {doc ? 'Reemplazar' : 'Subir'}
              </Button>
            </div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}
