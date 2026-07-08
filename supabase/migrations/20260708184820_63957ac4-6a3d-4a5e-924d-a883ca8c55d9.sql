-- De-dupe existing rows before adding the unique index (keep the earliest).
DELETE FROM public.soml_upgrades u
USING public.soml_upgrades u2
WHERE u.id <> u2.id
  AND lower(btrim(u.member_name)) = lower(btrim(u2.member_name))
  AND u.created_at > u2.created_at;

DELETE FROM public.soml_manual_referrals r
USING public.soml_manual_referrals r2
WHERE r.id <> r2.id
  AND lower(btrim(r.member_name)) = lower(btrim(r2.member_name))
  AND r.created_at > r2.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_soml_upgrades_member_name
  ON public.soml_upgrades (lower(btrim(member_name)));

CREATE UNIQUE INDEX IF NOT EXISTS uniq_soml_manual_referrals_member_name
  ON public.soml_manual_referrals (lower(btrim(member_name)));