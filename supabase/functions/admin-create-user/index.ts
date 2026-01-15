import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const roleLabels: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  user: "User",
};

async function sendWelcomeEmail(
  email: string,
  password: string,
  firstName: string,
  role: string
) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.log("RESEND_API_KEY not configured, skipping email notification");
    return { success: false, error: "Email service not configured" };
  }

  const resend = new Resend(resendApiKey);
  const roleLabel = roleLabels[role] || role;

  try {
    const { data, error } = await resend.emails.send({
      from: "TMS System <onboarding@resend.dev>",
      to: [email],
      subject: "Your TMS Account Has Been Created",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Welcome to TMS</h1>
            <p style="color: #e0e7ef; margin: 10px 0 0 0;">Your account has been created</p>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin-bottom: 20px;">Hello${firstName ? ` ${firstName}` : ''},</p>
            
            <p>Your account has been successfully created in the Transport Management System. You can now log in using the credentials below:</p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; width: 100px;">Email:</td>
                  <td style="padding: 8px 0; font-weight: 600;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Password:</td>
                  <td style="padding: 8px 0; font-weight: 600; font-family: monospace; background: #fef3c7; padding: 4px 8px; border-radius: 4px; display: inline-block;">${password}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Role:</td>
                  <td style="padding: 8px 0;"><span style="background: #3b82f6; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">${roleLabel}</span></td>
                </tr>
              </table>
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>⚠️ Security Notice:</strong> Please change your password after your first login for security purposes.
              </p>
            </div>
            
            <p style="margin-top: 20px;">If you have any questions or need assistance, please contact your system administrator.</p>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              Best regards,<br>
              <strong>TMS Administration Team</strong>
            </p>
          </div>
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
            This is an automated message. Please do not reply to this email.
          </p>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Error sending welcome email:", error);
      return { success: false, error: error.message };
    }

    console.log("Welcome email sent successfully to:", email);
    return { success: true, data };
  } catch (error) {
    console.error("Exception sending welcome email:", error);
    return { success: false, error: String(error) };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create client with user's auth token to verify they're a superadmin
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

    // Check if requesting user is superadmin or has users:create permission
    const { data: isSuperadmin, error: roleError } = await userClient.rpc("is_superadmin", {
      _user_id: requestingUser.id,
    });

    const { data: hasPermission } = await userClient.rpc("has_permission", {
      _user_id: requestingUser.id,
      _resource: "users",
      _action: "create",
    });

    if (!isSuperadmin && !hasPermission) {
      return new Response(
        JSON.stringify({ error: "You don't have permission to create users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { email, password, firstName, lastName, role, customRoleId, company, isActive = true, sendEmail = true } = await req.json();

    if (!email || !password || !role) {
      return new Response(
        JSON.stringify({ error: "Email, password, and role are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate role
    const validRoles = ["superadmin", "admin", "user"];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: "Invalid role. Must be superadmin, admin, or user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if email already exists in auth.users
    const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) {
      console.error("Error checking existing users:", listError);
      return new Response(
        JSON.stringify({ error: "Failed to check existing users" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailExists = existingUsers.users.some(
      (user) => user.email?.toLowerCase() === email.toLowerCase()
    );

    if (emailExists) {
      return new Response(
        JSON.stringify({ error: "A user with this email already exists" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the user using admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: firstName || "",
        last_name: lastName || "",
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update profile with company if provided
    if (company) {
      await adminClient
        .from("profiles")
        .update({ company })
        .eq("user_id", newUser.user.id);
    }

    // Assign role to the new user (one role per user enforced by unique constraint)
    const { error: roleInsertError } = await adminClient
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: role,
        custom_role_id: customRoleId || null,
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

    // Auto-sync: Link user to matching entity (driver, customer, transporter) by email
    let linkedEntity = null;
    const normalizedEmail = email.toLowerCase();

    // Check drivers
    const { data: driverMatch } = await adminClient
      .from("drivers")
      .select("id, name")
      .ilike("email", normalizedEmail)
      .is("user_id", null)
      .limit(1);

    if (driverMatch && driverMatch.length > 0) {
      await adminClient.from("drivers").update({ user_id: newUser.user.id }).eq("id", driverMatch[0].id);
      linkedEntity = { type: "driver", name: driverMatch[0].name };
      console.log(`Linked user to driver: ${driverMatch[0].name}`);
    }

    // Check customers
    if (!linkedEntity) {
      const { data: customerMatch } = await adminClient
        .from("customers")
        .select("id, display_name")
        .ilike("email", normalizedEmail)
        .is("user_id", null)
        .limit(1);

      if (customerMatch && customerMatch.length > 0) {
        await adminClient.from("customers").update({ user_id: newUser.user.id }).eq("id", customerMatch[0].id);
        linkedEntity = { type: "customer", name: customerMatch[0].display_name };
        console.log(`Linked user to customer: ${customerMatch[0].display_name}`);
      }
    }

    // Check transporters
    if (!linkedEntity) {
      const { data: transporterMatch } = await adminClient
        .from("transporters")
        .select("id, transporter_name")
        .ilike("email", normalizedEmail)
        .is("user_id", null)
        .limit(1);

      if (transporterMatch && transporterMatch.length > 0) {
        await adminClient.from("transporters").update({ user_id: newUser.user.id }).eq("id", transporterMatch[0].id);
        linkedEntity = { type: "transporter", name: transporterMatch[0].transporter_name };
        console.log(`Linked user to transporter: ${transporterMatch[0].transporter_name}`);
      }
    }

    // Send welcome email with credentials
    let emailResult = { success: false, error: "Email not sent" };
    if (sendEmail) {
      emailResult = await sendWelcomeEmail(email, password, firstName || "", role);
    }

    console.log("User created successfully:", email, "Email sent:", emailResult.success, "Linked entity:", linkedEntity);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          role: role,
        },
        linkedEntity,
        emailSent: emailResult.success,
        emailError: emailResult.success ? null : emailResult.error,
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
