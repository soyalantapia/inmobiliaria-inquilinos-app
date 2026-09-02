import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@llave/ui/globals.css';
import './pwa-register.css';
import { PwaRegister } from './pwa-register';
import { Toaster } from '@llave/ui/use-toast';
import { themeScript } from '@llave/ui/theme-toggle';
import { AuthProvider } from '@/components/auth-provider';
import { QueryProvider } from '@/components/query-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'My Alquiler',
  description: 'Pagá tu alquiler y expensas, hacé reclamos y seguí tu contrato.',
  // El CONTENIDO del manifest lo genera app/manifest.ts (con basePath). El LINK,
  // en cambio, Next lo emite con el path crudo del campo `manifest` SIN aplicar
  // basePath, así que lo prefijamos a mano. NEXT_PUBLIC_BASE_PATH solo está
  // seteado en el static export (vacío en dev/Railway).
  manifest: (process.env.NEXT_PUBLIC_BASE_PATH ?? '') + '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'My Alquiler', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#7C3AED',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es-AR"
      className={inter.variable}
      style={{ colorScheme: 'only light' }}
      data-darkreader-mode="ignore"
      data-darkreader-scheme="light"
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="only light" />
        <meta name="supported-color-schemes" content="light" />
        <meta name="darkreader-lock" />
        {/* Qué commit está corriendo. Ver el mismo meta en el panel: la API lo expone en
            /health y los fronts no lo exponían en ningún lado. Va como meta porque esta app
            también se buildea en modo static export, donde no hay servidor que conteste. */}
        <meta
          name="build-commit"
          content={process.env.NEXT_PUBLIC_COMMIT?.slice(0, 7) || 'desconocido'}
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Sonar: reporte de errores del portfolio. El HOST viene por variable de entorno y
            SIN default: si falta, no se emite nada.

            Estuvo escrito a mano apuntando a Railway y murio con el ban del 28/08; como esto
            se hornea en el HTML al construir, un host equivocado sobrevive hasta el proximo
            build de los tres servicios. La key sigue siendo publica a proposito: el guard real
            es `allowedOrigins` del proyecto en Sonar.

            El `meta` va adentro del mismo guard: sin loader no clasifica nada. */}
        {process.env.NEXT_PUBLIC_SONAR_URL && (
          <>
            <meta name="sonar-env" content="production" />
            {/* eslint-disable-next-line @next/next/no-sync-scripts */}
            <script
              src={`${process.env.NEXT_PUBLIC_SONAR_URL}/v1/loader.js?key=son_pub_live_L4ZgFYmfd8ITxrofS_uDPhst`}
              async
            />
          </>
        )}
      </head>
      <body className="min-h-screen bg-background font-sans" style={{ backgroundColor: '#ffffff' }}>
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </QueryProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
