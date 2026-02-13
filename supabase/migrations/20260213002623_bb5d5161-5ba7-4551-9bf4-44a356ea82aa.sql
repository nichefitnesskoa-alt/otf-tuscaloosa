
-- Part 5: EIRMA Objection Playbooks table
CREATE TABLE public.objection_playbooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  objection_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  trigger_obstacles text[] NOT NULL DEFAULT '{}',
  empathize_line text NOT NULL DEFAULT '',
  isolate_question text NOT NULL DEFAULT '',
  redirect_framework text NOT NULL DEFAULT '',
  redirect_discovery_question text NOT NULL DEFAULT '',
  suggestion_framework text NOT NULL DEFAULT '',
  ask_line text NOT NULL DEFAULT '',
  full_script text NOT NULL DEFAULT '',
  training_notes text NOT NULL DEFAULT '',
  expert_principles text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.objection_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read objection_playbooks" ON public.objection_playbooks FOR SELECT USING (true);
CREATE POLICY "Admins can manage objection_playbooks" ON public.objection_playbooks FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Part 6D: Add primary_objection to intros_run
ALTER TABLE public.intros_run ADD COLUMN IF NOT EXISTS primary_objection text DEFAULT NULL;

-- Seed EIRMA objection playbooks from existing playbook + expanded EIRMA
INSERT INTO public.objection_playbooks (objection_name, sort_order, trigger_obstacles, empathize_line, isolate_question, redirect_framework, redirect_discovery_question, suggestion_framework, ask_line, full_script, training_notes, expert_principles) VALUES

('Pricing', 1,
  ARRAY['Cost', 'Too expensive / budget concerns', 'Too expensive', 'budget'],
  '"I totally get it — investing in your health is a real decision, and I want to make sure it feels right for you."',
  '"If the price were exactly where you wanted it, is this something you''d be ready to start today?"',
  'Break cost into daily investment. Compare to existing spending (coffee, subscriptions). Emphasize ROI: fewer doctor visits, more energy, better quality of life. Reference their specific goal from the questionnaire to personalize value.',
  '"What are you currently spending on fitness or health-related things each month?"',
  'Present Premier vs Elite as a choice framework, not a pitch. "Most people in your situation choose between two options..." Frame Elite as the value play for committed members.',
  '"Based on everything you''ve shared — your goal of [their goal], wanting [their emotional driver] — let''s get you started. Which option feels like the better fit for where you are right now?"',
  E'**FULL EIRMA SCRIPT — PRICING**\n\n**EMPATHIZE:** "I totally get it — investing in your health is a real decision, and I want to make sure it feels right for you."\n\n**ISOLATE:** "If the price were exactly where you wanted it, is this something you''d be ready to start today?"\n- If YES → proceed to Redirect\n- If NO → there''s another hidden objection. Ask: "What else is on your mind?"\n\n**REDIRECT:**\n1. "What are you currently spending on fitness or health-related things each month?"\n2. Break down cost per session: "At [X] classes per week, you''re looking at about $[Y] per workout — that includes the coach, the plan, the heart rate tracking, everything."\n3. "Think of it this way: $[daily cost] a day. That''s less than your morning coffee for a complete fitness solution."\n4. Reference their goal: "You said [their goal] is important to you. What would it be worth to actually achieve that this year instead of putting it off again?"\n\n**SUGGEST:**\n"Most people in your situation choose between two options:\n- **Premier** at $[X]/month gives you [Y] classes. Great if you want to start with structure.\n- **Elite** at $[X]/month is unlimited. If you''re serious about [their goal], this is where most people see the fastest results because there''s no limit on how often you can come."\n\n**ASK:**\n"Based on everything you''ve shared — your goal of [their goal], wanting [their emotional driver] — let''s get you started. Which option feels like the better fit?"',
  'Common mistake: Defending the price. Never justify — redirect to value. Key: If they say "let me think about it" after pricing, the real objection is almost never price. Dig deeper.',
  'Hormozi: Frame as investment with ROI, not cost. Cialdini: Commitment/consistency — reference what they already said they want. Voss: Label their concern ("It sounds like you want to make sure you''re getting your money''s worth").'
),

