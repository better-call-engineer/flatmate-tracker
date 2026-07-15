import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Database } from '@/lib/database.types';
import { Profile, PasswordReset } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const { action, email, slot, password } = await request.json();

    if (!email || !slot) {
      return NextResponse.json({ error: 'Email and flatmate slot are required.' }, { status: 400 });
    }

    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (action === 'request') {
      // 1. Find user by email
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;

      const matchedUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!matchedUser) {
        return NextResponse.json({ error: 'No registered account found with this email.' }, { status: 404 });
      }

      // 2. Fetch profile and verify slot
      const { data: profile, error: profileError } = await (supabaseAdmin as any)
        .from('profiles')
        .select('*')
        .eq('id', matchedUser.id)
        .single() as { data: Profile | null; error: any };

      if (profileError || !profile) {
        return NextResponse.json({ error: 'Profile data not found.' }, { status: 404 });
      }

      if (profile.slot !== slot) {
        return NextResponse.json({ error: 'This email is not registered for the selected flatmate slot.' }, { status: 400 });
      }

      // 3. Check for existing pending/approved requests
      const { data: existingRequests } = await (supabaseAdmin as any)
        .from('password_resets')
        .select('*')
        .eq('user_id', profile.id)
        .in('status', ['pending', 'approved']) as { data: PasswordReset[] | null };

      if (existingRequests && existingRequests.length > 0) {
        const pendingReq = existingRequests.find(r => r.status === 'pending');
        if (pendingReq) {
          return NextResponse.json({ error: 'A password reset request is already pending admin approval.' }, { status: 400 });
        }
        return NextResponse.json({ 
          status: 'approved',
          message: 'Your request has been approved! You can now set your new password.'
        });
      }

      // 4. Create new request
      const { error: insertError } = await (supabaseAdmin as any)
        .from('password_resets')
        .insert({
          user_id: profile.id,
          status: 'pending'
        });

      if (insertError) throw insertError;

      return NextResponse.json({ message: 'Password reset request submitted! Please wait for admin approval.' });
    }

    if (action === 'status') {
      // 1. Find user
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;

      const matchedUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!matchedUser) {
        return NextResponse.json({ error: 'No account found with this email.' }, { status: 404 });
      }

      // 2. Get profile
      const { data: profile } = await (supabaseAdmin as any)
        .from('profiles')
        .select('*')
        .eq('id', matchedUser.id)
        .single() as { data: Profile | null };

      if (!profile || profile.slot !== slot) {
        return NextResponse.json({ error: 'This email is not registered for the selected flatmate slot.' }, { status: 400 });
      }

      // 3. Find latest request
      const { data: requestRecord, error: requestError } = await (supabaseAdmin as any)
        .from('password_resets')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as { data: PasswordReset | null; error: any };

      if (requestError || !requestRecord) {
        return NextResponse.json({ status: 'none', message: 'No reset request found for this account.' });
      }

      return NextResponse.json({ status: requestRecord.status, id: requestRecord.id });
    }

    if (action === 'confirm') {
      if (!password || password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
      }

      // 1. Find user
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;

      const matchedUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!matchedUser) {
        return NextResponse.json({ error: 'No account found.' }, { status: 404 });
      }

      // 2. Get profile
      const { data: profile } = await (supabaseAdmin as any)
        .from('profiles')
        .select('*')
        .eq('id', matchedUser.id)
        .single() as { data: Profile | null };

      if (!profile || profile.slot !== slot) {
        return NextResponse.json({ error: 'Profile/slot mismatch.' }, { status: 400 });
      }

      // 3. Get active approved request
      const { data: approvedRequest, error: requestError } = await (supabaseAdmin as any)
        .from('password_resets')
        .select('*')
        .eq('user_id', profile.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as { data: PasswordReset | null; error: any };

      if (requestError || !approvedRequest) {
        return NextResponse.json({ error: 'No approved reset request found. It may have expired or not been approved yet.' }, { status: 400 });
      }

      // 4. Update password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        profile.id,
        { password }
      );

      if (updateError) throw updateError;

      // 5. Mark request as completed
      const { error: markError } = await (supabaseAdmin as any)
        .from('password_resets')
        .update({ status: 'completed' })
        .eq('id', approvedRequest.id);

      if (markError) throw markError;

      return NextResponse.json({ message: 'Password reset successfully! You can now log in.' });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error: any) {
    console.error('Password reset handler error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
