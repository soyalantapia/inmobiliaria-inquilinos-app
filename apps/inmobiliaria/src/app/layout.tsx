import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@llave/ui/globals.css';
import { Toaster } from '@llave/ui/use-toast';
import { themeScript } from '@llave/ui/theme-toggle';
import { AuthProvider } from '@/components/auth-provider';
import { QueryProvider } from '@/components/query-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'My Alquiler — Panel inmobiliaria',
  description: 'Panel para inmobiliarias: contratos, cobranza en vivo, rendición a propietarios, reclamos y caja.',
};

export const viewport: Viewport = {
  themeColor: '#7C3AED',
  colorScheme: 'light',
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
        {/* Qué commit está corriendo este front. La API lo expone en /health desde hace rato;
            los fronts no, y por eso no había forma de verificar que un deploy entró ni de medir
            la distancia entre lo que hay arriba y `main`.
            Va como meta y no como endpoint porque estas apps también se buildean en modo static
            export (GitHub Pages), donde no hay servidor que conteste. Un meta viaja en el HTML
            y se lee con `curl -s https://admin.myalquiler.com | grep build-commit`.
            'desconocido' antes que un valor inventado, igual que /health. */}
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
      </body>
    </html>
  );
}
