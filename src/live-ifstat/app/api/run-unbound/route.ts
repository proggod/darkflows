import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function POST() {
  try {
    // Execute the Python script
    const { stdout, stderr } = await execPromise('/usr/bin/python3 /usr/local/darkflows/bin/run_all_unbounds.py');
    
    if (stderr) {
      console.error('Error running unbound script:', stderr);
      return NextResponse.json({ error: 'Failed to run unbound script' }, { status: 500 });
    }
    
    console.log('Unbound script output:', stdout);
    return NextResponse.json({ success: true, message: 'Unbound script executed successfully' });
  } catch (error) {
    console.error('Exception running unbound script:', error);
    return NextResponse.json({ error: 'Failed to run unbound script' }, { status: 500 });
  }
} 