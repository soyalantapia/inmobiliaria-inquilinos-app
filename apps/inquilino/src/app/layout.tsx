import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@llave/ui/globals.css';
import './pwa-register.css';
import { PwaRegister } from './pwa-register';
import { Toaster } from '@llave/ui/use-toast';
import { themeScript } from '@llave/ui/theme-toggle';
import { AuthProvider } from '@/components/auth-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Llave',
  description: 'Pagá tu alquiler y expensas, chateá con tu contrato.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Llave', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#7C3AED',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans">
        <AuthProvider>
          <div className="mx-auto flex min-h-screen max-w-md flex-col">{children}</div>
          <Toaster />
        </AuthProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
