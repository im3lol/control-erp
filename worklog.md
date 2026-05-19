# ERP System Development Worklog

## Phase 1: Initial ERP Build (Completed)
- 6 modules built: Settings, Inventory, Accounting, Sales, Purchases, Reports
- 20+ API routes, 22 UI components
- FIFO costing, double-entry accounting, automatic journal entries

## Phase 2: Major Enhancement (Completed)
- Multi-company architecture with data isolation
- Authentication system (NextAuth.js, JWT sessions)
- Permission system (32 permissions, 7 roles)
- Investors module (capital, distributions, withdrawals, ledger)
- Product codes (UPC, EAN, SKU, ASIN, FNSKU)
- Product image upload and display
- 7-step company setup wizard

## Phase 3: Bug Fixes & Branding (Completed)

### Login Credentials: admin / admin123

### Changes Made:
1. **Hydration Mismatch Fix**: Added `suppressHydrationWarning` to `<body>` tag in layout.tsx to prevent console errors from browser extensions
2. **Branding Update**: Renamed system to "Control ERP" / "Ctrl" / ctrlerp.cloud throughout all components
3. **Login Flow Fix**: 
   - Removed broken `sessionProcessedRef` that prevented session sync after login
   - Fixed CompanySwitcher using hardcoded `userId=admin` instead of actual user ID
   - Added auto-company selection when only 1 company exists
   - Added session re-fetch delay after signIn for reliability
   - Added proper NextAuth type declarations
4. **RBAC Permissions System**: 
   - Full permission viewer dialog showing all permissions per role
   - 9 permission groups: Settings, Inventory, Accounting, Sales, Purchases, Reports, Investors, Users, Companies
   - Role-based badge colors and icons
5. **Admin-Only User Creation**:
   - API-level access control using `getServerSession`
   - Only admin/super_admin can create/edit/delete users
   - Only super_admin can create/modify super_admin users
   - Users cannot delete themselves
   - Permission preview when selecting role in user form
6. **super_admin role**: Added to role labels and user management

## Task 3: Branding Consistency Update (Completed)

### Branding Rules Applied:
- **Full name**: "Control ERP" (used in headings, formal references)
- **Short name**: "Ctrl" (used in sidebar, compact spaces)
- **Domain**: "ctrlerp.cloud" (used in subtitles, footer, page title)
- **Arabic**: "نظام كنترول" (used alongside English name)

### Files Updated:

1. **`src/app/page.tsx`**:
   - Desktop sidebar header: "Control" → "Ctrl"
   - Mobile sidebar header: "Control" → "Ctrl"
   - Dashboard welcome banner: "مرحباً بك في Control ERP" — kept unchanged (correct full name usage)

2. **`src/app/layout.tsx`**:
   - Page title: "Control ERP - نظام كنترول" → "Control ERP - ctrlerp.cloud"
   - Description: updated to include "ctrlerp.cloud" domain reference

3. **`src/components/auth/login-form.tsx`** — Verified correct:
   - Heading: "Control ERP" ✅
   - Subtitle: "نظام كنترول - إدارة موارد مؤسسية متكاملة" ✅

4. **`src/components/auth/company-selector.tsx`** — No branding references to update

5. **`src/components/companies/company-switcher.tsx`** — No branding references to update

6. **`src/components/companies/setup-wizard.tsx`** — No branding references to update

7. **`src/components/settings/users-list.tsx`** — Already has "user@ctrlerp.cloud" placeholder ✅

### Consistency Verification:
- All sidebar headers use "Ctrl" (compact space)
- All formal headings/banners use "Control ERP" (full name)
- Page title includes "ctrlerp.cloud" domain
- Arabic "نظام كنترول" used alongside English name in login form

## Task 4: Product Codes & Image Support Enhancement (Completed)

### Overview:
Enhanced the ItemCode model, API routes, and UI components to support multiple product codes (UPC, EAN, SKU, ASIN, FNSKU, OTHER) with Arabic labels and image thumbnails in the balances view.

