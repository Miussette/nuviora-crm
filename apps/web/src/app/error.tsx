'use client';
import { Button } from '@nuviora/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="mx-auto max-w-lg p-10"><h1 className="text-2xl font-semibold">Algo salió mal</h1><p className="my-5">No pudimos cargar esta página. Vuelve a intentarlo.</p><Button onClick={reset}>Reintentar</Button></main>; }
