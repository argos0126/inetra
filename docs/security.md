# Security Guidelines

## Overview

This document outlines security measures, best practices, and guidelines for the Logistics TMS application.

## Authentication Security

### Password Requirements
- Managed by Supabase Auth
- Configurable in Supabase Dashboard

### Session Security
- JWT tokens with expiration
- Automatic token refresh
- Secure storage in browser

### Never Store
```typescript
// ❌ NEVER DO THIS
localStorage.setItem('isAdmin', 'true');
localStorage.setItem('userRole', 'superadmin');

// ❌ NEVER CHECK CLIENT-SIDE ONLY
if (localStorage.getItem('isAdmin')) {
  showAdminPanel();
}
```

## Authorization Security

### Role-Based Access Control

**Secure Pattern:**
```sql
-- Roles in separate table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Security definer function
CREATE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'superadmin'
  )
$$;
```

### Row-Level Security (RLS)

**All tables MUST have RLS enabled:**
```sql
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policy_name"
ON public.table_name
FOR ALL
USING (is_superadmin(auth.uid()));
```

### Avoiding Recursive RLS

**Wrong:**
```sql
-- ❌ Creates infinite recursion
CREATE POLICY "Admins can view all"
ON public.profiles
FOR SELECT
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
```

**Correct:**
```sql
-- ✅ Use security definer function
CREATE POLICY "Admins can view all"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
```

## Data Protection

### Sensitive Data Categories

| Category | Examples | Protection |
|----------|----------|------------|
| PII | Aadhaar, PAN, phone | RLS, encryption |
| Credentials | API tokens | Edge functions only |
| Location | GPS coordinates | RLS, access logs |
| Documents | License, POD | Storage policies |

### Storage Security

**Storage bucket policies:**
```sql
-- Private bucket for documents
CREATE POLICY "Users can access own documents"
ON storage.objects
FOR ALL
USING (bucket_id = 'driver-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]);
```

### API Secrets

**Never expose in frontend:**
```typescript
// ❌ NEVER
const API_KEY = 'sk-1234567890';
fetch('https://api.example.com', {
  headers: { 'Authorization': API_KEY }
});

// ✅ CORRECT - Use edge functions
const { data } = await supabase.functions.invoke('api-wrapper', {
  body: { action: 'get-data' }
});
```

## Edge Function Security

### CORS Headers
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

### Service Role Usage
```typescript
// Edge functions use service role for database access
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
```

### Input Validation
```typescript
// Always validate input
const { msisdn } = await req.json();

if (!msisdn || typeof msisdn !== 'string') {
  return new Response(
    JSON.stringify({ error: 'Invalid MSISDN' }),
    { status: 400 }
  );
}

// Sanitize before use
const sanitizedMsisdn = msisdn.replace(/[^0-9]/g, '');
```

### No Raw SQL
```typescript
// ❌ NEVER execute raw SQL
await supabase.rpc('execute_sql', { query: userInput });

// ✅ Use Supabase client methods
await supabase.from('table').select().eq('column', value);
```

## Token Management

### Storage
```sql
-- Tokens stored securely in database
CREATE TABLE public.integration_tokens (
  id uuid PRIMARY KEY,
  token_type text NOT NULL,
  token_value text NOT NULL,  -- Encrypted at rest by Supabase
  expires_at timestamptz NOT NULL
);
```

### Auto-Refresh
- Authentication token: Every 5 hours (6hr expiry)
- Access token: Every 25 minutes (30min expiry)
- Cron jobs handle refresh

### Access Pattern
```typescript
// Only edge functions access tokens
const token = await getStoredToken(supabase, 'authentication');
if (!token || isExpired(token)) {
  await autoRefreshToken(supabase, 'authentication');
}
```

## Logging & Audit

### What to Log
- Authentication events
- Status changes
- Data access patterns
- API calls
- Errors

### Audit Tables
- `trip_audit_logs` - Trip status changes
- `shipment_status_history` - Shipment updates
- Supabase built-in logging for auth

### Log Security
- No sensitive data in logs
- No passwords or tokens
- Mask PII where possible

## Security Checklist

### Before Deployment
- [ ] RLS enabled on all tables
- [ ] All secrets in environment variables
- [ ] No hardcoded credentials
- [ ] API keys only in edge functions
- [ ] Storage bucket policies configured
- [ ] CORS properly configured
- [ ] Input validation in place
- [ ] Error messages don't leak info

### Regular Checks
- [ ] Review RLS policies
- [ ] Rotate API keys periodically
- [ ] Check for leaked secrets
- [ ] Monitor access logs
- [ ] Update dependencies

## Incident Response

### If Credentials Leaked
1. Immediately rotate affected credentials
2. Update Supabase secrets
3. Redeploy edge functions
4. Review access logs
5. Notify affected parties

### If Unauthorized Access Detected
1. Review auth logs
2. Identify affected accounts
3. Force password resets
4. Review RLS policies
5. Document and report

## Compliance Notes

### Data Retention
- Location history: As per business requirement
- Audit logs: Minimum 1 year
- Consent records: As per regulatory requirement

### PII Handling
- Aadhaar/PAN: Masked in UI where possible
- Phone numbers: Visible only to authorized users
- Documents: Secure storage with access control

## Security Resources

- [Supabase Security Best Practices](https://supabase.com/docs/guides/database/postgres/security)
- [RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Security](https://supabase.com/docs/guides/storage/security)
