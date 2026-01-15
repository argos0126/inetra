
-- Remove the duplicate/incorrect role entry (admin without custom_role_id)
DELETE FROM public.user_roles 
WHERE id = '362f9c00-2728-4528-97d4-aeb9169cc47d';

-- Update the remaining entry to use 'admin' base role instead of 'user'
UPDATE public.user_roles 
SET role = 'admin' 
WHERE id = 'e0bd2902-90f3-4bd7-938c-954d8a302c7e';
