# Frontend Code Changes for AWS Migration

> **All code updates needed to switch from Supabase to AWS**

This guide shows exactly what code changes are required to migrate your frontend from Supabase to AWS services.

---

## Table of Contents

1. [Environment Variables](#1-environment-variables)
2. [AWS API Client](#2-aws-api-client)
3. [Authentication (Supabase → Cognito)](#3-authentication-supabase--cognito)
4. [Database Queries](#4-database-queries)
5. [Edge Functions → Lambda](#5-edge-functions--lambda)
6. [Storage (S3)](#6-storage-s3)
7. [Real-time Features](#7-real-time-features)

---

## 1. Environment Variables

### Current: Supabase

```env
# .env (Supabase)
VITE_SUPABASE_URL=https://ofjgwusjzgjkfwumzwwy.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

### New: AWS

```env
# .env (AWS)
VITE_AWS_REGION=ap-south-1
VITE_API_ENDPOINT=https://xxxxxx.execute-api.ap-south-1.amazonaws.com/prod
VITE_COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXX
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_S3_BUCKET=tms-production-documents
VITE_CLOUDFRONT_URL=https://dxxxxxxxx.cloudfront.net
```

---

## 2. AWS API Client

### Create New API Client

Create `src/integrations/aws/client.ts`:

```typescript
// src/integrations/aws/client.ts

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

interface ApiOptions extends RequestInit {
  body?: any;
}

class AWSApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${API_ENDPOINT}${path}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    return response.json();
  }

  async post<T>(path: string, data: any): Promise<T> {
    const response = await fetch(`${API_ENDPOINT}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    return response.json();
  }

  async put<T>(path: string, data: any): Promise<T> {
    const response = await fetch(`${API_ENDPOINT}${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    return response.json();
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${API_ENDPOINT}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    return response.json();
  }
}

export const apiClient = new AWSApiClient();
```

---

## 3. Authentication (Supabase → Cognito)

### Install AWS Amplify

```bash
npm install aws-amplify
```

### Create Cognito Auth Provider

Create `src/contexts/CognitoAuthContext.tsx`:

```typescript
// src/contexts/CognitoAuthContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import { 
  signIn, 
  signOut, 
  signUp, 
  confirmSignUp,
  getCurrentUser,
  fetchAuthSession,
  resetPassword,
  confirmResetPassword
} from 'aws-amplify/auth';
import { apiClient } from '@/integrations/aws/client';

// Configure Amplify
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
    }
  }
});

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  confirmResetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function CognitoAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      
      if (session.tokens?.idToken) {
        apiClient.setToken(session.tokens.idToken.toString());
      }

      setUser({
        id: currentUser.userId,
        email: currentUser.signInDetails?.loginId || '',
        name: currentUser.username,
      });
    } catch {
      setUser(null);
      apiClient.clearToken();
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(email: string, password: string) {
    const result = await signIn({ username: email, password });
    
    if (result.isSignedIn) {
      await checkAuth();
    }
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
    apiClient.clearToken();
  }

  async function handleSignUp(email: string, password: string, name: string) {
    await signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          name,
        }
      }
    });
  }

  async function handleConfirmSignUp(email: string, code: string) {
    await confirmSignUp({ username: email, confirmationCode: code });
  }

  async function handleResetPassword(email: string) {
    await resetPassword({ username: email });
  }

  async function handleConfirmResetPassword(
    email: string, 
    code: string, 
    newPassword: string
  ) {
    await confirmResetPassword({
      username: email,
      confirmationCode: code,
      newPassword,
    });
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn: handleSignIn,
        signOut: handleSignOut,
        signUp: handleSignUp,
        confirmSignUp: handleConfirmSignUp,
        resetPassword: handleResetPassword,
        confirmResetPassword: handleConfirmResetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a CognitoAuthProvider');
  }
  return context;
}
```

### Update App.tsx

```typescript
// src/App.tsx

// BEFORE (Supabase)
import { AuthProvider } from '@/contexts/AuthContext';

// AFTER (AWS)
import { CognitoAuthProvider } from '@/contexts/CognitoAuthContext';

function App() {
  return (
    // BEFORE
    // <AuthProvider>
    //   <App />
    // </AuthProvider>
    
    // AFTER
    <CognitoAuthProvider>
      <App />
    </CognitoAuthProvider>
  );
}
```

---

## 4. Database Queries

### Create API Hooks

Instead of direct Supabase queries, create API hooks:

```typescript
// src/hooks/useTrips.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/integrations/aws/client';

interface Trip {
  id: string;
  trip_code: string;
  status: string;
  // ... other fields
}

// Fetch all trips
export function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: () => apiClient.get<Trip[]>('/trips'),
  });
}

// Fetch single trip
export function useTrip(id: string) {
  return useQuery({
    queryKey: ['trips', id],
    queryFn: () => apiClient.get<Trip>(`/trips/${id}`),
    enabled: !!id,
  });
}

