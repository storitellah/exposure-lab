/** A link to the Storitellah website, used wherever the studio is credited. */
import type { ReactNode } from 'react';

export const STORITELLAH_URL = 'https://storitellah.com';

export function StoritellahLink({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <a href={STORITELLAH_URL} target="_blank" rel="noopener noreferrer" className={className}>
      {children ?? 'Storitellah'}
    </a>
  );
}
