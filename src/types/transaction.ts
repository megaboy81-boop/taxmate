// 거래내역 분류 카테고리
export type ExpenseCategory =
  | 'rent'          // 임대료
  | 'salary'        // 인건비
  | 'utility'       // 공과금·관리비
  | 'telecom'       // 통신비
  | 'supply'        // 원재료·소모품
  | 'food'          // 식비·접대비
  | 'transport'     // 교통·차량
  | 'marketing'     // 광고·마케팅
  | 'subscription'  // 구독서비스
  | 'foreign'       // 해외결제
  | 'insurance'     // 보험료
  | 'education'     // 교육·도서
  | 'personal'      // 개인지출 (비경비)
  | 'family'        // 가족지출
  | 'uncategorized' // 미분류

// 통장 원본 거래
export interface RawTransaction {
  date: string          // YYYY-MM-DD
  description: string   // 적요
  amount: number        // 금액 (출금 양수, 입금 음수)
  balance?: number      // 잔액
  bankCode?: string     // 은행 식별
  raw: string           // 원본 행
}

// 분류된 거래
export interface Transaction extends RawTransaction {
  id: string
  category: ExpenseCategory
  isDeductible: boolean
  isForeign: boolean
  isSubscription: boolean
  merchantName?: string     // 정제된 상호명
  note?: string             // 경고/메모
  year: number
  month: number
}

// 구독 서비스
export interface Subscription {
  name: string
  amount: number
  cycle: 'monthly' | 'annual'
  lastDate: string
  nextDate?: string
  isForeign: boolean
  category: 'streaming' | 'saas' | 'cloud' | 'other'
}

// 해외결제 항목
export interface ForeignPayment {
  date: string
  description: string
  amount: number
  currency?: string
  warning: string  // 부가세 매입세액 불공제 안내
}

// 절세 공제 항목 (기존 공제 데이터 임포트용)
export interface DeductionItem {
  type: DeductionType
  amount: number
  year: number
  source: 'homtax' | 'manual' | 'card'  // 출처
  label: string
}

export type DeductionType =
  | 'yellow_umbrella'     // 노란우산공제
  | 'pension_savings'     // 연금저축
  | 'irp'                 // IRP
  | 'national_pension'    // 국민연금
  | 'health_insurance'    // 건강보험
  | 'family_salary'       // 가족 인건비
  | 'business_card'       // 사업용 신용카드
  | 'medical'             // 의료비
  | 'education'           // 교육비
  | 'donation'            // 기부금
  | 'housing'             // 주택관련
  | 'other'

// 업로드된 파일 파싱 결과
export interface ParseResult {
  transactions: RawTransaction[]
  source: 'bank' | 'card' | 'homtax'
  bankName?: string
  period?: { from: string; to: string }
  totalRows: number
  errorRows: number
}

// 연도별 비교 데이터
export interface YearlyComparison {
  year: number
  totalExpense: number
  deductibleExpense: number
  nonDeductible: number
  foreignPayments: number
  subscriptionCost: number
}

// 전체 분석 결과
export interface AnalysisResult {
  transactions: Transaction[]
  subscriptions: Subscription[]
  foreignPayments: ForeignPayment[]
  yearlyComparisons: YearlyComparison[]
  deductionItems: DeductionItem[]
  summary: {
    totalExpense: number
    deductibleExpense: number
    potentialDeduction: number        // 더 받을 수 있는 공제
    alreadyClaimed: number            // 이미 공제받은 금액
    missedDeduction: number           // 놓친 공제
    foreignPaymentTotal: number
    subscriptionTotal: number
    topCategories: { category: ExpenseCategory; amount: number }[]
  }
}
