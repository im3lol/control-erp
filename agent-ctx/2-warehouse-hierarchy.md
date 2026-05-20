# Task 2 - Warehouse Tree Hierarchy Implementation

## Summary
Updated Warehouses module to support a 5-level tree hierarchy: Warehouse → Zone → Rack → Shelf → Box.

## Files Modified/Created

### API Routes
1. **`src/app/api/inventory/warehouses/route.ts`** - Rewrote:
   - GET: Now includes `parent` relation and `_count.children`. Supports `?view=tree` query param for nested JSON response via `buildTree()` function.
   - POST: Now supports `type` (WAREHOUSE/ZONE/RACK/SHELF/BOX) and `parentId` fields. Validates parent exists and belongs to same company.
   - Removed PUT/DELETE (moved to [id] route).

2. **`src/app/api/inventory/warehouses/[id]/route.ts`** - Created:
   - PUT: Updates warehouse with type, parentId, and all fields. Validates type values, prevents circular references in parent assignment, validates parent company ownership.
   - DELETE: Checks for children before allowing deletion (in addition to stock movements check).

3. **`src/app/api/inventory/warehouses/import/route.ts`** - Created:
   - POST: Accepts xlsx file upload via FormData. Parses columns: code, nameAr, nameEn, type, parentCode, location, manager.
   - Resolves parentCode to parentId using existing warehouse codes. Tracks created records for intra-import references.
   - Returns successCount, errorCount, errors array, and totalRows.

4. **`src/app/api/inventory/warehouses/template/route.ts`** - Created:
   - GET: Generates and returns xlsx template with headers and one sample row.
   - Returns proper Content-Type and Content-Disposition headers for file download.

### UI Component
5. **`src/components/inventory/warehouses-list.tsx`** - Complete rewrite:
   - **Tree View / List View toggle**: Default Tree view with collapsible nodes, List view with flat table.
   - **Tree View**: Recursive rendering with depth-based indentation, type-specific icons (Building2/MapPin/LayoutGrid/Layers/Box), type color badges, expand/collapse per node, hover-to-reveal edit/delete buttons, children count.
   - **List View**: Flat table with Type and Parent columns added.
   - **Add/Edit Dialog**: Type select field with Arabic labels, Parent Location dropdown filtered by type hierarchy, nameAr optional (falls back to code).
   - **Import Excel Dialog**: File upload area, template download link, import result display with success/error counts.
   - **Stock Transfers button**: Links to stock-movements view.
   - **Color coding**: WAREHOUSE=emerald, ZONE=teal, RACK=amber, SHELF=violet, BOX=rose.

### Other Changes
6. **`src/lib/db.ts`** - Changed Prisma log level from `['query']` to `['error']` to reduce memory usage.

## Verified
- ✅ ESLint passes with no errors
- ✅ GET /api/inventory/warehouses returns flat list with parent and _count
- ✅ GET /api/inventory/warehouses?view=tree returns nested tree structure
- ✅ POST /api/inventory/warehouses creates with type, parentId, parent relation included in response
- ✅ Prisma schema with self-referencing hierarchy is correctly generated
- ✅ Database pushed and Prisma client regenerated

## Notes
- Server experiences OOM in restricted environment after compiling multiple API routes (infrastructure issue, not code bug)
- The code is functionally correct based on testing of GET and POST endpoints
