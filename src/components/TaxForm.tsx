'use client'

import { useState } from 'react'
import type { TaxInput, BusinessType } from '@/types/tax'

const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: 'retail',      label: '도소매업' },
  { value: 'food',        label: '음식점 / 제조업' },
  { value: 'service',     label: '서비스업 / 프리랜서' },
  { value: 'real_estate', label: '부동산임대업' },
]

interface Props {
  onSubmit: (input: TaxInput) => void
}

export default function TaxForm({ onSubmit }: Props) {
  const [form, setForm] = useState<TaxInput>({
    annualRevenue: 0,
    annualExpense: 0,
    businessType: 'service',
    deductions: 0,
  })

  function handleChange(key: keyof TaxInput, value: string | BusinessType) {
    setForm(prev => ({
      ...prev,
      [key]: typeof value === 'string' && key !== 'businessType'
        ? Number(value.replace(/,/g, '')) || 0
        : value,
    }))
  }

  function formatKRW(val: number) {
    return val > 0 ? val.toLocaleString('ko-KR') : ''
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
      <h2 className="text-lg font-semibold text-gray-800">기본 정보 입력</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">업종</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.businessType}
          onChange={e => handleChange('businessType', e.target.value as BusinessType)}
        >
          {BUSINESS_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">연간 매출 (원)</label>
        <input
          type="text"
          inputMode="numeric"
          placeholder="예: 50,000,000"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={formatKRW(form.annualRevenue)}
          onChange={e => handleChange('annualRevenue', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">연간 경비 (원)</label>
        <input
          type="text"
          inputMode="numeric"
          placeholder="예: 20,000,000"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={formatKRW(form.annualExpense)}
          onChange={e => handleChange('annualExpense', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          소득공제 <span className="text-gray-400 font-normal">(노란우산공제 등, 선택)</span>
        </label>
        <input
          type="text"
          inputMode="numeric"
          placeholder="예: 5,000,000"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={formatKRW(form.deductions ?? 0)}
          onChange={e => handleChange('deductions', e.target.value)}
        />
      </div>

      <button
        onClick={() => onSubmit(form)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-3 text-sm transition-colors"
      >
        세금 계산하기
      </button>
    </div>
  )
}
