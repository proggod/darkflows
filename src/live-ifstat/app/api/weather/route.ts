import { NextRequest, NextResponse } from 'next/server'

interface Location {
  latitude: string
  longitude: string
  cityName: string
  zipCode?: string
}

const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;
const RETRY_DELAY_MS = 1000;

async function fetchWithTimeout(url: string, timeout: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function retryFetch(url: string, retries: number): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetchWithTimeout(url, TIMEOUT_MS);
      if (response.ok) return response;
    } catch (error) {
      console.error(`Weather API attempt ${i + 1} failed:`, error);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  throw new Error('All retry attempts failed');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat') || '51.5074' // Default to London
  const lon = searchParams.get('lon') || '-0.1278'

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode&current_weather=true&timezone=auto`
    
    const response = await retryFetch(url, MAX_RETRIES)
    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Weather API error:', error)
    return NextResponse.json({
      error: 'Weather service temporarily unavailable',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 503 })
  }
}

// Add ZIP code lookup endpoint
export async function POST(request: NextRequest) {
  try {
    const { zipCode } = await request.json()
    const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`)
    
    if (!response.ok) {
      throw new Error('Invalid ZIP code')
    }
    
    const data = await response.json()
    const location: Location = {
      latitude: data.places[0].latitude,
      longitude: data.places[0].longitude,
      cityName: `${data.places[0]["place name"]}, ${data.places[0]["state abbreviation"]}`,
      zipCode
    }

    return NextResponse.json(location)
  } catch (error) {
    console.error('ZIP lookup error:', error)
    return NextResponse.json(
      { error: 'Invalid ZIP code' },
      { status: 400 }
    )
  }
} 