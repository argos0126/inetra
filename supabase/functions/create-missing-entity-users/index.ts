import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Role mapping for each entity type
const ROLE_MAPPING: Record<string, string> = {
  driver: "Viewer",
  customer: "Shipper User",
  transporter: "Transporter Admin",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify authorization
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

    const { data: { user: requestingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if superadmin or has users:create permission
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
        JSON.stringify({ error: "You don't have permission to perform this operation" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const tempPassword = "12345678";
    const results = {
      drivers: { created: 0, failed: 0, errors: [] as string[] },
      customers: { created: 0, failed: 0, errors: [] as string[] },
      transporters: { created: 0, failed: 0, errors: [] as string[] },
    };

    // Process drivers without user accounts (including those without email)
    const { data: drivers } = await adminClient
      .from("drivers")
      .select("id, name, email, mobile")
      .is("user_id", null);

    console.log(`Found ${drivers?.length || 0} drivers without accounts`);

    for (const driver of drivers || []) {
      try {
        // Generate email from mobile if no email exists
        let email = driver.email;
        if (!email && driver.mobile) {
          email = `driver_${driver.mobile.replace(/[^0-9]/g, '')}@tms.local`;
        }
        
        if (!email) {
          console.log(`Driver ${driver.name} has no email or mobile, skipping`);
          results.drivers.errors.push(`${driver.name}: No email or mobile available`);
          results.drivers.failed++;
          continue;
        }
        
        // Check if user already exists with this email
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === email);
        
        if (existingUser) {
          // Link existing user to driver and update email if generated
          await adminClient.from("drivers").update({ 
            user_id: existingUser.id,
            email: email 
          }).eq("id", driver.id);
          console.log(`Linked existing user to driver: ${email}`);
          results.drivers.created++;
          continue;
        }

        // Create new user
        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email: email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            first_name: driver.name?.split(" ")[0] || "",
            last_name: driver.name?.split(" ").slice(1).join(" ") || "",
            entity_type: "driver",
            entity_id: driver.id,
          },
        });

        if (createError) {
          console.error(`Error creating user for driver ${email}:`, createError.message);
          results.drivers.errors.push(`${email}: ${createError.message}`);
          results.drivers.failed++;
          continue;
        }

        // Find role
        const { data: roleData } = await adminClient
          .from("roles")
          .select("id")
          .eq("name", ROLE_MAPPING.driver)
          .single();

        if (roleData) {
          await adminClient.from("user_roles").insert({
            user_id: newUser.user.id,
            role: "user",
            custom_role_id: roleData.id,
          });
        }

        // Link user to driver and update email
        await adminClient.from("drivers").update({ 
          user_id: newUser.user.id,
          email: email 
        }).eq("id", driver.id);
        console.log(`Created user for driver: ${email}`);
        results.drivers.created++;
      } catch (e: any) {
        console.error(`Error processing driver ${driver.email || driver.mobile}:`, e.message);
        results.drivers.errors.push(`${driver.email || driver.mobile}: ${e.message}`);
        results.drivers.failed++;
      }
    }

    // Process customers without user accounts (including those without email)
    const { data: customers } = await adminClient
      .from("customers")
      .select("id, display_name, email, phone")
      .is("user_id", null);

    console.log(`Found ${customers?.length || 0} customers without accounts`);

    for (const customer of customers || []) {
      try {
        // Generate email from phone if no email exists
        let email = customer.email;
        if (!email && customer.phone) {
          email = `customer_${customer.phone.replace(/[^0-9]/g, '')}@tms.local`;
        }
        
        if (!email) {
          console.log(`Customer ${customer.display_name} has no email or phone, skipping`);
          results.customers.errors.push(`${customer.display_name}: No email or phone available`);
          results.customers.failed++;
          continue;
        }

        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === email);
        
        if (existingUser) {
          await adminClient.from("customers").update({ 
            user_id: existingUser.id,
            email: email 
          }).eq("id", customer.id);
          console.log(`Linked existing user to customer: ${email}`);
          results.customers.created++;
          continue;
        }

        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email: email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            first_name: customer.display_name?.split(" ")[0] || "",
            last_name: customer.display_name?.split(" ").slice(1).join(" ") || "",
            entity_type: "customer",
            entity_id: customer.id,
          },
        });

        if (createError) {
          console.error(`Error creating user for customer ${email}:`, createError.message);
          results.customers.errors.push(`${email}: ${createError.message}`);
          results.customers.failed++;
          continue;
        }

        const { data: roleData } = await adminClient
          .from("roles")
          .select("id")
          .eq("name", ROLE_MAPPING.customer)
          .single();

        if (roleData) {
          await adminClient.from("user_roles").insert({
            user_id: newUser.user.id,
            role: "user",
            custom_role_id: roleData.id,
            customer_id: customer.id,
          });
        }

        await adminClient.from("customers").update({ 
          user_id: newUser.user.id,
          email: email 
        }).eq("id", customer.id);
        console.log(`Created user for customer: ${email}`);
        results.customers.created++;
      } catch (e: any) {
        console.error(`Error processing customer ${customer.email || customer.phone}:`, e.message);
        results.customers.errors.push(`${customer.email || customer.phone}: ${e.message}`);
        results.customers.failed++;
      }
    }

    // Process transporters without user accounts (including those without email)
    const { data: transporters } = await adminClient
      .from("transporters")
      .select("id, transporter_name, email, mobile")
      .is("user_id", null);

    console.log(`Found ${transporters?.length || 0} transporters without accounts`);
    console.log("Transporters data:", JSON.stringify(transporters, null, 2));

    for (const transporter of transporters || []) {
      try {
        console.log(`Processing transporter: ${transporter.transporter_name}, email: ${transporter.email}, mobile: ${transporter.mobile}`);
        
        // Generate email from mobile if no email exists
        let email = transporter.email;
        if (!email && transporter.mobile) {
          email = `transporter_${transporter.mobile.replace(/[^0-9]/g, '')}@tms.local`;
        }
        
        if (!email) {
          console.log(`Transporter ${transporter.transporter_name} has no email or mobile, skipping`);
          results.transporters.errors.push(`${transporter.transporter_name}: No email or mobile available`);
          results.transporters.failed++;
          continue;
        }

        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === email);
        
        if (existingUser) {
          await adminClient.from("transporters").update({ 
            user_id: existingUser.id,
            email: email 
          }).eq("id", transporter.id);
          console.log(`Linked existing user to transporter: ${email}`);
          results.transporters.created++;
          continue;
        }

        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email: email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            first_name: transporter.transporter_name?.split(" ")[0] || "",
            last_name: transporter.transporter_name?.split(" ").slice(1).join(" ") || "",
            entity_type: "transporter",
            entity_id: transporter.id,
          },
        });

        if (createError) {
          console.error(`Error creating user for transporter ${email}:`, createError.message);
          results.transporters.errors.push(`${email}: ${createError.message}`);
          results.transporters.failed++;
          continue;
        }

        const { data: roleData } = await adminClient
          .from("roles")
          .select("id")
          .eq("name", ROLE_MAPPING.transporter)
          .single();

        if (roleData) {
          await adminClient.from("user_roles").insert({
            user_id: newUser.user.id,
            role: "user",
            custom_role_id: roleData.id,
          });
        }

        await adminClient.from("transporters").update({ 
          user_id: newUser.user.id,
          email: email 
        }).eq("id", transporter.id);
        console.log(`Created user for transporter: ${email}`);
        results.transporters.created++;
      } catch (e: any) {
        console.error(`Error processing transporter ${transporter.email || transporter.mobile}:`, e.message);
        results.transporters.errors.push(`${transporter.email || transporter.mobile}: ${e.message}`);
        results.transporters.failed++;
      }
    }

    const totalCreated = results.drivers.created + results.customers.created + results.transporters.created;
    const totalFailed = results.drivers.failed + results.customers.failed + results.transporters.failed;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Created ${totalCreated} user accounts, ${totalFailed} failed`,
        results,
        tempPassword: "12345678",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
