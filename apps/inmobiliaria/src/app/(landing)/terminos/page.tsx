import { SITE_URL } from '@/lib/site';
import { LegalShell } from '../_legal/legal-shell';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Términos y Condiciones · My Alquiler',
  description:
    'Términos y condiciones de uso de My Alquiler, el software de gestión de alquileres para inmobiliarias.',
  alternates: { canonical: '/terminos' },
  robots: { index: true, follow: true },
};

export default function TerminosPage() {
  return (
    <LegalShell titulo="Términos y Condiciones" actualizado="14 de julio de 2026">
      <p>
        Estos Términos y Condiciones (los “Términos”) regulan el uso de{' '}
        <strong>My Alquiler</strong> (la “Plataforma”), un software de gestión de alquileres
        prestado por <strong>[Razón social]</strong>, CUIT <strong>[CUIT]</strong>, con domicilio
        en <strong>[domicilio]</strong> (“nosotros”). Al crear una cuenta o usar la Plataforma,
        aceptás estos Términos.
      </p>

      <h2>1. Qué es My Alquiler</h2>
      <p>
        My Alquiler es una herramienta para que inmobiliarias y administradores organicen la
        gestión de sus alquileres: contratos, liquidaciones, seguimiento de cobranzas, rendiciones
        a propietarios, reclamos y comunicación con inquilinos. La Plataforma{' '}
        <strong>organiza información</strong>: no es una entidad financiera y no interviene en la
        relación contractual entre la inmobiliaria, el propietario y el inquilino.
      </p>

      <h2>2. Cuenta y acceso</h2>
      <p>
        Para usar la Plataforma tenés que crear una cuenta con un email válido. El acceso se hace
        con un código de un solo uso que enviamos a ese email (sin contraseña). Sos responsable de
        mantener el control de tu casilla y de la actividad de tu cuenta y la de tu equipo. Avisanos
        de inmediato si detectás un uso no autorizado.
      </p>

      <h2>3. Uso aceptable</h2>
      <p>Al usar la Plataforma te comprometés a no:</p>
      <ul>
        <li>Cargar datos de terceros sin la base legal para hacerlo.</li>
        <li>Usar la Plataforma para fines ilícitos o contrarios a la buena fe.</li>
        <li>Intentar vulnerar la seguridad, acceder a datos de otras cuentas o interferir con el servicio.</li>
        <li>Revender o ceder el acceso a terceros sin nuestra autorización.</li>
      </ul>

      <h2>4. Planes, precios y período gratuito</h2>
      <p>
        Los planes y precios vigentes se publican en <a href="/precios">/precios</a>. Durante la
        etapa de lanzamiento el servicio es <strong>gratuito</strong>, sin tarjeta y sin
        permanencia; te avisaremos antes de que empiece a facturarse. No hay cargos por dar de baja
        la cuenta ni por exportar tus datos.
      </p>

      <h2>5. El dinero no pasa por nosotros</h2>
      <p>
        My Alquiler <strong>no cobra, no custodia ni transfiere dinero</strong>. Los pagos de los
        inquilinos se acreditan directamente en la cuenta bancaria (CBU/alias) de la inmobiliaria o
        del propietario, según corresponda. La Plataforma solo registra y organiza esa información
        para facilitar el seguimiento y la rendición. La validación de cada pago la hace siempre el
        usuario.
      </p>

      <h2>6. Tus datos y tu contenido</h2>
      <p>
        La información que cargás (contratos, inquilinos, propietarios, pagos, etc.) es tuya. Nos
        autorizás a procesarla únicamente para prestarte el servicio, según nuestra{' '}
        <a href="/privacidad">Política de Privacidad</a>. Podés exportar y llevarte tus datos cuando
        quieras. Sos responsable de la exactitud de lo que cargás y de contar con la base legal para
        tratar los datos de terceros (por ejemplo, inquilinos y propietarios).
      </p>

      <h2>7. Propiedad intelectual</h2>
      <p>
        El software, la marca y el diseño de My Alquiler son de su titular y están protegidos. Estos
        Términos no te transfieren derechos sobre la Plataforma más allá del uso que habilitan.
      </p>

      <h2>8. Disponibilidad y responsabilidad</h2>
      <p>
        Trabajamos para que el servicio esté disponible y sea confiable, pero se presta “tal cual”,
        sin garantía de disponibilidad ininterrumpida. En la medida permitida por la ley, no
        respondemos por daños indirectos ni por decisiones que tomes a partir de la información de la
        Plataforma; la responsabilidad final sobre cobranzas, rendiciones y la relación con
        inquilinos y propietarios es tuya.
      </p>

      <h2>9. Baja y cancelación</h2>
      <p>
        Podés dar de baja tu cuenta cuando quieras. Podemos suspender o cancelar cuentas que
        incumplan estos Términos. En caso de baja, te damos un plazo razonable para exportar tus
        datos antes de eliminarlos, salvo obligación legal de conservarlos.
      </p>

      <h2>10. Cambios en los Términos</h2>
      <p>
        Podemos actualizar estos Términos. Si el cambio es relevante, te avisaremos por un medio
        razonable (por ejemplo, email o dentro de la Plataforma). El uso posterior implica la
        aceptación de la versión vigente.
      </p>

      <h2>11. Ley aplicable</h2>
      <p>
        Estos Términos se rigen por las leyes de la República Argentina. Ante cualquier
        controversia, las partes se someten a los tribunales de <strong>[jurisdicción]</strong>,
        salvo normas de orden público que dispongan otra cosa.
      </p>

      <h2>12. Contacto</h2>
      <p>
        Escribinos por WhatsApp desde el botón del sitio o a{' '}
        <a href="mailto:[email de contacto]">[email de contacto]</a>.
      </p>
    </LegalShell>
  );
}
