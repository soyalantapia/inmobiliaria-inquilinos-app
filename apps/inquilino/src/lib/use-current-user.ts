'use client';

import { useEffect, useState } from 'react';
import { mockUser } from './auth';
import { leerSesion, type InquilinoSesion } from './auth-otp';
import { apiEnabled } from './api/client';

export interface CurrentUserView {
  isLoaded: boolean;
  isSignedIn: boolean;
  firstName: string;
  fullName: string;
  initial: string;
  phone: string | null;
  email: string | null;
}

/**
 * Devuelve el usuario logueado. Prioridad:
 *   1. Sesión OTP activa en localStorage (`leerSesion()`)
 *   2. Mock por defecto (para que las pantallas no se rompan si todavía no
 *      hay sesión — sólo durante el primer render en SSR)
 */
export function useCurrentUser(): CurrentUserView {
  const [sesion, setSesion] = useState<InquilinoSesion | null>(null);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setSesion(leerSesion());
    setHidratado(true);
  }, []);

  if (sesion) {
    const fullName = `${sesion.nombre} ${sesion.apellido}`.trim();
    const initial = (sesion.nombre.charAt(0) || sesion.email.charAt(0)).toUpperCase();
    return {
      isLoaded: true,
      isSignedIn: true,
      firstName: sesion.nombre,
      fullName,
      initial,
      phone: null,
      email: sesion.email,
    };
  }

  // Fallback cuando todavía no hay sesión (primer render / SSR / sin login).
  // En producción (apiEnabled) NO mostramos el mock 'Mariela': devolvemos un
  // perfil neutro. Tras el login OTP la sesión real ya pone el nombre.
  if (apiEnabled) {
    return {
      isLoaded: hidratado,
      isSignedIn: false,
      firstName: '',
      fullName: '',
      initial: '',
      phone: null,
      email: null,
    };
  }

  // Demo (!apiEnabled): seguimos usando el mock para que las pantallas no se
  // rompan antes de hidratar la sesión.
  return {
    isLoaded: hidratado,
    isSignedIn: false,
    firstName: mockUser.user.firstName,
    fullName: mockUser.user.fullName,
    initial: mockUser.user.firstName.slice(0, 1),
    phone: mockUser.user.primaryPhoneNumber.phoneNumber,
    email: mockUser.user.primaryEmailAddress.emailAddress,
  };
}
