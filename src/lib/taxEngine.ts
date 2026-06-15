import type {
  TaxInput, TaxResult, VatResult, IncomeTaxResult, SavingsCoaching,
  PersonalDeductionInput, PersonalDeductionResult, TaxCreditInput, TaxCreditResult,
  CalcStep, BusinessType,
} from '@/types/tax'
import {
  INCOME_TAX_BRACKETS, LOCAL_INCOME_TAX_RATE,
  BASIC_DEDUCTION_PER_PERSON, ADDITIONAL_DEDUCTION, WOMAN_HEAD_INCOME_CEILING,
  CHILD_TAX_CREDIT, STANDARD_TAX_CREDIT, BOOKKEEPING_TAX_CREDIT_RATE,
  BOOKKEEPING_TAX_CREDIT_CAP, ELECTRONIC_FILING_TAX_CREDIT, PENSION_CREDIT,
  VAT_GENERAL_RATE, VAT_SIMPLIFIED_THRESHOLD, VAT_EXEMPT_THRESHOLD,
  VAT_SIMPLIFIED_INPUT_CREDIT_RATE, VAT_SIMPLIFIED_THRESHOLD_BY_TYPE, BUSINESS_TYPES,
  EXPENSE_GROUP_THRESHOLDS, YELLOW_UMBRELLA_LIMITS,
} from '@/lib/taxData'

const won = (n: number) => Math.round(n).toLocaleString('ko-KR')
// 입력 방어 헬퍼
const num = (n: number | undefined) => (Number.isFinite(n) ? (n as number) : 0)          // finite 보장 (음수 허용: 결손)
const pos = (n: number | undefined) => (Number.isFinite(n) && (n as number) > 0 ? (n as number) : 0) // 양수만
const count = (n: number | undefined) => Math.max(0, Math.floor(Number.isFinite(n) ? (n as number) : 0)) // 음수 없는 정수

// ─────────────────────────────────────────────────────────────
// 인적공제 (소득세법 §50~§51)
// ─────────────────────────────────────────────────────────────

export function calcPersonalDeduction(p?: PersonalDeductionInput, grossIncome?: number): PersonalDeductionResult {
  const steps: CalcStep[] = []
  let total = 0

  // 본인 기본공제는 항상 적용
  total += BASIC_DEDUCTION_PER_PERSON
  steps.push({ label: '본인 기본공제', basis: '소득세법 §50', formula: `${won(BASIC_DEDUCTION_PER_PERSON)}원`, amount: BASIC_DEDUCTION_PER_PERSON })

  if (p) {
    const spouse = p.spouse ? 1 : 0
    const dependents = count(p.dependents)
    const basicCount = 1 + spouse + dependents // 기본공제 대상자 수

    if (spouse) {
      total += BASIC_DEDUCTION_PER_PERSON
      steps.push({ label: '배우자 공제', basis: '소득세법 §50', formula: `${won(BASIC_DEDUCTION_PER_PERSON)}원`, amount: BASIC_DEDUCTION_PER_PERSON })
    }
    if (dependents > 0) {
      const amt = BASIC_DEDUCTION_PER_PERSON * dependents
      total += amt
      steps.push({ label: `부양가족 공제 ×${dependents}`, basis: '소득세법 §50', formula: `${won(BASIC_DEDUCTION_PER_PERSON)} × ${dependents}`, amount: amt })
    }
    // 추가공제 대상 수는 기본공제 대상자 수를 초과할 수 없음
    const elderly = Math.min(count(p.elderly), basicCount)
    const disabled = Math.min(count(p.disabled), basicCount)
    if (elderly > 0) {
      const amt = ADDITIONAL_DEDUCTION.elderly * elderly
      total += amt
      steps.push({ label: `경로우대 공제 ×${elderly}`, basis: '소득세법 §51', formula: `${won(ADDITIONAL_DEDUCTION.elderly)} × ${elderly}`, amount: amt })
    }
    if (disabled > 0) {
      const amt = ADDITIONAL_DEDUCTION.disabled * disabled
      total += amt
      steps.push({ label: `장애인 공제 ×${disabled}`, basis: '소득세법 §51', formula: `${won(ADDITIONAL_DEDUCTION.disabled)} × ${disabled}`, amount: amt })
    }
    // 부녀자·한부모 중복 시 한부모 적용 (소득세법 §51 ②)
    if (p.singleParent) {
      total += ADDITIONAL_DEDUCTION.singleParent
      steps.push({ label: '한부모 공제', basis: '소득세법 §51', formula: `${won(ADDITIONAL_DEDUCTION.singleParent)}원`, amount: ADDITIONAL_DEDUCTION.singleParent })
    } else if (p.womanHead && (grossIncome === undefined || grossIncome <= WOMAN_HEAD_INCOME_CEILING)) {
      // 부녀자공제: 종합소득금액 3천만원 이하 요건
      total += ADDITIONAL_DEDUCTION.womanHead
      steps.push({ label: '부녀자 공제', basis: '소득세법 §51 (종합소득금액 3천만↓)', formula: `${won(ADDITIONAL_DEDUCTION.womanHead)}원`, amount: ADDITIONAL_DEDUCTION.womanHead })
    }
  }

  return { total, steps }
}

