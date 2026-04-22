import type {
  TaxInput, TaxResult, VatResult, IncomeTaxResult, SavingsCoaching,
  BusinessType, VatType
} from '@/types/tax'

const TAX_BRACKETS = [
  { limit: 14_000_000,    rate: 0.06, deduction: 0 },
  { limit: 50_000_000,    rate: 0.15, deduction: 1_260_000 },
  { limit: 88_000_000,    rate: 0.24, deduction: 5_760_000 },
  { limit: 150_000_000,   rate: 0.35, deduction: 15_440_000 },
  { limit: 300_000_000,   rate: 0.38, deduction: 19_940_000 },
  { limit: 500_000_000,   rate: 0.40, deduction: 25_940_000 },
  { limit: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { limit: Infinity,      rate: 0.45, deduction: 65_940_000 },
]

const VAT_SIMPLIFIED_THRESHOLD = 104_000_000
const VAT_EXEMPT_THRESHOLD = 48_000_000

const SIMPLIFIED_VAT_RATES: Record<BusinessType, number> = {
  retail:      0.15,
  food:        0.15,
  service:     0.40,
  real_estate: 0.40,
}

// 업종별 단순경비율 (단순 적용 구간 임계값 + 해당 경비율)
const SIMPLE_EXPENSE_RATES: Record<BusinessType, { threshold: number; simpleRate: number; stdRate: number }> = {
  retail:      { threshold: 60_000_000, simpleRate: 0.90, stdRate: 0.25 },
  food:        { threshold: 36_000_000, simpleRate: 0.90, stdRate: 0.20 },
  service:     { threshold: 24_000_000, simpleRate: 0.70, stdRate: 0.20 },
  real_estate: { threshold: 24_000_000, simpleRate: 0.42, stdRate: 0.10 },
}

// 간편장부 의무 기준 (이 이상이면 복식부기 의무)
const BOOKKEEPING_THRESHOLD: Record<BusinessType, number> = {
  retail:      300_000_000,
  food:        150_000_000,
  service:     75_000_000,
  real_estate: 75_000_000,
}

export type ExpenseTier = 'simple_rate' | 'standard_rate' | 'bookkeeping'

export interface DualComparison {
  rateMethod: IncomeTaxResult    // 경비율 방식
  bookMethod: IncomeTaxResult    // 간편장부(실경비) 방식
  betterMethod: 'rate' | 'book' | 'equal'
  savingAmount: number
  tier: ExpenseTier
  tierLabel: string
}

export function getExpenseTier(revenue: number, businessType: BusinessType): ExpenseTier {
  const r = SIMPLE_EXPENSE_RATES[businessType]
  if (revenue < r.threshold) return 'simple_rate'
  if (revenue < BOOKKEEPING_THRESHOLD[businessType]) return 'standard_rate'
  return 'bookkeeping'
}

export function getTierLabel(tier: ExpenseTier): string {
  if (tier === 'simple_rate') return '단순경비율 적용 구간'
  if (tier === 'standard_rate') return '기준경비율 적용 구간'
  return '간편장부 의무 구간'
}

export function calcByExpenseRate(input: TaxInput): IncomeTaxResult {
  const r = SIMPLE_EXPENSE_RATES[input.businessType]
  const rate = input.annualRevenue < r.threshold ? r.simpleRate : r.stdRate
  const estimatedExpense = Math.round(input.annualRevenue * rate)
  return calcIncomeTax({ ...input, annualExpense: estimatedExpense })
}

export function calcDualComparison(input: TaxInput): DualComparison {
  const tier = getExpenseTier(input.annualRevenue, input.businessType)
  const rateMethod = calcByExpenseRate(input)
  const bookMethod = calcIncomeTax(input)

  const diff = rateMethod.totalTax - bookMethod.totalTax
  const betterMethod = diff > 0 ? 'book' : diff < 0 ? 'rate' : 'equal'
  const savingAmount = Math.abs(diff)

  return { rateMethod, bookMethod, betterMethod, savingAmount, tier, tierLabel: getTierLabel(tier) }
}

export function calcVat(revenue: number, businessType: BusinessType): VatResult {
  let vatType: VatType
  let estimatedVat: number
  let effectiveRate: number

  if (revenue >= VAT_SIMPLIFIED_THRESHOLD) {
    vatType = 'general'
    estimatedVat = revenue * 0.10
    effectiveRate = 0.10
  } else if (revenue >= VAT_EXEMPT_THRESHOLD) {
    vatType = 'simplified'
    const valueAddedRate = SIMPLIFIED_VAT_RATES[businessType]
    estimatedVat = revenue * valueAddedRate * 0.10
    effectiveRate = valueAddedRate * 0.10
  } else {
    vatType = 'exempt'
    estimatedVat = 0
    effectiveRate = 0
  }

  return { vatType, estimatedVat, effectiveRate }
}

export function calcIncomeTax(input: TaxInput): IncomeTaxResult {
  const netIncome = input.annualRevenue - input.annualExpense
  const taxableIncome = Math.max(0, netIncome - (input.deductions ?? 0))
  const bracket = TAX_BRACKETS.find(b => taxableIncome <= b.limit)!
  const incomeTax = taxableIncome * bracket.rate - bracket.deduction
  const localTax = incomeTax * 0.10

  return {
    taxableIncome,
    taxRate: bracket.rate,
    incomeTax: Math.max(0, incomeTax),
    localTax: Math.max(0, localTax),
    totalTax: Math.max(0, incomeTax + localTax),
    bracketLabel: `${(bracket.rate * 100).toFixed(0)}% 구간`,
  }
}

export function calcCoaching(input: TaxInput, incomeTax: IncomeTaxResult): SavingsCoaching {
  const marginalRate = incomeTax.taxRate * 1.1
  const tips = []

  tips.push({
    title: '노란우산공제 가입',
    description: '연 최대 500만원 소득공제. 폐업·노령 시 원금+이자 수령',
    estimatedSaving: Math.round(5_000_000 * marginalRate),
    priority: 'high' as const,
  })

  const pensionRate = input.annualRevenue <= 55_000_000 ? 0.15 : 0.12
  tips.push({
    title: '연금저축 + IRP 최대 납입',
    description: '연 최대 900만원 세액공제 (연금저축 600 + IRP 300)',
    estimatedSaving: Math.round(9_000_000 * pensionRate),
    priority: 'high' as const,
  })

  tips.push({
    title: '가족 인건비 원천세 신고',
    description: '실제 근무 가족 급여를 원천세(3.3%) 신고하면 전액 경비 인정',
    estimatedSaving: 0,
    priority: 'medium' as const,
  })

  tips.push({
    title: '거래처 경조사비 증빙 보관',
    description: '청첩장·부고 캡처 보관 시 건당 20만원 한도 접대비 인정',
    estimatedSaving: 0,
    priority: 'low' as const,
  })

  const potentialSavings = tips.reduce((sum, t) => sum + t.estimatedSaving, 0)
  return { potentialSavings, tips }
}

export function calcTax(input: TaxInput): TaxResult {
  const vat = calcVat(input.annualRevenue, input.businessType)
  const incomeTax = calcIncomeTax(input)
  const coaching = calcCoaching(input, incomeTax)
  return { vat, incomeTax, coaching }
}
