import { useParams } from 'react-router-dom';
import { GiveawayEntryForm } from './components/GiveawayEntryForm';

export default function GiveawayEntryPage() {
  const { studioSlug, entrySlug } = useParams<{ studioSlug: string; entrySlug?: string }>();
  if (!studioSlug) return null;
  return <GiveawayEntryForm slug={studioSlug} entrySlug={entrySlug} />;
}
