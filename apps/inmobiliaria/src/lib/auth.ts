// Capa de auth opt-in: si NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY está, usamos
// Clerk real. Si no, mock para que el dev local levante sin keys.

export const isClerkEnabled = (): boolean => {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
};

export const mockUser = {
  isLoaded: true,
  isSignedIn: true,
  user: {
    id: 'mock_roberto',
    firstName: 'Roberto',
    lastName: 'Tapia',
    fullName: 'Roberto Tapia',
    primaryEmailAddress: { emailAddress: 'roberto@inmosol.com.ar' },
    imageUrl: '',
  },
} as const;
