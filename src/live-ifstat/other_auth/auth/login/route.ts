import { NextResponse, NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { setSessionCookie } from '@/lib/session';

export async function POST(
  request: NextRequest,
  _context: unknown
) {
  try {
    await connectDB();
    const { email, password } = await request.json();

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    console.log('Login user:', {
      id: user._id.toString(),
      email: user.email,
      name: user.name
    });

    if (!user.approved) {
      return NextResponse.json(
        { error: 'Account pending approval' },
        { status: 403 }
      );
    }

    const token = await new SignJWT({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      approved: user.approved
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    await setSessionCookie(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
} 