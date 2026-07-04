-- Default reference data for DK Production Manager

insert into "ProjectType" (name, color) values
  ('Film publicitaire', '#9d3bf1'),
  ('Reportage', '#22d3ee'),
  ('Clip musical', '#ef4444'),
  ('Mariage / Événementiel', '#f59e0b'),
  ('Photographie', '#10b981'),
  ('Documentaire', '#6e6a75')
on conflict do nothing;

insert into "EventType" (name, color) values
  ('Tournage', '#9d3bf1'),
  ('Réunion client', '#22d3ee'),
  ('Livraison', '#10b981'),
  ('Repérage', '#f59e0b'),
  ('Montage', '#6e6a75'),
  ('Autre', '#ef4444')
on conflict do nothing;
