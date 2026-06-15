'use client'

import { useState } from 'react'
import Link from 'next/link'
import { calcIncomeTax, calcVat, calcDualComparison } from '@/lib/taxEngine'
import { calcSmeReduction, calcCardIssuanceCredit, calcDeemedInputCredit, type SavingEstimate } from '@/lib/taxCredits'
import { estimateSocialInsurance, projectNextYearHealth } from '@/lib/socialInsurance'
import { assessCompliance, getTaxCalendar } from '@/lib/compliance'
import { BUSINESS_TYPES } from '@/lib/taxData'
import type { BusinessType, TaxInput, CalcStep } from '@/types/tax'

const won = (n: number) => Math.round(n).toLocaleString('ko-KR')

interface DiagInput {
  revenue: number; expense: number; businessType: BusinessType; priorRevenue: number
  spouse: boolean; dependents: number; children: number
  pensionSavings: number; irp: number; region: 'metro' | 'non_metro'
}

function diagnose(p: DiagInput) {
  const input: TaxInput = {
    annualRevenue: p.revenue, annualExpense: p.expense, businessType: p.businessType,
    priorYearRevenue: p.priorRevenue,
    personalDeduction: { spouse: p.spouse, dependents: p.dependents },
    credits: { childrenOver8: p.children, pensionSavings: p.pensionSavings, irp: p.irp, electronicFiling: true },
    region: p.region,
  }
  const incomeTax = calcIncomeTax(input)
  const vat = calcVat(p.revenue, p.businessType)
  const dual = calcDualComparison(input)
  const compliance = assessCompliance({ annualRevenue: p.revenue, priorYearRevenue: p.priorRevenue, businessType: p.businessType })
  const calendar = getTaxCalendar(compliance.vatType)
  const insurance = estimateSocialInsurance(incomeTax.grossIncome, 2026)
  const lastYearIncome = Math.max(0, p.priorRevenue - p.expense)
  const nextHealth = projectNextYearHealth(incomeTax.grossIncome, lastYearIncome || incomeTax.grossIncome)
  const credits: SavingEstimate[] = [
    calcSmeReduction({ businessType: p.businessType, calculatedTax: incomeTax.calculatedTax, region: p.region }),
    calcCardIssuanceCredit({ cardAndCashSales: Math.round(p.revenue * 0.8), priorYearSupply: p.priorRevenue, businessType: p.businessType, payableVat: vat.estimatedVat }),
    calcDeemedInputCredit({ businessType: p.businessType, taxBase: p.revenue, exemptAgriPurchase: p.businessType === 'food' ? Math.round(p.revenue * 0.3) : 0, vatType: vat.vatType }),
  ].filter(c => c.applicable)
  // 세금 적립 알리미: 이미 계산된 값들의 합 (신규 계산 없음)
  const annualBurden = incomeTax.totalTax + vat.estimatedVat + insurance.annualHealth + insurance.annualPension
  const monthlySetAside = Math.round(annualBurden / 12)
  return { incomeTax, vat, dual, compliance, calendar, insurance, nextHealth, credits, annualBurden, monthlySetAside }
}
type Diagnosis = ReturnType<typeof diagnose>

function Steps({ steps }: { steps: CalcStep[] }) {
  const [open, setOpen] = useState(false)
  if (!steps.length) return null
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} className="text-xs text-blue-600 hover:underline">
        {open ? '▲ 계산 근거 접기' : '▼ 계산 근거·법조문 보기'}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 bg-gray-50 rounded-lg p-3">
          {steps.map((s, i) => (
            <div key={i} className="flex justify-between gap-3 text-xs">
              <span className="text-gray-600">
                {s.label}
                {s.basis ? <span className="text-gray-400"> · {s.basis}</span> : null}
                {s.formula ? <span className="block text-gray-400 mt-0.5">{s.formula}</span> : null}
              </span>
              <span className={`font-medium tabular-nums whitespace-nowrap ${s.amount < 0 ? 'text-red-500' : 'text-gray-800'}`}>{won(s.amount)}원</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, hint }: { label: string; value: number; onChange: (n: number) => void; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}{hint ? <span className="text-gray-300"> {hint}</span> : null}</span>
      <input
        type="number" inputMode="numeric" value={value || ''}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-right tabular-nums focus:border-blue-400 outline-none"
      />
    </label>
  )
}

