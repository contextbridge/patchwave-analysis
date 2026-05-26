import { CITATIONS, type CitationKey } from '../data/citations.ts';
import { FootnoteBodyLink, FootnoteReference } from './FootnoteReference.tsx';

interface Props {
  source: CitationKey;
}

export function Citation({ source }: Props) {
  const c = CITATIONS[source];
  return (
    <FootnoteReference
      id={`source-${source}`}
      title={c.label}
      body={<FootnoteBodyLink href={c.url}>{c.url}</FootnoteBodyLink>}
      titleText={`${c.label} — view source note`}
    />
  );
}
