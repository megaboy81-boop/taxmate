/**
 * socialInsurance.ts — 지역가입자 사업자 건강보험·국민연금 추정
 * 1인사업자 핵심 페인포인트: 소득 증가 → 다음해 11월 건보료 재산정 "폭탄" 선제 경고.
 * ⚠️ 지역가입자 건보료는 소득 외 재산·자동차도 반영 → 본 추정은 소득 기준 근사치.
 */
import { SOCIAL_INSURANCE } from './taxData'
import type { CalcStep } from '@/types/tax'

const won = (n: number) => Math.round(n).toLocaleString('ko-KR')
const safe = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

export interface InsuranceEstimate {
  year: number
  annualHealth: number     // 연 건강보험료(장기요양 포함)
  annualPension: number    // 연 국민연금
  monthlyHealth: number
  monthlyPension: number
  steps: CalcStep[]
  disclaimer: string
}

const FALLBACK_YEAR = 2026

export function estimateSocialInsurance(annualBusinessIncome: number, year = 2026): InsuranceEstimate {
  const income = safe(annualBusinessIncome)
  const healthRate = SOCIAL_INSURANCE.healthRateByYear[year] ?? SOCIAL_INSURANCE.healthRateByYear[FALLBACK_YEAR]
  const ltcRate = SOCIAL_INSURANCE.longTermCareRateByYear[year] ?? SOCIAL_INSURANCE.longTermCareRateByYear[FALLBACK_YEAR]
  const pensionRate = SOCIAL_INSURANCE.nationalPensionRateByYear[year] ?? SOCIAL_INSURANCE.nationalPensionRateByYear[FALLBACK_YEAR]
  const pensionCap = SOCIAL_INSURANCE.nationalPensionCapByYear[year] ?? SOCIAL_INSURANCE.nationalPensionCapByYear[FALLBACK_YEAR]
  const monthlyIncome = income / 12

  const monthlyHealthBase = Math.round(monthlyIncome * healthRate)
  const monthlyLongTerm = Math.round(monthlyHealthBase * ltcRate)
  const monthlyHealth = monthlyHealthBase + monthlyLongTerm
  const annualHealth = monthlyHealth * 12

  const pensionBase = Math.min(Math.max(monthlyIncome, SOCIAL_INSURANCE.nationalPensionFloor), pensionCap)
  const monthlyPension = Math.round(pensionBase * pensionRate)
  const annualPension = monthlyPension * 12

  const steps: CalcStep[] = [
    { label: `건강보험료 (${year}년 ${(healthRate * 100).toFixed(2)}%)`, basis: '보건복지부 고시', formula: `월소득 ${won(monthlyIncome)} × ${(healthRate * 100).toFixed(2)}%`, amount: monthlyHealthBase },
    { label: `장기요양보험료 (건보료의 ${(ltcRate * 100).toFixed(2)}%)`, formula: `${won(monthlyHealthBase)} × ${(ltcRate * 100).toFixed(2)}%`, amount: monthlyLongTerm },
    { label: `국민연금 (${(pensionRate * 100).toFixed(1)}%)`, basis: '국민연금법 (상한 기준소득월액 적용)', formula: `${won(pensionBase)} × ${(pensionRate * 100).toFixed(1)}%`, amount: monthlyPension },
  ]

  return {
    year, annualHealth, annualPension, monthlyHealth, monthlyPension, steps,
    disclaimer: '지역가입자 건강보험료는 소득 외 재산·자동차도 반영되므로 본 추정은 소득 기준 근사치입니다. 정확한 금액은 건강보험공단 확인이 필요합니다.',
  }
}

/** 내년 건보료 변동 예상 (올해 소득이 작년보다 늘면 다음해 11월 재산정으로 인상) */
export function projectNextYearHealth(thisYearIncome: number, lastYearIncome: number, nextYear = 2026) {
  const cur = estimateSocialInsurance(safe(lastYearIncome), nextYear)
  const next = estimateSocialInsurance(safe(thisYearIncome), nextYear)
  const deltaMonthly = next.monthlyHealth - cur.monthlyHealth
  return {
    currentMonthly: cur.monthlyHealth,
    projectedMonthly: next.monthlyHealth,
    deltaMonthly,
    deltaAnnual: deltaMonthly * 12,
    warning: deltaMonthly > 1000
      ? `소득 증가로 내년 건강보험료가 월 약 ${won(deltaMonthly)}원(연 ${won(deltaMonthly * 12)}원) 오를 것으로 예상됩니다. 미리 대비하세요.`
      : '소득 변동에 따른 건강보험료 인상은 크지 않을 것으로 보입니다.',
  }
}