// ─────────────────────────────────────────────────────────────
// 세액공제 (소득세법 §59 등)
// ─────────────────────────────────────────────────────────────

export function calcTaxCredits(input: TaxInput, calculatedTax: number, grossIncome: number): TaxCreditResult {
  const c: TaxCreditInput = input.credits ?? {}
  const breakdown: { label: string; amount: number; basis: string }[] = []
  let total = 0

  // 자녀세액공제 (8세 이상)
  const kids = count(c.childrenOver8)
  if (kids > 0) {
    let childCredit = 0
    if (kids >= 1) childCredit += CHILD_TAX_CREDIT.first
    if (kids >= 2) childCredit += CHILD_TAX_CREDIT.second
    if (kids > 2) childCredit += (kids - 2) * CHILD_TAX_CREDIT.thirdPlusEach
    breakdown.push({ label: `자녀세액공제 (${kids}명)`, amount: childCredit, basis: '소득세법 §59의2' })
    total += childCredit
  }

  // 연금계좌세액공제
  const pensionSavings = Math.min(pos(c.pensionSavings), PENSION_CREDIT.pensionSavingsCap)
  const pensionBase = Math.min(pensionSavings + pos(c.irp), PENSION_CREDIT.totalCap)
  if (pensionBase > 0) {
    const rate = grossIncome <= PENSION_CREDIT.highRateIncomeCeiling ? PENSION_CREDIT.highRate : PENSION_CREDIT.lowRate
    const pensionCredit = Math.round(pensionBase * rate)
    breakdown.push({ label: `연금계좌세액공제 (${(rate * 100).toFixed(0)}%)`, amount: pensionCredit, basis: '소득세법 §59의3' })
    total += pensionCredit
  }

  // 기장세액공제: 간편장부대상자가 복식부기로 신고 시 산출세액의 20% (한도 100만)
  if (c.isSimpleBookEligible && c.isDoubleEntry) {
    const bookCredit = Math.min(Math.round(Math.max(0, calculatedTax) * BOOKKEEPING_TAX_CREDIT_RATE), BOOKKEEPING_TAX_CREDIT_CAP)
    if (bookCredit > 0) {
      breakdown.push({ label: '기장세액공제 (20%)', amount: bookCredit, basis: '소득세법 §56의2' })
      total += bookCredit
    }
  }

  // 전자신고세액공제
  if (c.electronicFiling) {
    breakdown.push({ label: '전자신고세액공제', amount: ELECTRONIC_FILING_TAX_CREDIT, basis: '조특법 §104의8' })
    total += ELECTRONIC_FILING_TAX_CREDIT
  }

  // 표준세액공제 (특별공제 미적용 사업자) — 명시 요청 시만
  if (c.useStandardCredit) {
    breakdown.push({ label: '표준세액공제', amount: STANDARD_TAX_CREDIT, basis: '소득세법 §59의4' })
    total += STANDARD_TAX_CREDIT
  }

  // 세액공제는 산출세액을 초과할 수 없음
  total = Math.min(total, Math.max(0, calculatedTax))
  return { total, breakdown }
}

// ─────────────────────────────────────────────────────────────
// 종합소득세 (소득세법 §55)
// ─────────────────────────────────────────────────────────────

