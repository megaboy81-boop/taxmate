/**
 * taxData.ts — TaxMate 세무 상수 정본 (Single Source of Truth)
 * =============================================================
 * 모든 세율·한도·공제액을 이 파일 한 곳에 집약하고, 각 값에 [근거]와 [발효]를 명시한다.
 * 세법 개정 시 이 파일만 고치면 되고, taxData.test.ts / taxEngine.test.ts 가 회귀를 막는다.
 *
 * 기준: 2025년 귀속(2026년 5월 신고) 현행.
 * 검증: 세무회계 NLM + 웹(국세청·보건복지부 공식) + codex 교차검증 (2026-06).
 *
 * ⚠️ 본 데이터는 일반 추정용 참고자료다. 실제 신고는 홈택스 또는 세무사 확인이 필요하다.
 *    개별 업종코드별 단순/기준경비율은 국세청 고시에 따라 상이하므로, 아래 값은 대표 예시값이다.
 */

/** 귀속연도(소득이 발생한 해). 신고는 다음 해 5월. */
export const TAX_YEAR = 2025

// ─────────────────────────────────────────────────────────────
// 1. 종합소득세 (소득세법 §55)
// ─────────────────────────────────────────────────────────────

/** 과세표준 누진세율 8구간 [근거] 소득세법 §55 ① [발효] 2023.1.1~ 현행 */
export const INCOME_TAX_BRACKETS = [
  { limit: 14_000_000,    rate: 0.06, progressiveDeduction: 0,          label: '6%' },
  { limit: 50_000_000,    rate: 0.15, progressiveDeduction: 1_260_000,  label: '15%' },
  { limit: 88_000_000,    rate: 0.24, progressiveDeduction: 5_760_000,  label: '24%' },
  { limit: 150_000_000,   rate: 0.35, progressiveDeduction: 15_440_000, label: '35%' },
  { limit: 300_000_000,   rate: 0.38, progressiveDeduction: 19_940_000, label: '38%' },
  { limit: 500_000_000,   rate: 0.40, progressiveDeduction: 25_940_000, label: '40%' },
  { limit: 1_000_000_000, rate: 0.42, progressiveDeduction: 35_940_000, label: '42%' },
  { limit: Infinity,      rate: 0.45, progressiveDeduction: 65_940_000, label: '45%' },
] as const

/** 지방소득세율 = 산출세액 × 10% [근거] 지방세법 §92, §103의3 */
export const LOCAL_INCOME_TAX_RATE = 0.10

// ─────────────────────────────────────────────────────────────
// 2. 인적공제 (소득세법 §50~§51)
// ─────────────────────────────────────────────────────────────

/** 기본공제 1인당 금액 [근거] 소득세법 §50 (본인·배우자·부양가족, 연소득금액 100만원 이하 요건) */
export const BASIC_DEDUCTION_PER_PERSON = 1_500_000

/** 추가공제 [근거] 소득세법 §51 */
export const ADDITIONAL_DEDUCTION = {
  elderly: 1_000_000,   // 경로우대: 만 70세 이상, 1인당
  disabled: 2_000_000,  // 장애인: 1인당
  womanHead: 500_000,   // 부녀자공제 (종합소득금액 3,000만원 이하 요건)
  singleParent: 1_000_000, // 한부모 (부녀자공제와 중복 시 한부모 적용)
} as const

/** 부녀자공제 소득 상한 [근거] 소득세법 §51 ① 3호 */
export const WOMAN_HEAD_INCOME_CEILING = 30_000_000

// ─────────────────────────────────────────────────────────────
// 3. 세액공제 (소득세법 §59 등)
// ─────────────────────────────────────────────────────────────

/**
 * 자녀세액공제 (8세 이상 자녀) [근거] 소득세법 §59의2
 * [발효] 2024년 귀속분부터 인상: 첫째 25만 / 둘째 30만 / 셋째 이후 1인당 40만
 */
export const CHILD_TAX_CREDIT = {
  first: 250_000,
  second: 300_000,
  thirdPlusEach: 400_000,
} as const

/** 표준세액공제 (사업소득자, 특별공제 미적용 시) [근거] 소득세법 §59의4 ⑨ */
export const STANDARD_TAX_CREDIT = 70_000

/** 기장세액공제: 산출세액의 20%, 한도 100만 (간편장부대상자가 복식부기로 신고 시) [근거] 소득세법 §56의2 */
export const BOOKKEEPING_TAX_CREDIT_RATE = 0.20
export const BOOKKEEPING_TAX_CREDIT_CAP = 1_000_000

