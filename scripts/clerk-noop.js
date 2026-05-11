// Stub de @clerk/nextjs para builds estáticos. Clerk usa server actions
// internamente y eso es incompatible con `output: 'export'`. En la demo de
// GitHub Pages, la auth está apagada (no hay env var de Clerk), así que
// reemplazar Clerk por noops es funcionalmente equivalente.
'use client';

const React = require('react');

// Provider que pasa el children sin hacer nada
function ClerkProvider({ children }) {
  return React.createElement(React.Fragment, null, children);
}

// Componentes que renderizan nada o el children
const Noop = () => null;
const PassThrough = ({ children }) => React.createElement(React.Fragment, null, children);

// Hooks devuelven valores vacíos
const useUser = () => ({ user: null, isLoaded: true, isSignedIn: false });
const useAuth = () => ({ userId: null, isLoaded: true, isSignedIn: false, signOut: () => Promise.resolve() });
const useClerk = () => ({ signOut: () => Promise.resolve(), openSignIn: () => {}, openSignUp: () => {} });

module.exports = {
  ClerkProvider,
  SignIn: Noop,
  SignUp: Noop,
  UserButton: Noop,
  SignedIn: PassThrough,
  SignedOut: PassThrough,
  ClerkLoaded: PassThrough,
  ClerkLoading: Noop,
  useUser,
  useAuth,
  useClerk,
  // Server helpers — no se usan en client pero por si acaso
  clerkMiddleware: () => () => null,
  createRouteMatcher: () => () => false,
  auth: () => ({ userId: null, protect: () => {} }),
  currentUser: () => null,
};
