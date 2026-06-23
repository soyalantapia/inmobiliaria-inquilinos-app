import Client from './page-client';

// Pre-generamos un token "demo" para el static export (GH Pages). Los tokens
// reales de co-invitación se generan al compartir desde la app en vivo; en el
// export estático las invitaciones no aplican (el cliente cae a "funcionan en la
// app en vivo"). `dynamicParams` permite tokens arbitrarios en dev/Railway.
// Sin este generateStaticParams, `output: export` fallaba el build ENTERO — era
// la única ruta dinámica que no lo tenía (las otras 6 token routes ya lo hacen).
export function generateStaticParams() {
  return [{ token: 'demo' }];
}

export const dynamicParams = process.env.STATIC_EXPORT !== '1';

export default function Page() {
  return <Client />;
}
