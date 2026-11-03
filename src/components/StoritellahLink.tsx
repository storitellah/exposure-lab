/** A link to the Storitellah website, used wherever the studio is credited. */
export const STORITELLAH_URL = 'https://storitellah.com';

export function StoritellahLink({ className }: { className?: string }) {
  return (
    <a href={STORITELLAH_URL} target="_blank" rel="noopener noreferrer" className={className}>
      Storitellah
    </a>
  );
}
