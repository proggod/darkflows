//DO NOT REMOVE: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Define the context type with params as a Promise
interface RouteContext {
  params: Promise<{
    name: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Await the params Promise to get the actual parameters
    const { name } = await context.params;

    // Validate service name to prevent command injection
    if (!/^[a-zA-Z0-9-]+$/.test(name)) {
      return NextResponse.json({ error: 'Invalid service name' }, { status: 400 });
    }

    const { stdout } = await execAsync(`journalctl -u ${name} -n 100 --no-pager`);

    return NextResponse.json({ logs: stdout });
  } catch (error) {
    console.error('Error fetching service logs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
