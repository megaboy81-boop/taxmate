'use client'

import type { BusinessType } from '@/types/tax'

const VAT_EXEMPT = 48_000_000
const VAT_SIMPLIFIED = 104_000_000
const METER_MAX = 150_000_000

interface Props {
  revenue: number
  businessType: BusinessType
}

export default function VatMeter({ revenue }: Props) {
  const clamped = Math.min(revenue, METER_MAX)
  const pct = (clamped / METER_MAX) * 100

  let type: string
  let color: string
  let desc: string

  if (revenue < VAT_EXEMPT) {
    type = '납부면제'
    color = 'bg-green-500'
    desc = '부가세 납부 면제 (신고는 필요)'
  } else if (revenue < VAT_SIMPLIFIED) {
    type = '간이과세자'
    color = 'bg-yellow-500'
    desc = '실효세율 1.5~4% (업종별 상이)'
  } else {
    type = '일반과세자'
    color = 'bg-red-500'
    desc = '부가세 10% 납부 의무'
  }

  const exemptPct = (VAT_EXEMPT / METER_MAX) * 100
  const simplPct = (VAT_SIMPLIFIED / METER_MAX) * 100

  return (
    <div className="bg-gray-50 rounded-xl p-4 mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500">부가세 과세 유형</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${color}`}>{type}</span>
      </div>

      {/* 슬라이더 바 */}
      <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden mb-1">
        <div className="absolute left-0 top-0 h-full bg-green-200" style={{ width: `${exemptPct}%` }} />
        <div className="absolute top-0 h-full bg-yellow-200" style={{ left: `${exemptPct}%`, width: `${simplPct - exemptPct}%` }} />
        <div className="absolute top-0 h-full bg-red-200" style={{ left: `${simplPct}%`, right: 0 }} />
        {/* 현재 위치 */}
        <div className={`absolute top-0 h-full w-1 ${color} rounded-full shadow`} style={{ left: `${Math.min(pct, 98)}%` }} />
      </div>

      <div className="flex justify-between text-xs text-gray-400 mb-2">
        <span>0</span>
        <span>4,800만</span>
        <span>1억 400만</span>
        <span>1.5억+</span>
      </div>

      <p className="text-xs text-gray-600">{desc}</p>

      {revenue >= VAT_SIMPLIFIED * 0.85 && revenue < VAT_SIMPLIFIED && (
        <p className="text-xs text-orange-500 font-medium mt-1">
          ⚠ 연매출 1억 400만 초과 시 내년부터 일반과세자 전환
        </p>
      )}
    </div>
  )
}
