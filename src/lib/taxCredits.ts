/**
 * taxCredits.ts — 자영업자가 놓치기 쉬운 3대 절세 세액공제·감면 계산기
 * (중소기업특별세액감면 / 신용카드발행세액공제 / 의제매입세액공제)
 *
 * ⚠️ 세무사법 안전: 본 모듈은 "참고용 계산 도구"이며 절세 권유가 아니다.
 *    각 결과의 note에 요건·제외사유를 명시하고, 적용 여부는 세무사 확인이 필요하다.
 *    불명확 업종(needs_review)은 과다공제 방지를 위해 미적용 처리하고 확인 안내만 제공한다.
 */
import {
  SME_SPECIAL_REDUCTION, SME_ELIGIBILITY, CARD_ISSUANCE_CREDIT, CARD_CREDIT_ELIGIBLE,
  DEEMED_INPUT_CREDIT, BUSINESS_TYPES,
} from './taxData'
import type { BusinessType, CalcStep } from '@/types/tax'

const won = (n: number) => Math.round(n).toLocaleString('ko-KR')
const safe = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

export interface SavingEstimate {
  applicable: boolean
  needsReview?: boolean    // 업종코드 확인 필요 (미적용)
  amount: number
  label: string
  basis: string
  note: string
  steps: CalcStep[]
}

/** 중소기업특별세액감면 (조특법 §7) — 업종 적격성 whitelist 기반 */
export function calcSmeReduction(opts: {
  businessType: BusinessType
  calculatedTax: number
  businessIncomeRatio?: number
  region?: 'metro' | 'non_metro'
  isSmallBusiness?: boolean
}): SavingEstimate {
  const { businessType } = opts
  const calculatedTax = safe(opts.calculatedTax)
  const ratio = Math.min(Math.max(opts.businessIncomeRatio ?? 1, 0), 1)
  const region = opts.region ?? 'non_metro'
  const isSmall = opts.isSmallBusiness ?? true
  const label = '중소기업특별세액감면'
  const basis = '조특법 §7'
  const elig = SME_ELIGIBILITY[businessType]

  if (elig === 'excluded') {
    return { applicable: false, amount: 0, label, basis, note: `${BUSINESS_TYPES[businessType].label}은 감면 제외 업종입니다.`, steps: [] }
  }
  if (elig === 'needs_review') {
    return { applicable: false, needsReview: true, amount: 0, label, basis, note: `${BUSINESS_TYPES[businessType].label}은 세부 업종코드에 따라 감면 대상 여부가 갈립니다(전문직·소비성서비스 제외). 적용 여부는 세무사 확인이 필요합니다.`, steps: [] }
  }

  const table = isSmall ? SME_SPECIAL_REDUCTION.smallBusiness : SME_SPECIAL_REDUCTION.mediumBusiness
  const rkey = region === 'metro' ? 'metro' : 'nonMetro'
  const rate = elig === 'wholesale_retail' ? table.wholesaleRetailMedical[rkey] : table.others[rkey]
  const reducibleTax = calculatedTax * ratio
  const amount = Math.min(Math.round(reducibleTax * rate), SME_SPECIAL_REDUCTION.cap)
  const steps: CalcStep[] = [
    { label: '감면대상 산출세액', formula: `산출세액 ${won(calculatedTax)} × 사업소득비율 ${(ratio * 100).toFixed(0)}%`, amount: reducibleTax },
    { label: `감면율 ${(rate * 100).toFixed(0)}%`, basis, formula: `× ${(rate * 100).toFixed(0)}% (한도 ${won(SME_SPECIAL_REDUCTION.cap)})`, amount },
  ]

  return {
    applicable: amount > 0,
    amount,
    label,
    basis,
    note: '상시근로자 감소 시 감면액이 차감되며, 최저한세가 적용됩니다. 정확한 감면율은 업종코드·기업규모에 따라 다르므로 세무사 확인이 필요합니다.',
    steps,
  }
}

