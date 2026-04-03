UPDATE public.intros_booked SET lead_source = 'Instagram DMs' WHERE lead_source IN ('Source Not Found', 'OTF Lead Intake Sheet');
UPDATE public.intros_run SET lead_source = 'Instagram DMs' WHERE lead_source IN ('Source Not Found', 'OTF Lead Intake Sheet');
UPDATE public.leads SET source = 'Instagram DMs' WHERE source IN ('Source Not Found', 'OTF Lead Intake Sheet');
UPDATE public.sales_outside_intro SET lead_source = 'Instagram DMs' WHERE lead_source IN ('Source Not Found', 'OTF Lead Intake Sheet');