import { NextRequest, NextResponse } from 'next/server'

interface Location {
  latitude: string
  longitude: string
  cityName: string
  zipCode?: string
  country?: string
}

interface ZippopotamResponse {
  'post code'?: string;
  country: string;
  'country abbreviation': string;
  places: Array<{
    'place name': string;
    longitude: string;
    latitude: string;
    state?: string;
    'state abbreviation'?: string;
  }>;
}

const MAX_RETRIES = 3

async function retryFetch(url: string, maxRetries: number): Promise<Response> {
  let lastError: Error | null = null
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
      throw new Error(`HTTP error! status: ${response.status}`)
    } catch (error) {
      lastError = error as Error
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)))
    }
  }
  
  throw lastError
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    let location: Location

    if (body.zipCode) {
      // Handle ZIP code lookup - now supports any country
      const country = body.country?.toLowerCase() || 'us'
      const response = await fetch(`https://api.zippopotam.us/${country}/${body.zipCode}`)
      
      if (!response.ok) {
        throw new Error(`Invalid postal code for ${country.toUpperCase()}`)
      }
      
      const data = await response.json()
      location = {
        latitude: data.places[0].latitude,
        longitude: data.places[0].longitude,
        cityName: data.places[0]["place name"],
        zipCode: body.zipCode,
        country: country.toUpperCase()
      }

      // Add state/region for countries that have it
      if (data.places[0]["state abbreviation"]) {
        location.cityName += `, ${data.places[0]["state abbreviation"]}`
      } else if (data.places[0].state) {
        location.cityName += `, ${data.places[0].state}`
      }
    } else if (body.city && body.country) {
      // Handle city lookup using Zippopotam
      const country = body.country.toLowerCase()
      const state = body.state?.toLowerCase() || ''
      let response: Response
      let data: ZippopotamResponse
      
      if (state && country === 'us') {
        // Use state-based lookup for US cities
        response = await fetch(`https://api.zippopotam.us/us/${state}/${body.city.toLowerCase()}`)
        if (!response.ok) {
          throw new Error('City not found')
        }
        data = await response.json()
      } else {
        // For non-US cities, we'll try to find the city in the country's postal codes
        // First, get a list of places in the country that match the city name
        const cityLower = body.city.toLowerCase()
        
        // We'll use the nominatim API as a fallback since Zippopotam doesn't support direct city search
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(cityLower)}&country=${encodeURIComponent(country)}&format=json&limit=1`
        response = await fetch(nominatimUrl, {
          headers: {
            'User-Agent': 'DarkFlows Weather Widget'
          }
        })
        
        if (!response.ok) {
          throw new Error('City not found')
        }
        
        data = await response.json()
        if (!data || data.length === 0) {
          throw new Error('City not found')
        }
        
        // Use the first result
        const result = data[0]
        location = {
          latitude: result.lat,
          longitude: result.lon,
          cityName: `${body.city}, ${body.country.toUpperCase()}`,
          country: body.country.toUpperCase()
        }
        
        return NextResponse.json(location)
      }
      
      if (!data.places || data.places.length === 0) {
        throw new Error('City not found')
      }
      
      const place = data.places[0]
      location = {
        latitude: place.latitude,
        longitude: place.longitude,
        cityName: `${body.city}, ${body.country.toUpperCase()}${state ? `, ${state.toUpperCase()}` : ''}`,
        country: body.country.toUpperCase()
      }
    } else {
      throw new Error('Invalid request parameters')
    }

    return NextResponse.json(location)
  } catch (error) {
    console.error('Location lookup error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Location lookup failed' },
      { status: 400 }
    )
  }
} 