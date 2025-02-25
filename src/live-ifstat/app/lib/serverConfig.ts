export const fetchOptions = {
  cache: 'no-store' as RequestCache,
  next: { 
    revalidate: 0,
  },
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
  }
} 