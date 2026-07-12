
CREATE TABLE IF NOT EXISTS public.shift_task_guidance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name text NOT NULL,
  lane_order int NOT NULL DEFAULT 0,
  lane_title text NOT NULL,
  why_line text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_safety_note boolean NOT NULL DEFAULT false,
  is_unmapped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shift_task_guidance TO anon, authenticated;
GRANT ALL ON public.shift_task_guidance TO service_role;

ALTER TABLE public.shift_task_guidance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shift task guidance"
  ON public.shift_task_guidance FOR SELECT
  USING (true);

CREATE POLICY "Anyone can manage shift task guidance"
  ON public.shift_task_guidance FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_shift_task_guidance_task_name
  ON public.shift_task_guidance(task_name, lane_order);

DROP TRIGGER IF EXISTS trg_shift_task_guidance_updated_at ON public.shift_task_guidance;
CREATE TRIGGER trg_shift_task_guidance_updated_at
  BEFORE UPDATE ON public.shift_task_guidance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: standing IG safety note + 14 lanes, attached to the "IG DMs sent this shift" task.
DELETE FROM public.shift_task_guidance WHERE task_name = 'IG DMs sent this shift';

INSERT INTO public.shift_task_guidance (task_name, lane_order, lane_title, why_line, steps, is_safety_note) VALUES
('IG DMs sent this shift', 0, 'Instagram account safety — always',
 'Read this before anything else.',
 '["Space actions through your shift, never in one burst.","Never copy-paste the same comment twice.","Never cold-DM a stranger with a pitch — the first message should feel like a real person noticed a real thing.","If you wouldn''t say it to someone''s face, don''t type it."]'::jsonb,
 true),

('IG DMs sent this shift', 1, 'Engage with our own partners',
 'Their followers already trust them, it''s a warm audience.',
 '["Open a partner business''s Instagram (coffee shops, run clubs, gyms we work with).","Like their most recent post.","Leave one real, specific comment, not \"nice!\"","Scroll their other commenters — that''s your list of engaged locals.","Follow 3 to 5 of them.","Comment on one of their posts too."]'::jsonb, false),

('IG DMs sent this shift', 2, 'Answer people who tag us',
 'Highest-intent lead there is, they already showed up.',
 '["Check our tagged posts and stories daily.","Like it.","Reply with something specific to what they posted.","Follow them.","If they''re not already a lead, add them."]'::jsonb, false),

('IG DMs sent this shift', 3, 'Go through members'' friends and family',
 'Their followers are seeing OTF through someone they already trust.',
 '["Find a member''s workout post or story.","Look at who liked or commented.","Engage the same way — comment, follow."]'::jsonb, false),

('IG DMs sent this shift', 4, 'Local business audiences',
 'Filtered, local, already-engaged people in one place.',
 '["Find a local business''s page (not a competing gym).","Like their recent post.","Leave a real comment.","Follow the page.","Open their commenters list.","Follow and comment on 3 to 5 of those people too."]'::jsonb, false),

('IG DMs sent this shift', 5, 'Run and fitness communities',
 'Already choosing to move, easiest conversion on this list.',
 '["Find the local run club or fitness group''s page.","Engage the same 4-step way: like, comment, follow, then their commenters."]'::jsonb, false),

('IG DMs sent this shift', 6, 'Greek life, through philanthropy chairs',
 'A chapter''s philanthropy chair is already looking for event partners.',
 '["Find the chapter''s Instagram.","Find the philanthropy or wellness chair (usually tagged in bio or recent posts).","DM them directly: offer a free class or event tie-in.","Follow up once, politely, if no reply in a few days."]'::jsonb, false),

('IG DMs sent this shift', 7, 'Club and intramural sports teams',
 'Under-followed, easy to reach, already athletic.',
 '["Search UA club/intramural team accounts.","Engage the same 4-step way."]'::jsonb, false),

('IG DMs sent this shift', 8, 'New-to-town audiences',
 'People actively building a routine in a new city.',
 '["Reach out to a local realtor or apartment leasing office.","Offer free class cards for their welcome packets.","Follow their page, engage with their posts too."]'::jsonb, false),

('IG DMs sent this shift', 9, 'Corporate wellness contacts',
 'A named wellness committee contact is a warmer door than "the company".',
 '["Find DCH or Mercedes-Benz wellness/ERG pages if they exist.","DM or find the actual contact person.","Offer a free team class."]'::jsonb, false),

('IG DMs sent this shift', 10, 'Adjacent wellness businesses',
 'PT/chiro patients are told to keep moving right when they''re discharged.',
 '["Find local PT, chiro, or yoga clinic pages.","Engage the same way — like, comment, follow.","When you reach a real person, mention a discharge-to-fitness partnership."]'::jsonb, false),

('IG DMs sent this shift', 11, 'Local realtors',
 'Someone who just bought a house here is actively building a new routine.',
 '["Find realtor pages.","Engage the same way.","Offer free-class cards for their closing gift bags."]'::jsonb, false),

('IG DMs sent this shift', 12, 'Athletic booster clubs',
 'Off-season athletes need conditioning, booster clubs are always fundraising.',
 '["Find the booster club or coach''s page.","Offer a team conditioning session.","They promote it to the whole roster''s families."]'::jsonb, false),

('IG DMs sent this shift', 13, 'Local geotags and event hashtags',
 'People tagging Tuscaloosa landmarks or gameday are locally active and easy to find in one place.',
 '["Search a local hashtag or geotag.","Engage with recent posts the same way."]'::jsonb, false),

('IG DMs sent this shift', 14, 'VIP Class Outreach — Business Partnership',
 'A free class for a business''s team builds a real partnership, not just one visit. The one-line pitch: "We''d love to bring your team in for a free class, it''s a great bonding experience, and we''ll set the whole thing up."',
 '["Pick one way in: DM their Instagram — casual, specific, mention something real about their business.","Or call/email if no Instagram reply.","Or walk in and offer it in person.","Once they say yes: book the class time with them directly.","Offer their staff a membership discount.","Offer their customers a discount too, in exchange for them promoting us to their audience."]'::jsonb, false);
