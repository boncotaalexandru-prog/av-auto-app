-- Adauga coloana furnizor la cheltuielile de masini
alter table public.parc_cheltuieli add column if not exists furnizor text;
