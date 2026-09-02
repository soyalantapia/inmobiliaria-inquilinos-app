import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@llave/ui/globals.css';
import { Toaster } from '@llave/ui/use-toast';
import { QueryProvider } from '@/components/query-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'My Alquiler · Propietarios',
  description: 'Mirá lo que se cobró, lo que se gastó y lo que te depositaron por tus propiedades.',
};

export const viewport: Viewport = {
  themeColor: '#7C3AED',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={inter.variable} style={{ colorScheme: 'only light' }} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="only light" />
        <meta name="supported-color-schemes" content="light" />
        {/* Qué commit está corriendo. Ver el mismo meta en el panel: la API lo expone en
            /health y los fronts no lo exponían en ningún lado. Acá importa DOBLE: este portal
            se sirve como export estático adentro del panel, así que no tiene servidor propio
            que conteste ni deploy propio que mirar. Si su build falla, el panel se queda con
            la imagen anterior y `/propietario` sigue devolviendo 200 con código viejo — este
            meta es lo único que distingue "anda" de "anda lo de antes". */}
        <meta
          name="build-commit"
          content={process.env.NEXT_PUBLIC_COMMIT?.slice(0, 7) || 'desconocido'}
        />
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
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