/** 신용카드·현금영수증 발행세액공제 (부가법 §46) — 최종소비자 업종 + 납부세액 한도 */
export function calcCardIssuanceCredit(opts: {
  cardAndCashSales: number
  priorYearSupply?: number
  businessType?: BusinessType
  payableVat?: number          // 공제 전 납부세액 — 초과공제(환급) 방지 한도
}): SavingEstimate {
  const cardAndCashSales = safe(opts.cardAndCashSales)
  const prior = safe(opts.priorYearSupply ?? cardAndCashSales)
  const label = '신용카드·현금영수증 발행세액공제'
  const basis = '부가법 §46'

  if (opts.businessType && !CARD_CREDIT_ELIGIBLE.includes(opts.businessType)) {
    return { applicable: false, amount: 0, label, basis, note: '소매·음식·숙박 등 최종소비자 대상 업종만 해당합니다.', steps: [] }
  }
  if (prior > CARD_ISSUANCE_CREDIT.revenueCeiling) {
    return { applicable: false, amount: 0, label, basis, note: `직전연도 공급가액 ${won(CARD_ISSUANCE_CREDIT.revenueCeiling)} 초과 시 제외됩니다.`, steps: [] }
  }

  const raw = cardAndCashSales * CARD_ISSUANCE_CREDIT.rate
  let amount = Math.min(Math.round(raw), CARD_ISSUANCE_CREDIT.annualCap)
  let capped = false
  // 발행세액공제는 납부세액을 한도로 하며 환급되지 않음
  if (opts.payableVat !== undefined) {
    const payable = safe(opts.payableVat)
    if (amount > payable) { amount = payable; capped = true }
  }
  const steps: CalcStep[] = [
    { label: '공제액', basis, formula: `${won(cardAndCashSales)} × ${(CARD_ISSUANCE_CREDIT.rate * 100).toFixed(1)}% (연 한도 ${won(CARD_ISSUANCE_CREDIT.annualCap)})`, amount },
  ]
  return {
    applicable: amount > 0,
    amount,
    label,
    basis,
    note: `발급액의 ${(CARD_ISSUANCE_CREDIT.rate * 100).toFixed(1)}%, 연 ${won(CARD_ISSUANCE_CREDIT.annualCap)} 한도 (${CARD_ISSUANCE_CREDIT.sunsetDate}까지 한시). 납부세액 한도 내에서만 공제되며 환급되지 않습니다.${capped ? ' (납부세액 한도로 제한됨)' : ''}`,
    steps,
  }
}

/** 의제매입세액공제 (부가법 §42) — 면세 농·축·수·임산물 매입분 */
export function calcDeemedInputCredit(opts: {
  businessType: BusinessType
  taxBase: number
  exemptAgriPurchase: number
  vatType?: 'general' | 'simplified' | 'exempt'   // 간이·면제는 배제(2021.7~)
}): SavingEstimate {
  const taxBase = safe(opts.taxBase)
  const exemptAgriPurchase = safe(opts.exemptAgriPurchase)
  const label = '의제매입세액공제'
  const basis = '부가법 §42'
  const isFood = opts.businessType === 'food'
  const isManuf = opts.businessType === 'manufacturing'

  // 간이·면제 과세자는 의제매입세액공제 배제 (2021.7.1~). 일반과세자만 적용.
  if (opts.vatType && opts.vatType !== 'general') {
    return { applicable: false, amount: 0, label, basis, note: '2021.7.1 이후 간이과세자는 의제매입세액공제가 배제됩니다(일반과세자만 적용).', steps: [] }
  }

  if (!isFood && !isManuf) {
    return { applicable: false, amount: 0, label, basis, note: '음식점업·제조업에서 면세 농수산물을 원재료로 사용할 때 적용됩니다.', steps: [] }
  }

  let rate: number
  let limitRate: number
  let rateLabel: string
  if (isFood) {
    rate = taxBase <= 200_000_000 ? DEEMED_INPUT_CREDIT.rates.foodUnder2 : DEEMED_INPUT_CREDIT.rates.foodOver2
    rateLabel = taxBase <= 200_000_000 ? '9/109' : '8/108'
    limitRate = DEEMED_INPUT_CREDIT.foodLimitRates.find(l => taxBase <= l.taxBaseCeiling)!.rate
  } else {
    rate = DEEMED_INPUT_CREDIT.rates.manufacturing
    rateLabel = '4/104'
    limitRate = DEEMED_INPUT_CREDIT.otherLimitRates.find(l => taxBase <= l.taxBaseCeiling)!.rate
  }

  const eligiblePurchase = Math.min(exemptAgriPurchase, taxBase * limitRate)
  const amount = Math.max(0, Math.round(eligiblePurchase * rate))
  const steps: CalcStep[] = [
    { label: '공제대상 매입액', formula: `min(매입 ${won(exemptAgriPurchase)}, 과표 ${won(taxBase)}×${(limitRate * 100).toFixed(0)}%)`, amount: eligiblePurchase },
    { label: `공제율 ${rateLabel}`, basis, formula: `${won(eligiblePurchase)} × ${rateLabel}`, amount },
  ]
  return {
    applicable: amount > 0,
    amount,
    label,
    basis,
    note: '면세 농·축·수·임산물 매입 증빙(계산서·신용카드매출전표)이 있어야 공제됩니다.',
    steps,
  }
}
