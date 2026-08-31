import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service-role client — server-side only, never exposed to browser
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Very lightweight HMAC-style token using Web Crypto */
async function signToken(payload: object): Promise<string> {
  const data = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const sigB64 = Buffer.from(sig).toString('base64url');
  const dataB64 = Buffer.from(data).toString('base64url');
  return `${dataB64}.${sigB64}`;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required.' }, { status: 400 });
    }

    // Step 1: Attempt sign-in using service role to validate credentials
    // We create a temporary anon client just for sign-in validation
    const tempClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: authData, error: authError } = await tempClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const userId = authData.user.id;

    // Step 2: Verify the user has admin role in profiles table (via service role)
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, username, avatar_color, role, status')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    if (profile.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied: Admin credentials required.' }, { status: 403 });
    }

    if (profile.status !== 'active') {
      return NextResponse.json({ error: 'Admin account is not active.' }, { status: 403 });
    }

    // Step 3: Sign the temp client out immediately — we do NOT want any Supabase
    // session to persist. The admin token we issue is the sole auth artifact.
    await tempClient.auth.signOut();

    // Step 4: Issue a signed admin token valid for 12 hours
    const expiry = Date.now() + 12 * 60 * 60 * 1000;
    const token = await signToken({ userId, expiry });

    return NextResponse.json({
      token,
      profile: {
        id: profile.id,
        username: profile.username,
        avatarColor: profile.avatar_color,
        email,
      },
    });
  } catch (err) {
    console.error('[admin-login]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