/** 전자신고세액공제 (납세자 직접 전자신고) [근거] 조특법 §104의8 */
export const ELECTRONIC_FILING_TAX_CREDIT = 20_000

/**
 * 연금계좌세액공제 [근거] 소득세법 §59의3
 * 연금저축 600만 + IRP 합산 900만 한도. 종합소득금액 4,500만 이하(총급여 5,500만) 15%, 초과 12%.
 */
export const PENSION_CREDIT = {
  pensionSavingsCap: 6_000_000,
  totalCap: 9_000_000,
  highRate: 0.15,
  lowRate: 0.12,
  highRateIncomeCeiling: 45_000_000, // 종합소득금액 기준
} as const

// ─────────────────────────────────────────────────────────────
// 4. 부가가치세 (부가가치세법)
// ─────────────────────────────────────────────────────────────

export const VAT_GENERAL_RATE = 0.10           // 일반과세 [근거] 부가법 §30
export const VAT_SIMPLIFIED_THRESHOLD = 104_000_000  // 간이과세 기준 직전연도 공급대가 [발효] 2024.7.1~
export const VAT_EXEMPT_THRESHOLD = 48_000_000       // 간이과세 납부의무 면제 [근거] 부가법 §69
export const VAT_SIMPLIFIED_INPUT_CREDIT_RATE = 0.005 // 간이 매입세액공제 = 매입공급대가 × 0.5% [근거] 부가법 §63

// ─────────────────────────────────────────────────────────────
// 5. 업종 정의 — 경비율 군(가/나/다) + 간이 부가가치율 + 대표 경비율
// ─────────────────────────────────────────────────────────────

export type ExpenseGroup = '가' | '나' | '다'

/**
 * 간이과세 업종별 부가가치율 [근거] 부가법 시행령 §111 ② [발효] 2024.7.1~ (15/20/25/30/40%)
 * 추계 경비율 적용·복식부기·성실신고 기준은 경비율 군(가/나/다)에 연동.
 *
 * ⚠️ 단순/기준경비율(simpleRate/standardRate)은 업종코드별로 상이한 대표 예시값이다.
 *    정확한 값은 국세청 "업종별 기준·단순경비율" 고시 참조.
 */
export interface BusinessTypeInfo {
  label: string
  group: ExpenseGroup
  vatValueAddedRate: number  // 간이과세 부가가치율
  simpleRate: number         // 대표 단순경비율
  standardRate: number       // 대표 기준경비율
}

export const BUSINESS_TYPES = {
  retail:        { label: '도·소매업',           group: '가', vatValueAddedRate: 0.15, simpleRate: 0.90, standardRate: 0.20 },
  food:          { label: '음식점업',             group: '나', vatValueAddedRate: 0.15, simpleRate: 0.89, standardRate: 0.15 },
  manufacturing: { label: '제조업',               group: '나', vatValueAddedRate: 0.20, simpleRate: 0.85, standardRate: 0.18 },
  accommodation: { label: '숙박업',               group: '나', vatValueAddedRate: 0.25, simpleRate: 0.83, standardRate: 0.18 },
  construction:  { label: '건설업',               group: '나', vatValueAddedRate: 0.30, simpleRate: 0.82, standardRate: 0.17 },
  service:       { label: '기타 서비스업(미용·수리·학원 등)', group: '다', vatValueAddedRate: 0.30, simpleRate: 0.70, standardRate: 0.17 },
  professional:  { label: '전문·과학·기술 서비스업(프리랜서 전문직)', group: '다', vatValueAddedRate: 0.40, simpleRate: 0.65, standardRate: 0.16 },
  real_estate:   { label: '부동산임대업',         group: '다', vatValueAddedRate: 0.40, simpleRate: 0.42, standardRate: 0.10 },
} as const satisfies Record<string, BusinessTypeInfo>

export type BusinessTypeKey = keyof typeof BUSINESS_TYPES

/**
 * 경비율 군별 기준금액 (직전연도 수입금액) [근거] 소득세법 시행령 §143, §208
 *  - simpleRateCeiling: 이 금액 미만이면 단순경비율, 이상이면 기준경비율 적용
 *  - doubleEntryThreshold: 이 금액 이상이면 복식부기 의무 (미만은 간편장부 대상)
 *  - sincereThreshold: 이 금액 이상이면 성실신고확인대상 [근거] 소득세법 §70의2
 */
