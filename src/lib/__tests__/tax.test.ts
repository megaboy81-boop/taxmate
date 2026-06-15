import { describe, it, expect } from 'vitest'
import {
  calcIncomeTax, calcByExpenseRate, calcDualComparison, calcVat,
  calcPersonalDeduction, calcCoaching,
} from '@/lib/taxEngine'
import { calcSmeReduction, calcCardIssuanceCredit, calcDeemedInputCredit } from '@/lib/taxCredits'
import { estimateSocialInsurance, projectNextYearHealth } from '@/lib/socialInsurance'
import { assessCompliance, getTaxCalendar } from '@/lib/compliance'
import type { TaxInput } from '@/types/tax'

// ─────────────────────────────────────────────────────────────
// 종합소득세 — 누진세율 + 인적공제
// ─────────────────────────────────────────────────────────────
describe('calcIncomeTax — 종합소득세', () => {
  it('본인 기본공제(150만)만 적용된 기본 케이스', () => {
    const input: TaxInput = { annualRevenue: 65_000_000, annualExpense: 15_000_000, businessType: 'service' }
    const r = calcIncomeTax(input)
    expect(r.grossIncome).toBe(50_000_000)
    expect(r.totalDeduction).toBe(1_500_000)       // 본인 기본공제
    expect(r.taxableIncome).toBe(48_500_000)
    expect(r.taxRate).toBe(0.15)
    // 48,500,000 × 15% − 1,260,000 = 6,015,000
    expect(r.calculatedTax).toBe(6_015_000)
    expect(r.incomeTax).toBe(6_015_000)
    expect(r.localTax).toBe(601_500)
    expect(r.totalTax).toBe(6_616_500)
  })

  it('인적공제(배우자+부양가족2)로 과세표준이 줄어든다', () => {
    const input: TaxInput = {
      annualRevenue: 65_000_000, annualExpense: 15_000_000, businessType: 'service',
      personalDeduction: { spouse: true, dependents: 2 },
    }
    const r = calcIncomeTax(input)
    expect(r.totalDeduction).toBe(6_000_000)        // 본인150+배우자150+부양가족150×2
    expect(r.taxableIncome).toBe(44_000_000)
    // 44,000,000 × 15% − 1,260,000 = 5,340,000
    expect(r.calculatedTax).toBe(5_340_000)
  })

  it('세액공제(자녀2+연금900만)가 결정세액에서 차감된다', () => {
    const input: TaxInput = {
      annualRevenue: 65_000_000, annualExpense: 15_000_000, businessType: 'service',
      credits: { childrenOver8: 2, pensionSavings: 6_000_000, irp: 3_000_000 },
    }
    const r = calcIncomeTax(input)
    // 산출세액 6,015,000 (본인공제만)
    // 자녀: 25만+30만 = 55만 / 연금: min(900만)×12%(소득5천만>4500만) = 108만 → 163만
    expect(r.taxCredits).toBe(1_630_000)
    expect(r.incomeTax).toBe(6_015_000 - 1_630_000)
  })

  it('모든 계산은 투명성 steps를 반환한다', () => {
    const r = calcIncomeTax({ annualRevenue: 50_000_000, annualExpense: 10_000_000, businessType: 'retail' })
    expect(r.steps.length).toBeGreaterThan(3)
    expect(r.steps.some(s => s.label === '과세표준')).toBe(true)
    expect(r.steps.some(s => s.label === '산출세액')).toBe(true)
  })

  it('과표 구간 경계값 — 누진세율표', () => {
    // 과표 정확히 5천만이 되도록: 소득 5천만+본인공제150만 = 경비조정
    const mk = (taxable: number): TaxInput => ({ annualRevenue: taxable + 1_500_000, annualExpense: 0, businessType: 'retail' })
    expect(calcIncomeTax(mk(10_000_000)).calculatedTax).toBe(600_000)         // 1천만×6%
    expect(calcIncomeTax(mk(50_000_000)).calculatedTax).toBe(6_240_000)       // 5천만×15%−126만
    expect(calcIncomeTax(mk(88_000_000)).calculatedTax).toBe(15_360_000)      // 8800만×24%−576만
  })
})

