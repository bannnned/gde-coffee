DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'users_role_chk'
    ) THEN
        ALTER TABLE public.users
            DROP CONSTRAINT users_role_chk;
    END IF;

    ALTER TABLE public.users
        ADD CONSTRAINT users_role_chk CHECK (role IN ('user', 'moderator', 'admin'));
END
$$;
