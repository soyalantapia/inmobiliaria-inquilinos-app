'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { isClerkEnabled } from '@/lib/auth';

// El stack manda Clerk (CLAUDE.md §2). Si todavía no se cargaron las keys
// de Clerk, evitamos envolver el árbol con ClerkProvider para que el dev
// local funcione sin variables de entorno.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!isClerkEnabled()) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: 'hsl(262 78% 56%)',
          colorBackground: 'hsl(270 20% 98%)',
          fontFamily: 'var(--font-sans)',
          borderRadius: '0.75rem',
        },
        elements: {
          card: 'shadow-none border-none',
          formButtonPrimary: 'bg-primary hover:bg-primary/90',
        },
      }}
      signInUrl="/login"
      signUpUrl="/login"
      afterSignInUrl="/"
      afterSignUpUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
