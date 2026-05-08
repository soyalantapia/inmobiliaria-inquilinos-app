import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@llave/ui/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Llave — Panel inmobiliaria',
  description: 'Cargá contratos con IA, cobrá automático, verificá inquilinos.',
};

export const viewport: Viewport = {
  themeColor: '#7C3AED',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans">{children}</body>
    </html>
  );
}
