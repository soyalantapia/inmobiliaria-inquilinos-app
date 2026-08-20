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
            /health y los fronts no lo exponían en ningún lado. Acá importa doble, porque este
            portal hoy sólo existe como static export en GitHub Pages (T-46-N1) y ahí no hay
            ningún otro modo de saber qué se publicó. */}
        <meta
          name="build-commit"
          content={process.env.NEXT_PUBLIC_COMMIT?.slice(0, 7) || 'desconocido'}
        />
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