export default function DetailedPage() {
  const [f, setF] = useState<DiagInput>({
    revenue: 60_000_000, expense: 20_000_000, businessType: 'service', priorRevenue: 60_000_000,
    spouse: false, dependents: 0, children: 0, pensionSavings: 0, irp: 0, region: 'non_metro',
  })
  const [r, setR] = useState<Diagnosis | null>(null)
  const set = <K extends keyof DiagInput>(k: K, v: DiagInput[K]) => setF(prev => ({ ...prev, [k]: v }))

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="w-full max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-gray-900">정밀 세금 진단</h1>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← 처음으로</Link>
        </div>
        <p className="text-xs text-gray-500 mb-4">인적공제·세액공제·절세공제·건강보험까지 반영한 정밀 추정. 모든 결과는 <b>계산 근거</b>를 함께 보여줍니다.</p>

        {/* 입력 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          <label className="block">
            <span className="text-xs text-gray-500">업종</span>
            <select value={f.businessType} onChange={e => set('businessType', e.target.value as BusinessType)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-400 outline-none bg-white">
              {Object.entries(BUSINESS_TYPES).map(([k, info]) => <option key={k} value={k}>{info.label}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="연 매출" hint="(부가세 포함)" value={f.revenue} onChange={v => set('revenue', v)} />
            <Field label="연 경비(실액)" value={f.expense} onChange={v => set('expense', v)} />
            <Field label="직전연도 매출" hint="(경비율 판정)" value={f.priorRevenue} onChange={v => set('priorRevenue', v)} />
            <Field label="부양가족 수" hint="(본인·배우자 제외)" value={f.dependents} onChange={v => set('dependents', v)} />
            <Field label="8세이상 자녀 수" value={f.children} onChange={v => set('children', v)} />
            <Field label="연금저축 납입" value={f.pensionSavings} onChange={v => set('pensionSavings', v)} />
            <Field label="IRP 납입" value={f.irp} onChange={v => set('irp', v)} />
          </div>
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-sm text-gray-600">
              <input type="checkbox" checked={f.spouse} onChange={e => set('spouse', e.target.checked)} /> 배우자 공제
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-600">
              <input type="checkbox" checked={f.region === 'metro'} onChange={e => set('region', e.target.checked ? 'metro' : 'non_metro')} /> 수도권 사업장
            </label>
          </div>
          <button onClick={() => setR(diagnose(f))}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl text-sm hover:bg-blue-700 transition-colors">
            정밀 진단하기
          </button>
        </div>

        {r && (
          <div className="space-y-3 mt-4">
            {/* 세금 적립 알리미 — "지금 얼마 떼어둬야" */}
            <div className="bg-blue-600 rounded-2xl p-4 text-white">
              <h2 className="font-bold">예상 연 세금·4대보험 부담</h2>
              <div className="text-2xl font-bold mt-1 tabular-nums">{won(r.annualBurden)}원</div>
              <p className="text-xs text-blue-100 mt-0.5">소득세 + 부가세 + 건강보험 + 국민연금 합산 추정</p>
              <div className="mt-2 bg-white/15 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-sm">매달 따로 떼어둘 권장액</span>
                <span className="font-bold tabular-nums">{won(r.monthlySetAside)}원 / 월</span>
              </div>
            </div>
            {/* 종합소득세 */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex justify-between items-baseline">
                <h2 className="font-bold text-gray-900">종합소득세</h2>
                <span className="text-xl font-bold text-blue-600 tabular-nums">{won(r.incomeTax.totalTax)}원</span>
              </div>
              <div className="mt-1 text-xs text-gray-500 grid grid-cols-2 gap-x-3 gap-y-0.5">
                <span>소득금액 {won(r.incomeTax.grossIncome)}원</span>
                <span>과세표준 {won(r.incomeTax.taxableIncome)}원</span>
                <span>공제 {won(r.incomeTax.totalDeduction)}원</span>
                <span>세액공제 {won(r.incomeTax.taxCredits)}원</span>
              </div>
              <Steps steps={r.incomeTax.steps} />
            </div>

            {/* 부가가치세 */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex justify-between items-baseline">
                <h2 className="font-bold text-gray-900">부가가치세 <span className="text-xs font-normal text-gray-400">({r.compliance.vatTypeLabel})</span></h2>
                <span className="text-xl font-bold text-gray-900 tabular-nums">{won(r.vat.estimatedVat)}원</span>
              </div>
              <Steps steps={r.vat.steps} />
            </div>

            {/* 경비율 vs 장부 */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <h2 className="font-bold text-gray-900">경비율 vs 장부 비교</h2>
              <p className="text-sm text-gray-600 mt-1">
                {r.dual.tierLabel} · {r.dual.rateMethodLabel} 방식 세금 {won(r.dual.rateMethod.totalTax)}원 vs 장부 {won(r.dual.bookMethod.totalTax)}원
              </p>
              <p className="text-sm font-semibold text-green-600 mt-1">
                {r.dual.betterMethod === 'equal' ? '두 방식 세금이 동일합니다' : `${r.dual.betterMethod === 'book' ? '장부(실경비)' : r.dual.rateMethodLabel} 방식이 ${won(r.dual.savingAmount)}원 유리`}
              </p>
            </div>

            {/* 절세 인텔리전스 */}
            {r.credits.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <h2 className="font-bold text-gray-900">💡 놓치기 쉬운 절세 (참고용)</h2>
                <div className="mt-2 space-y-2">
                  {r.credits.map((c, i) => (
                    <div key={i} className="text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-700">{c.label} <span className="text-xs text-gray-400">{c.basis}</span></span>
                        <span className="font-semibold text-amber-700 tabular-nums">~{won(c.amount)}원</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{c.note}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-2">※ 절세 권유가 아닌 참고용 추정입니다. 적용 요건은 세무사 확인이 필요합니다.</p>
              </div>
            )}

            {/* 사회보험 */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <h2 className="font-bold text-gray-900">건강보험·국민연금 추정 <span className="text-xs font-normal text-gray-400">(2026)</span></h2>
              <div className="mt-1 text-sm text-gray-600 grid grid-cols-2 gap-x-3">
                <span>건강보험 월 {won(r.insurance.monthlyHealth)}원</span>
                <span>국민연금 월 {won(r.insurance.monthlyPension)}원</span>
              </div>
              {r.nextHealth.deltaMonthly > 1000 && (
                <p className="text-sm text-red-500 mt-2">⚠️ {r.nextHealth.warning}</p>
              )}
              <p className="text-[11px] text-gray-400 mt-2">{r.insurance.disclaimer}</p>
              <Steps steps={r.insurance.steps} />
            </div>

            {/* 컴플라이언스 + 캘린더 */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <h2 className="font-bold text-gray-900">신고 의무 & 일정</h2>
              <div className="mt-1 text-sm text-gray-600 space-y-0.5">
                <p>과세유형: <b>{r.compliance.vatTypeLabel}</b></p>
                <p>{r.compliance.bookkeepingLabel}</p>
              </div>
              {r.compliance.messages.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {r.compliance.messages.map((m, i) => <li key={i} className="text-xs text-orange-600">• {m}</li>)}
                </ul>
              )}
              <div className="mt-3 border-t border-gray-100 pt-2">
                <p className="text-xs text-gray-400 mb-1">올해 챙길 세무 일정</p>
                <div className="space-y-0.5">
                  {r.calendar.map((e, i) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <span className="text-gray-400 tabular-nums w-12">{e.month}/{e.day}</span>
                      <span className="text-gray-700">{e.title}</span>
                      <span className="text-gray-400">— {e.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 text-center px-4">
              본 결과는 일반 추정용 참고자료이며 실제 신고 금액과 다를 수 있습니다. 정확한 신고는 홈택스 또는 세무사 확인이 필요합니다.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
