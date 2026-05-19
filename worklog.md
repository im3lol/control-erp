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

---
Task ID: 2
Agent: Main Agent
Task: Bypass login system - auto-login as admin to focus on ERP functionality

Work Log:
- Modified AppContent in page.tsx to auto-login using admin credentials (admin/admin123)
- Added auto-login useEffect that calls /api/auth/login with admin credentials on mount
- Added fallback: if login API fails, sets a dev admin user directly (id: dev-admin, role: super_admin)
- Added auto-company-selection: if authenticated but no company, auto-selects first company
- Added auto-company-creation: if no companies exist, creates default "شركة كنترول" via /api/companies/setup
- Removed LoginForm requirement - app no longer shows login screen
- Removed CompanySelector requirement - app no longer shows company selection screen
- Loading spinner shows while auto-login and auto-company setup are in progress
- Login form and company selector components kept intact for future re-enablement
- Database seeded with default company, admin user, currencies, UOMs, warehouses, and chart of accounts
- Verified: server starts, page loads (HTTP 200), login API works, dashboard API works

Stage Summary:
- Login system bypassed - app auto-logs in as admin (super_admin role) on load
- Company auto-selected - if only one company exists, it's auto-selected
- If no companies exist, default company "شركة كنترول" is auto-created
- Auth components (LoginForm, CompanySelector) preserved for future use
- Database has seed data: 1 company, 4 currencies, 5 UOMs, 1 admin user, 1 warehouse, 24 accounts
