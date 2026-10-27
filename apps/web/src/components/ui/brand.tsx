import Image from 'next/image';

export function BrandLogo({ className = '' }: { className?: string }) {
  return <span className={`inline-flex flex-col items-start ${className}`}>
    <Image src="/brand/logo-nuviora.png" alt="Nuviora Gestión" width={2172} height={724} className="h-auto w-full" priority />
    <span aria-hidden="true" className="-mt-1 pl-[8%] text-[10px] font-semibold uppercase tracking-[.24em] text-primary">Gestión</span>
  </span>;
}

export function BrandMark({ className = '' }: { className?: string }) {
  return <Image src="/brand/isotipo-nuviora.png" alt="" aria-hidden="true" width={1024} height={1024} className={`h-auto ${className}`} />;
}
