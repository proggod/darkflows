import { NextRequest, NextResponse } from 'next/server'

interface Location {
  latitude: string
  longitude: string
  cityName: string
  zipCode?: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat') || '51.5074' // Default to London
  const lon = searchParams.get('lon') || '-0.1278'

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode&current_weather=true&timezone=auto`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Weather service error')
    }

    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Weather API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    )
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