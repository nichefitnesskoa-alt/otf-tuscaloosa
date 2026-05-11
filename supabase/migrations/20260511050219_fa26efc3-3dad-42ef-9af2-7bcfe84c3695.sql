-- Deactivate legacy per-shift templates and seed unified 'standard' set.
UPDATE public.shift_task_templates
SET is_active = false
WHERE shift_type IN ('morning','mid','last','weekend');

INSERT INTO public.shift_task_templates (shift_type, task_order, task_name, has_count, count_label, is_active) VALUES
('standard', 10, 'Name on whiteboard before intros arrive', false, NULL, true),
('standard', 11, 'Booking confirmation and questionnaire sent for today', false, NULL, true),
('standard', 12, 'Read their questionnaire before they walk in — know one thing about them', false, NULL, true),
('standard', 20, 'Comment genuinely on posts on feed or people we follow today', true, '(Comments Made)', true),
('standard', 21, 'IG DMs sent this shift', true, 'DMs sent', true),
('standard', 22, 'Lead texts sent this shift — new or cold', true, 'Texts sent', true),
('standard', 30, 'Follow-up queue worked this shift', false, NULL, true),
('standard', 31, 'At least one person got a real next step — a booking, a date, a real answer', false, NULL, true),
('standard', 40, 'Create a connection with a member. Learn something new about them.', false, NULL, true),
('standard', 41, 'Ask a member if they have a friend who wants a free class', false, NULL, true),
('standard', 50, 'Milestones checked after every check-in wave — bag prepped before they finish class', false, NULL, true),
('standard', 51, 'Rowers checked and charging if needed — nothing left for the next SA to discover', false, NULL, true);