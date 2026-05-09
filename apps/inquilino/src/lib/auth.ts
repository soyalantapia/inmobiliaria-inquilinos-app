// Capa de auth opt-in: si NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY está, usamos
// Clerk real. Si no, mock para que el dev local levante sin keys.
//
// Migración a Clerk: poner las dos vars en .env.local (CLAUDE.md §8.7).

export const isClerkEnabled = (): boolean => {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
};

// Usuario mock que devolvemos cuando Clerk no está activo. Reemplaza el
// objeto que retorna useUser() de Clerk para que las pantallas no se
// rompan en desarrollo local.
export const mockUser = {
  isLoaded: true,
  isSignedIn: true,
  user: {
    id: 'mock_mariela',
    firstName: 'Mariela',
    lastName: 'Sosa',
    fullName: 'Mariela Sosa',
    primaryPhoneNumber: { phoneNumber: '+5491145678900' },
    primaryEmailAddress: { emailAddress: 'mariela.sosa@gmail.com' },
    imageUrl: '',
  },
} as const;
