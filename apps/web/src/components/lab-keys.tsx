'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Left/right arrow keys move between experiments. */
export function LabKeys({ prev, next }: { prev: string; next: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === 'ArrowLeft') router.push(prev);
      if (e.key === 'ArrowRight') router.push(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, prev, next]);
  return null;
}
