import { NextResponse } from 'next/server';
import fs from 'fs/promises';

const SCHEDULE_FILE = '/etc/darkflows/block_schedule.json';

async function readSchedule() {
  try {
    const content = await fs.readFile(SCHEDULE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const defaultSchedule = [
        { id: 'sun', day: 'Su', startTime: '00:00', endTime: '23:59' },
        { id: 'mon', day: 'M', startTime: '00:00', endTime: '23:59' },
        { id: 'tue', day: 'T', startTime: '00:00', endTime: '23:59' },
        { id: 'wed', day: 'W', startTime: '00:00', endTime: '23:59' },
        { id: 'thu', day: 'Th', startTime: '00:00', endTime: '23:59' },
        { id: 'fri', day: 'F', startTime: '00:00', endTime: '23:59' },
        { id: 'sat', day: 'Sa', startTime: '00:00', endTime: '23:59' },
      ];
      await fs.writeFile(SCHEDULE_FILE, JSON.stringify(defaultSchedule, null, 2));
      return defaultSchedule;
    }
    throw error;
  }
}

export async function GET() {
  try {
    const schedule = await readSchedule();
    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Error reading schedule:', error);
    return NextResponse.json(
      { error: 'Failed to read schedule' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const schedule = await request.json();
    await fs.writeFile(SCHEDULE_FILE, JSON.stringify(schedule, null, 2));
    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Error saving schedule:', error);
    return NextResponse.json(
      { error: 'Failed to save schedule' },
      { status: 500 }
    );
  }
} 