-- Fix: Change standard_tat_hours from INTEGER to NUMERIC to allow decimal values
-- This fixes the "invalid input syntax for type integer" error when storing calculated TAT values

ALTER TABLE serviceability_lanes 
ALTER COLUMN standard_tat_hours TYPE NUMERIC USING standard_tat_hours::NUMERIC;