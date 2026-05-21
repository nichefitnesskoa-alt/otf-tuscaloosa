import { useParams } from 'react-router-dom';
import { GiveawayEntryForm } from './components/GiveawayEntryForm';

export default function GiveawayEntryPage() {
  const { studioSlug } = useParams<{ studioSlug: string }>();
  if (!studioSlug) return null;
  return <GiveawayEntryForm slug={studioSlug} />;
}