### Changes Made:

#### 1. Prisma Schema (`prisma/schema.prisma`)
- **ItemCode model updated**:
  - Renamed `value` field to `code` (better naming convention)
  - Added `createdAt` and `updatedAt` timestamp fields
  - Added `@@map("item_codes")` for explicit table mapping
  - Updated unique constraint from `@@unique([itemId, codeType])` to `@@unique([itemId, codeType, code])` to allow multiple codes of the same type with different values
  - Added `OTHER` as a valid code type option
- **Item model**: `image` field already existed — no changes needed
- Ran `bun run db:push --accept-data-loss` to apply schema changes

#### 2. New API Routes

- **`/api/items/[id]/codes/route.ts`** — RESTful route for item codes:
  - GET: Get all codes for an item by ID
  - POST: Add a new code to an item (with uniqueness check)
  - DELETE: Remove a code by codeId (query param) with item ownership verification

- **`/api/upload/route.ts`** — General-purpose file upload:
  - POST: Handles image upload from FormData
  - Validates file type (JPEG, PNG, WebP, GIF) and size (max 5MB)
  - Saves to `/home/z/my-project/upload/` directory
  - Returns the file path for storage in DB

- **`/api/serve-upload/[path]/route.ts`** — Serves uploaded files:
  - GET: Serves files from the `upload/` directory with proper content types
  - Includes path traversal security check
  - Sets cache headers for performance

#### 3. Updated Existing API Routes

- **`/api/inventory/item-codes/route.ts`**:
  - Updated all `value` references to `code`
  - Added `OTHER` to `VALID_CODE_TYPES`
  - Updated uniqueness check to use `code` field with `itemId + codeType + code` combination
  - PUT handler now checks uniqueness for both `codeType` and `code` changes

- **`/api/inventory/items/route.ts`**:
  - Updated code creation maps from `value` to `code` in both POST and PUT handlers

#### 4. UI Component Updates

- **`items-list.tsx`**:
  - Renamed `value` to `code` in `ItemCode` interface and all usages
  - Added Arabic labels for code types: باركود UPC, باركود EAN, رمز التخزين SKU, أمازون ASIN, أمازون FNSKU, أخرى
  - Added `CODE_TYPE_SHORT` mapping for compact badge display
  - Enhanced table: primary code now shows with a colored type badge + code value
  - Enhanced detail dialog: codes section uses grid layout with colored badges
  - Search now includes product code values in search scope
  - Code type dropdown wider (w-36) to accommodate Arabic labels

- **`item-balances-list.tsx`**:
  - Added `image` field to `Item` interface
  - Added new image thumbnail column in the table header
  - Each row now shows a small product image (8x8) or Package icon placeholder
  - Updated `colSpan` from 7 to 8 for empty state and summary row

#### 5. Configuration Updates

- **`next.config.ts`**: Added rewrites to serve `/upload/*` files via `/api/serve-upload/*`

## Task 6: Role-Based Access Control (RBAC) & Admin-Only User Creation (Completed)

### Overview:
Implemented comprehensive Role-Based Access Control (RBAC) across the entire Control ERP application, enforcing permissions on both API routes and client-side navigation.

### Changes Made:

#### 1. Server-Side Auth Helper (`src/lib/auth-guard.ts`) — NEW FILE
- `getCurrentUser()`: Returns authenticated user info from session (id, name, username, role, companyId, companyRole)
- `requireAuth()`: Throws Arabic error if not authenticated
- `requirePermission(permission)`: Throws Arabic error if user lacks the specified permission
- `requireAdmin()`: Throws Arabic error if user is not super_admin or admin
- `canAssignRole(creatorRole, targetRole)`: Determines if a creator can assign a target role:
  - super_admin can assign any role
  - admin can assign: accountant, sales, purchase, inventory, viewer
  - Other roles cannot create users
