# Task ID: 3 - Fix Items (nameAr optional, default UOM) and Categories (parent update bug)

## Work Summary

### 1. Item nameAr - Made optional in API and UI

**API (`src/app/api/inventory/items/route.ts`):**
- POST handler: Changed validation from `if (!code || !nameAr)` to `if (!code)` and updated error message
- POST handler: Changed `nameAr` to `nameAr: nameAr || null` to store empty strings as null
- PUT handler: Changed `nameAr` spread to `nameAr: nameAr || null` to handle empty string → null conversion

**UI (`src/components/inventory/items-list.tsx`):**
- Updated `Item` interface: `nameAr: string` → `nameAr: string | null`
- Removed `<span className="text-red-500">*</span>` from nameAr label in the form dialog
- Changed validation from `!formData.code.trim() || !formData.nameAr.trim()` to `!formData.code.trim()` with Arabic error message
- Table: Changed `{item.nameAr}` to `{item.nameAr || item.nameEn || item.code}` for null fallback
- Detail dialog title: Changed to use fallback `{detailItem.nameAr || detailItem.nameEn || detailItem.code}`
- Image alt attributes: Updated to use fallback `item.nameAr || item.code`
- Search filter: Added null check `(item.nameAr && item.nameAr.includes(searchTerm))`
- handleOpenEdit: Changed `nameAr: item.nameAr` to `nameAr: item.nameAr || ''`
- handleSubmit payload: Changed `nameAr: formData.nameAr` to `nameAr: formData.nameAr || null`

### 2. Default UOM - PCS auto-selection

**UI (`src/components/inventory/items-list.tsx`):**
- In `handleOpenAdd`: Added logic to find UOM with code "PCS" and pre-select it as default `uomId`

### 3. Fixed Category parent update bug (and Items PUT/DELETE routing)

**Root Cause:** The UI was calling PUT/DELETE on `/api/inventory/categories/${editingId}` and `/api/inventory/items/${editingId}`, but there were no dynamic `[id]` route files. The PUT/DELETE handlers existed only at the base routes (`/api/inventory/categories` and `/api/inventory/items`) which expect `id` in the request body. This caused 404 errors.

**Fix for Categories (`src/components/inventory/categories-list.tsx`):**
- PUT: Changed URL from `/api/inventory/categories/${editingId}` to `/api/inventory/categories`
- PUT: Added `id: editingId` to the payload when editing
- DELETE: Changed from simple GET-style DELETE with URL param to proper DELETE with JSON body containing `{ id: deletingId, companyId }`

**Fix for Items (`src/components/inventory/items-list.tsx`):**
- PUT: Changed URL from `/api/inventory/items/${editingId}?companyId=${companyId}` to `/api/inventory/items`
- PUT: Added `id: editingId` to the payload when editing
- DELETE: Changed from simple fetch with URL param to proper DELETE with JSON body containing `{ id: deletingId, companyId }`

## Files Modified
- `src/app/api/inventory/items/route.ts` - nameAr optional in POST/PUT
- `src/components/inventory/items-list.tsx` - nameAr optional UI, PCS default, routing fixes
- `src/components/inventory/categories-list.tsx` - PUT/DELETE routing fixes

## Verification
- `bun run lint` passed with no errors
- `bun run db:push` confirmed schema is in sync
- Dev server running normally
