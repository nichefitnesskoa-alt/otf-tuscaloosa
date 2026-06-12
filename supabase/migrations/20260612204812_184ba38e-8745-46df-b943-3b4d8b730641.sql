
-- Per-bullet guidance
CREATE TABLE public.fv_scoring_guidance (
  bullet_key text PRIMARY KEY,
  score_0 text NOT NULL,
  score_1 text NOT NULL,
  score_2 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fv_scoring_guidance TO anon, authenticated;
GRANT ALL ON public.fv_scoring_guidance TO service_role;
ALTER TABLE public.fv_scoring_guidance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read scoring guidance" ON public.fv_scoring_guidance FOR SELECT USING (true);
CREATE TRIGGER trg_fv_scoring_guidance_updated BEFORE UPDATE ON public.fv_scoring_guidance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-column meta (star + why this matters)
CREATE TABLE public.fv_scoring_columns (
  column_key text PRIMARY KEY,
  is_starred boolean NOT NULL DEFAULT false,
  why_matters text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fv_scoring_columns TO anon, authenticated;
GRANT ALL ON public.fv_scoring_columns TO service_role;
ALTER TABLE public.fv_scoring_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read scoring columns" ON public.fv_scoring_columns FOR SELECT USING (true);
CREATE TRIGGER trg_fv_scoring_columns_updated BEFORE UPDATE ON public.fv_scoring_columns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Global how-to-score rule (single row)
CREATE TABLE public.fv_scoring_global (
  id text PRIMARY KEY DEFAULT 'default',
  surface_test text NOT NULL,
  awareness_test text NOT NULL,
  scale_meaning text NOT NULL,
  bottom_line text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fv_scoring_global_single_row CHECK (id = 'default')
);
GRANT SELECT ON public.fv_scoring_global TO anon, authenticated;
GRANT ALL ON public.fv_scoring_global TO service_role;
ALTER TABLE public.fv_scoring_global ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read scoring global" ON public.fv_scoring_global FOR SELECT USING (true);
CREATE TRIGGER trg_fv_scoring_global_updated BEFORE UPDATE ON public.fv_scoring_global
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: per-bullet guidance (15 rows mapped to existing bullet_keys)
INSERT INTO public.fv_scoring_guidance (bullet_key, score_0, score_1, score_2) VALUES
('tread_otconnect',
 'Intro never got synced. No heart rate on the board, no help getting the tread moving.',
 'Got them connected and the tread running, then moved on. Basics handled, nothing more.',
 'Got them synced and made sure the intro starts off on the right foot with the first effort and the feeling.'),
('tread_first_effort',
 'Left them to guess their own speed and incline. No help dialing anything in.',
 'Just gave a thumbs up and a quick check-in.',
 'Helped them gauge how their initial effort was and whether they needed any initial changes.'),
('tread_throughout',
 'One check at the start, then never returned to the tread.',
 'A thumbs up each pass. Friendly, but never read how they were holding up block to block.',
 'Came back each block with intent. Read their effort, offered a real adjustment, let them choose to push or back off.'),
('rower_setup',
 'Intro sat down with feet unstrapped and damper untouched. No help came.',
 'Helped them get strapped in.',
 'Got them set up, helped with the OTConnect options, and got them going on their initial effort and tempo.'),
('rower_phases',
 'No form cue at all. Intro rowed all arms the whole block, no fix offered.',
 'General coaching cues, to the group or the intro.',
 'Customized coaching to the guest based on their level.'),
('rower_throughout',
 'Helped at setup, never came back. Form fell apart on the second row with no support.',
 'General check-in (simple thumbs up).',
 'Offering them goals or challenges appropriate to their level.'),
('floor_connect',
 'Never came to the intro''s station the entire floor block.',
 'General acknowledgement, once or multiple times.',
 'Made at least one emotional connection. Tied things back to their goals or why.'),
('floor_correct',
 'Intro''s form broke down rep after rep. No correction all block.',
 'Hit 1 or 2 of the cueing styles (verbal, visual, tactile).',
 'Personalized verbal, visual, and tactile cueing.'),
('floor_customize',
 'No option was offered (takeaway modification).',
 'Coach offered options as needed to the intro (responding to needs).',
 'Offering goals or challenges appropriate to their level (proactive coaching).'),
('otbeat_color',
 'Never spoke to the intro about their colors or zones all class.',
 'Good coaching to the whole group on colors.',
 'Intentionally working with the guest to help them understand their heart rate.'),
('otbeat_feeling',
 'Never connected effort to a feeling for the intro. No internal gauge.',
 'Consistent in saying to the group how efforts should feel.',
 'Asking questions to gauge if they''re at the right effort level.'),
('otbeat_hr',
 'Percentages never came up. Intro didn''t know what the number on their tile meant.',
 'Letting a guest know that 84% is where we hit orange.',
 'Coached the number to a real target. Bringing their heart rate down a few percent in a walking recovery, or pointing out they''re getting close to the 84% orange zone.'),
('handback_recap',
 'No recap of their data. Intro left without seeing what they accomplished.',
 'Read the splat number off the screen. Never connected it back to why they came in.',
 'Pulled one or two numbers and tied them directly to the goal they shared. Showed them they did the thing they came to do.'),
('handback_recommend',
 'No recommendation on how often to come or what would help them progress.',
 'Told them to come as much as they can. Encouraging, but no specific number tied to their goal.',
 'Gave a specific frequency built around their goal and explained why, plus how a personal monitor would help them track it.'),
('handback_prebook',
 'Intro left without ever being asked when they''re coming back.',
 'Told them to come back soon. Warm, but no day, no class, no next step set.',
 'Tied a specific class to something they enjoyed today, named the day, and booked it with them on the spot.');

-- Seed: column meta
INSERT INTO public.fv_scoring_columns (column_key, is_starred, why_matters) VALUES
('tread',    true,  'One of the two most important. Where the intro first learns what heart-rate-based training feels like.'),
('rower',    false, NULL),
('floor',    false, NULL),
('otbeat',   true,  'The other category that matters most. Heart rate is why people stay.'),
('handback', false, NULL);

-- Seed: global rule
INSERT INTO public.fv_scoring_global (id, surface_test, awareness_test, scale_meaning, bottom_line) VALUES
('default',
 'Surface or deep? Did you give the intro the basic version, or get in there — ask, read them, respond to what you saw?',
 'Aware of them? Were you reading this person''s state in this moment, or running a default you''d run for anyone?',
 '0 did not do · 1 surface level (touched it, stayed shallow) · 2 hit standard (got in there with them).',
 'A 1 checks the box, a 2 changes the visit. Stand beside them. See the rep. Ask. Mean it.');
