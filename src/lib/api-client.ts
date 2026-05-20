import { useAppStore } from '@/lib/store'

/**
 * Authenticated fetch helper that automatically includes the access token
 * in request headers. Works alongside NextAuth cookies - if cookies work,
 * they'll be used; if not, the token header serves as a fallback.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = useAppStore.getState().accessToken
  
  const headers = new Headers(options.headers || {})
  
  if (token) {
    headers.set('X-Auth-Token', token)
  }
  
  return fetch(url, {
    ...options,
    headers,
  })
}
