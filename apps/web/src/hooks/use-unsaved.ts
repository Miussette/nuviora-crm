'use client';
import { useEffect } from 'react';
export function useUnsaved(dirty: boolean) {
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    const click = (event: MouseEvent) => {
      if (!dirty || !(event.target instanceof Element)) return;
      const link = event.target.closest('a');
      if (link && link.href !== window.location.href && !window.confirm('Tienes cambios sin guardar. ¿Quieres salir?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', handler); document.addEventListener('click', click, true);
    return () => { window.removeEventListener('beforeunload', handler); document.removeEventListener('click', click, true); };
  }, [dirty]);
}
