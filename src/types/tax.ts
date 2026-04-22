export type BusinessType =
  | 'retail'       // 도소매업
  | 'food'         // 음식점/제조
  | 'service'      // 서비스/프리랜서
  | 'real_estate'  // 부동산임대

export type VatType = 'general' | 'simplified' | 'exempt'

export interface TaxInput {
  annualRevenue: number       // 연 매출 (원)
  annualExpense: number       // 경비 (원)
  businessType: BusinessType
  deductions?: number         // 소득공제 (노란우산 등, 원)
}

export interface VatResult {
  vatType: VatType
  estimatedVat: number        // 납부 예상 부가세
  effectiveRate: number       // 실효세율
}

export interface IncomeTaxResult {
  taxableIncome: number       // 과세표준
  taxRate: number             // 한계세율
  incomeTax: number           // 소득세
  localTax: number            // 지방소득세 (10%)
  totalTax: number            // 합계
  bracketLabel: string        // 세율 구간 설명
}

export interface SavingsCoaching {
  potentialSavings: number    // 절세 가능액
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
