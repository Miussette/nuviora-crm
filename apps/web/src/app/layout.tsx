import type { Metadata } from 'next';
import { AppProvider } from '@/providers/app-provider';
import '@/styles/globals.css';
export const metadata: Metadata = { title: { default: 'Nuviora Gestión', template: '%s · Nuviora' }, description: 'Tu negocio organizado, sin complicaciones.', icons: { icon: { url: '/brand/isotipo-nuviora.png', type: 'image/png' }, apple: '/brand/isotipo-nuviora.png' } };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="es-CL"><body><AppProvider>{children}</AppProvider></body></html>; }
