/**
 * compliance.ts — 신고 의무·과세유형·세무 일정 판정
 * "단발 계산기 → 연중 세무 파트너"(1인사업자 전문가 제안)의 토대.
 */
import {
  BUSINESS_TYPES, EXPENSE_GROUP_THRESHOLDS,
  VAT_SIMPLIFIED_THRESHOLD, VAT_EXEMPT_THRESHOLD, VAT_SIMPLIFIED_EXCLUDED,
} from './taxData'
import type { BusinessType, VatType } from '@/types/tax'

const won = (n: number) => Math.round(n).toLocaleString('ko-KR')

export interface ComplianceStatus {
  vatType: VatType
  vatTypeLabel: string
  bookkeeping: 'double_entry' | 'simple_book'
  bookkeepingLabel: string
  isSincereTarget: boolean
  messages: string[]   // 마일스톤·경계 알림
}

export function assessCompliance(opts: {
  annualRevenue: number
  priorYearRevenue?: number
  businessType: BusinessType
}): ComplianceStatus {
  const businessType = opts.businessType
  const sn = (n: number | undefined) => (Number.isFinite(n) && (n as number) > 0 ? (n as number) : 0)
  const annualRevenue = sn(opts.annualRevenue)
  const prior = opts.priorYearRevenue !== undefined ? sn(opts.priorYearRevenue) : annualRevenue
  const group = BUSINESS_TYPES[businessType].group
  const th = EXPENSE_GROUP_THRESHOLDS[group]
  const messages: string[] = []

  // 과세유형 — 직전연도 공급대가 기준으로 판정 (현재 매출은 전망/경계 알림에만 사용)
  const judgeRevenue = prior
  const simplifiedExcluded = VAT_SIMPLIFIED_EXCLUDED.includes(businessType)
  let vatType: VatType
  let vatTypeLabel: string
  if (judgeRevenue >= VAT_SIMPLIFIED_THRESHOLD || simplifiedExcluded) {
    vatType = 'general'; vatTypeLabel = simplifiedExcluded ? '일반과세자(간이배제 업종)' : '일반과세자'
  } else if (judgeRevenue >= VAT_EXEMPT_THRESHOLD) {
    vatType = 'simplified'; vatTypeLabel = '간이과세자'
  } else {
    vatType = 'exempt'; vatTypeLabel = '간이과세자(납부의무 면제)'
  }

  // 장부 의무
  const bookkeeping = prior >= th.doubleEntryThreshold ? 'double_entry' : 'simple_book'
  const bookkeepingLabel = bookkeeping === 'double_entry'
    ? `복식부기 의무 (${group}군 직전수입 ${won(th.doubleEntryThreshold)} 이상)`
    : `간편장부 대상 (${group}군 직전수입 ${won(th.doubleEntryThreshold)} 미만)`

  // 성실신고확인대상
  const isSincereTarget = annualRevenue >= th.sincereThreshold
  if (isSincereTarget) {
    messages.push(`⚠️ 성실신고확인대상입니다 (${group}군 ${won(th.sincereThreshold)} 이상). 종합소득세 신고기한이 6월 30일로 연장되며, 성실신고확인서 미제출 시 가산세(사업소득 산출세액 상당액의 5%와 수입금액의 0.02% 중 큰 금액)가 부과됩니다.`)
  }

  // 마일스톤·경계 알림
  if (vatType === 'exempt' && annualRevenue > VAT_EXEMPT_THRESHOLD * 0.9) {
    messages.push(`곧 부가세 납부의무 면제 기준(${won(VAT_EXEMPT_THRESHOLD)})을 넘어설 수 있습니다. 초과 시 부가세 납부가 시작됩니다.`)
  }
  if (vatType === 'simplified' && annualRevenue > VAT_SIMPLIFIED_THRESHOLD * 0.9) {
    messages.push(`곧 일반과세 전환 기준(${won(VAT_SIMPLIFIED_THRESHOLD)})에 근접합니다. 전환 시 부가세 신고가 연 2회로 늘고 매입세액공제 방식이 달라지니, 전자세금계산서 수취를 미리 챙기세요.`)
  }
  if (bookkeeping === 'simple_book' && prior > th.doubleEntryThreshold * 0.9) {
    messages.push(`곧 복식부기 의무 구간에 진입합니다. 복식부기로 신고하면 기장세액공제(산출세액 20%, 한도 100만)도 받을 수 있습니다.`)
  }

  return { vatType, vatTypeLabel, bookkeeping, bookkeepingLabel, isSincereTarget, messages }
}

export interface TaxEvent {
  month: number
  day: number
  title: string
  desc: string
}

/** 과세유형 맞춤 연간 세무 일정 (개인화 — 노이즈 줄이기) */
export function getTaxCalendar(vatType: VatType): TaxEvent[] {
  const events: TaxEvent[] = [
    { month: 5, day: 31, title: '종합소득세 신고·납부', desc: '전년도 소득 종합소득세 확정신고 (성실신고확인대상은 6/30)' },
    { month: 11, day: 30, title: '종합소득세 중간예납', desc: '상반기 추정소득 기준 (중간예납세액 50만원 미만 면제)' },
  ]
  if (vatType === 'general') {
    events.push({ month: 1, day: 25, title: '부가세 2기 확정신고', desc: '전년 7~12월분' })
    events.push({ month: 4, day: 25, title: '부가세 예정고지/신고', desc: '직전기 납부세액의 50% 자동고지' })
    events.push({ month: 7, day: 25, title: '부가세 1기 확정신고', desc: '당해 1~6월분' })
    events.push({ month: 10, day: 25, title: '부가세 예정고지/신고', desc: '직전기 납부세액의 50% 자동고지' })
  } else {
    // 간이과세자(납부면제 포함) — 납부의무가 면제돼도 신고의무는 있음
    events.push({
      month: 1, day: 25, title: '부가세 신고(간이)',
      desc: vatType === 'exempt' ? '납부는 면제되나 연 1회 신고의무는 있음' : '전년도분 연 1회 신고',
    })
  }
  return events.sort((a, b) => a.month - b.month || a.day - b.day)
}
