'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { isClerkEnabled } from '@/lib/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!isClerkEnabled()) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: 'hsl(262 78% 56%)',
          colorBackground: 'hsl(0 0% 100%)',
          fontFamily: 'var(--font-sans)',
          borderRadius: '0.75rem',
        },
        elements: {
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
