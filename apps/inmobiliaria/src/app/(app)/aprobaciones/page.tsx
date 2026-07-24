import { redirect } from 'next/navigation';

// Las aprobaciones ahora viven DENTRO de Pagos (Camila las buscaba ahí, no en una
// entrada suelta del menú). Cualquier link viejo a /aprobaciones cae en el tab.
export default function AprobacionesPage() {
  redirect('/pagos?tab=aprobaciones');
}
