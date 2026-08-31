import { NextRequest, NextResponse } from 'next/server';

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Verify a token issued by /api/auth/admin-login */
async function verifyToken(token: string): Promise<{ userId: string; expiry: number } | null> {
  try {
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return null;

    const encoder = new TextEncoder();
    const data = Buffer.from(dataB64, 'base64url').toString('utf8');

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = Buffer.from(sigB64, 'base64url');
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      encoder.encode(data)
    );

    if (!valid) return null;

    const payload = JSON.parse(data) as { userId: string; expiry: number };

    // Check expiry
    if (Date.now() > payload.expiry) return null;

    return payload;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ valid: false, error: 'No token provided.' }, { status: 400 });
    }

    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json({ valid: false, error: 'Invalid or expired token.' }, { status: 401 });
    }

    return NextResponse.json({ valid: true, userId: payload.userId });
  } catch (err) {
    console.error('[admin-verify]', err);
    return NextResponse.json({ valid: false, error: 'Internal server error.' }, { status: 500 });
  }
}
