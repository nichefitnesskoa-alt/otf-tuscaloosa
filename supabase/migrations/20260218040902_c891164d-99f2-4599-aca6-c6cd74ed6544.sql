ALTER TABLE shift_recaps
  ADD CONSTRAINT shift_recaps_staff_date_type_unique
  UNIQUE (staff_name, shift_date, shift_type);