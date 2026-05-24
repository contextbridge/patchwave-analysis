import { CITATIONS, type CitationKey } from '../data/citations.ts';

interface Props {
  source: CitationKey;
}

export function Citation({ source }: Props) {
  const c = CITATIONS[source];
  return (
    <a
      href={c.url}
      target="_blank"
      rel="noopener noreferrer"
      title={c.label}
      className="text-primary ml-0.5 inline-block align-super text-[0.7em] font-medium hover:underline"
    >
      [src]
    </a>
  );
}