export function calcIncomeTax(input: TaxInput): IncomeTaxResult {
  const steps: CalcStep[] = []

  const revenue = pos(input.annualRevenue)   // 매출/경비는 음수 불가
  const expense = pos(input.annualExpense)
  const grossIncome = revenue - expense // 결손(음수)은 차감 결과로만 발생
  steps.push({ label: '소득금액', basis: '수입금액 − 필요경비', formula: `${won(revenue)} − ${won(expense)}`, amount: grossIncome })

  // 종합소득공제: 인적공제 + 연금보험료공제 + (레거시 소득공제)
  const personal = calcPersonalDeduction(input.personalDeduction, grossIncome)
  const pensionPremium = pos(input.pensionPremium)
  const legacy = pos(input.deductions)
  const totalDeduction = personal.total + pensionPremium + legacy

  steps.push({ label: '인적공제', basis: '소득세법 §50~§51', formula: personal.steps.map(s => s.label).join(' + '), amount: personal.total })
  if (pensionPremium > 0) steps.push({ label: '연금보험료공제', basis: '소득세법 §51의3', formula: `국민연금 등 ${won(pensionPremium)}`, amount: pensionPremium })
  if (legacy > 0) steps.push({ label: '기타 소득공제', formula: `${won(legacy)}`, amount: legacy })

  const taxableIncome = Math.max(0, grossIncome - totalDeduction)
  steps.push({ label: '과세표준', formula: `소득금액 − 공제 ${won(totalDeduction)}`, amount: taxableIncome })

  const bracket = INCOME_TAX_BRACKETS.find(b => taxableIncome <= b.limit)!
  const calculatedTax = Math.max(0, Math.round(taxableIncome * bracket.rate - bracket.progressiveDeduction))
  steps.push({
    label: '산출세액',
    basis: '소득세법 §55 누진세율',
    formula: `${won(taxableIncome)} × ${(bracket.rate * 100).toFixed(0)}% − 누진공제 ${won(bracket.progressiveDeduction)}`,
    amount: calculatedTax,
  })

  const credits = calcTaxCredits(input, calculatedTax, grossIncome)
  if (credits.total > 0) {
    steps.push({ label: '세액공제·감면', basis: credits.breakdown.map(b => b.basis).join(', '), formula: credits.breakdown.map(b => `${b.label} ${won(b.amount)}`).join(' + '), amount: -credits.total })
  }

  const incomeTax = Math.max(0, Math.round(calculatedTax - credits.total))
  const localTax = Math.max(0, Math.round(incomeTax * LOCAL_INCOME_TAX_RATE))
  const totalTax = incomeTax + localTax

  steps.push({ label: '결정세액(소득세)', formula: `산출 ${won(calculatedTax)} − 공제 ${won(credits.total)}`, amount: incomeTax })
  steps.push({ label: '지방소득세', basis: '지방세법 (소득세 ×10%)', formula: `${won(incomeTax)} × 10%`, amount: localTax })
  steps.push({ label: '총 납부세액', formula: '소득세 + 지방소득세', amount: totalTax })

  return {
    grossIncome, totalDeduction, taxableIncome,
    taxRate: bracket.rate, calculatedTax, taxCredits: credits.total,
    incomeTax, localTax, totalTax,
    bracketLabel: `${bracket.label} 구간`, steps,
  }
}

// ─────────────────────────────────────────────────────────────
// 추계 경비율 (단순/기준 자동 분기) — 소득세법 시행령 §143
// ─────────────────────────────────────────────────────────────

export type ExpenseTier = 'simple_rate' | 'standard_rate' | 'bookkeeping'

export interface DualComparison {
  rateMethod: IncomeTaxResult
  bookMethod: IncomeTaxResult
  betterMethod: 'rate' | 'book' | 'equal'
  savingAmount: number
  tier: ExpenseTier
  tierLabel: string
  rateMethodLabel: string
  warning?: string             // 복식부기 의무·전문직 등 추계 제약 경고
}

export function getExpenseTier(revenue: number, businessType: BusinessType): ExpenseTier {
  const group = BUSINESS_TYPES[businessType].group
  const th = EXPENSE_GROUP_THRESHOLDS[group]
  if (revenue < th.simpleRateCeiling) return 'simple_rate'
  if (revenue < th.doubleEntryThreshold) return 'standard_rate'
  return 'bookkeeping'
}

