-- Prevent duplicate account associations per (user, platform, username)
CREATE UNIQUE INDEX IF NOT EXISTS platform_accounts_user_platform_username_uidx
  ON public.platform_accounts (user_id, platform, lower(username))
  WHERE username IS NOT NULL AND length(trim(username)) > 0;