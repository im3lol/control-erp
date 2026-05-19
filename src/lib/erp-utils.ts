// Auto-numbering helpers
export function generateDocNumber(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-EG', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Format date
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

// Get status badge color
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    POSTED: 'bg-green-100 text-green-800',
    PARTIAL_PAID: 'bg-orange-100 text-orange-800',
    PAID: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
    REVERSED: 'bg-gray-100 text-gray-800',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

// Get status Arabic label
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: 'مسودة',
    CONFIRMED: 'مؤكدة',
    POSTED: 'مرحل',
    PARTIAL_PAID: 'مدفوع جزئياً',
    PAID: 'مدفوع',
    CANCELLED: 'ملغية',
    REVERSED: 'معكوس',
  }
  return labels[status] || status
}

// Role Arabic labels
export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: 'مدير',
    accountant: 'محاسب',
    sales: 'بائع',
    purchase: 'مستلم مشتريات',
    inventory: 'أمين مخزن',
    viewer: 'مشاهد',
  }
  return labels[role] || role
}

// Account type labels
export function getAccountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    ASSET: 'أصول',
    LIABILITY: 'خصوم',
    EQUITY: 'حقوق ملكية',
    REVENUE: 'إيرادات',
    EXPENSE: 'مصروفات',
  }
  return labels[type] || type
}
