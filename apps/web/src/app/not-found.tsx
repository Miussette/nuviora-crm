import Link from 'next/link';
export default function NotFound() { return <main className="mx-auto max-w-lg p-10"><h1 className="text-2xl font-semibold">Página no encontrada</h1><p className="my-5">Revisa el enlace o selecciona tu empresa.</p><Link className="text-primary underline" href="/seleccionar-empresa">Volver a mis empresas</Link></main>; }