/** 기준경비율 추계소득금액 비교 배율 [근거] 소득세법 시행령 §143 ③ (간편장부 2.8배 / 복식부기의무 3.4배) */
export const STANDARD_EXPENSE_MULTIPLIER = { simpleBook: 2.8, doubleEntry: 3.4 } as const

export const EXPENSE_GROUP_THRESHOLDS: Record<ExpenseGroup, {
  simpleRateCeiling: number
  doubleEntryThreshold: number
  sincereThreshold: number
}> = {
  '가': { simpleRateCeiling: 60_000_000, doubleEntryThreshold: 300_000_000, sincereThreshold: 1_500_000_000 },
  '나': { simpleRateCeiling: 36_000_000, doubleEntryThreshold: 150_000_000, sincereThreshold:   750_000_000 },
  '다': { simpleRateCeiling: 24_000_000, doubleEntryThreshold:  75_000_000, sincereThreshold:   500_000_000 },
}

// ─────────────────────────────────────────────────────────────
// 6. 노란우산공제 — 사업소득금액별 차등한도 (조특법 §86의3)
// ─────────────────────────────────────────────────────────────

/**
 * [근거] 조특법 §86의3 소기업·소상공인 공제부금 소득공제 한도 (사업소득금액 기준)
 * [발효] 2025.1.1 납입분~ 상향: 600만 / 400만 / 200만 (정책브리핑 2025 세법개정)
 */
export const YELLOW_UMBRELLA_LIMITS = [
  { incomeCeiling: 40_000_000,  limit: 6_000_000 }, // 4천만 이하: 600만 (2025 상향)
  { incomeCeiling: 100_000_000, limit: 4_000_000 }, // 4천만 초과 ~ 1억 이하: 400만 (2025 상향)
  { incomeCeiling: Infinity,    limit: 2_000_000 }, // 1억 초과: 200만
] as const

// ─────────────────────────────────────────────────────────────
// 7. 절세 세액공제·감면
// ─────────────────────────────────────────────────────────────

/**
 * 중소기업특별세액감면 [근거] 조특법 §7 [발효] 2025년 현행
 * 소기업/중기업 × 수도권/수도권외 × 업종별 차등. 아래는 소기업 대표 감면율.
 * 부동산임대·소비성서비스(유흥 등)·전문직(변호사·의사 등 면허서비스)은 제외.
 * 연간 한도 1억 (상시근로자 감소 시 1인당 500만원 차감).
 */
export const SME_SPECIAL_REDUCTION = {
  cap: 100_000_000,
  // [업종군][지역] 소기업 감면율
  smallBusiness: {
    // 도소매·의료업(현금수입업종): 소기업 10% — 지역 무관 [근거] 조특법 §7 ①2호
    wholesaleRetailMedical: { metro: 0.10, nonMetro: 0.10 },
    // 제조·건설·기타 감면대상 소기업: 수도권 20%, 수도권외 30% [근거] 조특법 §7 ①2호
    others: { metro: 0.20, nonMetro: 0.30 },
  },
  // 중기업 감면율: 도소매·의료 수도권외 5%, 기타 수도권외 15%, 수도권 0%
  mediumBusiness: {
    wholesaleRetailMedical: { metro: 0.0, nonMetro: 0.05 },
    others: { metro: 0.0, nonMetro: 0.15 },
  },
  excludedTypes: ['real_estate'] as BusinessTypeKey[],
} as const

/**
 * 중소기업특별세액감면 업종 적격성 (조특법 §7 감면대상 업종 매핑)
 *  - wholesale_retail: 도소매·의료업 특례율(소기업 10%)
 *  - general: 제조·건설·숙박·음식 등 일반 감면율(소기업 수도권20/외30)
 *  - needs_review: 일부만 해당(전문직·개인서비스) — 과다공제 방지 위해 미적용 + 확인 안내
 *  - excluded: 부동산임대·소비성서비스 등 제외
 */
export const SME_ELIGIBILITY: Record<BusinessTypeKey, 'wholesale_retail' | 'general' | 'needs_review' | 'excluded'> = {
  retail: 'wholesale_retail',
  food: 'general',
  manufacturing: 'general',
  accommodation: 'general',
  construction: 'general',
  service: 'needs_review',
  professional: 'needs_review',
  real_estate: 'excluded',
}

/** 신용카드등 발행세액공제 적격 업종 (부가법 §46 최종소비자 대상) */
export const CARD_CREDIT_ELIGIBLE: BusinessTypeKey[] = ['retail', 'food', 'accommodation', 'service']