// ─────────────────────────────────────────────────────────────
// 인적공제 — 추가공제 + 부녀자/한부모 배타
// ─────────────────────────────────────────────────────────────
describe('calcPersonalDeduction', () => {
  it('본인만이면 150만', () => {
    expect(calcPersonalDeduction().total).toBe(1_500_000)
    expect(calcPersonalDeduction(undefined).total).toBe(1_500_000)
  })
  it('경로우대+장애인 추가공제', () => {
    const r = calcPersonalDeduction({ dependents: 1, elderly: 1, disabled: 1 })
    // 본인150 + 부양150 + 경로100 + 장애200 = 600만
    expect(r.total).toBe(6_000_000)
  })
  it('부녀자와 한부모 중복 시 한부모만 적용', () => {
    const r = calcPersonalDeduction({ womanHead: true, singleParent: true })
    // 본인150 + 한부모100 = 250만 (부녀자 50만 미적용)
    expect(r.total).toBe(2_500_000)
  })
})

// ─────────────────────────────────────────────────────────────
// 기준경비율 vs 단순경비율 자동 분기 (Track A 핵심 버그 수정)
// ─────────────────────────────────────────────────────────────
describe('calcByExpenseRate — 경비율 분기', () => {
  it('직전수입이 단순경비율 기준 미만이면 단순경비율 적용', () => {
    // service(다군) 단순기준 2400만, prior 2000만 < 2400만
    const r = calcByExpenseRate({ annualRevenue: 20_000_000, annualExpense: 0, businessType: 'service', priorYearRevenue: 20_000_000 })
    // 경비 = 2000만 × 0.70 = 1400만 → 소득 600만 − 본인150만 = 과표 450만 → 6%
    expect(r.grossIncome).toBe(6_000_000)
    expect(r.calculatedTax).toBe(270_000)
  })

  it('직전수입이 기준 이상이면 기준경비율 — min(주요경비방식, 단순×배율) 적용', () => {
    const r = calcByExpenseRate({ annualRevenue: 30_000_000, annualExpense: 0, businessType: 'service', priorYearRevenue: 30_000_000, majorExpense: 10_000_000 })
    // 주요경비방식 = 30M−10M−30M×0.17 = 14.9M / 배율방식 = (30M−30M×0.70)×2.8 = 25.2M → min 14.9M
    expect(r.grossIncome).toBe(14_900_000)
    expect(r.calculatedTax).toBe(804_000)
  })
  it('당해수입이 복식부기 의무 기준 이상이면 기준경비율(복식부기율 ½) 적용', () => {
    // service 다군 복식부기 7,500만. 직전 2,000만(단순구간)이나 당해 1억 → bookkeeping
    const r = calcByExpenseRate({ annualRevenue: 100_000_000, annualExpense: 0, businessType: 'service', priorYearRevenue: 20_000_000, majorExpense: 30_000_000 })
    // 기준율 0.17×½=0.085. 주요경비방식=100M−30M−8.5M=61.5M / 배율=(30M)×3.4=102M → min 61.5M
    expect(r.grossIncome).toBe(61_500_000)
  })

  it('듀얼비교는 유리한 방식을 선택한다', () => {
    const input: TaxInput = { annualRevenue: 30_000_000, annualExpense: 25_000_000, businessType: 'service', priorYearRevenue: 20_000_000 }
    const d = calcDualComparison(input)
    expect(['rate', 'book', 'equal']).toContain(d.betterMethod)
    expect(d.rateMethodLabel).toBe('단순경비율')
  })
})

