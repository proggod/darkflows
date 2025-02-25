export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import mongoose from 'mongoose';
import { SignJWT } from 'jose';

export async function POST(request: NextRequest) {
  console.log('=== REGISTER ROUTE START ===');
  try {
    await connectDB();
    
    // Check if this is the first user
    const userCount = await User.countDocuments();
    console.log('User count check:', {
      timestamp: new Date().toISOString(),
      totalUsers: userCount
    });

    const body = await request.json();
    const { name, email, password } = body;

    console.log('Registration attempt:', {
      timestamp: new Date().toISOString(),
      email,
      name,
      passwordLength: password?.length,
      mongoUri: process.env.MONGODB_URI?.replace(/:[^:@]+@/, ':***@'),
      dbState: mongoose.connection.readyState
    });

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    
    console.log('User check:', {
      timestamp: new Date().toISOString(),
      exists: !!existingUser,
      email
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // If this is the first user, make them an admin and auto-approve
    const isFirstUser = userCount === 0;
    const newUser = await User.create({
      name,
      email,
      password,
      role: isFirstUser ? 'admin' : 'user',
      approved: isFirstUser // Auto-approve if first user
    });

    console.log('User created:', {
      timestamp: new Date().toISOString(),
      userId: newUser._id.toString(),
      email: newUser.email,
      role: newUser.role,
      approved: newUser.approved,
      isFirstUser
    });

    // For the first user, we can automatically log them in
    if (isFirstUser) {
      const token = await new SignJWT({
        id: newUser._id.toString(),
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(new TextEncoder().encode(process.env.JWT_SECRET));

      const response = NextResponse.json({ 
        success: true,
        redirectTo: '/admin'
      });

      response.cookies.set({
        name: 'session',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      });

      return response;
    }

    return NextResponse.json({ 
      success: true,
      redirectTo: '/login'
    });

  } catch (error) {
    console.error('Registration error:', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  } finally {
    console.log('=== REGISTER ROUTE END ===');
  }
} 