'use client'

import { useState } from 'react'
import TaxResult from './TaxResult'
import DualCompare from './DualCompare'
import VatMeter from './VatMeter'
import { calcTax, calcDualComparison } from '@/lib/taxEngine'
import type { TaxInput, BusinessType, TaxResult as TaxResultType } from '@/types/tax'
import type { DualComparison } from '@/lib/taxEngine'

// 세분화 업종
const BUSINESS_OPTIONS = [
  { group: '음식업', items: [
    { value: 'food', label: '음식점 / 식당' },
    { value: 'food', label: '카페 / 음료' },
    { value: 'food', label: '배달 전문점' },
  ]},
  { group: '소매 / 유통', items: [
    { value: 'retail', label: '소매점 / 편의점' },
    { value: 'retail', label: '온라인 쇼핑몰' },
    { value: 'retail', label: '도매업' },
  ]},
  { group: '서비스업', items: [
    { value: 'service', label: '미용 / 뷰티' },
    { value: 'service', label: '학원 / 교육' },
    { value: 'service', label: '세탁 / 청소' },
    { value: 'service', label: '수리 / AS' },
  ]},
  { group: '프리랜서', items: [
    { value: 'service', label: 'IT / 개발' },
    { value: 'service', label: '디자인 / 영상' },
    { value: 'service', label: '글쓰기 / 크리에이터' },
    { value: 'service', label: '강사 / 코치' },
  ]},
  { group: '기타', items: [
    { value: 'real_estate', label: '부동산 임대' },
    { value: 'service', label: '건설 / 인테리어' },
    { value: 'retail', label: '제조업' },
  ]},
]

type InputMode = 'monthly' | 'ytd'

interface FormState {
  businessLabel: string
  businessType: BusinessType
  inputMode: InputMode
  monthlyRevenue: number
  ytdRevenue: number
  currentMonth: number
  fixedExpense: number
  variableExpense: number
  yellowUmbrella: boolean
  pension: number
}

const INIT: FormState = {
  businessLabel: '',
  businessType: 'service',
  inputMode: 'monthly',
  monthlyRevenue: 0,
  ytdRevenue: 0,
  currentMonth: new Date().getMonth() + 1,
  fixedExpense: 0,
  variableExpense: 0,
  yellowUmbrella: false,
  pension: 0,
}

function numInput(val: number) {
  return val > 0 ? val.toLocaleString('ko-KR') : ''
}

function parseNum(s: string) {
  return Number(s.replace(/,/g, '')) || 0
}

function estimateAnnual(form: FormState): number {
  if (form.inputMode === 'monthly') {
    return form.monthlyRevenue * 12
  }
  if (form.currentMonth <= 0) return 0
  return Math.round((form.ytdRevenue / form.currentMonth) * 12)
}