('Time', 2,
  ARRAY['Time', 'Schedule is too busy', 'can''t find the time', 'too busy'],
  '"I hear you — everyone''s busy, and the last thing you want is something that adds stress to your schedule."',
  '"If we could find a time that worked perfectly with your schedule, would you be ready to get started?"',
  'Emphasize 1-hour efficiency. Ask about their actual schedule to find pockets. Position OTF as the solution to "not having time to plan workouts." Reference their available days from the questionnaire.',
  '"Walk me through a typical week — what does your schedule actually look like? Where are the gaps?"',
  'Match their available days to the class schedule. "Based on what you told me, [day] at [time] and [day] at [time] would work perfectly. That''s [X] classes a week, which is exactly what you need for [their goal]."',
  '"Let''s lock in those times right now so they''re on your calendar and you don''t have to think about it. Which day do you want to start?"',
  E'**FULL EIRMA SCRIPT — TIME**\n\n**EMPATHIZE:** "I hear you — everyone''s busy, and the last thing you want is something that adds stress to your schedule."\n\n**ISOLATE:** "If we could find a time that worked perfectly with your schedule, would you be ready to get started?"\n\n**REDIRECT:**\n1. "Walk me through a typical week — what does your schedule look like?"\n2. Find the gaps. "So you''re free [day] mornings and [day] evenings? Perfect."\n3. "Here''s the thing about OTF — the workout is done for you. You walk in, the coach tells you exactly what to do, and in 60 minutes you''re done. No planning, no figuring out what to do. You just show up."\n4. "You said you want [their goal]. The members who achieve that are the ones who put it on their calendar like any other appointment. It becomes non-negotiable."\n\n**SUGGEST:**\n"Based on your schedule, here''s what I''d recommend: [X] classes per week on [specific days/times]. That fits your availability and gets you results."\n\n**ASK:**\n"Let''s lock those times in right now. Which day do you want your first official class to be?"',
  'Common mistake: Accepting "I''m too busy" at face value. Everyone has 3-4 hours per week they spend on things less important than their health. Key: Get specific about their schedule — abstract "busy" falls apart when you look at actual hours.',
  'Voss: Calibrated questions ("How does your schedule work?"). Hormozi: Time is the most common false objection — usually masks something else.'
),

('Shopping Around', 3,
  ARRAY['Already have a routine', 'comparing options', 'shopping around', 'checking out other gyms'],
  '"That makes total sense — you should absolutely find the right fit. Let me ask you something..."',
  '"What specifically are you comparing? What would make one option clearly better than another for you?"',
  'Position OTF''s unique differentiators: heart-rate based training, coached classes, community accountability, structured progression. Don''t trash competitors — elevate OTF. Reference their specific goals to show why OTF fits.',
  '"What''s most important to you in choosing where to work out?"',
  'Frame as "results-based decision." "You could try a few places, or you could start getting results now. Every week you spend shopping around is a week you''re not making progress toward [their goal]."',
  '"Here''s what I''d suggest — start here, commit for 30 days, and if it''s not everything I''m telling you it is, we''ll figure it out. But I don''t want you to lose another month. Ready to go?"',
  E'**FULL EIRMA SCRIPT — SHOPPING AROUND**\n\n**EMPATHIZE:** "That makes total sense — you should absolutely find the right fit."\n\n**ISOLATE:** "What specifically are you comparing? What would make one option clearly better than another for you?"\n\n**REDIRECT:**\n1. Listen to their criteria.\n2. Map each criterion back to OTF: "You said you want [X] — here''s exactly how we do that..."\n3. "What makes OTF different is the coach, the heart rate zones, and the community. You''re not just getting a gym — you''re getting a system designed to get results."\n4. "A lot of our members tried other places first. What they tell me is they wish they''d started here sooner."\n\n**SUGGEST:**\nPresent the membership that aligns with their stated criteria.\n\n**ASK:**\n"Start here, commit for 30 days, and see for yourself. Ready to go?"',
  'Key: Don''t compete on features — compete on outcomes. Ask what they want to ACHIEVE, then show how OTF delivers that. Most "shopping around" objections are actually indecision, not comparison.',
  'Cialdini: Social proof ("most of our members tried other places first"). Hormozi: Opportunity cost framing ("every week shopping is a week not progressing").'
),

('Spousal/Parental', 4,
  ARRAY['need to talk to spouse', 'partner', 'husband', 'wife', 'parents'],
  '"I completely understand — big decisions should involve the people who matter most to you."',
  '"If your [spouse/partner] said ''go for it,'' would you be ready to start today?"',
  'Offer to include the partner. Provide take-home materials. Frame it as a health investment for the family. Ask what specifically the partner would want to know — often the member already knows the answer.',
  '"What do you think [spouse/partner] would want to know? What would make them feel good about this?"',
  '"I can put together all the details for you to share, or if they want to come in and see the studio, I''d love to meet them. In the meantime, let me get you set up so we can hold your spot."',
  '"Why don''t we get everything set up now so you don''t lose your spot, and if anything changes after talking with [spouse/partner], we''ll take care of it. Sound fair?"',
  E'**FULL EIRMA SCRIPT — SPOUSAL/PARENTAL**\n\n**EMPATHIZE:** "I completely understand — big decisions should involve the people who matter most to you."\n\n**ISOLATE:** "If your [spouse/partner] said ''go for it,'' would you be ready to start today?"\n- If YES → they want it. Help them sell it at home.\n- If NO → there''s another objection hiding behind this one.\n\n**REDIRECT:**\n1. "What do you think [spouse/partner] would want to know?"\n2. Usually: cost, schedule impact, or commitment length.\n3. Address each one directly.\n4. "A lot of our members'' partners were skeptical at first, and now they say it''s the best investment they''ve made — because when [name] is healthier and happier, everyone benefits."\n\n**SUGGEST:**\nSet everything up contingent on partner approval.\n\n**ASK:**\n"Let''s get you set up now so you don''t lose momentum. If anything changes after your conversation, I''ll take care of it. Fair enough?"',
  'Key: The partner is rarely the real objection. It''s usually cover for their own uncertainty. The isolate question reveals this. If they say "yes, I''d start today if they said yes" — the partner isn''t the problem. Help them build the case to present at home.',
  'Voss: "It sounds like you really want to do this but you''re worried about the reaction." Cialdini: Commitment — get a micro-yes now that creates momentum.'
),

