/**
 * Layout para páginas públicas sin auth ni sidebar (landing comercial,
 * precios, etc.). Se renderiza con su propio shell minimalista.
 */
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
