import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminAction {
  action: 'delete_user' | 'demote_superadmin' | 'promote_to_superadmin' | 'list_superadmins' | 'recover_superadmin';
  targetUserId?: string;
  targetEmail?: string;
  recoveryCode?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const recoveryCodeSecret = Deno.env.get('SUPERADMIN_RECOVERY_CODE');

    // Create admin client with service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    
    // Parse request body
    const body: AdminAction = await req.json();
    const { action, targetUserId, targetEmail, recoveryCode } = body;

    // Get client info for audit
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Helper function to log admin actions
    const logAction = async (
      actionType: string,
      performedBy: string | null,
      targetId: string | null,
      targetEmailLog: string | null,
      success: boolean,
      details: Record<string, unknown> = {},
      errorMessage?: string
    ) => {
      await adminClient.from('admin_audit_logs').insert({
        action: actionType,
        performed_by: performedBy,
        target_user_id: targetId,
        target_user_email: targetEmailLog,
        details,
        ip_address: clientIp,
        user_agent: userAgent,
        success,
        error_message: errorMessage,
      });
    };

    // Recovery action uses recovery code instead of JWT
    if (action === 'recover_superadmin') {
      console.log('Processing superadmin recovery request...');

      if (!recoveryCodeSecret) {
        await logAction('recover_superadmin', null, null, targetEmail || null, false, {}, 'Recovery code not configured');
        return new Response(
          JSON.stringify({ error: 'Recovery mechanism not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!recoveryCode || recoveryCode !== recoveryCodeSecret) {
        await logAction('recover_superadmin', null, null, targetEmail || null, false, { attemptedCode: '***' }, 'Invalid recovery code');
        return new Response(
          JSON.stringify({ error: 'Invalid recovery code' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!targetEmail) {
        return new Response(
          JSON.stringify({ error: 'Target email is required for recovery' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find user by email
      const { data: userData, error: userError } = await adminClient.auth.admin.listUsers();
      if (userError) {
        await logAction('recover_superadmin', null, null, targetEmail, false, {}, userError.message);
        throw userError;
      }

      const targetUser = userData.users.find(u => u.email === targetEmail);
      if (!targetUser) {
        await logAction('recover_superadmin', null, null, targetEmail, false, {}, 'User not found');
        return new Response(
          JSON.stringify({ error: 'User not found with that email' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Add superadmin role
      const { error: roleError } = await adminClient.from('user_roles').upsert({
        user_id: targetUser.id,
        role: 'superadmin'
      }, { onConflict: 'user_id,role' });

      if (roleError) {
        await logAction('recover_superadmin', null, targetUser.id, targetEmail, false, {}, roleError.message);
        throw roleError;
      }

      // Ensure profile is active
      await adminClient.from('profiles').update({ is_active: true }).eq('user_id', targetUser.id);

      await logAction('recover_superadmin', null, targetUser.id, targetEmail, true, { method: 'recovery_code' });

      console.log(`Superadmin recovered successfully: ${targetEmail}`);

      return new Response(
        JSON.stringify({ success: true, message: `Superadmin access restored for ${targetEmail}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // All other actions require JWT authentication
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create authenticated client
    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin action requested by user: ${user.id}, action: ${action}`);

    // Check if requester is superadmin
    const { data: isSuperadmin } = await adminClient.rpc('is_superadmin', { _user_id: user.id });
    if (!isSuperadmin) {
      await logAction(action, user.id, targetUserId || null, null, false, {}, 'Not authorized - not a superadmin');
      return new Response(
        JSON.stringify({ error: 'Only superadmins can perform this action' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different actions
    switch (action) {
      case 'list_superadmins': {
        // Get superadmin user_ids from user_roles
        const { data: superadminRoles, error } = await adminClient
          .from('user_roles')
          .select('user_id, created_at')
          .eq('role', 'superadmin');

        if (error) throw error;

        // Get emails from auth
        const { data: authUsers } = await adminClient.auth.admin.listUsers();
        
        // Get profiles for these users
        const userIds = superadminRoles?.map(sa => sa.user_id) || [];
        const { data: profiles } = await adminClient
          .from('profiles')
          .select('user_id, first_name, last_name, is_active')
          .in('user_id', userIds);
        
        const superadminList = superadminRoles?.map(sa => {
          const authUser = authUsers?.users.find(u => u.id === sa.user_id);
          const profile = profiles?.find(p => p.user_id === sa.user_id);
          return {
            id: sa.user_id,
            email: authUser?.email || 'unknown',
            first_name: profile?.first_name,
            last_name: profile?.last_name,
            is_active: profile?.is_active ?? true,
            created_at: sa.created_at,
          };
        });

        await logAction('list_superadmins', user.id, null, null, true, { count: superadminList?.length });

        return new Response(
          JSON.stringify({ superadmins: superadminList }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'demote_superadmin': {
        if (!targetUserId) {
          return new Response(
            JSON.stringify({ error: 'Target user ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Cannot demote yourself
        if (targetUserId === user.id) {
          await logAction('demote_superadmin', user.id, targetUserId, null, false, {}, 'Cannot demote yourself');
          return new Response(
            JSON.stringify({ error: 'Cannot demote yourself. Use recovery mechanism if needed.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if this is the last superadmin
        const { data: superadminCount } = await adminClient
          .from('user_roles')
          .select('user_id', { count: 'exact', head: true })
          .eq('role', 'superadmin');
        
        if ((superadminCount as any)?.length <= 1 || (superadminCount as any) === 1) {
          // Double check with a proper count
          const { count } = await adminClient
            .from('user_roles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'superadmin');
          
          if (count && count <= 1) {
            await logAction('demote_superadmin', user.id, targetUserId, null, false, {}, 'Cannot demote last superadmin');
            return new Response(
              JSON.stringify({ error: 'Cannot demote the last superadmin. At least one superadmin is required.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Get target user email for logging
        const { data: authUsers } = await adminClient.auth.admin.listUsers();
        const targetAuthUser = authUsers?.users.find(u => u.id === targetUserId);

        // Remove superadmin role
        const { error } = await adminClient
          .from('user_roles')
          .delete()
          .eq('user_id', targetUserId)
          .eq('role', 'superadmin');

        if (error) {
          await logAction('demote_superadmin', user.id, targetUserId, targetAuthUser?.email || null, false, {}, error.message);
          throw error;
        }

        await logAction('demote_superadmin', user.id, targetUserId, targetAuthUser?.email || null, true, {});

        console.log(`Superadmin demoted: ${targetUserId} by ${user.id}`);

        return new Response(
          JSON.stringify({ success: true, message: 'Superadmin role removed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'promote_to_superadmin': {
        if (!targetUserId) {
          return new Response(
            JSON.stringify({ error: 'Target user ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get target user email for logging
        const { data: authUsers } = await adminClient.auth.admin.listUsers();
        const targetAuthUser = authUsers?.users.find(u => u.id === targetUserId);

        // Add superadmin role
        const { error } = await adminClient.from('user_roles').upsert({
          user_id: targetUserId,
          role: 'superadmin'
        }, { onConflict: 'user_id,role' });

        if (error) {
          await logAction('promote_to_superadmin', user.id, targetUserId, targetAuthUser?.email || null, false, {}, error.message);
          throw error;
        }

        await logAction('promote_to_superadmin', user.id, targetUserId, targetAuthUser?.email || null, true, {});

        console.log(`User promoted to superadmin: ${targetUserId} by ${user.id}`);

        return new Response(
          JSON.stringify({ success: true, message: 'User promoted to superadmin' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete_user': {
        if (!targetUserId) {
          return new Response(
            JSON.stringify({ error: 'Target user ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Cannot delete yourself
        if (targetUserId === user.id) {
          await logAction('delete_user', user.id, targetUserId, null, false, {}, 'Cannot delete yourself');
          return new Response(
            JSON.stringify({ error: 'Cannot delete yourself' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get target user details before deletion
        const { data: authUsers } = await adminClient.auth.admin.listUsers();
        const targetAuthUser = authUsers?.users.find(u => u.id === targetUserId);

        // Check if target is a superadmin
        const { data: targetIsSuperadmin } = await adminClient.rpc('is_superadmin', { _user_id: targetUserId });

        // If deleting a superadmin, check if they're the last one
        if (targetIsSuperadmin) {
          const { count } = await adminClient
            .from('user_roles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'superadmin');
          
          if (count && count <= 1) {
            await logAction('delete_user', user.id, targetUserId, targetAuthUser?.email || null, false, { was_superadmin: true }, 'Cannot delete last superadmin');
            return new Response(
              JSON.stringify({ error: 'Cannot delete the last superadmin. At least one superadmin is required.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Delete the user from auth (cascades to profiles and user_roles)
        const { error } = await adminClient.auth.admin.deleteUser(targetUserId);

        if (error) {
          await logAction('delete_user', user.id, targetUserId, targetAuthUser?.email || null, false, { was_superadmin: targetIsSuperadmin }, error.message);
          throw error;
        }

        await logAction('delete_user', user.id, targetUserId, targetAuthUser?.email || null, true, { 
          was_superadmin: targetIsSuperadmin,
          deleted_email: targetAuthUser?.email 
        });

        console.log(`User deleted: ${targetUserId} (was superadmin: ${targetIsSuperadmin}) by ${user.id}`);

        return new Response(
          JSON.stringify({ success: true, message: 'User deleted successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Admin management error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
