// Fallback de datos del usuario para pantallas que se renderizan antes de
// que la sesión OTP esté hidratada desde localStorage. En producción esto
// vendría del endpoint del usuario logueado.

export const mockUser = {
  isLoaded: true,
  isSignedIn: true,
  user: {
    id: 'usr_mariela',
    firstName: 'Mariela',
    lastName: 'Sosa',
    fullName: 'Mariela Sosa',
    primaryPhoneNumber: { phoneNumber: '+5491145678900' },
    primaryEmailAddress: { emailAddress: 'mariela.sosa@gmail.com' },
    imageUrl: '',
  },
} as const;
