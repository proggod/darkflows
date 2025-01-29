import { NextResponse } from 'next/server';
import fs from 'fs/promises';

const SCHEDULE_FILE = '/etc/darkflows/block_schedule.json';

const defaultSchedule = [
  { id: 'sun', day: 'Su', startTime: '00:00', endTime: '23:59' },
  { id: 'mon', day: 'M', startTime: '00:00', endTime: '23:59' },
  { id: 'tue', day: 'T', startTime: '00:00', endTime: '23:59' },
  { id: 'wed', day: 'W', startTime: '00:00', endTime: '23:59' },
  { id: 'thu', day: 'Th', startTime: '00:00', endTime: '23:59' },
  { id: 'fri', day: 'F', startTime: '00:00', endTime: '23:59' },
  { id: 'sat', day: 'Sa', startTime: '00:00', endTime: '23:59' },
];

async function readSchedule() {
  try {
    const content = await fs.readFile(SCHEDULE_FILE, 'utf-8');
    const schedule = JSON.parse(content);
    // Validate schedule format
    if (!Array.isArray(schedule) || !schedule.every(day => 
      day.id && day.day && day.startTime && day.endTime
    )) {
      throw new Error('Invalid schedule format');
    }
    return schedule;
  } catch (error: unknown) {
    if (error instanceof Error && 
        ((error as NodeJS.ErrnoException).code === 'ENOENT' || error.message === 'Invalid schedule format')) {
      try {
        await fs.mkdir('/etc/darkflows', { recursive: true });
        await fs.writeFile(SCHEDULE_FILE, JSON.stringify(defaultSchedule, null, 2));
        return defaultSchedule;
      } catch (writeError) {
        console.error('Error writing default schedule:', writeError);
        return defaultSchedule; // Return default even if we can't write it
      }
    }
    console.error('Error reading schedule:', error);
    return defaultSchedule;
  }
}

export async function GET() {
  try {
    const schedule = await readSchedule();
    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Error reading schedule:', error);
    return NextResponse.json(defaultSchedule, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const schedule = await request.json();
    // Validate schedule format
    if (!Array.isArray(schedule) || !schedule.every(day => 
      day.id && day.day && day.startTime && day.endTime
    )) {
      return NextResponse.json(
        { error: 'Invalid schedule format' },
        { status: 400 }
      );
    }
    
    try {
      await fs.mkdir('/etc/darkflows', { recursive: true });
      await fs.writeFile(SCHEDULE_FILE, JSON.stringify(schedule, null, 2));
    } catch (writeError) {
      console.error('Error writing schedule:', writeError);
      return NextResponse.json(
        { error: 'Failed to save schedule. Please check file permissions.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Error saving schedule:', error);
    return NextResponse.json(
      { error: 'Failed to save schedule' },
      { status: 500 }
    );
  }
} 