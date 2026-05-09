'use client';

import { useUser } from '@clerk/nextjs';
import { isClerkEnabled, mockUser } from './auth';

export interface CurrentUserView {
  isLoaded: boolean;
  isSignedIn: boolean;
  firstName: string;
  fullName: string;
  initial: string;
  phone: string | null;
}

// Hook único para el resto de la app. Si Clerk está habilitado lee de
// useUser(); si no, devuelve el mock. Las pantallas no se enteran.
export function useCurrentUser(): CurrentUserView {
  if (isClerkEnabled()) {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- isClerkEnabled es estable en build
    const { user, isLoaded, isSignedIn } = useUser();
    const first = user?.firstName ?? user?.username ?? 'Inquilino';
    const full = user?.fullName ?? first;
    return {
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      firstName: first,
      fullName: full,
      initial: first.slice(0, 1).toUpperCase(),
      phone: user?.primaryPhoneNumber?.phoneNumber ?? null,
    };
  }

  return {
    isLoaded: true,
    isSignedIn: true,
    firstName: mockUser.user.firstName,
    fullName: mockUser.user.fullName,
    initial: mockUser.user.firstName.slice(0, 1),
    phone: mockUser.user.primaryPhoneNumber.phoneNumber,
  };
}