/**
 * 신용카드등 발행세액공제 [근거] 부가법 §46 [발효] 2026.12.31까지 한시 1.3%/1,000만
 * 직전연도 공급가액 10억 이하 개인사업자(소매·음식·숙박 등 최종소비자 대상).
 */
export const CARD_ISSUANCE_CREDIT = {
  rate: 0.013,                  // 한시: 1.3% (2027~ 1.0%)
  annualCap: 10_000_000,        // 한시: 1,000만 (2027~ 500만)
  revenueCeiling: 1_000_000_000, // 직전연도 공급가액 10억 이하
  sunsetDate: '2026-12-31',
} as const

/**
 * 의제매입세액공제 [근거] 부가법 §42 — 면세 농·축·수·임산물 매입분
 * 공제율: 음식점 개인 8/108, 제조 4/104(중소·과자점 6/106).
 * 과세표준 한도율(개인 음식점): 1억 이하 75%, 1억~2억 70%, 2억 초과 60%.
 */
export const DEEMED_INPUT_CREDIT = {
  rates: {
    foodUnder2: 9 / 109,     // 음식점 개인, 과세표준 2억 이하 특례 (한시)
    foodOver2: 8 / 108,      // 음식점 개인, 과세표준 2억 초과
    manufacturing: 4 / 104,  // 일반 제조
  },
  // 음식점 개인 과세표준 구간별 한도율
  foodLimitRates: [
    { taxBaseCeiling: 100_000_000, rate: 0.75 },
    { taxBaseCeiling: 200_000_000, rate: 0.70 },
    { taxBaseCeiling: Infinity,    rate: 0.60 },
  ],
  // 음식점 외 개인사업자(제조 등) 한도율
  otherLimitRates: [
    { taxBaseCeiling: 200_000_000, rate: 0.65 },
    { taxBaseCeiling: Infinity,    rate: 0.55 },
  ],
} as const

// ─────────────────────────────────────────────────────────────
// 8. 사회보험 추정 (지역가입자 사업자 기준)
// ─────────────────────────────────────────────────────────────

/**
 * 건강보험·국민연금 [근거] 보건복지부 고시 / 국민연금법
 *  - 건강보험료율: 2025년 7.09% → 2026년 7.19% (보건복지부 2025.9 보도자료 확정)
 *  - 장기요양보험료율 = 건강보험료 × 12.95% (2025)
 *  - 국민연금: 9% (지역가입자 본인 전액), 기준소득월액 상한 617만(2025.7~)
 *  ⚠️ 지역가입자 건보료는 소득 외 재산·자동차도 반영 → 본 추정은 소득 기준 근사치.
 */
export const SOCIAL_INSURANCE = {
  // 건강보험료율 [근거] 보건복지부: 2025 7.09% → 2026 7.19%
  healthRateByYear: { 2025: 0.0709, 2026: 0.0719 } as Record<number, number>,
  // 장기요양보험료율(건보료 대비) [근거] 보건복지부: 2025 12.95% → 2026 13.14%
  longTermCareRateByYear: { 2025: 0.1295, 2026: 0.1314 } as Record<number, number>,
  // 국민연금 보험료율 [근거] 2025 연금개혁: 2026.1.1부터 9.0%→9.5% (2033년 13%까지 단계 인상)
  nationalPensionRateByYear: { 2025: 0.09, 2026: 0.095 } as Record<number, number>,
  // 국민연금 기준소득월액 상한 (7월 기준 변경): 2025.7~2026.6 637만, 2026.7~ 659만.
  // 연간 추정은 하반기 기준 적용(보수적): 2025=637만, 2026=659만
  nationalPensionCapByYear: { 2025: 6_370_000, 2026: 6_590_000 } as Record<number, number>,
  nationalPensionFloor: 400_000,
} as const

/**
 * 업종별 간이과세 기준금액 (직전연도 공급대가) [근거] 부가법 §61, 시행령 §109
 * 부동산임대업·과세유흥장소는 4,800만원 이상이면 간이배제(일반과세). 일반 업종은 1.04억.
 * (해당 업종은 4,800만원 미만일 때만 간이과세 → 동시에 납부면제 구간)
 */
export const VAT_SIMPLIFIED_THRESHOLD_BY_TYPE: Partial<Record<BusinessTypeKey, number>> = {
  real_estate: 48_000_000,
}
