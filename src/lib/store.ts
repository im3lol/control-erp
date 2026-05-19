import { create } from 'zustand'

export type Module = 'dashboard' | 'settings' | 'inventory' | 'accounting' | 'sales' | 'purchases' | 'reports'
type SettingsView = 'company' | 'currencies' | 'uom' | 'users' | 'chart-of-accounts'
type InventoryView = 'warehouses' | 'items' | 'categories' | 'stock-movements' | 'item-balances'
type AccountingView = 'journal-entries' | 'chart-of-accounts'
type SalesView = 'customers' | 'sales-invoices' | 'receipt-vouchers'
type PurchasesView = 'suppliers' | 'purchase-invoices' | 'payment-vouchers'
type ReportsView = 'trial-balance' | 'balance-sheet' | 'income-statement' | 'inventory-report' | 'sales-report' | 'purchase-report' | 'customer-aging' | 'supplier-aging'

interface AppState {
  currentModule: Module
  currentView: string
  sidebarOpen: boolean
  setModule: (module: Module) => void
  setView: (view: string) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentModule: 'dashboard',
  currentView: '',
  sidebarOpen: true,
  setModule: (module) => set({ currentModule: module, currentView: '' }),
  setView: (view) => set({ currentView: view }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
