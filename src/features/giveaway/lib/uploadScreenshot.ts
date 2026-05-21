import { supabase } from '@/integrations/supabase/client';

export async function uploadScreenshot(opts: {
  studioSlug: string;
  draftId: string;
  actionType: string;
  file: File;
}): Promise<string> {
  const { studioSlug, draftId, actionType, file } = opts;
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${studioSlug}/${draftId}/${actionType}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('giveaway-uploads').upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('giveaway-uploads').getPublicUrl(path);
  return data.publicUrl;
}
