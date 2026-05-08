import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@llave/ui/globals.css';
import './pwa-register.css';
import { PwaRegister } from './pwa-register';

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
    <html lang="es-AR" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans">
        <div className="mx-auto flex min-h-screen max-w-md flex-col">{children}</div>
        <PwaRegister />
      </body>
    </html>
  );
}
