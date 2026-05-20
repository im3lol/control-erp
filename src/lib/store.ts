import { create } from 'zustand'

export type Module = 'dashboard' | 'settings' | 'inventory' | 'accounting' | 'sales' | 'purchases' | 'reports' | 'investors'
type SettingsView = 'companies' | 'company' | 'currencies' | 'uom' | 'users' | 'chart-of-accounts'
type InventoryView = 'warehouses' | 'items' | 'categories' | 'stock-movements' | 'item-balances' | 'item-detail' | 'stock-transfer-form' | 'material-requests' | 'material-request-form' | 'delivery-notes' | 'delivery-note-form' | 'purchase-receipts' | 'purchase-receipt-form' | 'pick-lists' | 'pick-list-form'
type AccountingView = 'journal-entries' | 'chart-of-accounts'
type SalesView = 'customers' | 'sales-invoices' | 'sales-orders' | 'customer-form' | 'sales-order-form' | 'sales-invoice-form'
type PurchasesView = 'suppliers' | 'purchase-invoices' | 'purchase-orders' | 'supplier-form' | 'purchase-order-form' | 'purchase-invoice-form'
type ReportsView = 'trial-balance' | 'balance-sheet' | 'income-statement' | 'inventory-report' | 'sales-report' | 'purchase-report' | 'customer-aging' | 'supplier-aging'
type InvestorsView = 'investors-list'

export interface UserInfo {
  id: string
  name: string
  username: string
  role: string
  email?: string
}

export interface CompanyInfo {
  id: string
  nameAr: string
  nameEn?: string
  logo?: string | null
  vatRate?: number
  role?: string
}

// ── localStorage helpers ──────────────────────────────────────────────────────
const STORAGE_KEY = 'ctrl_erp_auth'

function loadFromStorage(): { user: UserInfo | null; accessToken: string | null; companies: CompanyInfo[]; currentCompanyId: string | null } {
  if (typeof window === 'undefined') {
    return { user: null, accessToken: null, companies: [], currentCompanyId: null }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      return {
        user: data.user || null,
        accessToken: data.accessToken || null,
        companies: data.companies || [],
        currentCompanyId: data.currentCompanyId || null,
      }
    }
  } catch {
    // ignore parse errors
  }
  return { user: null, accessToken: null, companies: [], currentCompanyId: null }
}

function saveToStorage(data: { user: UserInfo | null; accessToken: string | null; companies: CompanyInfo[]; currentCompanyId: string | null }) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore write errors
  }
}

function clearStorage() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

interface AppState {
  currentModule: Module
  currentView: string
  sidebarOpen: boolean
  // Auth & company
  user: UserInfo | null
  currentCompanyId: string | null
  companies: CompanyInfo[]
  isAuthenticated: boolean
  accessToken: string | null
  hydrated: boolean
  // Item filter for navigation from item detail
  itemFilter: string | null
  // Selected item for detail page navigation
  selectedItemId: string | null
  // Selected transfer for detail page navigation
  selectedTransferId: string | null
  // Document ID for editing (used by form pages)
  editingDocId: string | null
  // Navigation actions
  setModule: (module: Module) => void
  setView: (view: string) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  // Auth & company actions
  setUser: (user: UserInfo) => void
  setCurrentCompany: (id: string) => void
  setCompanies: (companies: CompanyInfo[]) => void
  addCompany: (company: CompanyInfo) => void
  updateCompany: (id: string, data: Partial<CompanyInfo>) => void
  removeCompany: (id: string) => void
  setAccessToken: (token: string | null) => void
  hydrate: () => void
  logout: () => void
  setItemFilter: (filter: string | null) => void
  setSelectedItemId: (id: string | null) => void
  setSelectedTransferId: (id: string | null) => void
  setEditingDocId: (id: string | null) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  currentModule: 'dashboard',
  currentView: '',
  sidebarOpen: true,
  // Auth & company
  user: null,
  currentCompanyId: null,
  companies: [],
  isAuthenticated: false,
  accessToken: null,
  hydrated: false,
  itemFilter: null,
  selectedItemId: null,
  selectedTransferId: null,
  editingDocId: null,
  // Navigation actions
  setModule: (module) => set({ currentModule: module, currentView: '' }),
  setView: (view) => set({ currentView: view }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setItemFilter: (filter) => set({ itemFilter: filter }),
  setSelectedItemId: (id) => set({ selectedItemId: id }),
  setSelectedTransferId: (id) => set({ selectedTransferId: id }),
  setEditingDocId: (id) => set({ editingDocId: id }),
  // Auth & company actions
  setUser: (user) => {
    set({ user, isAuthenticated: true })
    saveToStorage({
      user,
      accessToken: get().accessToken,
      companies: get().companies,
      currentCompanyId: get().currentCompanyId,
    })
  },
  setCurrentCompany: (id) => {
    set({ currentCompanyId: id })
    saveToStorage({
      user: get().user,
      accessToken: get().accessToken,
      companies: get().companies,
      currentCompanyId: id,
    })
  },
  setCompanies: (companies) => {
    set({ companies })
    saveToStorage({
      user: get().user,
      accessToken: get().accessToken,
      companies,
      currentCompanyId: get().currentCompanyId,
    })
  },
  addCompany: (company) => {
    const newCompanies = [...get().companies, company]
    set({ companies: newCompanies })
    saveToStorage({
      user: get().user,
      accessToken: get().accessToken,
      companies: newCompanies,
      currentCompanyId: get().currentCompanyId,
    })
  },
  updateCompany: (id, data) => {
    const newCompanies = get().companies.map((c) =>
      c.id === id ? { ...c, ...data } : c
    )
    set({ companies: newCompanies })
    saveToStorage({
      user: get().user,
      accessToken: get().accessToken,
      companies: newCompanies,
      currentCompanyId: get().currentCompanyId,
    })
  },
  removeCompany: (id) => {
    const newCompanies = get().companies.filter((c) => c.id !== id)
    const newCurrentId = get().currentCompanyId === id
          ? (newCompanies[0]?.id ?? null)
          : get().currentCompanyId
    set({ companies: newCompanies, currentCompanyId: newCurrentId })
    saveToStorage({
      user: get().user,
      accessToken: get().accessToken,
      companies: newCompanies,
      currentCompanyId: newCurrentId,
    })
  },
  setAccessToken: (token) => {
    set({ accessToken: token })
    saveToStorage({
      user: get().user,
      accessToken: token,
      companies: get().companies,
      currentCompanyId: get().currentCompanyId,
    })
  },
  hydrate: () => {
    const stored = loadFromStorage()
    if (stored.user && stored.accessToken) {
      set({
        user: stored.user,
        accessToken: stored.accessToken,
        companies: stored.companies,
        currentCompanyId: stored.currentCompanyId,
        isAuthenticated: true,
        hydrated: true,
      })
    } else {
      set({ hydrated: true })
    }
  },
  logout: () => {
    clearStorage()
    set({ user: null, currentCompanyId: null, companies: [], isAuthenticated: false, accessToken: null })
  },
}))
