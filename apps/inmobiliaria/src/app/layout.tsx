import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@llave/ui/globals.css';
import { Toaster } from '@llave/ui/use-toast';
import { themeScript } from '@llave/ui/theme-toggle';
import { AuthProvider } from '@/components/auth-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Llave — Panel inmobiliaria',
  description: 'Cargá contratos con IA, cobrá automático, verificá inquilinos.',
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
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans" style={{ backgroundColor: '#ffffff' }}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
