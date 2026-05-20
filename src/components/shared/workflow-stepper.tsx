'use client'

import { cn } from '@/lib/utils'
import { Check, ArrowLeft } from 'lucide-react'

// ─── Workflow Step ─────────────────────────────────────────────────────────────

export interface WorkflowStep {
  label: string
  status: 'completed' | 'current' | 'upcoming'
  number?: string // Document number if exists
}

// ─── Workflow Stepper ──────────────────────────────────────────────────────────

interface WorkflowStepperProps {
  steps: WorkflowStep[]
  className?: string
}

export default function WorkflowStepper({ steps, className }: WorkflowStepperProps) {
  if (!steps || steps.length <= 1) return null

  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto pb-1', className)}>
      {steps.map((step, idx) => (
        <div key={idx} className="flex items-center gap-1 shrink-0">
          {/* Step badge */}
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                step.status === 'completed'
                  ? 'bg-emerald-500 text-white'
                  : step.status === 'current'
                  ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500'
                  : 'bg-slate-100 text-slate-400'
              )}
            >
              {step.status === 'completed' ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                idx + 1
              )}
            </div>
            <span
              className={cn(
                'text-xs font-medium whitespace-nowrap',
                step.status === 'completed'
                  ? 'text-emerald-600'
                  : step.status === 'current'
                  ? 'text-slate-900'
                  : 'text-slate-400'
              )}
            >
              {step.label}
              {step.number && (
                <span className="text-slate-400 font-mono mr-1">({step.number})</span>
              )}
            </span>
          </div>

          {/* Arrow connector */}
          {idx < steps.length - 1 && (
            <ArrowLeft className="h-3.5 w-3.5 text-slate-300 shrink-0 mx-0.5" />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Workflow Presets ──────────────────────────────────────────────────────────

export function getPurchaseWorkflow(current: string, data?: { poNumber?: string; prNumber?: string; piNumber?: string }): WorkflowStep[] {
  return [
    { label: 'أمر الشراء', status: current === 'PO' ? 'current' : (data?.poNumber ? 'completed' : 'upcoming'), number: data?.poNumber },
    { label: 'إذن الاستلام', status: current === 'PR' ? 'current' : (data?.prNumber ? 'completed' : 'upcoming'), number: data?.prNumber },
    { label: 'فاتورة الشراء', status: current === 'PI' ? 'current' : (data?.piNumber ? 'completed' : 'upcoming'), number: data?.piNumber },
  ]
}

export function getSalesWorkflow(current: string, data?: { soNumber?: string; dnNumber?: string; siNumber?: string }): WorkflowStep[] {
  return [
    { label: 'أمر البيع', status: current === 'SO' ? 'current' : (data?.soNumber ? 'completed' : 'upcoming'), number: data?.soNumber },
    { label: 'إذن الصرف', status: current === 'DN' ? 'current' : (data?.dnNumber ? 'completed' : 'upcoming'), number: data?.dnNumber },
    { label: 'فاتورة البيع', status: current === 'SI' ? 'current' : (data?.siNumber ? 'completed' : 'upcoming'), number: data?.siNumber },
  ]
}

export function getMaterialRequestWorkflow(current: string, data?: { mrNumber?: string }): WorkflowStep[] {
  return [
    { label: 'طلب المواد', status: current === 'MR' ? 'current' : (data?.mrNumber ? 'completed' : 'upcoming'), number: data?.mrNumber },
    { label: 'اعتماد', status: 'upcoming' },
    { label: 'تلبية', status: 'upcoming' },
  ]
}

export function getPickListWorkflow(current: string, data?: { pkNumber?: string }): WorkflowStep[] {
  return [
    { label: 'قائمة التحضير', status: current === 'PK' ? 'current' : (data?.pkNumber ? 'completed' : 'upcoming'), number: data?.pkNumber },
    { label: 'تحضير', status: 'upcoming' },
    { label: 'اكتمال', status: 'upcoming' },
  ]
}
