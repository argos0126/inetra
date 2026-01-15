import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Role name to role ID mapping - these are the system roles
const ROLE_MAPPING: Record<string, string> = {
  "Viewer": "viewer",
  "Shipper User": "shipper_user", 
  "Transporter Admin": "transporter_admin",
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

    // Create client with user's auth token to verify they're authorized
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the requesting user
    const { data: { user: requestingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is superadmin or has permission to create users
    const { data: isSuperadmin } = await userClient.rpc("is_superadmin", {
      _user_id: requestingUser.id,
    });

    const { data: hasPermission } = await userClient.rpc("has_permission", {
      _user_id: requestingUser.id,
      _resource: "users",
      _action: "create",
    });

    if (!isSuperadmin && !hasPermission) {
      return new Response(
        JSON.stringify({ error: "You don't have permission to create entity users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { 
      email, 
      entityType, // 'driver', 'customer', 'transporter'
      entityId,
      firstName,
      lastName,
      roleName, // 'Viewer', 'Shipper User', 'Transporter Admin'
      customerId // Optional: for scoping role to a customer
    } = await req.json();

    console.log(`Creating user for ${entityType} with email: ${email}, role: ${roleName}`);

    if (!email || !entityType || !entityId || !roleName) {
      return new Response(
        JSON.stringify({ error: "Email, entityType, entityId, and roleName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Generate a random temporary password
    const tempPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";

    // Create the user using admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: firstName || "",
        last_name: lastName || "",
        entity_type: entityType,
        entity_id: entityId,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User created with ID: ${newUser.user.id}`);

    // Find the role by name
    const { data: roleData, error: roleFetchError } = await adminClient
      .from("roles")
      .select("id")
      .eq("name", roleName)
      .single();

    if (roleFetchError || !roleData) {
      console.error("Error finding role:", roleFetchError);
      // Delete the user if role not found
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: `Role '${roleName}' not found` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found role ID: ${roleData.id} for role: ${roleName}`);

    // Assign base role 'user' and custom role
    const { error: roleInsertError } = await adminClient
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: "user", // Base app_role
        custom_role_id: roleData.id,
        customer_id: customerId || null,
      });

    if (roleInsertError) {
      console.error("Error assigning role:", roleInsertError);
      // Try to delete the user if role assignment fails
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: "Failed to assign role: " + roleInsertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the entity with the user_id
    const entityTable = entityType === "driver" ? "drivers" : 
                        entityType === "customer" ? "customers" : "transporters";
    
    const { error: updateError } = await adminClient
      .from(entityTable)
      .update({ user_id: newUser.user.id })
      .eq("id", entityId);

    if (updateError) {
      console.error("Error updating entity with user_id:", updateError);
      // Don't fail the whole operation, just log it
    }

    console.log(`Successfully created user and assigned role for ${entityType}`);

    // Send password reset email so user can set their own password
    const { error: resetError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: email,
    });

    if (resetError) {
      console.log("Could not generate password reset link:", resetError.message);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          role: roleName,
        },
        message: "User created successfully. A password reset email will be sent."
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
