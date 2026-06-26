
CREATE TABLE public.ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  inventory_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  platform TEXT,
  generated_title TEXT,
  generated_description TEXT,
  photos TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ads_photos_max_20 CHECK (array_length(photos, 1) IS NULL OR array_length(photos, 1) <= 20)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads TO authenticated;
GRANT ALL ON public.ads TO service_role;

ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own ads" ON public.ads
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER ads_touch_updated_at
  BEFORE UPDATE ON public.ads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX ads_user_id_idx ON public.ads(user_id);
CREATE INDEX ads_inventory_id_idx ON public.ads(inventory_id);
