
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'contatto',
  ADD COLUMN IF NOT EXISTS motivo text,
  ADD COLUMN IF NOT EXISTS messaggio text,
  ADD COLUMN IF NOT EXISTS data date,
  ADD COLUMN IF NOT EXISTS stato_attivita text NOT NULL DEFAULT 'in_programma',
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE;

ALTER TABLE public.contacts
  DROP COLUMN IF EXISTS totale_transazioni,
  DROP COLUMN IF EXISTS totale_speso;

CREATE INDEX IF NOT EXISTS idx_contacts_kind ON public.contacts(user_id, kind);
CREATE INDEX IF NOT EXISTS idx_contacts_data ON public.contacts(user_id, data);
CREATE INDEX IF NOT EXISTS idx_contacts_parent ON public.contacts(parent_id);
