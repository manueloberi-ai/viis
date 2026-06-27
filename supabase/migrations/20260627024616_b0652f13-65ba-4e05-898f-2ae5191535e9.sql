
-- 1) Audit log table
CREATE TABLE public.inventory_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid,
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  changed_fields jsonb,
  old_row jsonb,
  new_row jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventory_audit_log_user_idx ON public.inventory_audit_log(user_id, created_at DESC);
CREATE INDEX inventory_audit_log_item_idx ON public.inventory_audit_log(inventory_item_id);

GRANT SELECT ON public.inventory_audit_log TO authenticated;
GRANT ALL ON public.inventory_audit_log TO service_role;

ALTER TABLE public.inventory_audit_log ENABLE ROW LEVEL SECURITY;

-- Only owners can read their audit rows; no client writes (trigger uses SECURITY DEFINER)
CREATE POLICY "audit owner read" ON public.inventory_audit_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2) Trigger function
CREATE OR REPLACE FUNCTION public.log_inventory_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_changed jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user := OLD.user_id;
    INSERT INTO public.inventory_audit_log(inventory_item_id, user_id, action, old_row)
    VALUES (OLD.id, v_user, 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    v_user := NEW.user_id;
    INSERT INTO public.inventory_audit_log(inventory_item_id, user_id, action, new_row)
    VALUES (NEW.id, v_user, 'INSERT', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_user := NEW.user_id;
    SELECT jsonb_object_agg(key, value)
      INTO v_changed
      FROM jsonb_each(to_jsonb(NEW))
     WHERE to_jsonb(NEW) -> key IS DISTINCT FROM to_jsonb(OLD) -> key;
    IF v_changed IS NOT NULL THEN
      INSERT INTO public.inventory_audit_log(inventory_item_id, user_id, action, changed_fields, old_row, new_row)
      VALUES (NEW.id, v_user, 'UPDATE', v_changed, to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_inventory_audit
AFTER INSERT OR UPDATE OR DELETE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.log_inventory_changes();

-- 3) Ensure ads.inventory_id can only reference an item owned by the same user
CREATE OR REPLACE FUNCTION public.ensure_ads_inventory_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF NEW.inventory_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT user_id INTO v_owner FROM public.inventory_items WHERE id = NEW.inventory_id;
  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;
  IF v_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'Non puoi collegare un annuncio a un prodotto di un altro utente' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ads_owner_check
BEFORE INSERT OR UPDATE ON public.ads
FOR EACH ROW EXECUTE FUNCTION public.ensure_ads_inventory_owner();
