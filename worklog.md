---
Task ID: 1
Agent: Main Agent
Task: Fix auth/session system - simplify to token-based approach with localStorage persistence

Work Log:
- Diagnosed session retrieval failure: NextAuth session cookies don't work reliably through Caddy proxy
- Removed SessionProvider, useSession, and signOut dependencies from client components
- Updated store.ts with localStorage persistence for auth token, user data, companies, and current company
- Added hydrate() method to store that loads saved auth state from localStorage on page load
- Updated login-form.tsx to use only custom /api/auth/login API (removed NextAuth signIn call)
- Updated company-selector.tsx to remove NextAuth signOut dependency
- Updated page.tsx AppContent to remove useSession() and SessionProvider
- Added hydration check in AppContent (shows spinner while loading from localStorage)
- Simplified logout handler (no longer calls signOut)
- Added NEXTAUTH_SECRET to .env file

Stage Summary:
- Auth system now uses pure token-based approach via custom /api/auth/login endpoint
- Access tokens are stored in both Zustand state and localStorage for persistence
- Session is maintained across page refreshes using localStorage hydration
- No more dependency on NextAuth cookies for client-side session management
- Server-side auth still uses auth-guard.ts which checks both NextAuth session and X-Auth-Token header
- Login API verified working: POST /api/auth/login returns user data, companies, and token
- Default credentials: admin / admin123
