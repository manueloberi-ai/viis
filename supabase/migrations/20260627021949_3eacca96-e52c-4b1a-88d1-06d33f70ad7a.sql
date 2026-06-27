
CREATE OR REPLACE FUNCTION public.set_updated_at_contacts()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Cliente',
  piattaforma TEXT,
  username TEXT,
  email TEXT,
  telefono TEXT,
  citta TEXT,
  paese TEXT,
  note TEXT,
  totale_transazioni INTEGER NOT NULL DEFAULT 0,
  totale_speso NUMERIC(10,2) NOT NULL DEFAULT 0,
  ultimo_contatto DATE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  preferito BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own contacts" ON public.contacts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_contacts();

CREATE INDEX idx_contacts_user ON public.contacts(user_id);
