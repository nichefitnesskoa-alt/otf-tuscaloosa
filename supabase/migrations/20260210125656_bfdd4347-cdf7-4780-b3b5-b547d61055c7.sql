DROP POLICY "Authenticated users can create questionnaires" ON intro_questionnaires;
CREATE POLICY "Anyone can create questionnaires"
  ON intro_questionnaires FOR INSERT
  WITH CHECK (true);