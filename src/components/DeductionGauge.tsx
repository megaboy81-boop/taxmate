'use client'

import type { DeductionAnalysis } from '@/lib/deductionEngine'

function won(n: number) { return n.toLocaleString('ko-KR') + '원' }

interface Props {
  analysis: DeductionAnalysis
  annualRevenue: number
}

const PRIORITY_COLOR = { high: 'text-red-600 bg-red-50', medium: 'text-orange-600 bg-orange-50', low: 'text-gray-500 bg-gray-50' }
const PRIORITY_LABEL = { high: '⛔ 필수', medium: '⚠ 권장', low: '참고' }

export default function DeductionGauge({ analysis, annualRevenue }: Props) {
  const totalPossible = analysis.totalClaimedDeduction + analysis.totalAvailableDeduction
  const claimedPct = totalPossible > 0 ? (analysis.totalClaimedDeduction / totalPossible) * 100 : 0

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-800">절세 현황</h3>
        <p className="text-xs text-gray-400 mt-0.5">이미 받은 공제 vs 더 받을 수 있는 공제</p>
      </div>

      {/* 게이지 */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-blue-600 font-medium">공제 중 {won(analysis.totalClaimedDeduction)}</span>
          <span className="text-orange-500 font-medium">추가 가능 {won(analysis.totalAvailableDeduction)}</span>
        </div>
        <div className="h-3 bg-orange-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${claimedPct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>이미 절세 {won(analysis.alreadySavedTax)}</span>
          <span>추가 절세 가능 {won(analysis.totalPotentialTaxSaving)}</span>
        </div>
      </div>

      {/* 공제 항목별 */}
      <div className="space-y-2">
        {analysis.gaps.map(gap => (
          <div key={gap.type} className="rounded-xl border border-gray-100 p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${PRIORITY_COLOR[gap.priority]}`}>
                  {PRIORITY_LABEL[gap.priority]}
                </span>
                <span className="text-sm font-medium text-gray-800">{gap.label}</span>
              </div>
              {gap.taxSaving > 0 && (
                <span className="text-xs font-bold text-blue-600">절세 +{won(gap.taxSaving)}</span>
              )}
            </div>

            <p className="text-xs text-gray-500 mb-2">{gap.description}</p>

            <div className="flex items-center gap-2">
              {gap.maxLimit > 0 ? (
                <>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${gap.maxLimit > 0 ? Math.min((gap.claimed / gap.maxLimit) * 100, 100) : 0}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {won(gap.claimed)} / {won(gap.maxLimit)}
                  </span>
                </>
              ) : (
                <span className="text-xs text-gray-400">
                  {gap.claimed > 0 ? `납입 중 ${won(gap.claimed)}` : '미가입'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {analysis.totalPotentialTaxSaving > 0 && (
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl px-4 py-3 text-white">
          <p className="text-xs opacity-80">지금 바로 시작하면</p>
          <p className="text-lg font-bold">연 {won(analysis.totalPotentialTaxSaving)} 추가 절세</p>
          <p className="text-xs opacity-70 mt-0.5">공제 한도를 모두 채웠을 때 기준</p>
        </div>
      )}
    </div>
  )
}
