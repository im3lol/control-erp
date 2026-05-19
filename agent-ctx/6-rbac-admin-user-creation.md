# Task 6: Role-Based Access Control (RBAC) & Admin-Only User Creation

**Agent**: Main Developer
**Status**: Completed

## Summary
Implemented comprehensive RBAC across the entire Control ERP application, enforcing permissions on both API routes (server-side) and client-side navigation. Also enforced admin-only user creation with role assignment restrictions.

## Files Created
- `src/lib/auth-guard.ts` — Server-side auth helper with requireAuth(), requirePermission(), requireAdmin(), canAssignRole(), getAssignableRoles()

## Files Modified
- `src/app/api/inventory/items/route.ts` — Added RBAC checks (inventory.view, inventory.create, inventory.edit, inventory.delete)
- `src/app/api/inventory/warehouses/route.ts` — Added RBAC checks
- `src/app/api/inventory/categories/route.ts` — Added RBAC checks
- `src/app/api/inventory/stock-movements/route.ts` — Added RBAC checks
- `src/app/api/inventory/item-balances/route.ts` — Added RBAC checks
- `src/app/api/sales/invoices/route.ts` — Added RBAC checks (sales.view, sales.create)
- `src/app/api/sales/customers/route.ts` — Added RBAC checks (sales.view, sales.create, sales.edit)
- `src/app/api/purchases/invoices/route.ts` — Added RBAC checks (purchases.view, purchases.create)
- `src/app/api/purchases/suppliers/route.ts` — Added RBAC checks (purchases.view, purchases.create, purchases.edit)
- `src/app/api/accounting/journal-entries/route.ts` — Added RBAC checks (accounting.view, accounting.create)
- `src/app/api/investors/route.ts` — Added RBAC checks (investors.view, investors.create)
- `src/app/api/reports/trial-balance/route.ts` — Added RBAC checks (reports.view)
- `src/app/api/settings/users/route.ts` — Refactored to use requireAdmin(), canAssignRole(), getAssignableRoles()
- `src/components/settings/users-list.tsx` — Complete rewrite with admin-only creation, role restriction, permission display, non-admin restricted view
- `src/app/page.tsx` — Added filterNavigationByRole(), userRole prop to SidebarNav

## Key Design Decisions
1. All API routes use `requirePermission()` from auth-guard.ts — single source of truth for permission checks
2. Permission errors return 403 with Arabic messages matching the pattern `غير مصرح` or `صلاحية`
3. Navigation filtering is client-side only (for UX); server-side API protection is the real enforcement
4. Settings module is hidden from non-admin users since `settings.edit` is only for admin/super_admin
5. Role assignment follows hierarchical rules: super_admin can assign any role, admin can assign limited roles
6. Non-admin users see a restricted view with a clear Arabic message and read-only user list