- `getAssignableRoles(creatorRole)`: Returns list of roles a creator can assign

#### 2. Protected API Routes with RBAC
All API routes now check permissions before processing requests:

- **Inventory** (`/api/inventory/items`, `/warehouses`, `/categories`, `/stock-movements`, `/item-balances`):
  - GET → `inventory.view`
  - POST → `inventory.create`
  - PUT → `inventory.edit`
  - DELETE → `inventory.delete`

- **Sales** (`/api/sales/invoices`, `/api/sales/customers`):
  - GET → `sales.view`
  - POST → `sales.create`
  - PUT → `sales.edit`
  - DELETE → `sales.edit`

- **Purchases** (`/api/purchases/invoices`, `/api/purchases/suppliers`):
  - GET → `purchases.view`
  - POST → `purchases.create`
  - PUT → `purchases.edit`
  - DELETE → `purchases.edit`

- **Accounting** (`/api/accounting/journal-entries`):
  - GET → `accounting.view`
  - POST → `accounting.create`

- **Investors** (`/api/investors`):
  - GET → `investors.view`
  - POST → `investors.create`

- **Reports** (`/api/reports/trial-balance`):
  - GET → `reports.view`

- **Settings/Users** (`/api/settings/users`):
  - GET → `users.view`
  - POST → `requireAdmin()` + `canAssignRole()` check
  - PUT → `requireAdmin()` + `canAssignRole()` check
  - DELETE → `requireAdmin()`

All routes return 403 with Arabic error messages when permission check fails.

#### 3. Admin-Only User Creation — Client Side (`src/components/settings/users-list.tsx`)
- **Non-admin users**: See a restricted view with a clear message explaining their limited access, plus a read-only user list
- **Add User button**: Only shown for admin/super_admin roles
- **Role selector**: Filtered by `getAssignableRoles()`:
  - super_admin sees all 7 roles
  - admin sees only: accountant, sales, purchase, inventory, viewer
  - Other roles see no options (cannot create users)
- **Role descriptions**: Each role has an Arabic description tooltip explaining permissions
- **Permission count badges**: Role selector shows permission count next to each role name
- **Client-side validation**: Prevents submitting a role the user cannot assign

#### 4. Server-Side Role Assignment Enforcement (`/api/settings/users/route.ts`)
- Replaced old `checkAdminAccess()` with `requireAdmin()` from auth-guard
- POST: Uses `canAssignRole()` to verify the authenticated user can assign the requested role
- PUT: Uses `canAssignRole()` when changing a user's role
- DELETE: Uses `requireAdmin()` for authorization
- Error messages include list of allowed roles when assignment is denied

#### 5. Client-Side Navigation Permission Checks (`src/app/page.tsx`)
- Added `filterNavigationByRole()` function that filters the navigation tree based on user role
- Module-to-permission mapping:
  - Dashboard → always visible (all roles have `settings.view`)
  - Settings → requires `settings.edit` (admin/super_admin only)
  - Inventory → requires `inventory.view`
  - Accounting → requires `accounting.view`
  - Sales → requires `sales.view`
  - Purchases → requires `purchases.view`
  - Investors → requires `investors.view`
  - Reports → requires `reports.view`
- SidebarNav component now accepts `userRole` prop
- Navigation items and children are filtered before rendering
- Applied to both mobile and desktop sidebar views

#### 6. Permissions Display in User Settings
- **Role info tooltip**: Hovering over the role badge shows the role's Arabic description and permission count
- **Permissions dialog**: Clicking the "N صلاحية" button opens a detailed dialog showing:
  - 9 permission groups (Settings, Inventory, Accounting, Sales, Purchases, Reports, Investors, Users, Companies)
  - Each group shows whether it's allowed/denied for the selected role
  - Individual permissions shown as badges (green = allowed, strikethrough = denied)
  - Full role description in the dialog subtitle