export default function QuickWizard() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(INIT)
  const [result, setResult] = useState<TaxResultType | null>(null)
  const [dual, setDual] = useState<DualComparison | null>(null)

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  function calcResult() {
    const annualRevenue = estimateAnnual(form)
    const annualExpense = (form.fixedExpense + form.variableExpense) * 12
    const deductions = (form.yellowUmbrella ? 5_000_000 : 0) + form.pension
    const input: TaxInput = { annualRevenue, annualExpense, businessType: form.businessType, deductions }
    setResult(calcTax(input))
    setDual(calcDualComparison(input))
    setStep(5)
  }

  const annualEst = estimateAnnual(form)

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      {/* 헤더 */}
      {step < 5 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} className="text-gray-400 hover:text-gray-600 text-sm">← 이전</button>
            )}
            <span className="text-xs text-gray-400 ml-auto">{step} / 4</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${(step / 4) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Step 1: 업종 */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">어떤 업종이세요?</h2>
          <div className="space-y-3">
            {BUSINESS_OPTIONS.map(group => (
              <div key={group.group}>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">{group.group}</p>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map(item => (
                    <button
                      key={item.label}
                      onClick={() => { set('businessLabel', item.label); set('businessType', item.value as BusinessType); setStep(2) }}
                      className={`text-left px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors
                        ${form.businessLabel === item.label
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: 수입 */}
      {step === 2 && (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-gray-900">수입이 얼마나 되세요?</h2>

          <div className="flex gap-2">
            {(['monthly', 'ytd'] as InputMode[]).map(m => (
              <button key={m} onClick={() => set('inputMode', m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors
                  ${form.inputMode === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                {m === 'monthly' ? '이번 달 매출' : '올해 누적 매출'}
              </button>
            ))}
          </div>

          {form.inputMode === 'monthly' ? (
            <div>
              <label className="block text-sm text-gray-600 mb-1">이번 달 평균 매출 (원)</label>
              <input type="text" inputMode="numeric" placeholder="예: 3,000,000"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={numInput(form.monthlyRevenue)}
                onChange={e => set('monthlyRevenue', parseNum(e.target.value))} />
              {form.monthlyRevenue > 0 && (
                <p className="mt-2 text-sm text-blue-600 font-medium">
                  → 연간 예상 매출: {(form.monthlyRevenue * 12).toLocaleString('ko-KR')}원
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">올해 {form.currentMonth}월까지 누적 매출 (원)</label>
                <input type="text" inputMode="numeric" placeholder="예: 18,000,000"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={numInput(form.ytdRevenue)}
                  onChange={e => set('ytdRevenue', parseNum(e.target.value))} />
              </div>
              {form.ytdRevenue > 0 && (
                <p className="text-sm text-blue-600 font-medium">
                  → 연간 예상 매출: {annualEst.toLocaleString('ko-KR')}원
                </p>
              )}
            </div>
          )}

          {annualEst > 0 && (
            <VatMeter revenue={annualEst} businessType={form.businessType} />
          )}

          <button onClick={() => setStep(3)}
            disabled={annualEst === 0}
            className="w-full bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl py-3 text-sm transition-colors">
            다음
          </button>
        </div>
      )}

      {/* Step 3: 지출 */}
      {step === 3 && (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-gray-900">월 지출이 얼마나 되세요?</h2>

          <div>
            <label className="block text-sm text-gray-600 mb-1">고정 지출 / 월 (임대료, 인건비, 통신비 등)</label>
            <input type="text" inputMode="numeric" placeholder="예: 1,500,000"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={numInput(form.fixedExpense)}
              onChange={e => set('fixedExpense', parseNum(e.target.value))} />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">변동 지출 / 월 (재료비, 광고비, 소모품 등)</label>
            <input type="text" inputMode="numeric" placeholder="예: 500,000"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={numInput(form.variableExpense)}
              onChange={e => set('variableExpense', parseNum(e.target.value))} />
          </div>

          {(form.fixedExpense + form.variableExpense) > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
              월 경비 합계: <span className="font-semibold text-gray-900">{(form.fixedExpense + form.variableExpense).toLocaleString('ko-KR')}원</span>
              <span className="text-gray-400"> → 연 {((form.fixedExpense + form.variableExpense) * 12).toLocaleString('ko-KR')}원</span>
            </div>
          )}

          <button onClick={() => setStep(4)}
            className="w-full bg-blue-600 text-white font-semibold rounded-xl py-3 text-sm transition-colors">
            다음
          </button>
        </div>
      )}

      {/* Step 4: 공제 */}
      {step === 4 && (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-gray-900">절세 항목 확인</h2>
          <p className="text-sm text-gray-500">해당되는 항목을 체크하세요. 세금을 줄일 수 있습니다.</p>

          <div className="space-y-3">
            <button onClick={() => set('yellowUmbrella', !form.yellowUmbrella)}
              className={`w-full text-left p-4 rounded-xl border transition-colors ${form.yellowUmbrella ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${form.yellowUmbrella ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                  {form.yellowUmbrella && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">노란우산공제 가입 중</p>
                  <p className="text-xs text-gray-500 mt-0.5">연 최대 500만원 소득공제 적용</p>
                </div>
              </div>
            </button>

            <div className="p-4 rounded-xl border border-gray-200 bg-white">
              <p className="text-sm font-semibold text-gray-800 mb-2">연금저축 + IRP 연간 납입액</p>
              <input type="text" inputMode="numeric" placeholder="예: 3,000,000 (최대 9,000,000)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={numInput(form.pension)}
                onChange={e => set('pension', parseNum(e.target.value))} />
            </div>
          </div>

          <button onClick={calcResult}
            className="w-full bg-blue-600 text-white font-bold rounded-xl py-3.5 text-sm transition-colors hover:bg-blue-700">
            세금 계산하기 →
          </button>
        </div>
      )}

      {/* Step 5: 결과 */}
      {step === 5 && result && dual && (
        <div>
          <div className="mb-6 flex items-center gap-3">
            <button onClick={() => { setStep(1); setResult(null); setDual(null); setForm(INIT) }} className="text-sm text-gray-400 hover:text-gray-600">← 다시 계산</button>
            <div className="flex-1 text-right">
              <span className="text-xs text-gray-400">{form.businessLabel} · 연 예상 {annualEst.toLocaleString('ko-KR')}원</span>
            </div>
          </div>
          <DualCompare dual={dual} />
          <div className="mt-4">
            <TaxResult result={result} />
          </div>
          <p className="mt-6 text-center text-xs text-gray-400">본 결과는 참고용이며 실제 신고는 세무사 확인이 필요합니다.</p>
        </div>
      )}
    </div>
  )
}
