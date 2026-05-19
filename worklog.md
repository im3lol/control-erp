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
- Added auto-company-creation: if no companies exist, creates default company via /api/companies/setup
- Removed LoginForm requirement - app no longer shows login screen
- Removed CompanySelector requirement - app no longer shows company selection screen
- Loading spinner shows while auto-login and auto-company setup are in progress
- Login form and company selector components kept intact for future re-enablement

Stage Summary:
- Login system bypassed - app auto-logs in as admin (super_admin role) on load
- Company auto-selected - if only one company exists, it's auto-selected
- Auth components (LoginForm, CompanySelector) preserved for future use
- Also updated auth-guard.ts to auto-fallback to admin user when no auth is present (dev mode)

---
Task ID: 3-5
Agent: Main Agent + Subagents
Task: Warehouse tree hierarchy, Items fixes, Stock Transfer, Item relations

Work Log:
- Updated prisma/schema.prisma: Warehouse model now has type (WAREHOUSE/ZONE/RACK/SHELF/BOX) and parentId for hierarchy
- Added StockTransfer and StockTransferLine models
- Made Item.nameAr optional (String?)
- Added StockTransfer relation to Company model
- Pushed schema changes to database

- Warehouses API: Updated GET to include parent/children/tree, POST supports type/parentId
- Warehouses [id] API: PUT with circular reference prevention, DELETE prevents if has children
- Warehouses import API: Accepts xlsx file, parses columns, resolves parentCode → parentId
- Warehouses template API: Returns downloadable xlsx template with sample data
- Warehouses UI: Complete rewrite with Tree/List view toggle, type icons, import Excel dialog

- Items: nameAr made optional in API and UI, default UOM (PCS) auto-selected
- Categories: Fixed parent update bug (UI was calling wrong API endpoint)

- Stock Transfers API: GET/POST for list and create, [id] for detail/confirm/cancel
- Stock Transfer confirmation creates IN/OUT stock movements and updates item balances
- Stock Transfer cancellation reverses movements if already confirmed
- Stock Transfers UI: Full CRUD with create/view/confirm/cancel dialogs
- Added "تحويلات المخزون" navigation item under inventory module

- Items detail view now shows related counts (مبيعات/مشتريات/حركة/تسوية)
- Added itemFilter to store for cross-module navigation
- Clicking count cards navigates to filtered views
- Sales/Purchase/Stock Movements APIs support itemId filter
- All components show clear filter chip when itemFilter is active

Stage Summary:
- Full warehouse tree hierarchy: Warehouse → Zone → Rack → Shelf → Box
- Excel import/export for warehouse structure
- Item nameAr is now optional, default UOM is PCS
- Category parent update bug fixed
- Complete Stock Transfer feature with confirm/cancel and stock movement integration
- Item detail shows related records with clickable navigation and filtering
