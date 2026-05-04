import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/layouts/AppShell'
import { ScanPage } from '@/pages/ScanPage'
import { OrderDetailPage } from '@/pages/OrderDetailPage'
import { ConfirmationPage } from '@/pages/ConfirmationPage'
import { OrdersListPage } from '@/pages/OrdersListPage'
import { LoginPage } from '@/pages/LoginPage'
import { MagicLinkPage } from '@/pages/MagicLinkPage'
import { AuthProvider } from '@/lib/auth'
import { RequireAuth } from '@/components/RequireAuth'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route path="auth/magic" element={<MagicLinkPage />} />

          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<ScanPage />} />
            <Route path="pedidos" element={<OrdersListPage />} />
            <Route path="pedidos/:token" element={<OrderDetailPage />} />
            <Route path="pedidos/:token/confirmacion" element={<ConfirmationPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