export function getTierLabel(tier: ExpenseTier): string {
  if (tier === 'simple_rate') return '단순경비율 적용 구간'
  if (tier === 'standard_rate') return '기준경비율 적용 구간'
  return '복식부기 의무 구간'
}

export function calcByExpenseRate(input: TaxInput): IncomeTaxResult {
  const info = BUSINESS_TYPES[input.businessType]
  const prior = pos(input.priorYearRevenue) || pos(input.annualRevenue)
  const tier = getExpenseTier(prior, input.businessType)

  let estimatedExpense: number
  if (tier === 'simple_rate') {
    estimatedExpense = Math.round(num(input.annualRevenue) * info.simpleRate)
  } else {
    // 기준경비율: 주요경비 실액(매입+임차+인건비) + 수입 × 기준경비율
    estimatedExpense = Math.round(pos(input.majorExpense) + num(input.annualRevenue) * info.standardRate)
  }
  return calcIncomeTax({ ...input, annualExpense: estimatedExpense })
}

export function calcDualComparison(input: TaxInput): DualComparison {
  const prior = pos(input.priorYearRevenue) || pos(input.annualRevenue)
  const tier = getExpenseTier(prior, input.businessType)
  const rateMethod = calcByExpenseRate(input)
  const bookMethod = calcIncomeTax(input)

  const diff = rateMethod.totalTax - bookMethod.totalTax
  const betterMethod = diff > 0 ? 'book' : diff < 0 ? 'rate' : 'equal'
  const savingAmount = Math.abs(diff)

  let warning: string | undefined
  if (tier === 'bookkeeping') {
    warning = '직전연도 수입이 복식부기 의무 기준 이상입니다. 추계(경비율)로 신고하면 무기장가산세(산출세액의 20%)가 부과될 수 있어 복식부기 신고가 원칙입니다.'
  } else if (input.businessType === 'professional') {
    warning = '전문직 등 일부 업종은 업종코드에 따라 단순경비율 적용이 배제될 수 있습니다. 적용 가능 여부는 국세청 업종코드 기준 확인이 필요합니다.'
  }

  return {
    rateMethod, bookMethod, betterMethod, savingAmount,
    tier, tierLabel: getTierLabel(tier),
    rateMethodLabel: tier === 'simple_rate' ? '단순경비율' : '기준경비율',
    warning,
  }
}

// ─────────────────────────────────────────────────────────────
// 부가가치세 (부가가치세법)
// ─────────────────────────────────────────────────────────────

/**
 * @param revenue 연 매출. ⚠️ 공급대가(부가세 포함 총매출) 기준이다. 카드매출 등 입금 총액.
 * @param businessType 업종
 * @param purchaseAmount (선택) 매입 공급대가(부가세 포함) — 일반 매입세액공제, 간이 0.5% 공제에 사용
 */
