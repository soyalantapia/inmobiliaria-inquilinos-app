import { SITE_URL } from '@/lib/site';
import { LegalShell } from '../_legal/legal-shell';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Política de Privacidad · My Alquiler',
  description:
    'Cómo My Alquiler recopila, usa y protege los datos personales, conforme a la Ley 25.326 de Argentina.',
  alternates: { canonical: '/privacidad' },
  robots: { index: true, follow: true },
};

export default function PrivacidadPage() {
  return (
    <LegalShell titulo="Política de Privacidad" actualizado="14 de julio de 2026">
      <p>
        En <strong>My Alquiler</strong> cuidamos tus datos. Esta política explica qué información
        tratamos y para qué, conforme a la <strong>Ley 25.326</strong> de Protección de Datos
        Personales de Argentina. El responsable del tratamiento es{' '}
        <strong>[Razón social]</strong>, CUIT <strong>[CUIT]</strong>, con domicilio en{' '}
        <strong>[domicilio]</strong>.
      </p>

      <h2>1. Qué datos tratamos</h2>
      <ul>
        <li>
          <strong>De tu cuenta:</strong> email, nombre y datos de la inmobiliaria que cargás al
          registrarte y configurar tu perfil.
        </li>
        <li>
          <strong>Operativos (los que cargás vos):</strong> información de contratos, propiedades,
          propietarios, inquilinos, liquidaciones, pagos, reclamos y comunicaciones. Parte de estos
          son datos de terceros que vos gestionás.
        </li>
        <li>
          <strong>Técnicos:</strong> registros de uso, dirección IP y datos de navegación para
          seguridad y mejora del servicio.
        </li>
      </ul>
      <p>
        <strong>No</strong> conectamos tu cuenta bancaria ni accedemos a tu home banking: los pagos
        se acreditan directamente en tu CBU/alias y vos subís y validás los comprobantes.
      </p>

      <h2>2. Para qué los usamos</h2>
      <ul>
        <li>Prestarte el servicio: gestionar tu cuenta, contratos, cobranzas y rendiciones.</li>
        <li>Enviarte avisos operativos (por ejemplo, códigos de acceso, notificaciones).</li>
        <li>Dar soporte y mejorar la Plataforma.</li>
        <li>Cumplir obligaciones legales.</li>
      </ul>

      <h2>3. Con quién los compartimos</h2>
      <p>
        <strong>No vendemos tus datos.</strong> Los compartimos solo con proveedores que nos
        ayudan a prestar el servicio y que tratan los datos por cuenta nuestra, en las siguientes
        categorías: infraestructura y hosting, envío de emails, y analítica de uso. Estos
        proveedores pueden alojar información fuera de Argentina; en ese caso adoptamos recaudos
        para su protección. También podemos divulgar datos si la ley lo exige.
      </p>

      <h2>4. Datos de terceros que cargás</h2>
      <p>
        Cuando cargás datos de inquilinos o propietarios, actuás como responsable de esos datos y
        nosotros como encargados del tratamiento. Sos vos quien debe contar con la base legal e
        informar a esas personas sobre el uso de su información. Te ayudamos a atender los pedidos
        que recibas de esos titulares.
      </p>

      <h2>5. Seguridad</h2>
      <p>
        Aplicamos medidas técnicas y organizativas razonables para proteger la información (accesos
        controlados, cifrado en tránsito, aislamiento de datos por cuenta). Ningún sistema es
        infalible, pero trabajamos para minimizar los riesgos.
      </p>

      <h2>6. Conservación</h2>
      <p>
        Conservamos tus datos mientras tengas una cuenta activa y por el plazo necesario para
        cumplir obligaciones legales. Al dar de baja, podés exportarlos y luego los eliminamos,
        salvo que una norma nos obligue a conservarlos por más tiempo.
      </p>

      <h2>7. Tus derechos</h2>
      <p>
        Podés acceder, rectificar, actualizar y solicitar la supresión de tus datos personales
        escribiéndonos (ver Contacto). Conforme a la Ley 25.326, la{' '}
        <strong>Agencia de Acceso a la Información Pública (AAIP)</strong> es el órgano de control y
        atiende las denuncias por incumplimiento.
      </p>

      <h2>8. Cookies y analítica</h2>
      <p>
        Usamos cookies y herramientas de analítica para que la Plataforma funcione y para entender
        su uso de forma agregada. Podés gestionar las cookies desde tu navegador; algunas son
        necesarias para el funcionamiento del servicio.
      </p>

      <h2>9. Cambios</h2>
      <p>
        Podemos actualizar esta política. Si el cambio es relevante, te avisaremos por un medio
        razonable. La fecha de “última actualización” arriba indica la versión vigente.
      </p>

      <h2>10. Contacto</h2>
      <p>
        Para ejercer tus derechos o hacer una consulta, escribinos por WhatsApp desde el botón del
        sitio o a <a href="mailto:[email de contacto]">[email de contacto]</a>.
      </p>
    </LegalShell>
  );
}