// ─────────────────────────────────────────────────────────────
// 부가세 — 간이 업종별 부가가치율 (Track A 버그 수정: 기타서비스 30%)
// ─────────────────────────────────────────────────────────────
describe('calcVat — 부가가치세', () => {
  it('기타서비스업 간이 부가가치율은 30% (이전 40% 오류 수정)', () => {
    const r = calcVat(70_000_000, 'service')
    expect(r.vatType).toBe('simplified')
    // 7000만 × 30% × 10% = 210만
    expect(r.estimatedVat).toBe(2_100_000)
  })
  it('전문서비스업은 40%', () => {
    expect(calcVat(70_000_000, 'professional').estimatedVat).toBe(2_800_000)
  })
  it('1.04억 이상은 일반과세 (공급대가÷11)', () => {
    const r = calcVat(200_000_000, 'retail')
    expect(r.vatType).toBe('general')
    expect(r.estimatedVat).toBe(Math.round(200_000_000 / 11))
  })
  it('부동산임대업 간이 기준은 4,800만 — 이상 일반, 미만 면제', () => {
    expect(calcVat(50_000_000, 'real_estate').vatType).toBe('general')   // 4800만 이상 → 일반
    expect(calcVat(40_000_000, 'real_estate').vatType).toBe('exempt')    // 4800만 미만 → 간이(납부면제)
  })
  it('4800만 미만은 납부면제 (배제업종 아닌 경우)', () => {
    const r = calcVat(40_000_000, 'food')
    expect(r.vatType).toBe('exempt')
    expect(r.estimatedVat).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────
// 노란우산 차등한도 (2025 상향: 600/400/200)
// ─────────────────────────────────────────────────────────────
describe('calcCoaching — 노란우산 차등한도', () => {
  const tipCap = (grossIncome: number) => {
    const it = calcIncomeTax({ annualRevenue: grossIncome, annualExpense: 0, businessType: 'service' })
    const c = calcCoaching({ annualRevenue: grossIncome, annualExpense: 0, businessType: 'service' }, it)
    return c.tips.find(t => t.title.includes('노란우산'))!.description
  }
  it('사업소득 4천만 이하 → 600만 한도', () => {
    expect(tipCap(30_000_000)).toContain('6,000,000')
  })
  it('4천~1억 → 400만 한도', () => {
    expect(tipCap(70_000_000)).toContain('4,000,000')
  })
  it('1억 초과 → 200만 한도', () => {
    expect(tipCap(150_000_000)).toContain('2,000,000')
  })
})

// ─────────────────────────────────────────────────────────────
// 3대 절세 세액공제 (Track C)
// ─────────────────────────────────────────────────────────────
describe('taxCredits — 절세 인텔리전스', () => {
  it('중소기업특별세액감면 — 도소매 소기업 10%', () => {
    const r = calcSmeReduction({ businessType: 'retail', calculatedTax: 10_000_000, region: 'non_metro' })
    expect(r.amount).toBe(1_000_000)
    expect(r.applicable).toBe(true)
  })
  it('중소기업특별세액감면 — 제조 소기업 수도권 20%', () => {
    expect(calcSmeReduction({ businessType: 'manufacturing', calculatedTax: 10_000_000, region: 'metro' }).amount).toBe(2_000_000)
  })
  it('부동산임대업은 감면 제외', () => {
    const r = calcSmeReduction({ businessType: 'real_estate', calculatedTax: 10_000_000 })
    expect(r.applicable).toBe(false)
    expect(r.amount).toBe(0)
  })
  it('신용카드발행세액공제 — 1.3%, 한도 1000만', () => {
    const r = calcCardIssuanceCredit({ cardAndCashSales: 240_000_000, priorYearSupply: 300_000_000 })
    expect(r.amount).toBe(3_120_000)   // 2.4억 × 1.3%
  })
  it('신용카드발행세액공제 — 직전 공급가액 10억 초과 제외', () => {
    expect(calcCardIssuanceCredit({ cardAndCashSales: 1_000_000_000, priorYearSupply: 1_500_000_000 }).applicable).toBe(false)
  })
  it('의제매입세액공제 — 음식점 과표 2억이하 9/109 특례 + 한도율', () => {
    const r = calcDeemedInputCredit({ businessType: 'food', taxBase: 200_000_000, exemptAgriPurchase: 60_000_000, vatType: 'general' })
    // min(6000만, 2억×70%) = 6000만 → 6000만 × 9/109 (2억 이하 특례)
    expect(r.amount).toBe(Math.round(60_000_000 * 9 / 109))
  })
  it('의제매입세액공제 — 음식점 과표 2억초과는 8/108', () => {
    const r = calcDeemedInputCredit({ businessType: 'food', taxBase: 300_000_000, exemptAgriPurchase: 50_000_000, vatType: 'general' })
    // 한도 3억×60%=1.8억, min(5천만,1.8억)=5천만 → 5천만 × 8/108
    expect(r.amount).toBe(Math.round(50_000_000 * 8 / 108))
  })
  it('의제매입세액공제 — 비대상 업종은 미적용', () => {
    expect(calcDeemedInputCredit({ businessType: 'retail', taxBase: 100_000_000, exemptAgriPurchase: 10_000_000, vatType: 'general' }).applicable).toBe(false)
  })
  it('의제매입세액공제 — 간이과세자는 배제(2021.7~), 일반만 적용', () => {
    expect(calcDeemedInputCredit({ businessType: 'food', taxBase: 60_000_000, exemptAgriPurchase: 20_000_000, vatType: 'simplified' }).applicable).toBe(false)
    expect(calcDeemedInputCredit({ businessType: 'food', taxBase: 300_000_000, exemptAgriPurchase: 50_000_000, vatType: 'general' }).applicable).toBe(true)
  })
  it('중소기업특별세액감면 — 불명확 업종(서비스)은 needs_review 미적용', () => {
    const r = calcSmeReduction({ businessType: 'service', calculatedTax: 10_000_000 })
    expect(r.applicable).toBe(false)
    expect(r.needsReview).toBe(true)
  })
  it('신용카드발행세액공제 — 납부세액 한도로 제한(환급 불가)', () => {
    const r = calcCardIssuanceCredit({ cardAndCashSales: 240_000_000, businessType: 'food', payableVat: 1_000_000 })
    expect(r.amount).toBe(1_000_000)   // 312만이지만 납부세액 100만으로 캡
  })
  it('신용카드발행세액공제 — 비대상 업종(제조) 제외', () => {
    expect(calcCardIssuanceCredit({ cardAndCashSales: 100_000_000, businessType: 'manufacturing' }).applicable).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// 입력 방어 (codex 검수 반영)
// ─────────────────────────────────────────────────────────────
describe('입력 방어', () => {
  it('NaN/음수 매출도 예외 없이 0 이상으로 처리', () => {
    const r = calcIncomeTax({ annualRevenue: NaN, annualExpense: -100, businessType: 'retail' })
    expect(Number.isFinite(r.totalTax)).toBe(true)
    expect(r.totalTax).toBeGreaterThanOrEqual(0)
  })
  it('소수 자녀 수는 정수로 절사', () => {
    const r = calcIncomeTax({ annualRevenue: 100_000_000, annualExpense: 0, businessType: 'retail', credits: { childrenOver8: 2.9 } })
    expect(r.taxCredits).toBe(550_000)   // 2명: 25만+30만
  })
  it('경로·장애 공제 수는 기본공제 대상자 수를 초과할 수 없음', () => {
    const r = calcPersonalDeduction({ dependents: 0, elderly: 5, disabled: 5 })
    // 기본공제 대상=본인1. 경로/장애 각 min(5,1)=1 → 본인150 + 경로100 + 장애200 = 450만
    expect(r.total).toBe(4_500_000)
  })
})

// ─────────────────────────────────────────────────────────────
// 사회보험 추정 (건보/국민연금)
// ─────────────────────────────────────────────────────────────
describe('socialInsurance', () => {
  it('국민연금 월 보험료 = 월소득 × 9.5% (2026 연금개혁, 상한 내)', () => {
    const r = estimateSocialInsurance(48_000_000, 2026)
    expect(r.monthlyPension).toBe(380_000)   // 400만 × 9.5%
  })
  it('2026 건보료율 7.19% 반영', () => {
    const r = estimateSocialInsurance(48_000_000, 2026)
    expect(r.steps[0].amount).toBeCloseTo(287_600, 0)
  })
  it('국민연금 상한 — 고소득도 기준소득월액 상한으로 캡 (2026)', () => {
    const r = estimateSocialInsurance(200_000_000, 2026)
    expect(r.monthlyPension).toBe(Math.round(6_590_000 * 0.095))
  })
  it('소득 증가 시 내년 건보료 인상 경고', () => {
    const p = projectNextYearHealth(80_000_000, 40_000_000)
    expect(p.deltaMonthly).toBeGreaterThan(0)
    expect(p.warning).toContain('오를 것')
  })
  it('비정상 입력(NaN/음수)도 0으로 방어', () => {
    const r = estimateSocialInsurance(NaN, 2026)
    expect(r.monthlyHealth).toBe(0)
    expect(Number.isFinite(r.monthlyPension)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// 컴플라이언스 — 과세유형/성실신고/캘린더
// ─────────────────────────────────────────────────────────────
describe('compliance', () => {
  it('과세유형 판정', () => {
    expect(assessCompliance({ annualRevenue: 40_000_000, businessType: 'service' }).vatType).toBe('exempt')
    expect(assessCompliance({ annualRevenue: 50_000_000, businessType: 'service' }).vatType).toBe('simplified')
    expect(assessCompliance({ annualRevenue: 200_000_000, businessType: 'service' }).vatType).toBe('general')
    expect(assessCompliance({ annualRevenue: 40_000_000, businessType: 'real_estate' }).vatType).toBe('exempt')
    expect(assessCompliance({ annualRevenue: 60_000_000, businessType: 'real_estate' }).vatType).toBe('general')
  })
  it('성실신고확인대상 판정 (다군 5억)', () => {
    expect(assessCompliance({ annualRevenue: 600_000_000, businessType: 'service' }).isSincereTarget).toBe(true)
    expect(assessCompliance({ annualRevenue: 400_000_000, businessType: 'service' }).isSincereTarget).toBe(false)
  })
  it('일반과세자 세무 캘린더는 부가세 4회 일정을 포함', () => {
    const cal = getTaxCalendar('general')
    const vatEvents = cal.filter(e => e.title.includes('부가세'))
    expect(vatEvents.length).toBe(4)
  })
})