// Create trip
export function useCreateTrip() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<Trip>) => 
      apiClient.post<Trip>('/trips', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

// Update trip
export function useUpdateTrip() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Trip> }) =>
      apiClient.put<Trip>(`/trips/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['trips', id] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

// Delete trip
export function useDeleteTrip() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/trips/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
```

### Example: Converting a Component

```typescript
// BEFORE (Supabase direct query)
import { supabase } from '@/integrations/supabase/client';

function TripsList() {
  const { data: trips } = useQuery({
    queryKey: ['trips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });
}

// AFTER (AWS API)
import { useTrips } from '@/hooks/useTrips';

function TripsList() {
  const { data: trips } = useTrips();
}
```

---

## 5. Edge Functions → Lambda

### Update Function Calls

```typescript
// BEFORE (Supabase Edge Function)
const { data } = await supabase.functions.invoke('telenity-tracking', {
  body: { tripId, msisdn }
});

// AFTER (AWS Lambda via API Gateway)
const data = await apiClient.post('/telenity-tracking', { tripId, msisdn });
```

### Create Function Hooks

```typescript
// src/hooks/useTracking.ts

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/integrations/aws/client';

export function useTelenityTracking() {
  return useMutation({
    mutationFn: ({ tripId, msisdn }: { tripId: string; msisdn: string }) =>
      apiClient.post('/telenity-tracking', { tripId, msisdn }),
  });
}

export function useWheelseyeTracking() {
  return useMutation({
    mutationFn: ({ tripId, vehicleNumber }: { tripId: string; vehicleNumber: string }) =>
      apiClient.post('/wheelseye-tracking', { tripId, vehicleNumber }),
  });
}

export function useGoogleMapsRoute() {
  return useMutation({
    mutationFn: (params: { origin: string; destination: string; waypoints?: string[] }) =>
      apiClient.post('/google-maps-route', params),
  });
}
```

---

## 6. Storage (S3)

### Install AWS SDK

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Create S3 Storage Hook

```typescript
// src/hooks/useStorage.ts

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/integrations/aws/client';

const S3_BUCKET = import.meta.env.VITE_S3_BUCKET;
const CLOUDFRONT_URL = import.meta.env.VITE_CLOUDFRONT_URL;

interface UploadResult {
  url: string;
  key: string;
}

export function useFileUpload() {
  return useMutation({
    mutationFn: async ({ file, folder }: { file: File; folder: string }): Promise<UploadResult> => {
      // Get presigned URL from backend
      const { uploadUrl, key } = await apiClient.post<{ uploadUrl: string; key: string }>(
        '/storage/presigned-url',
        {
          fileName: file.name,
          contentType: file.type,
          folder,
        }
      );

      // Upload file directly to S3
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      return {
        url: `${CLOUDFRONT_URL}/${key}`,
        key,
      };
    },
  });
}

export function useFileDelete() {
  return useMutation({
    mutationFn: async (key: string) => {
      await apiClient.delete(`/storage/${encodeURIComponent(key)}`);
    },
  });
}

// Helper to get public URL
export function getStorageUrl(key: string): string {
  return `${CLOUDFRONT_URL}/${key}`;
}
```

### Example: POD Upload Component

```typescript
// BEFORE (Supabase Storage)
const { data, error } = await supabase.storage
  .from('pod-documents')
  .upload(`${shipmentId}/${file.name}`, file);

// AFTER (AWS S3)
const { mutateAsync: uploadFile } = useFileUpload();
const result = await uploadFile({ file, folder: `pod-documents/${shipmentId}` });
```

---

## 7. Real-time Features

### Option A: Polling (Simple)

```typescript
// src/hooks/useRealTimeTrip.ts

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/integrations/aws/client';

export function useRealTimeTrip(tripId: string) {
  return useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => apiClient.get(`/trips/${tripId}`),
    refetchInterval: 5000, // Poll every 5 seconds
    enabled: !!tripId,
  });
}
```

### Option B: WebSocket (Advanced)

```typescript
// src/hooks/useWebSocket.ts

import { useEffect, useRef, useCallback, useState } from 'react';

const WS_ENDPOINT = import.meta.env.VITE_WS_ENDPOINT;

export function useWebSocket<T>(channel: string) {
  const ws = useRef<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<T | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    ws.current = new WebSocket(`${WS_ENDPOINT}?channel=${channel}`);

    ws.current.onopen = () => setIsConnected(true);
    ws.current.onclose = () => setIsConnected(false);
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLastMessage(data);
    };

    return () => {
      ws.current?.close();
    };
  }, [channel]);

  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  return { lastMessage, sendMessage, isConnected };
}
```

---

## Migration Checklist

- [ ] Update environment variables
- [ ] Create AWS API client
- [ ] Implement Cognito authentication
- [ ] Convert database queries to API calls
- [ ] Update edge function calls
- [ ] Migrate file uploads to S3
- [ ] Implement real-time alternatives
- [ ] Test all functionality
- [ ] Remove Supabase dependencies

---

## Removing Supabase Dependencies

Once migration is complete:

```bash
# Remove Supabase packages
npm uninstall @supabase/supabase-js

# Delete Supabase integration folder
rm -rf src/integrations/supabase
```
