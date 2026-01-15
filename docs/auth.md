# Authentication & Authorization

## Overview

The system uses Supabase Auth for authentication with a custom role-based access control (RBAC) system for authorization.

## Authentication

### Supabase Auth
Built on Supabase's authentication system with:
- Email/password login
- Session management
- JWT tokens

### Login Flow
```
User enters email/password
        ↓
supabase.auth.signInWithPassword()
        ↓
JWT token issued
        ↓
Session stored in localStorage
        ↓
User redirected to dashboard
```

### Registration Flow
```
User fills registration form
        ↓
supabase.auth.signUp()
        ↓
User created in auth.users
        ↓
Trigger: handle_new_user()
        ↓
Profile created in public.profiles
        ↓
Email verification (optional)
```

### Session Management
```typescript
// Check current session
const { data: { session } } = await supabase.auth.getSession();

// Listen to auth changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    // Redirect to login
  }
});
```

## Authorization

### Role Types

| Role | Description | Access Level |
|------|-------------|--------------|
| `superadmin` | Full system access | All operations |
| `admin` | Operational access | Most operations |
| `user` | Limited access | View only |

### Role Storage
Roles stored in separate `user_roles` table:
```sql
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
```

**Security Note:** Roles are NOT stored in profiles table to prevent privilege escalation attacks.

### Role Checking Functions

#### is_superadmin()
```sql
CREATE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'superadmin'
  )
$$;
```

#### has_role()
```sql
CREATE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

## Row-Level Security (RLS)

### Policy Pattern
All tables use RLS with superadmin access:
```sql
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage trips"
ON public.trips
FOR ALL
USING (is_superadmin(auth.uid()));
```

### User-Specific Policies
For user data tables:
```sql
-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id);
```

## Protected Routes

### ProtectedRoute Component
```typescript
// src/components/ProtectedRoute.tsx
export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/" />;
  
  return children;
};
```

### Usage
```tsx
<Route 
  path="/dashboard" 
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  } 
/>
```

## Auth Context

### Provider
```typescript
// src/contexts/AuthContext.tsx
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    
    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );
    
    return () => subscription.unsubscribe();
  }, []);
  
  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Hook
```typescript
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

## Security Best Practices

### Never Do
- ❌ Store roles in localStorage/sessionStorage
- ❌ Check admin status client-side only
- ❌ Store roles on profiles table
- ❌ Hardcode admin credentials
- ❌ Bypass RLS for convenience

### Always Do
- ✅ Use database functions for role checks
- ✅ Enable RLS on all tables
- ✅ Use SECURITY DEFINER functions
- ✅ Validate on server-side
- ✅ Use separate user_roles table

## Profile Management

### Automatic Profile Creation
Trigger on user registration:
```sql
CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Profile Page
Users can update their profile:
- First name
- Last name
- Company

## Logout

```typescript
const handleLogout = async () => {
  await supabase.auth.signOut();
  navigate('/');
};
```

## Components

### Pages
- `src/pages/Index.tsx` - Login page
- `src/pages/Profile.tsx` - User profile
- `src/pages/Users.tsx` - User management (admin)

### Components
- `src/components/AuthForm.tsx` - Login/signup form
- `src/components/ProtectedRoute.tsx` - Route guard

### Context
- `src/contexts/AuthContext.tsx` - Auth state management
