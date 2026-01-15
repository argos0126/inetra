-- Insert superadmin role for the main user
INSERT INTO public.user_roles (user_id, role)
VALUES ('41e7b171-1d4e-4743-8ee1-22321dc80737', 'superadmin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Ensure the profile is active
UPDATE public.profiles
SET is_active = true
WHERE user_id = '41e7b171-1d4e-4743-8ee1-22321dc80737';