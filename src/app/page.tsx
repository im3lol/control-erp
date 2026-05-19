'use client'

import { useState, useEffect, useCallback, type ElementType } from 'react'
import { useAppStore } from '@/lib/store'
import type { Module } from '@/lib/store'
import { formatCurrency, formatDate } from '@/lib/erp-utils'
import {
  LayoutDashboard,
  Settings,
  Package,
  Calculator,
  ShoppingCart,
  Truck,
  BarChart3,
  ChevronDown,
  Menu,
  Plus,
  Building2,
  DollarSign,
  Ruler,
  UserCog,
  GitBranch,
  Warehouse,
  Tags,
  ArrowLeftRight,
  Scale,
  BookOpen,
  Users,
  FileText,
  Receipt,
  CreditCard,
  PieChart,
  TrendingUp,
  Bell,
  LogOut,
  Activity,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import CompanyForm from '@/components/settings/company-form'
import CurrenciesList from '@/components/settings/currencies-list'
import UOMList from '@/components/settings/uom-list'
import UsersList from '@/components/settings/users-list'
import ChartOfAccounts from '@/components/accounting/chart-of-accounts'
import JournalEntriesList from '@/components/accounting/journal-entries-list'
import WarehousesList from '@/components/inventory/warehouses-list'
import CategoriesList from '@/components/inventory/categories-list'
import ItemsList from '@/components/inventory/items-list'
import StockMovementsList from '@/components/inventory/stock-movements-list'
import ItemBalancesList from '@/components/inventory/item-balances-list'
import SuppliersList from '@/components/purchases/suppliers-list'
import PurchaseInvoicesList from '@/components/purchases/purchase-invoices-list'
import PaymentVouchersList from '@/components/purchases/payment-vouchers-list'
import CustomersList from '@/components/sales/customers-list'
import SalesInvoicesList from '@/components/sales/sales-invoices-list'
import ReceiptVouchersList from '@/components/sales/receipt-vouchers-list'
import TrialBalanceReport from '@/components/reports/trial-balance'
import BalanceSheetReport from '@/components/reports/balance-sheet'
import IncomeStatementReport from '@/components/reports/income-statement'
import InventoryReport from '@/components/reports/inventory-report'
import SalesReport from '@/components/reports/sales-report'
import PurchaseReport from '@/components/reports/purchase-report'
import CustomerAgingReport from '@/components/reports/customer-aging'
import SupplierAgingReport from '@/components/reports/supplier-aging'

// ─── Navigation Configuration ────────────────────────────────────────────────

interface NavChild {
  id: string
  label: string
  icon: ElementType
}

interface NavItem {
  id: string
  label: string
  icon: ElementType
  children?: NavChild[]
}

const navigation: NavItem[] = [
  {
    id: 'dashboard',
    label: 'لوحة التحكم',
    icon: LayoutDashboard,
  },
  {
    id: 'settings',
    label: 'الإعدادات',
    icon: Settings,
    children: [
      { id: 'company', label: 'بيانات الشركة', icon: Building2 },
      { id: 'currencies', label: 'العملات', icon: DollarSign },
      { id: 'uom', label: 'وحدات القياس', icon: Ruler },
      { id: 'users', label: 'المستخدمين', icon: UserCog },
      { id: 'chart-of-accounts', label: 'شجرة الحسابات', icon: GitBranch },
    ],
  },
  {
    id: 'inventory',
    label: 'المخازن',
    icon: Package,
    children: [
      { id: 'warehouses', label: 'المخازن', icon: Warehouse },
      { id: 'items', label: 'الأصناف', icon: Package },
      { id: 'categories', label: 'الفئات', icon: Tags },
      { id: 'stock-movements', label: 'حركات المخزن', icon: ArrowLeftRight },
      { id: 'item-balances', label: 'أرصدة الأصناف', icon: Scale },
    ],
  },
  {
    id: 'accounting',
    label: 'الحسابات',
    icon: Calculator,
    children: [
      { id: 'journal-entries', label: 'القيود اليومية', icon: BookOpen },
      { id: 'chart-of-accounts', label: 'شجرة الحسابات', icon: GitBranch },
    ],
  },
  {
    id: 'sales',
    label: 'المبيعات',
    icon: ShoppingCart,
    children: [
      { id: 'customers', label: 'العملاء', icon: Users },
      { id: 'sales-invoices', label: 'فواتير البيع', icon: FileText },
      { id: 'receipt-vouchers', label: 'سندات القبض', icon: Receipt },
    ],
  },
  {
    id: 'purchases',
    label: 'المشتريات',
    icon: Truck,
    children: [
      { id: 'suppliers', label: 'الموردين', icon: Building2 },
      { id: 'purchase-invoices', label: 'فواتير الشراء', icon: FileText },
      { id: 'payment-vouchers', label: 'سندات الصرف', icon: CreditCard },
    ],
  },
  {
    id: 'reports',
    label: 'التقارير',
    icon: BarChart3,
    children: [
      { id: 'trial-balance', label: 'ميزان المراجعة', icon: Scale },
      { id: 'balance-sheet', label: 'الميزانية العمومية', icon: PieChart },
      { id: 'income-statement', label: 'قائمة الدخل', icon: TrendingUp },
      { id: 'inventory-report', label: 'تقرير المخازن', icon: Package },
      { id: 'sales-report', label: 'تقرير المبيعات', icon: BarChart3 },
      { id: 'purchase-report', label: 'تقرير المشتريات', icon: ShoppingCart },
      { id: 'customer-aging', label: 'أرصدة العملاء', icon: Users },
      { id: 'supplier-aging', label: 'أرصدة الموردين', icon: Building2 },
    ],
  },
]

// ─── Title Maps ──────────────────────────────────────────────────────────────

const moduleTitles: Record<string, string> = {
  dashboard: 'لوحة التحكم',
  settings: 'الإعدادات',
  inventory: 'المخازن',
  accounting: 'الحسابات',
  sales: 'المبيعات',
  purchases: 'المشتريات',
  reports: 'التقارير',
}

const viewTitles: Record<string, string> = {
  company: 'بيانات الشركة',
  currencies: 'العملات',
  uom: 'وحدات القياس',
  users: 'المستخدمين',
  'chart-of-accounts': 'شجرة الحسابات',
  warehouses: 'المخازن',
  items: 'الأصناف',
  categories: 'الفئات',
  'stock-movements': 'حركات المخزن',
  'item-balances': 'أرصدة الأصناف',
  'journal-entries': 'القيود اليومية',
  customers: 'العملاء',
  'sales-invoices': 'فواتير البيع',
  'receipt-vouchers': 'سندات القبض',
  suppliers: 'الموردين',
  'purchase-invoices': 'فواتير الشراء',
  'payment-vouchers': 'سندات الصرف',
  'trial-balance': 'ميزان المراجعة',
  'balance-sheet': 'الميزانية العمومية',
  'income-statement': 'قائمة الدخل',
  'inventory-report': 'تقرير المخازن',
  'sales-report': 'تقرير المبيعات',
  'purchase-report': 'تقرير المشتريات',
  'customer-aging': 'أرصدة العملاء',
  'supplier-aging': 'أرصدة الموردين',
}

// ─── Sidebar Navigation Component ────────────────────────────────────────────

interface SidebarNavProps {
  currentModule: string
  currentView: string
  expandedItems: string[]
  onNavClick: (id: string, hasChildren: boolean) => void
  onSubClick: (moduleId: string, viewId: string) => void
  isCollapsed: boolean
}

function SidebarNav({
  currentModule,
  currentView,
  expandedItems,
  onNavClick,
  onSubClick,
  isCollapsed,
}: SidebarNavProps) {
  // ── Collapsed Mode: Icon-only ──
  if (isCollapsed) {
    return (
      <nav className="space-y-1 p-2">
        {navigation.map((item) => {
          const isActive =
            currentModule === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavClick(item.id, !!item.children)}
              className={cn(
                'w-full flex items-center justify-center p-3 rounded-lg transition-colors duration-150',
                isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              )}
              title={item.label}
            >
              <item.icon className="h-5 w-5 shrink-0" />
            </button>
          )
        })}
      </nav>
    )
  }

  // ── Expanded Mode: Full text with collapsible sub-items ──
  return (
    <nav className="space-y-1 p-3">
      {navigation.map((item) => {
        const isActive = currentModule === item.id && !currentView
        const isExpanded = expandedItems.includes(item.id)
        const isParentActive = currentModule === item.id
        const hasChildren = !!item.children

        // ── Item with children (Collapsible) ──
        if (hasChildren) {
          return (
            <Collapsible
              key={item.id}
              open={isExpanded}
              onOpenChange={() => onNavClick(item.id, true)}
            >
              <CollapsibleTrigger asChild>
                <button
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
                    isParentActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1 text-right">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 transition-transform duration-200',
                      isExpanded && 'rotate-180'
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                <div className="me-3 mt-1 space-y-0.5 border-e border-slate-100 pe-3 py-1">
                  {item.children!.map((child) => {
                    const isChildActive =
                      currentModule === item.id && currentView === child.id
                    return (
                      <button
                        key={child.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSubClick(item.id, child.id)
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150',
                          isChildActive
                            ? 'bg-emerald-100/70 text-emerald-800 font-medium'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        )}
                      >
                        <child.icon className="h-4 w-4 shrink-0" />
                        <span>{child.label}</span>
                      </button>
                    )
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        }

        // ── Simple item (no children) ──
        return (
          <button
            key={item.id}
            onClick={() => onNavClick(item.id, false)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
              isActive
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-right">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

// ─── Dashboard Content ───────────────────────────────────────────────────────

interface DashboardData {
  totalSales: number
  totalPurchases: number
  customerCount: number
  supplierCount: number
  inventoryValue: number
  dueInvoices: number
  recentActivities: Array<{
    id: string
    type: string
    date: string
    description: string
    amount: number
  }>
}

const dashboardStatDefs = [
  { key: 'totalSales' as const, title: 'إجمالي المبيعات', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', isCurrency: true },
  { key: 'totalPurchases' as const, title: 'إجمالي المشتريات', icon: ShoppingCart, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', isCurrency: true },
  { key: 'customerCount' as const, title: 'عدد العملاء', icon: Users, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', isCurrency: false },
  { key: 'supplierCount' as const, title: 'عدد الموردين', icon: Building2, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', isCurrency: false },
  { key: 'inventoryValue' as const, title: 'قيمة المخزون', icon: Package, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', isCurrency: true },
  { key: 'dueInvoices' as const, title: 'الفواتير المستحقة', icon: FileText, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', isCurrency: false },
]

function DashboardContent() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      if (res.ok) {
        setData(await res.json())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const statValues: Record<string, number> = data ? {
    totalSales: data.totalSales,
    totalPurchases: data.totalPurchases,
    customerCount: data.customerCount,
    supplierCount: data.supplierCount,
    inventoryValue: data.inventoryValue,
    dueInvoices: data.dueInvoices,
  } : {}

  const activityIcons: Record<string, { icon: ElementType; color: string; bg: string }> = {
    stock_movement: { icon: ArrowLeftRight, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    sales_invoice: { icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    purchase_invoice: { icon: Receipt, color: 'text-orange-600', bg: 'bg-orange-50' },
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-l from-emerald-600 to-emerald-500 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">مرحباً بك في نظام ERP</h2>
            <p className="text-emerald-100 mt-0.5">
              إليك ملخص أعمالك اليوم
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {dashboardStatDefs.map((stat) => (
          <Card
            key={stat.key}
            className={cn(
              'border shadow-sm hover:shadow-md transition-shadow duration-200',
              stat.border
            )}
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={cn('p-3 rounded-xl', stat.bg)}>
                  <stat.icon className={cn('h-6 w-6', stat.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-500 truncate">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">
                    {loading ? '...' : stat.isCurrency ? formatCurrency(statValues[stat.key] || 0) : String(statValues[stat.key] || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                آخر الأنشطة
              </CardTitle>
              <Activity className="h-4 w-4 text-slate-400" />
            </div>
          </CardHeader>
          <CardContent>
            {data && data.recentActivities.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {data.recentActivities.map((activity) => {
                  const ai = activityIcons[activity.type] || { icon: FileText, color: 'text-slate-600', bg: 'bg-slate-50' }
                  return (
                    <div key={activity.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className={cn('p-2 rounded-lg', ai.bg)}>
                        <ai.icon className={cn('h-4 w-4', ai.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{activity.description}</p>
                        <p className="text-xs text-slate-400">{formatDate(activity.date)}</p>
                      </div>
                      <span className="font-mono text-sm font-semibold text-slate-700">{formatCurrency(activity.amount)}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                <FileText className="h-12 w-12 mb-3 text-slate-200" />
                <p className="text-sm">لا توجد أنشطة حالياً</p>
                <p className="text-xs mt-1 text-slate-300">
                  ستظهر الأنشطة هنا عند إجراء عمليات في النظام
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                إجراءات سريعة
              </CardTitle>
              <Plus className="h-4 w-4 text-slate-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <QuickAction label="فاتورة بيع" icon={FileText} />
              <QuickAction label="فاتورة شراء" icon={Receipt} />
              <QuickAction label="قيد يومية" icon={BookOpen} />
              <QuickAction label="إضافة صنف" icon={Package} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function QuickAction({ label, icon: Icon }: { label: string; icon: ElementType }) {
  return (
    <button className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors duration-150 group">
      <div className="h-10 w-10 rounded-lg bg-slate-50 group-hover:bg-emerald-100 flex items-center justify-center transition-colors">
        <Icon className="h-5 w-5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
      </div>
      <span className="text-xs text-slate-500 group-hover:text-emerald-700 font-medium transition-colors">
        {label}
      </span>
    </button>
  )
}

// ─── Module Placeholder ──────────────────────────────────────────────────────

function ModulePlaceholder({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          <Plus className="h-4 w-4" />
          إضافة جديد
        </Button>
      </div>

      <Card className="border shadow-sm">
        <CardContent className="flex flex-col items-center justify-center h-72 text-slate-400">
          <div className="h-20 w-20 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
            <Package className="h-10 w-10 text-slate-200" />
          </div>
          <p className="text-lg font-medium text-slate-500">
            سيتم إضافة محتوى {title} قريباً
          </p>
          <p className="text-sm mt-1 text-slate-300">
            هذه الصفحة قيد التطوير
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function Home() {
  const {
    currentModule,
    currentView,
    sidebarOpen,
    setModule,
    setView,
    toggleSidebar,
  } = useAppStore()
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [mobileOpen, setMobileOpen] = useState(false)

  // ── Navigation Handlers ──

  const handleNavClick = (id: string, hasChildren: boolean) => {
    if (hasChildren) {
      setModule(id as Module)
      setExpandedItems((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      )
    } else {
      setModule(id as Module)
      setMobileOpen(false)
    }
  }

  const handleSubClick = (moduleId: string, viewId: string) => {
    setModule(moduleId as Module)
    setView(viewId)
    setMobileOpen(false)
  }

  const handleCollapsedNavClick = (id: string, hasChildren: boolean) => {
    if (hasChildren) {
      // Expand sidebar first, then navigate
      if (!sidebarOpen) {
        toggleSidebar()
      }
      setModule(id as Module)
      setExpandedItems((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      )
    } else {
      setModule(id as Module)
    }
  }

  // ── Current Title ──

  const currentTitle = currentView
    ? viewTitles[currentView] || currentView
    : moduleTitles[currentModule] || currentModule

  // ── Render Content ──

  const renderContent = () => {
    if (currentModule === 'dashboard' && !currentView) {
      return <DashboardContent />
    }
    // Settings views
    if (currentModule === 'settings') {
      switch (currentView) {
        case 'company':
          return <CompanyForm />
        case 'currencies':
          return <CurrenciesList />
        case 'uom':
          return <UOMList />
        case 'users':
          return <UsersList />
        case 'chart-of-accounts':
          return <ChartOfAccounts />
        default:
          return <ModulePlaceholder title={currentTitle} />
      }
    }
    // Inventory views
    if (currentModule === 'inventory') {
      switch (currentView) {
        case 'warehouses':
          return <WarehousesList />
        case 'categories':
          return <CategoriesList />
        case 'items':
          return <ItemsList />
        case 'stock-movements':
          return <StockMovementsList />
        case 'item-balances':
          return <ItemBalancesList />
        default:
          return <ModulePlaceholder title={currentTitle} />
      }
    }
    // Accounting views
    if (currentModule === 'accounting') {
      switch (currentView) {
        case 'journal-entries':
          return <JournalEntriesList />
        case 'chart-of-accounts':
          return <ChartOfAccounts />
        default:
          return <ModulePlaceholder title={currentTitle} />
      }
    }
    // Sales views
    if (currentModule === 'sales') {
      switch (currentView) {
        case 'customers':
          return <CustomersList />
        case 'sales-invoices':
          return <SalesInvoicesList />
        case 'receipt-vouchers':
          return <ReceiptVouchersList />
        default:
          return <ModulePlaceholder title={currentTitle} />
      }
    }
    // Purchases views
    if (currentModule === 'purchases') {
      switch (currentView) {
        case 'suppliers':
          return <SuppliersList />
        case 'purchase-invoices':
          return <PurchaseInvoicesList />
        case 'payment-vouchers':
          return <PaymentVouchersList />
        default:
          return <ModulePlaceholder title={currentTitle} />
      }
    }
    // Reports views
    if (currentModule === 'reports') {
      switch (currentView) {
        case 'trial-balance':
          return <TrialBalanceReport />
        case 'balance-sheet':
          return <BalanceSheetReport />
        case 'income-statement':
          return <IncomeStatementReport />
        case 'inventory-report':
          return <InventoryReport />
        case 'sales-report':
          return <SalesReport />
        case 'purchase-report':
          return <PurchaseReport />
        case 'customer-aging':
          return <CustomerAgingReport />
        case 'supplier-aging':
          return <SupplierAgingReport />
        default:
          return <ModulePlaceholder title={currentTitle} />
      }
    }
    return <ModulePlaceholder title={currentTitle} />
  }

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-slate-50">
      {/* ── Header ── */}
      <header className="h-14 border-b bg-white flex items-center px-4 gap-3 sticky top-0 z-40 shrink-0">
        {/* Mobile menu trigger */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0">
            <SheetTitle className="sr-only">القائمة الرئيسية</SheetTitle>
            {/* Mobile sidebar header */}
            <div className="h-14 flex items-center gap-3 px-4 border-b shrink-0">
              <div className="h-8 w-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <LayoutDashboard className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-emerald-700 text-lg">
                نظام ERP
              </span>
            </div>
            {/* Mobile navigation */}
            <ScrollArea className="h-[calc(100dvh-3.5rem)]">
              <SidebarNav
                currentModule={currentModule}
                currentView={currentView}
                expandedItems={expandedItems}
                onNavClick={handleNavClick}
                onSubClick={handleSubClick}
                isCollapsed={false}
              />
              {/* Mobile user section */}
              <div className="border-t p-3 mt-2">
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="h-8 w-8 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Users className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      مدير النظام
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      admin@erp.com
                    </p>
                  </div>
                  <LogOut className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        {/* Desktop sidebar toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="hidden md:flex"
        >
          {sidebarOpen ? (
            <PanelRightClose className="h-5 w-5" />
          ) : (
            <PanelRightOpen className="h-5 w-5" />
          )}
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <h1 className="text-lg font-semibold text-slate-900">{currentTitle}</h1>

        <div className="flex-1" />

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-slate-500" />
          <span className="absolute top-2 end-2 h-2 w-2 bg-red-500 rounded-full" />
        </Button>

        {/* User avatar */}
        <div className="hidden sm:flex items-center gap-2 ms-2">
          <div className="h-8 w-8 bg-emerald-100 rounded-full flex items-center justify-center">
            <Users className="h-4 w-4 text-emerald-600" />
          </div>
          <span className="text-sm font-medium text-slate-700">
            مدير النظام
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            'hidden md:flex flex-col bg-white border-l shrink-0 transition-all duration-300 overflow-hidden',
            sidebarOpen ? 'w-72' : 'w-[68px]'
          )}
        >
          {/* Sidebar header */}
          <div className="h-14 flex items-center px-4 border-b shrink-0">
            {sidebarOpen ? (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <LayoutDashboard className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-emerald-700 text-lg">
                  نظام ERP
                </span>
              </div>
            ) : (
              <div className="h-8 w-8 bg-emerald-600 rounded-lg flex items-center justify-center mx-auto">
                <LayoutDashboard className="h-4 w-4 text-white" />
              </div>
            )}
          </div>

          {/* Sidebar navigation */}
          <ScrollArea className="flex-1">
            <SidebarNav
              currentModule={currentModule}
              currentView={currentView}
              expandedItems={sidebarOpen ? expandedItems : []}
              onNavClick={
                sidebarOpen ? handleNavClick : handleCollapsedNavClick
              }
              onSubClick={handleSubClick}
              isCollapsed={!sidebarOpen}
            />
          </ScrollArea>

          {/* Sidebar footer - user section */}
          {sidebarOpen && (
            <div className="border-t p-3 shrink-0">
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="h-8 w-8 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Users className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    مدير النظام
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    admin@erp.com
                  </p>
                </div>
                <LogOut className="h-4 w-4 text-slate-400" />
              </div>
            </div>
          )}
          {!sidebarOpen && (
            <div className="border-t p-2 shrink-0">
              <button className="w-full flex items-center justify-center p-3 rounded-lg hover:bg-slate-50 transition-colors" title="مدير النظام">
                <div className="h-8 w-8 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Users className="h-4 w-4 text-emerald-600" />
                </div>
              </button>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">{renderContent()}</div>
        </main>
      </div>
    </div>
  )
}
