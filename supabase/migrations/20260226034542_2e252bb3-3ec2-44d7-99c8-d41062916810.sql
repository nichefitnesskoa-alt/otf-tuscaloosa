-- Phone normalization across all tables
UPDATE intros_booked 
SET phone = substring(phone from 3)
WHERE phone IS NOT NULL AND phone ~ '^\+1\d{10}$';

UPDATE intros_booked 
SET phone = substring(phone from 2)
WHERE phone IS NOT NULL AND phone ~ '^1\d{10}$';

UPDATE leads 
SET phone = substring(phone from 3)
WHERE phone IS NOT NULL AND phone ~ '^\+1\d{10}$';

UPDATE leads 
SET phone = substring(phone from 2)
WHERE phone IS NOT NULL AND phone ~ '^1\d{10}$';

UPDATE vip_registrations 
SET phone = substring(phone from 3)
WHERE phone IS NOT NULL AND phone ~ '^\+1\d{10}$';

UPDATE vip_registrations 
SET phone = substring(phone from 2)
WHERE phone IS NOT NULL AND phone ~ '^1\d{10}$';

-- Migrate "Didn't Buy" to "Follow-up needed" in intros_run only
UPDATE intros_run 
SET result = 'Follow-up needed', result_canon = 'FOLLOW_UP_NEEDED'
WHERE result_canon = 'DIDNT_BUY' OR result = 'Didn''t Buy';