export function calcVat(revenue: number, businessType: BusinessType, purchaseAmount = 0): VatResult {
  const rev = pos(revenue)          // 공급대가(부가세 포함)
  const purchase = pos(purchaseAmount)
  const info = BUSINESS_TYPES[businessType]
  // 업종별 간이 기준 (부동산임대 등은 4,800만, 일반 업종은 1.04억)
  const simpThreshold = VAT_SIMPLIFIED_THRESHOLD_BY_TYPE[businessType] ?? VAT_SIMPLIFIED_THRESHOLD
  const steps: CalcStep[] = []
  let vatType: VatResult['vatType']
  let estimatedVat: number
  let effectiveRate: number

  if (rev >= simpThreshold) {
    // 간이 기준 이상 → 일반과세
    vatType = 'general'
    // 공급대가(부가세 포함) → 매출세액 = 공급대가 ÷ 11
    const salesVat = rev / 11
    const inputVat = purchase / 11
    estimatedVat = Math.max(0, Math.round(salesVat - inputVat))
    effectiveRate = rev > 0 ? estimatedVat / rev : 0
    steps.push({ label: '매출세액', basis: '부가법 §30 (공급대가 ÷11)', formula: `${won(rev)} ÷ 11`, amount: Math.round(salesVat) })
    steps.push({ label: '매입세액 공제', formula: `${won(purchase)} ÷ 11`, amount: -Math.round(inputVat) })
    steps.push({ label: '납부세액', formula: '매출세액 − 매입세액', amount: estimatedVat })
  } else if (rev >= VAT_EXEMPT_THRESHOLD) {
    vatType = 'simplified'
    const r = info.vatValueAddedRate
    const salesVat = rev * r * VAT_GENERAL_RATE
    const inputCredit = purchase * VAT_SIMPLIFIED_INPUT_CREDIT_RATE
    estimatedVat = Math.max(0, Math.round(salesVat - inputCredit))
    effectiveRate = rev > 0 ? estimatedVat / rev : 0
    steps.push({ label: '간이 납부세액', basis: `부가법 §63 (부가가치율 ${(r * 100).toFixed(0)}%)`, formula: `${won(rev)} × ${(r * 100).toFixed(0)}% × 10%`, amount: Math.round(salesVat) })
    if (purchase > 0) steps.push({ label: '매입세액공제 (0.5%)', formula: `${won(purchase)} × 0.5%`, amount: -Math.round(inputCredit) })
    steps.push({ label: '납부세액', amount: estimatedVat })
  } else {
    vatType = 'exempt'
    estimatedVat = 0
    effectiveRate = 0
    steps.push({ label: '납부의무 면제', basis: `부가법 §69 (연 공급대가 ${won(VAT_EXEMPT_THRESHOLD)} 미만)`, amount: 0 })
  }

  return { vatType, estimatedVat, effectiveRate, steps }
}

// ─────────────────────────────────────────────────────────────
// 절세 코칭 (중립 문구 — 권유 아닌 검토 항목 안내)
// ─────────────────────────────────────────────────────────────

export function calcCoaching(input: TaxInput, incomeTax: IncomeTaxResult): SavingsCoaching {
  const marginalRate = incomeTax.taxRate * (1 + LOCAL_INCOME_TAX_RATE)
  const grossIncome = incomeTax.grossIncome
  const tips = []

  // 노란우산: 부동산임대업 제외, 사업소득금액별 차등한도
  if (input.businessType !== 'real_estate') {
    const ucap = YELLOW_UMBRELLA_LIMITS.find(l => grossIncome <= l.incomeCeiling)!.limit
    tips.push({
      title: '노란우산공제 (소득공제 검토 항목)',
      description: `사업소득 ${won(grossIncome)}원 기준 연 최대 ${won(ucap)}원 소득공제 한도. 실제 납입액 기준으로 공제됩니다.`,
      estimatedSaving: Math.round(ucap * marginalRate),
      priority: 'high' as const,
    })
  }

  const pensionRate = grossIncome <= PENSION_CREDIT.highRateIncomeCeiling ? PENSION_CREDIT.highRate : PENSION_CREDIT.lowRate
  tips.push({
    title: '연금계좌 세액공제 (납입 한도 검토)',
    description: `연 최대 900만원 납입 한도 (연금저축 600 + IRP 300), 공제율 ${(pensionRate * 100).toFixed(0)}%`,
    estimatedSaving: Math.round(PENSION_CREDIT.totalCap * pensionRate),
    priority: 'high' as const,
  })

  tips.push({
    title: '가족 인건비 (요건: 실제 근무·원천세 신고)',
    description: '실제 근무한 가족에게 지급한 급여는 원천세(3.3%) 신고 시 경비로 인정될 수 있습니다',
    estimatedSaving: 0,
    priority: 'medium' as const,
  })

  tips.push({
    title: '사업용 지출 증빙 관리',
    description: '사업 관련 지출의 적격 증빙을 확보하면 누락 경비를 줄일 수 있습니다',
    estimatedSaving: 0,
    priority: 'medium' as const,
  })

  const potentialSavings = tips.reduce((sum, t) => sum + t.estimatedSaving, 0)
  return { potentialSavings, tips }
}

// ─────────────────────────────────────────────────────────────
// 통합 계산
// ─────────────────────────────────────────────────────────────

export function calcTax(input: TaxInput): TaxResult {
  const vat = calcVat(input.annualRevenue, input.businessType, pos(input.vatPurchase))
  const incomeTax = calcIncomeTax(input)
  const coaching = calcCoaching(input, incomeTax)
  return { vat, incomeTax, coaching }
}
