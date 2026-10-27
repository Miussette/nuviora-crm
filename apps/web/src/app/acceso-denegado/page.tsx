import Link from 'next/link';
export default function Denied() { return <main className="mx-auto max-w-lg p-10"><h1 className="text-2xl font-semibold">Acceso denegado</h1><p className="my-5">Tu rol no permite realizar esta acción.</p><Link className="text-primary underline" href="/seleccionar-empresa">Volver a mis empresas</Link></main>; }
