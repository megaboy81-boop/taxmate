'use client'

import type { Transaction } from '@/types/transaction'

function won(n: number) { return n.toLocaleString('ko-KR') + '원' }

interface Props {
  transactions: Transaction[]
}

export default function YearlyCompare({ transactions }: Props) {
  const outflows = transactions.filter(t => t.amount > 0)

  // 연도별 집계
  const byYear: Record<number, { total: number; deductible: number; foreign: number; subscription: number }> = {}
  for (const tx of outflows) {
    if (!byYear[tx.year]) byYear[tx.year] = { total: 0, deductible: 0, foreign: 0, subscription: 0 }
    byYear[tx.year].total += tx.amount
    if (tx.isDeductible) byYear[tx.year].deductible += tx.amount
    if (tx.isForeign) byYear[tx.year].foreign += tx.amount
    if (tx.isSubscription) byYear[tx.year].subscription += tx.amount
  }

  const years = Object.keys(byYear).map(Number).sort()
  if (years.length < 2) return null

  const latestYear = years[years.length - 1]
  const prevYear = years[years.length - 2]
  const latest = byYear[latestYear]
  const prev = byYear[prevYear]

  function diff(a: number, b: number) {
    const delta = a - b
    const pct = b > 0 ? Math.round((delta / b) * 100) : 0
    const up = delta > 0
    return { delta, pct, up }
  }

  const totalDiff = diff(latest.total, prev.total)
  const deductDiff = diff(latest.deductible, prev.deductible)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <h3 className="font-semibold text-gray-800 mb-1">전년도 비교</h3>
      <p className="text-xs text-gray-400 mb-4">{prevYear}년 vs {latestYear}년</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-500 mb-1">총 지출</p>
          <p className="text-sm font-bold text-gray-800">{won(latest.total)}</p>
          <p className={`text-xs mt-0.5 font-medium ${totalDiff.up ? 'text-red-500' : 'text-green-500'}`}>
            {totalDiff.up ? '▲' : '▼'} {Math.abs(totalDiff.pct)}% ({won(Math.abs(totalDiff.delta))})
          </p>
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-500 mb-1">경비 인정</p>
          <p className="text-sm font-bold text-gray-800">{won(latest.deductible)}</p>
          <p className={`text-xs mt-0.5 font-medium ${deductDiff.up ? 'text-blue-500' : 'text-orange-500'}`}>
            {deductDiff.up ? '▲' : '▼'} {Math.abs(deductDiff.pct)}% ({won(Math.abs(deductDiff.delta))})
          </p>
        </div>

        {latest.foreign > 0 && (
          <div className="rounded-xl bg-red-50 p-3">
            <p className="text-xs text-red-500 mb-1">해외결제</p>
            <p className="text-sm font-bold text-red-700">{won(latest.foreign)}</p>
            <p className="text-xs text-red-400 mt-0.5">부가세 환급 불가</p>
          </div>
        )}

        {latest.subscription > 0 && (
          <div className="rounded-xl bg-indigo-50 p-3">
            <p className="text-xs text-indigo-500 mb-1">구독 서비스</p>
            <p className="text-sm font-bold text-indigo-700">{won(latest.subscription)}</p>
            <p className="text-xs text-indigo-400 mt-0.5">월 {won(Math.round(latest.subscription / 12))}</p>
          </div>
        )}
      </div>

      {/* 지출 비율 바 비교 */}
      <div className="mt-4 space-y-2">
        {[
          { label: prevYear + '년', data: prev },
          { label: latestYear + '년', data: latest },
        ].map(({ label, data }) => {
          const max = Math.max(prev.total, latest.total)
          return (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-12 flex-shrink-0">{label}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${max > 0 ? (data.total / max) * 100 : 0}%` }} />
              </div>
              <span className="text-xs text-gray-600 w-24 text-right flex-shrink-0">{won(data.total)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
