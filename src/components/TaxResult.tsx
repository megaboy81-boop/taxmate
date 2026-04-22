'use client'

import Link from 'next/link'
import type { TaxResult } from '@/types/tax'

const VAT_TYPE_LABEL = {
  general:    '일반과세자',
  simplified: '간이과세자',
  exempt:     '납부면제',
}

function won(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

function pct(n: number) {
  return (n * 100).toFixed(1) + '%'
}

interface Props {
  result: TaxResult
}

export default function TaxResult({ result }: Props) {
  const { vat, incomeTax, coaching } = result

  return (
    <div className="space-y-4">
      {/* 부가세 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-4">부가가치세</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">과세 유형</p>
            <p className="font-semibold text-gray-900 text-sm">{VAT_TYPE_LABEL[vat.vatType]}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">납부 예상액</p>
            <p className="font-bold text-blue-700 text-sm">{won(vat.estimatedVat)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">실효세율</p>
            <p className="font-semibold text-gray-900 text-sm">{pct(vat.effectiveRate)}</p>
          </div>
        </div>
      </div>

      {/* 종합소득세 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-4">종합소득세</h3>
        <div className="space-y-2 text-sm">
          <Row label="과세표준" value={won(incomeTax.taxableIncome)} />
          <Row label="세율 구간" value={incomeTax.bracketLabel} highlight />
          <Row label="소득세" value={won(incomeTax.incomeTax)} />
          <Row label="지방소득세" value={won(incomeTax.localTax)} />
          <div className="border-t border-gray-100 pt-2 mt-2">
            <Row label="합계" value={won(incomeTax.totalTax)} bold />
          </div>
        </div>
      </div>

      {/* 절세 코칭 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">절세 코칭</h3>
          {coaching.potentialSavings > 0 && (
            <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full">
              최대 {won(coaching.potentialSavings)} 절세 가능
            </span>
          )}
        </div>
        <div className="space-y-3">
          {coaching.tips.map((tip, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-xl bg-gray-50">
              <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                tip.priority === 'high' ? 'bg-red-500' :
                tip.priority === 'medium' ? 'bg-yellow-500' : 'bg-gray-400'
              }`} />
              <div>
                <p className="text-sm font-medium text-gray-800">{tip.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{tip.description}</p>
                {tip.estimatedSaving > 0 && (
                  <p className="text-xs text-green-600 font-semibold mt-1">
                    예상 절세 {won(tip.estimatedSaving)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        <Link href="/coaching"
          className="mt-4 flex items-center justify-center gap-2 w-full bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-sm rounded-xl py-2.5 transition-colors">
          <span>💬</span> AI에게 더 자세히 물어보기
        </Link>
      </div>
    </div>
  )
}

function Row({ label, value, highlight, bold }: {
  label: string; value: string; highlight?: boolean; bold?: boolean
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`${bold ? 'font-bold text-gray-900' : 'text-gray-800'} ${highlight ? 'text-blue-600 font-semibold' : ''}`}>
        {value}
      </span>
    </div>
  )
}
