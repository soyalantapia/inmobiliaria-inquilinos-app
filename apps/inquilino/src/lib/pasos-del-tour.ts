import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  Receipt,
  Sparkles,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * Los pasos del tour de onboarding, y cuáles de ellos sólo valen en el build demo.
 *
 * POR QUÉ ESTÁN ACÁ Y NO ADENTRO DEL COMPONENTE. Porque el tour es lo PRIMERO que lee un
 * inquilino nuevo, y lo que promete tiene que poder verificarse. Sacados del `.tsx`, un test
 * puede cruzar cada CTA contra las pantallas que producción gatea con `<Proximamente>` —que es
 * exactamente el defecto que este archivo viene a cerrar—.
 *
 * EL DEFECTO. La app tiene cinco pantallas que en producción devuelven un cartel de
 * «Próximamente»: `/broker`, `/calendario`, `/contrato/renovacion`, `/cuenta/editar` y
 * `/profesionales`. El tour vendía tres de esas capacidades como si existieran, sin ningún gate:
 * un slide entero de «Mi calendario» con su botón, «Plomero, electricista y técnicos
 * recomendados», y la renovación en la bajada del último slide. Más dos cosas que sólo viven en
 * la rama demo de `/contrato`: la línea de tiempo y el link para el garante.
 *
 * O sea que el primer botón que tocaba un inquilino real lo llevaba a una pantalla vacía. Ya
 * había pasado antes con el slide del Asistente, que se sacó; la pasada quedó a medias.
 *
 * CÓMO SE RESUELVE. La lista de abajo dice lo que producción hace **de verdad**. El build demo
 * —que es una vidriera y sí puede mostrar de más— suma lo suyo con `soloDemo`,
 * `descripcionDemo` y `bulletsDemo`. La polaridad importa: el default es lo cierto para todos, y
 * lo que se agrega es la excepción, no al revés.
 */
export interface PasoDelTour {
  icon: LucideIcon;
  iconBg: string;
  titulo: string;
  /** Lo que la app hace de verdad, en producción. */
  descripcion: string;
  bullets: string[];
  cta?: { label: string; href: string };
  /** El slide entero promete algo que producción todavía no tiene. */
  soloDemo?: boolean;
  /** Reemplaza a `descripcion` en el build demo, donde sí se puede mostrar de más. */
  descripcionDemo?: string;
  /** Bullets que se SUMAN en el build demo. */
  bulletsDemo?: string[];
}

const GRADIENTE = 'from-primary to-primary/70';

