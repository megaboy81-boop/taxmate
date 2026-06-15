import type { BusinessTypeKey } from '@/lib/taxData'

/**
 * 업종 타입. taxData.BUSINESS_TYPES 의 키와 동일.
 * 기존 4종(retail/food/service/real_estate)은 그대로 유효하며 4종이 추가됐다(하위호환).
 */
export type BusinessType = BusinessTypeKey

export type VatType = 'general' | 'simplified' | 'exempt'

/** 계산 투명성: 모든 세금 계산은 단계별 산식을 함께 반환한다 (비판전문가 처방 — 신뢰 차별화) */
export interface CalcStep {
  label: string      // 단계 이름 (예: "과세표준")
  basis?: string     // 근거 (법조문/규칙)
  formula?: string   // 산식 (예: "5,000만 × 15% − 126만")
  amount: number     // 결과값 (원)
}

// ── 입력 ──

/** 인적공제 입력 (소득세법 §50~§51) */
export interface PersonalDeductionInput {
  spouse?: boolean        // 배우자 (소득금액 100만 이하 요건 충족 가정)
  dependents?: number     // 부양가족 수 (본인·배우자 제외)
  elderly?: number        // 경로우대(70세↑) 대상 수
  disabled?: number       // 장애인 수
  womanHead?: boolean     // 부녀자공제
  singleParent?: boolean  // 한부모공제
}

/** 세액공제 입력 (소득세법 §59 등) */
export interface TaxCreditInput {
  childrenOver8?: number          // 8세 이상 자녀 수
  pensionSavings?: number         // 연금저축 납입액
  irp?: number                    // IRP 납입액
  isDoubleEntry?: boolean         // 복식부기로 신고
  isSimpleBookEligible?: boolean  // 간편장부대상자 (기장세액공제 요건)
  electronicFiling?: boolean      // 전자신고(홈택스 직접)
  useStandardCredit?: boolean     // 표준세액공제 적용 여부
}

export interface TaxInput {
  annualRevenue: number            // 연 매출(수입금액)
  annualExpense: number            // 경비(실액)
  businessType: BusinessType
  deductions?: number              // (레거시) 단일 소득공제값 — 하위호환용. personalDeduction 우선.
  priorYearRevenue?: number        // 직전연도 수입금액 (경비율·복식부기·성실신고 판정). 없으면 annualRevenue 사용.
  majorExpense?: number            // 주요경비 실액(매입+임차료+인건비) — 기준경비율 계산용
  personalDeduction?: PersonalDeductionInput
  pensionPremium?: number          // 연금보험료공제(국민연금 등 납입액, 전액 공제)
  credits?: TaxCreditInput
  region?: 'metro' | 'non_metro'   // 사업장 수도권 여부 (세액감면용)
  vatPurchase?: number             // 부가세 매입액(공급가액) — 매입세액공제 계산용
}

// ── 결과 ──

export interface VatResult {
  vatType: VatType
  estimatedVat: number
  effectiveRate: number
  steps: CalcStep[]
}

export interface IncomeTaxResult {
  grossIncome: number      // 소득금액 = 수입 − 경비
  totalDeduction: number   // 종합소득공제 합계
  taxableIncome: number    // 과세표준
  taxRate: number          // 한계세율
  calculatedTax: number    // 산출세액 (세액공제 차감 전)
  taxCredits: number       // 세액공제·감면 합계
  incomeTax: number        // 결정 소득세 = max(0, 산출 − 공제)
  localTax: number         // 지방소득세 = 소득세 × 10%
  totalTax: number         // 소득세 + 지방소득세
  bracketLabel: string
  steps: CalcStep[]
}

export interface PersonalDeductionResult {
  total: number
  steps: CalcStep[]
}

export interface TaxCreditResult {
  total: number
  breakdown: { label: string; amount: number; basis: string }[]
}

export interface SavingsCoaching {
  potentialSavings: number
  tips: CoachingTip[]
}

export interface CoachingTip {
  title: string
  description: string
  estimatedSaving: number
  priority: 'high' | 'medium' | 'low'
}

export interface TaxResult {
  vat: VatResult
  incomeTax: IncomeTaxResult
  coaching: SavingsCoaching
}
