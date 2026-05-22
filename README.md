<div align="center">

<img src="public/erp-banner.png" alt="Control ERP Banner" width="100%" />

<br/>

# Control ERP

### نظام إدارة موارد المؤسسات المتكامل

**Comprehensive Enterprise Resource Planning System**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql)](https://supabase.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://www.prisma.io/)
[![Bun](https://img.shields.io/badge/Bun-Runtime-F9F1E0?logo=bun)](https://bun.sh/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[المميزات](#-المميزات) • [الوحدات](#-الوحدات) • [التقنيات](#-التقنيات) • [التثبيت](#-التثبيت) • [الاستخدام](#-الاستخدام) • [API](#-api-reference) • [المساهمة](#-المساهمة)

</div>

---

## 🌟 نبذة عن النظام

**Control ERP** هو نظام إدارة موارد مؤسسات متكامل مبني بتقنيات حديثة، مصمم خصيصاً للسوق العربي مع دعم كامل للغة العربية واتجاه RTL. يوفر النظام إدارة شاملة للحسابات والمخازن والمبيعات والمشتريات والاستثمارات مع نظام تقارير متقدم.

> **Control ERP** is a full-featured Enterprise Resource Planning system built with modern technologies, designed for the Arabic market with full RTL support. It provides comprehensive management of accounting, inventory, sales, purchases, and investments with advanced reporting.

---

## ✨ المميزات

| الميزة | الوصف |
|--------|-------|
| 🌐 **دعم عربي كامل** | واجهة عربية بالكامل مع دعم RTL، تنسيقات أرقام وتواريخ عربية |
| 🏢 **متعدد الشركات** | إدارة عدة شركات من نفس النظام مع عزل بيانات كامل |
| 🔐 **صلاحيات متقدمة** | نظام RBAC مع 7 أدوار و35 صلاحية مختلفة |
| 📊 **محاسبة مزدوجة** | نظام قيود يومية مزدوج مع ترحيل تلقائي وعكس قيود |
| 📦 **مخازن هرمية** | مخازن ببنية شجرية (مخزن ← منطقة ← رف ← رفوف ← صندوق) |
| 💰 **تكلفة FIFO** | نظام تكلفة بطبقات FIFO مع تتبع دقيق لتكلفة الأصناف |
| 🧾 **دورة مستندات كاملة** | أوامر بيع/شراء ← فواتير ← إيصالات ← مرتجعات |
| 📈 **تقارير مالية** | ميزان مراجعة، ميزانية عمومية، قائمة دخل، أرصدة عملاء/موردين |
| 🏦 **إدارة استثمارات** | إدارة مستثمرين، رؤوس أموال، توزيع أرباح، سحوبات |
| 🎨 **واجهة حديثة** | تصميم متجاوب مع shadcn/ui و Tailwind CSS |
| ⚡ **أداء عالي** | مبني على Bun runtime مع Supabase PostgreSQL |

---

## 📦 الوحدات

### 📊 لوحة التحكم (Dashboard)
- مؤشرات أداء رئيسية (مبيعات، مشتريات، عملاء، موردين)
- قيمة المخزون والفواتير المستحقة
- سجل الأنشطة الأخيرة
- إجراءات سريعة للعمليات الشائعة

### 📒 المحاسبة (Accounting)
- **شجرة الحسابات** — بنية هرمية مع أنواع (أصول، التزامات، حقوق ملكية، إيرادات، مصروفات)
- **القيود اليومية** — نظام قيد مزدوج (مدين/دائن) مع حالات (مسودة، مرحّل، معكوس)
- **ترحيل تلقائي** — إنشاء قيود تلقائياً من الفواتير والعمليات
- **عكس القيود** — إمكانية عكس القيود المرحّلة

### 🏭 المخازن (Inventory)
- **الأصناف** — إدارة أصناف مع صور وأكواد باركود متعددة
- **المخازن** — بنية هرمية (مخزن ← منطقة ← رف ← رفوف ← صندوق)
- **الفئات** — تصنيف هرمي للأصناف
- **أرصدة الأصناف** — تتبع الكمية والتكلفة المتوسطة لكل صنف في كل مخزن
- **طبقات FIFO** — تتبع تكلفة طبقات الشراء بدقة
- **تحويلات المخزون** — نقل بين المخازن مع سير عمل (مسودة ← مؤكد)
- **طلبات المواد** — نظام طلبات مع موافقات (مسودة ← قيد الانتظار ← معتمد ← منفذ)
- **أذون الصرف** — إذن صرف بضاعة من المخزن
- **أذون الاستلام** — إذن استلام بضاعة في المخزن
- **قوائم التحضير** — قوائم تحضير طلبات مع تتبع الكمية المحضّرة

### 💰 المبيعات (Sales)
- **العملاء** — إدارة بيانات العملاء مع حدود ائتمان وشروط دفع
- **أوامر البيع** — إنشاء أوامر بيع مع سير عمل كامل
- **فواتير البيع** — فواتير مع ضريبة قيمة مضافة (14%) وتتبع مدفوعات
- **إيصالات القبض** — تسجيل تحصيلات من العملاء
- **مرتجعات المبيعات** — إرجاع مع ربط بالفاتورة أو أمر البيع الأصلي

### 🛒 المشتريات (Purchases)
- **الموردون** — إدارة بيانات الموردين مع شروط دفع
- **أوامر الشراء** — إنشاء أوامر شراء مع تتبع الاستلام
- **فواتير الشراء** — فواتير شراء مع ضريبة وتتبع مدفوعات
- **إيصالات الدفع** — تسجيل مدفوعات للموردين
- **مرتجعات المشتريات** — إرجاع مع ربط بالفاتورة أو إذن الاستلام

### 🏦 المستثمرون (Investors)
- **إدارة المستثمرين** — بيانات المستثمرين مع الرقم القومي والحالة
- **الاستثمارات** — تسجيل رؤوس الأموال (نقدي، بنكي، أصول)
- **توزيع الأرباح** — حساب وتوزيع الأرباح حسب نسب الملكية
- **السحوبات** — سحب رأس مال أو أرباح
- **دفتر المستثمر** — سجل حركات كل مستثمر

### 📈 التقارير (Reports)
| التقرير | الوصف |
|---------|-------|
| ميزان المراجعة | أرصدة الحسابات مع المدين والدائن |
| الميزانية العمومية | الأصول مقابل الالتزامات وحقوق الملكية |
| قائمة الدخل | الإيرادات مقابل المصروفات وصافي الربح |
| تقرير المخازن | أرصدة وقيم الأصناف في المخازن |
| تقرير المبيعات | إجمالي المبيعات والفواتير والمرتجعات |
| تقرير المشتريات | إجمالي المشتريات والفواتير والمرتجعات |
| أرصدة العملاء | تقارير تقادم ديون العملاء |
| أرصدة الموردين | تقارير تقادم التزامات الموردين |

### ⚙️ الإعدادات (Settings)
- **بيانات الشركة** — تعديل اسم وعنوان وبيانات ضريبية
- **العملات** — إدارة عملات مع أسعار صرف
- **وحدات القياس** — وحدات قياس مخصصة
- **المستخدمون** — إنشاء وإدارة المستخدمين والأدوار
- **شجرة الحسابات** — إعداد الحسابات الافتراضية

---

## 🏗️ التقنيات

| الطبقة | التقنية |
|---------|---------|
| **الإطار** | Next.js 16 (App Router) |
| **اللغة** | TypeScript 5 |
| **الواجهة** | React 19 + shadcn/ui (45+ مكون) |
| **التنسيق** | Tailwind CSS 4 |
| **إدارة الحالة** | Zustand 5 |
| **قاعدة البيانات** | PostgreSQL (Supabase) + Prisma ORM 6 |
| **المصادقة** | NextAuth.js 4 + JWT + Custom Tokens |
| **الجداول** | TanStack Table 8 |
| **الرسوم البيانية** | Recharts 2 |
| **النماذج** | React Hook Form 7 + Zod 4 |
| **الأيقونات** | Lucide React |
| **التواريخ** | date-fns 4 |
| **الحركات** | Framer Motion 12 |
| **السحب والإفلات** | dnd-kit |
| **الإشعارات** | Sonner |
| **التصدير** | SheetJS (xlsx) |
| **الصور** | Sharp |
| **الوقت الحقيقي** | WebSocket/Socket.io (جاهز) |

---

## 🗄️ نموذج البيانات

```
┌─────────────────────────────────────────────────────────┐
│                    Control ERP Schema                    │
├─────────────┬─────────────┬─────────────┬───────────────┤
│  Auth &     │  Accounting │   Sales     │   Purchases   │
│  Multi-Co   │             │             │               │
├─────────────┼─────────────┼─────────────┼───────────────┤
│ User        │ Account     │ Customer    │ Supplier      │
│ AccessToken │ JournalEntry│ SalesOrder  │ PurchaseOrder │
│ Company     │ JournalLine │ SalesInvoice│ PurchaseInv.  │
│ CompanyUser │             │ SalesReturn │ PurchaseReturn│
│             │             │ ReceiptVouch│ PaymentVoucher│
├─────────────┼─────────────┼─────────────┼───────────────┤
│  Inventory  │  Investors  │  Settings   │               │
├─────────────┼─────────────┼─────────────┤               │
│ Item        │ Investor    │ Currency    │               │
│ ItemCode    │ Investment  │ UnitOfMeasure│              │
│ ItemBalance │ ProfitDist. │             │               │
│ FifoLayer   │ InvestorShare│            │               │
│ Warehouse   │ Withdrawal  │             │               │
│ ItemCategory│             │             │               │
│ StockMovement│            │             │               │
│ StockTransfer│           │             │               │
│ MaterialReq │             │             │               │
│ DeliveryNote│             │             │               │
│ PurchaseRcpt│             │             │               │
│ PickList    │             │             │               │
└─────────────┴─────────────┴─────────────┴───────────────┘
```

---

## 🔐 نظام الصلاحيات

### الأدوار (7 أدوار)

| الدور | الوصف |
|------|-------|
| `super_admin` | مدير عام — صلاحيات كاملة |
| `admin` | مدير — إدارة شاملة |
| `accountant` | محاسب — إدارة القيود والحسابات |
| `sales` | مبيعات — إدارة العملاء والفواتير |
| `purchase` | مشتريات — إدارة الموردين والطلبات |
| `inventory` | مخازن — إدارة الأصناف والمخازن |
| `viewer` | مشاهدة — عرض فقط |

### الصلاحيات (35 صلاحية)

```
settings: view, edit
inventory: view, create, edit, delete
accounting: view, create, post, reverse
sales: view, create, edit, confirm, collect
purchases: view, create, edit, confirm, pay
reports: view
investors: view, create, manage
users: view, create, edit, delete
companies: manage
```

---

## 🚀 التثبيت

### المتطلبات

- [Bun](https://bun.sh/) >= 1.0
- [Node.js](https://nodejs.org/) >= 18
- [PostgreSQL](https://www.postgresql.org/) أو حساب [Supabase](https://supabase.com/)

### خطوات التثبيت

```bash
# 1. استنساخ المشروع
git clone https://github.com/im3lol/control-erp.git
cd control-erp

# 2. تثبيت التبعيات
bun install

# 3. إعداد المتغيرات البيئية
cp .env.example .env
# عدّل ملف .env ببيانات قاعدة البيانات
```

### إعداد قاعدة البيانات (Supabase)

```env
# .env
DATABASE_URL="postgresql://postgres:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
```

> **ملاحظة**: استخدم الاتصال المجمّع (port 6543) للتشغيل، والاتصال المباشر (port 5432) للترحيلات.

```bash
# 4. إنشاء قاعدة البيانات
bun run db:push

# 5. بذر البيانات الأولية
curl -X POST http://localhost:3000/api/seed

# 6. تشغيل المشروع
bun run dev
```

### إعداد قاعدة البيانات (PostgreSQL محلي)

```env
DATABASE_URL="postgresql://user:password@localhost:5432/control_erp"
```

---

## 📖 الاستخدام

### تسجيل الدخول الافتراضي

| البيان | القيمة |
|--------|--------|
| اسم المستخدم | `admin` |
| كلمة المرور | `admin123` |

> ⚠️ **غيّر كلمة المرور الافتراضية فوراً في بيئة الإنتاج!**

### سير العمل النموذجي

```
1. إعداد الشركة ← بيانات الشركة، العملات، وحدات القياس
2. إعداد الحسابات ← شجرة الحسابات الافتراضية
3. إضافة المخازن ← مخازن ومناطق وأرفف
4. إضافة الأصناف ← أصناف مع أكواد وأسعار
5. إضافة الموردين والعملاء
6. بدء العمليات ← أوامر شراء/بيع ← فواتير ← مدفوعات
7. مراجعة التقارير ← ميزان المراجعة، الميزانية، قائمة الدخل
```

---

## 📡 API Reference

### المصادقة

```http
POST /api/auth/login          # تسجيل الدخول (Token-based)
GET  /api/auth/companies       # شركات المستخدم
```

### المحاسبة

```http
GET/POST  /api/accounting/accounts           # شجرة الحسابات
GET/POST  /api/accounting/journal-entries     # القيود اليومية
GET/PUT   /api/accounting/journal-entries/[id] # تفاصيل قيد
GET       /api/accounting/analytics           # تحليلات المحاسبة
```

### المبيعات

```http
GET/POST  /api/sales/customers       # العملاء
GET/POST  /api/sales/orders          # أوامر البيع
GET/PUT   /api/sales/orders/[id]     # تفاصيل أمر البيع
GET/POST  /api/sales/invoices        # فواتير البيع
GET/PUT   /api/sales/invoices/[id]   # تفاصيل الفاتورة
GET/POST  /api/sales/returns         # مرتجعات المبيعات
GET/POST  /api/sales/receipts        # إيصالات القبض
GET       /api/sales/analytics       # تحليلات المبيعات
```

### المشتريات

```http
GET/POST  /api/purchases/suppliers      # الموردون
GET/POST  /api/purchases/orders         # أوامر الشراء
GET/PUT   /api/purchases/orders/[id]    # تفاصيل أمر الشراء
GET/POST  /api/purchases/invoices       # فواتير الشراء
GET/PUT   /api/purchases/invoices/[id]  # تفاصيل الفاتورة
GET/POST  /api/purchases/returns        # مرتجعات المشتريات
GET/POST  /api/purchases/payments       # إيصالات الدفع
GET       /api/purchases/analytics      # تحليلات المشتريات
```

### المخازن

```http
GET/POST  /api/inventory/items              # الأصناف
POST      /api/inventory/items/image        # رفع صورة صنف
GET       /api/inventory/item-balances      # أرصدة الأصناف
GET/POST  /api/inventory/categories         # الفئات
GET/POST  /api/inventory/warehouses         # المخازن
GET       /api/inventory/stock-movements    # حركات المخزون
GET/POST  /api/inventory/stock-transfers    # تحويلات المخزون
GET/POST  /api/inventory/material-requests  # طلبات المواد
GET/POST  /api/inventory/delivery-notes     # أذون الصرف
GET/POST  /api/inventory/purchase-receipts  # أذون الاستلام
GET/POST  /api/inventory/pick-lists         # قوائم التحضير
GET       /api/inventory/analytics          # تحليلات المخازن
```

### المستثمرون

```http
GET/POST  /api/investors                    # المستثمرون
GET/PUT   /api/investors/[id]               # تفاصيل مستثمر
GET       /api/investors/[id]/ledger        # دفتر المستثمر
GET/POST  /api/investors/investments        # الاستثمارات
GET/POST  /api/investors/distributions      # توزيعات الأرباح
GET/POST  /api/investors/withdrawals        # السحوبات
```

### التقارير

```http
GET  /api/reports/trial-balance     # ميزان المراجعة
GET  /api/reports/balance-sheet     # الميزانية العمومية
GET  /api/reports/income-statement  # قائمة الدخل
GET  /api/reports/inventory-report  # تقرير المخازن
GET  /api/reports/sales-report      # تقرير المبيعات
GET  /api/reports/purchase-report   # تقرير المشتريات
GET  /api/reports/customer-aging    # أرصدة العملاء
GET  /api/reports/supplier-aging    # أرصدة الموردين
```

### الإعدادات والشركات

```http
GET/PUT   /api/settings/company     # بيانات الشركة
GET/POST  /api/settings/currencies  # العملات
GET/POST  /api/settings/uom         # وحدات القياس
GET/POST  /api/settings/users       # المستخدمون
GET/POST  /api/companies            # الشركات
POST      /api/companies/setup      # إعداد شركة جديدة
```

---

## 📁 هيكل المشروع

```
control-erp/
├── prisma/
│   └── schema.prisma          # نموذج قاعدة البيانات (40+ نموذج)
├── src/
│   ├── app/
│   │   ├── page.tsx           # الصفحة الرئيسية (SPA)
│   │   ├── layout.tsx         # التخطيط الرئيسي (RTL)
│   │   └── api/               # API Routes (REST)
│   │       ├── auth/          # المصادقة
│   │       ├── accounting/    # المحاسبة
│   │       ├── sales/         # المبيعات
│   │       ├── purchases/     # المشتريات
│   │       ├── inventory/     # المخازن
│   │       ├── investors/     # المستثمرون
│   │       ├── reports/       # التقارير
│   │       ├── settings/      # الإعدادات
│   │       └── companies/     # الشركات
│   ├── components/
│   │   ├── ui/                # shadcn/ui (45+ مكون)
│   │   ├── accounting/        # مكونات المحاسبة
│   │   ├── inventory/         # مكونات المخازن
│   │   ├── sales/             # مكونات المبيعات
│   │   ├── purchases/         # مكونات المشتريات
│   │   ├── investors/         # مكونات المستثمرين
│   │   ├── reports/           # مكونات التقارير
│   │   ├── settings/          # مكونات الإعدادات
│   │   └── shared/            # مكونات مشتركة
│   ├── lib/
│   │   ├── db.ts              # Prisma Client (Supabase)
│   │   ├── auth.ts            # NextAuth Config
│   │   ├── auth-guard.ts      # حماية المسارات
│   │   ├── permissions.ts     # نظام الصلاحيات (RBAC)
│   │   ├── store.ts           # Zustand State
│   │   ├── api-client.ts      # HTTP Client مع Auth
│   │   ├── erp-utils.ts       # أدوات ERP
│   │   └── utils.ts           # أدوات عامة
│   ├── hooks/                 # React Hooks
│   └── types/                 # TypeScript Types
├── public/
│   ├── uploads/               # ملفات مرفوعة
│   └── erp-banner.png         # بانر المشروع
└── package.json
```

---

## 🏛️ العمارة

```
┌──────────────────────────────────────────────┐
│                  Frontend                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ React 19 │ │ Zustand  │ │ shadcn/ui    │ │
│  │   SPA    │ │  Store   │ │ Components   │ │
│  └────┬─────┘ └────┬─────┘ └──────┬───────┘ │
│       └─────────────┼──────────────┘         │
│                     │                         │
├─────────────────────┼─────────────────────────┤
│                  API Layer                     │
│  ┌─────────────────┴─────────────────────┐   │
│  │        Next.js API Routes (REST)      │   │
│  │  ┌──────────┐  ┌───────────────────┐  │   │
│  │  │ Auth     │  │ Business Logic    │  │   │
│  │  │ Guard    │  │ & Validation      │  │   │
│  │  └──────────┘  └───────────────────┘  │   │
│  └──────────────────┬────────────────────┘   │
│                     │                         │
├─────────────────────┼─────────────────────────┤
│                  Data Layer                    │
│  ┌─────────────────┴─────────────────────┐   │
│  │          Prisma ORM 6                  │   │
│  │  ┌─────────────────────────────────┐   │   │
│  │  │   Supabase PostgreSQL           │   │   │
│  │  │   (Pooled + Direct Connections) │   │   │
│  │  └─────────────────────────────────┘   │   │
│  └────────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

---

## 🔄 دورة المستندات

```
                    المبيعات                              المشتريات
                    ────────                              ────────

  أمر بيع ──→ فاتورة بيع ──→ إيصال قبض     أمر شراء ──→ فاتورة شراء ──→ إيصال دفع
     │            │                               │            │
     │            ├──→ إذن صرف                      │            ├──→ إذن استلام
     │            │                               │            │
     │            └──→ مرتجع مبيعات                 │            └──→ مرتجع مشتريات
     │                                            │
     └──→ قائمة تحضير                              └──→ طبقة FIFO
```

---

## 🛡️ الأمان

- **مصادقة مزدوجة**: NextAuth (Cookie-based) + Access Token (Header-based)
- **JWT Sessions**: مدة صلاحية 24 ساعة
- **RBAC**: تحكم في الوصول قائم على الأدوار مع 35 صلاحية
- **حماية المسارات**: كل API route محمية بـ `requireAuth()` أو `requirePermission()`
- **عزل البيانات**: عزل كامل بين الشركات على مستوى الاستعلامات
- **رفع آمن**: التحقق من أنواع الملفات المرفوعة

---

## 🤝 المساهمة

نسعد بمساهماتكم! اتبع الخطوات التالية:

1. **Fork** المشروع
2. أنشئ فرع جديد (`git checkout -b feature/amazing-feature`)
3. التزم بالتغييرات (`git commit -m 'Add amazing feature'`)
4. ارفع الفرع (`git push origin feature/amazing-feature`)
5. افتح **Pull Request**

### معايير الكود

- TypeScript صارم في كل الملفات
- استخدام shadcn/ui للمكونات
- اتباع هيكل المشروع الموجود
- التعليقات بالعربية أو الإنجليزية

---

## 📄 الترخيص

هذا المشروع مرخص تحت رخصة MIT — راجع ملف [LICENSE](LICENSE) للتفاصيل.

---

<div align="center">

**صُنع بـ ❤️ للمجتمع العربي**

[⬆ ارجع للأعلى](#-control-erp)

</div>
