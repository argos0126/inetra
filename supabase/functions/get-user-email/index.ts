import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create client with user's auth token to verify authorization
    const authHeaderRaw = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeaderRaw) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = authHeaderRaw.startsWith("Bearer ") ? authHeaderRaw : `Bearer ${authHeaderRaw}`;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const accessToken = authHeader.replace(/^Bearer\s+/i, "");

    // Get the requesting user (pass the access token explicitly to avoid relying on stored session)
    const {
      data: { user: requestingUser },
      error: userError,
    } = await userClient.auth.getUser(accessToken);
    if (userError || !requestingUser) {
      console.error("get-user-email unauthorized", {
        userError,
        hasAuthHeader: Boolean(authHeaderRaw),
        authHeaderPrefix: authHeaderRaw.slice(0, 16),
      });

      return new Response(
        JSON.stringify({ error: "Unauthorized", details: userError?.message ?? null }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is superadmin or requesting their own email
    const { data: isSuperadmin } = await userClient.rpc("is_superadmin", {
      _user_id: requestingUser.id,
    });

    // Check if user has permission to view users
    const { data: hasViewPermission } = await userClient.rpc("has_permission", {
      _user_id: requestingUser.id,
      _resource: "users",
      _action: "view",
    });

    const isOwnProfile = requestingUser.id === userId;

    if (!isSuperadmin && !hasViewPermission && !isOwnProfile) {
      return new Response(
        JSON.stringify({ error: "Permission denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client with service role key to access auth.users
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user by ID
    const { data: userData, error: getUserError } = await adminClient.auth.admin.getUserById(userId);

    if (getUserError) {
      console.error("Error getting user:", getUserError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        email: userData.user.email,
        emailConfirmed: userData.user.email_confirmed_at !== null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
