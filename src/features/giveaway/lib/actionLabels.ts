export type BuiltInActionKey = 'post_engagement' | 'story_share' | 'free_class';

export interface ActionLabelOverride {
  title?: string;
  description?: string;
}

export type ActionLabelsMap = Partial<Record<string, ActionLabelOverride>>;

export const BUILT_IN_ACTION_DEFAULTS: Record<BuiltInActionKey, { title: string; description: string }> = {
  post_engagement: {
    title: 'Like, comment & tag a friend',
    description: 'Like our giveaway post, leave a comment, and tag a local friend.',
  },
  story_share: {
    title: 'Share to your story',
    description: 'Share our giveaway post to your Instagram story.',
  },
  free_class: {
    title: 'Post a Class Story',
    description: 'Post a story of you taking a class and tag us.',
  },
};

export function getActionLabel(
  labels: ActionLabelsMap | null | undefined,
  key: string,
  fallback: { title: string; description: string },
): { title: string; description: string } {
  const o = labels?.[key];
  return {
    title: (o?.title ?? '').trim() || fallback.title,
    description: (o?.description ?? '').trim() || fallback.description,
  };
}
