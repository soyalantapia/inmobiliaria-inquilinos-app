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
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Sonar: reporte de errores del portfolio. async → si Sonar se cae, NO bloquea la app.
            La key es pública a propósito; el guard real es allowedOrigins del proyecto en Sonar. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          src="https://sonar-api-production-77b5.up.railway.app/v1/loader.js?key=son_pub_live_L4ZgFYmfd8ITxrofS_uDPhst"
          async
        />
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