const PASOS: PasoDelTour[] = [
  {
    icon: Sparkles,
    iconBg: GRADIENTE,
    titulo: '¡Bienvenido a My Alquiler!',
    descripcion: 'Tu alquiler en un solo lugar. Te muestro las cosas importantes en 1 minuto.',
    bullets: [
      'Sin papeles ni llamadas innecesarias',
      'Todo lo que necesitás está a un toque',
      'Podés saltar este tour cuando quieras',
    ],
  },
  // ⛔ ACÁ DECÍA "Pagás con transferencia, MP o QR", y el título, "en un toque".
  //
  // Ni MP ni QR existen como forma de pagar: el enum MetodoPago del schema es TRANSFERENCIA |
  // MERCADOPAGO | EFECTIVO, y MERCADOPAGO es sólo la etiqueta con la que la inmo REGISTRA a
  // mano un pago que ya recibió — no hay checkout de ninguna pasarela en el monorepo. QR no
  // está ni en MetodoPago ni en MetodoPagoInformado; el único QR del schema es un valor de
  // MetodoComprobante, que respalda Comprobante.metodo y que no escribe nadie. El checkout
  // real de la app se llama, literalmente, "Pagar por
  // transferencia": muestra el CBU y el alias para copiar, y recién después pide el comprobante.
  //
  // A diferencia del slide del asistente (más abajo), este se reescribe en vez de sacarse: el
  // paso existe y es el más importante de la app, lo que no existía era el medio. El "en un
  // toque" se va por lo mismo — sostenía la promesa de pago instantáneo con otras palabras, y
  // encima le tapaba al inquilino el paso que más se olvida: volver a subir el comprobante. Sin
  // eso transfirió plata real y para el sistema no pagó, porque no hay informe que validar.
  {
    icon: CreditCard,
    iconBg: GRADIENTE,
    titulo: 'Pagás tu alquiler sin vueltas',
    descripcion: 'En la pantalla principal ves el monto exacto del mes y si está al día.',
    bullets: [
      'Te mostramos vencimiento, monto y punitorios si los hay',
      'Copiás el CBU o el alias y transferís desde tu banco',
      'Volvés, subís el comprobante y seguís acá la validación',
    ],
    cta: { label: 'Ver mis pagos', href: '/' },
  },
  {
    icon: FileText,
    iconBg: GRADIENTE,
    titulo: 'Conocé tu contrato',
    // La "evolución del alquiler" la dibujaba <ContratoTimeline />, que sólo se monta en la
    // rama demo de /contrato. En producción el inquilino ve datos, ajustes y depósito.
    descripcion: 'Datos clave, cuándo es tu próximo ajuste y en qué estado está tu depósito.',
    descripcionDemo:
      'Datos clave, próximos ajustes, evolución del alquiler y estado del depósito.',
    bullets: ['Con qué índice se ajusta y cuándo', 'Cuánto vas a recuperar del depósito'],
    // Las dos viven en <ContratoTimeline /> y <CompartirGarante />, que ContratoReal no monta.
    bulletsDemo: ['Línea de tiempo del contrato', 'Compartilo con tu garante con un link'],
    cta: { label: 'Abrir mi contrato', href: '/contrato' },
  },
  // ⛔ ACÁ HABÍA UN SLIDE que decía "Chateá con el Asistente — Una IA que leyó tus cláusulas y
  // te responde al instante" y "Te cita la cláusula exacta del contrato", con un CTA "Probar el
  // Asistente" hacia /broker.
  //
  // No existe: no hay ningún LLM en el monorepo, el "chat" es keyword-matching que sólo vive en
  // el build demo, y /broker en producción devuelve un cartel de "Próximamente". O sea que el
  // onboarding le prometía una capacidad entera a CADA inquilino nuevo, y el primer botón que
  // tocaba lo llevaba a una pantalla vacía.
  //
  // Se saca en vez de reescribirse: los otros slides ya cubren lo que la app hace de verdad
  // (pagar, ver el contrato, reportar un problema), y agregar un cuarto para rellenar sería
  // decorar. Cuando exista el asistente, el slide vuelve — con lo que haga, no con lo que
  // querríamos que hiciera.
  {
    icon: Wrench,
    iconBg: GRADIENTE,
    titulo: 'Reportá problemas',
    descripcion: 'Plomería, electricidad, cerraduras — todo desde la app.',
    bullets: [
      'Sumás foto y descripción rápida',
      'Seguís el estado en tiempo real',
      'Calificás al final y te ahorra futuras visitas',
    ],
    cta: { label: 'Ver reclamos', href: '/reclamos' },
  },
  {
    icon: Receipt,
    iconBg: GRADIENTE,
    titulo: 'Comprobantes a mano',
    descripcion: 'Todos tus pagos descargables en PDF, año por año.',
    bullets: [
      'Histórico mensual completo',
      'Útil para deducir si trabajás en relación de dependencia',
      'Lo compartís con tu contador en un clic',
    ],
    cta: { label: 'Ver comprobantes', href: '/comprobantes' },
  },
  {
    icon: CalendarDays,
    iconBg: GRADIENTE,
    titulo: 'Mi calendario',
    descripcion: 'Todo lo que va a pasar con tu alquiler: pagos, ajustes, vencimientos.',
    bullets: [
      'Vista unificada de eventos',
      'No te olvides de nada importante',
      'Con los vencimientos a la vista',
    ],
    cta: { label: 'Ver mi calendario', href: '/calendario' },
    // El slide entero: /calendario en producción es un cartel de "Próximamente" —"no hay
    // endpoint que devuelva eventos reales todavía", dice su propio comentario—. Con el CTA
    // adentro, el tour mandaba al inquilino nuevo justo ahí.
    soloDemo: true,
  },
  {
    icon: Users,
    iconBg: GRADIENTE,
    titulo: 'Y mucho más',
    // "Profesionales" y "renovación" salieron de la bajada: /profesionales y
    // /contrato/renovacion son "Próximamente" en producción.
    descripcion: 'Co-inquilinos, documentos y tus datos — todo desde Mi Cuenta.',
    descripcionDemo: 'Profesionales, co-inquilinos, documentos, renovación — todo desde Mi Cuenta.',
    bullets: [
      'Compartí el contrato con tu pareja o familia',
      'DNI y recibos guardados en un solo lugar',
    ],
    bulletsDemo: ['Plomero, electricista y técnicos recomendados'],
    cta: { label: 'Explorar Mi Cuenta', href: '/cuenta' },
  },
  {
    icon: CheckCircle2,
    iconBg: GRADIENTE,
    titulo: '¡Listo!',
    // Decía "Cualquier duda, el Asistente o la inmobiliaria están a un toque". Quedó de cuando
    // existía el slide del Asistente que se sacó más arriba: nombraba una capacidad que no
    // existe, y encima ya ni botón tiene desde que se le sacó `/broker` al nav. Era lo ÚLTIMO
    // que leía un inquilino nuevo antes de empezar a usar la app.
    //
    // La inmobiliaria sí está a un toque, y de verdad: /ayuda tiene el `wa.me` para escribirle.
    descripcion: 'Ya conocés My Alquiler. Cualquier duda, tu inmobiliaria está a un toque desde Ayuda.',
    bullets: [
      'Podés volver a ver este tour desde Mi Cuenta',
      'WhatsApp directo con tu inmobiliaria',
      'Que tengas una buena estadía 💜',
    ],
  },
];

/**
 * Los pasos que corresponde mostrar. `demo` es el build de vidriera (`!apiEnabled`): ahí se
 * muestra todo. En producción se caen los slides marcados `soloDemo` y se usa el texto que
 * describe lo que la app hace hoy.
 */
export function pasosDelTour(demo: boolean): PasoDelTour[] {
  if (demo) {
    return PASOS.map((p) => ({
      ...p,
      descripcion: p.descripcionDemo ?? p.descripcion,
      bullets: [...p.bullets, ...(p.bulletsDemo ?? [])],
    }));
  }
  return PASOS.filter((p) => !p.soloDemo);
}

/** Todos los pasos, marcas incluidas. Lo usa el test que cuida las promesas. */
export const TODOS_LOS_PASOS: readonly PasoDelTour[] = PASOS;
