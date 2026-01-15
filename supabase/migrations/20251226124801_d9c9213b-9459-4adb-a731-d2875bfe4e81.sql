-- Add unique constraint on user_id in user_roles to ensure one user can only have one role
-- First, delete any duplicate roles keeping only the first one
DELETE FROM user_roles a USING user_roles b
WHERE a.id > b.id AND a.user_id = b.user_id;

-- Now add the unique constraint
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);