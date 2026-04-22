'use client'

import type { DualComparison } from '@/lib/taxEngine'

function won(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

interface Props {
  dual: DualComparison
}

export default function DualCompare({ dual }: Props) {
  const { rateMethod, bookMethod, betterMethod, savingAmount, tierLabel } = dual

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-gray-800">신고 방식 비교</h3>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{tierLabel}</span>
      </div>
      <p className="text-xs text-gray-400 mb-4">두 방식 중 유리한 방법을 선택할 수 있습니다</p>

      <div className="grid grid-cols-2 gap-3">
        {/* 경비율 방식 */}
        <div className={`rounded-xl p-4 border-2 ${betterMethod === 'rate' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xs font-bold text-gray-600">경비율 방식</span>
            {betterMethod === 'rate' && (
              <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">유리</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-3">국세청 기준 경비율 적용 (영수증 없이)</p>
          <p className={`text-lg font-bold ${betterMethod === 'rate' ? 'text-blue-700' : 'text-gray-700'}`}>
            {won(rateMethod.totalTax)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{rateMethod.bracketLabel}</p>
        </div>

        {/* 간편장부 방식 */}
        <div className={`rounded-xl p-4 border-2 ${betterMethod === 'book' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xs font-bold text-gray-600">간편장부 방식</span>
            {betterMethod === 'book' && (
              <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">유리</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-3">실제 지출 경비 기반 (영수증 보관 필요)</p>
          <p className={`text-lg font-bold ${betterMethod === 'book' ? 'text-blue-700' : 'text-gray-700'}`}>
            {won(bookMethod.totalTax)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{bookMethod.bracketLabel}</p>
        </div>
      </div>

      {savingAmount > 0 && betterMethod !== 'equal' && (
        <div className="mt-3 bg-green-50 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
          {betterMethod === 'rate' ? '경비율' : '간편장부'} 방식이 <span className="font-bold">{won(savingAmount)}</span> 더 유리합니다
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">
        * 세무사 상담으로 본인 상황에 맞는 방식을 확정하세요
      </p>
    </div>
  )
}
