// Layout fullscreen — login y flujo de pago. Sin sidebar ni navbar.
// Centramos el contenido y dejamos max-w-md en mobile y un poquito más en
// desktop para que el checkout no se vea pegado.

export default function FullLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col md:max-w-lg">
      {children}
    </div>
  );
}
