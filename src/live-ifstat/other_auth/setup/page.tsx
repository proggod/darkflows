export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { isBuildTime } from '@/lib/buildUtils';
import SetupForm from './SetupForm';

export default async function SetupPage() {
  if (isBuildTime()) {
    return null;
  }

  await connectDB();
  const userCount = await User.countDocuments();

  if (userCount > 0) {
    redirect('/login');
  }

  return <SetupForm />;
} 