('Think About It', 5,
  ARRAY['think about it', 'need to think', 'not sure yet', 'want to consider'],
  '"Of course — I want you to feel 100% good about this. Can I ask you something?"',
  '"What specifically do you need to think about?"',
  'This is NEVER the real objection. It masks pricing, timing, fear, or partner concerns. The isolate question is critical here — it forces the real objection to surface. Once you know the real objection, pivot to that EIRMA script.',
  '"What specifically do you need to think about? Is it the price, the schedule, or something else?"',
  'Once the real objection surfaces, use the matching EIRMA script. If they truly can''t articulate it: "Totally fair. Let me ask — on a scale of 1-10, how excited are you about getting started? ... What would make it a 10?"',
  '"I don''t want you to lose the momentum from today. Let''s get you set up — you can always adjust later. What do you say?"',
  E'**FULL EIRMA SCRIPT — THINK ABOUT IT**\n\n**EMPATHIZE:** "Of course — I want you to feel 100% good about this."\n\n**ISOLATE:** "What specifically do you need to think about?"\n\nThis is the MOST IMPORTANT isolate question in all of EIRMA. "Think about it" is a catch-all that hides the real objection.\n\n**REDIRECT:**\nWait for their answer, then pivot:\n- If pricing → go to Pricing EIRMA\n- If schedule → go to Time EIRMA\n- If partner → go to Spousal EIRMA\n- If truly undecided: "On a scale of 1-10, how excited are you? ... What would make it a 10?"\n\n**KEY PRINCIPLE:** Never let them leave with "I need to think about it" as the final answer. You don''t have to close them today, but you DO need to know what the real objection is so your follow-up is targeted.\n\n**ASK:**\n"I don''t want you to lose the momentum from today. Let''s get you started."',
  '"Think about it" has the lowest conversion rate of any objection because most SAs accept it and move on. The SA who asks "what specifically?" closes 2x more. NEVER accept "think about it" as a final answer — always dig one level deeper.',
  'Voss: "It seems like there''s something holding you back." Mirror technique: repeat their last 3 words as a question. Miner: The "someday" list — "Is this going on your someday list, or is this something you''re actually going to do?"'
),

('Out of Town', 6,
  ARRAY['traveling', 'out of town', 'moving', 'not local', 'vacation'],
  '"That makes sense — no point in starting something you can''t maintain."',
  '"When you''re back/settled, is this something you''d want to start right away?"',
  'If temporary travel: "OTF has [X] studios nationwide. Your membership works at all of them." If moving: get their destination city and find the nearest OTF. If timing: set a specific start date.',
  '"When exactly are you back? Let''s get a date on the calendar."',
  'For travelers: Highlight OTF''s nationwide network. For future starts: "Let''s lock in today''s rate and set your start date for when you''re back — that way you don''t pay more later."',
  '"Let''s get you set up at today''s rate with a start date of [their return date]. That way you''re locked in and ready to go when you get back."',
  E'**FULL EIRMA SCRIPT — OUT OF TOWN**\n\n**EMPATHIZE:** "That makes sense — no point in starting something you can''t maintain."\n\n**ISOLATE:** "When you''re back/settled, is this something you''d want to start right away?"\n\n**REDIRECT:**\n- Temporary travel: "Did you know your OTF membership works at every studio in the country? You can keep going wherever you are."\n- Moving: "Where are you headed? There''s likely an OTF near you. Let me look it up."\n- Vacation: "Perfect — let''s set your start date for [return date]. You''ll actually have something to look forward to coming back to."\n\n**SUGGEST:**\nSet a future start date at today''s pricing.\n\n**ASK:**\n"Let''s lock in today''s rate with a start date of [return date]. You save money and you''re all set when you get back."',
  'Out of town is often a stall tactic rather than a real objection. The isolate question reveals whether they''re genuinely interested or just being polite. If genuinely traveling, OTF''s nationwide network is a strong redirect.',
  'Cialdini: Scarcity — "today''s rate" creates urgency. Commitment: Setting a future date creates a commitment that makes follow-through more likely.'
);
