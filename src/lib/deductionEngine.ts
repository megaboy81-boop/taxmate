import type { Transaction, DeductionItem, DeductionType } from '@/types/transaction'
import type { BusinessType } from '@/types/tax'

// 공제 한도표
const DEDUCTION_LIMITS: Record<DeductionType, { max: number; label: string; description: string; priority: 'high' | 'medium' | 'low' }> = {
  yellow_umbrella:  { max: 6_000_000,  label: '노란우산공제',      description: '폐업·노령 시 원금+이자 수령, 소득별 연 최대 600/400/200만원 소득공제(2025 상향)',  priority: 'high' },
  pension_savings:  { max: 6_000_000,  label: '연금저축',          description: '납입액의 12~15% 세액공제 (총급여 5,500만 이하 15%)',     priority: 'high' },
  irp:              { max: 3_000_000,  label: 'IRP (퇴직연금)',    description: '연금저축과 합산 최대 900만원, 12~15% 세액공제',           priority: 'high' },
  national_pension: { max: 0,          label: '국민연금',          description: '납입액 전액 소득공제 (한도 없음)',                         priority: 'high' },
  health_insurance: { max: 0,          label: '건강보험료',        description: '납입액 전액 소득공제',                                     priority: 'high' },
  family_salary:    { max: 0,          label: '가족 인건비',       description: '실 근무 가족 급여 원천세(3.3%) 신고 시 전액 경비 인정',    priority: 'medium' },
  business_card:    { max: 0,          label: '사업용 신용카드',   description: '사업용 카드 등록 시 지출 증빙 간소화, 경비 인정',          priority: 'medium' },
  medical:          { max: 2_000_000,  label: '의료비 세액공제',   description: '총급여 3% 초과분의 15% 세액공제',                         priority: 'low' },
  education:        { max: 3_000_000,  label: '교육비 세액공제',   description: '자녀 교육비 15% 세액공제 (유치원~고교)',                   priority: 'low' },
  donation:         { max: 0,          label: '기부금 세액공제',   description: '법정 기부금 전액, 지정 기부금 30% 한도',                   priority: 'low' },
  housing:          { max: 1_800_000,  label: '주택임차 차입금',   description: '전세자금 대출이자 40% 세액공제, 연 180만원 한도',          priority: 'low' },
  other:            { max: 0,          label: '기타 공제',         description: '',                                                         priority: 'low' },
}

export interface DeductionGap {
  type: DeductionType
  label: string
  description: string
  claimed: number        // 이미 공제받은 금액
  available: number      // 추가 공제 가능 금액
  maxLimit: number       // 최대 한도
  taxSaving: number      // 예상 절세액 (한계세율 적용)
  priority: 'high' | 'medium' | 'low'
}

export interface DeductionAnalysis {
  gaps: DeductionGap[]
  totalClaimedDeduction: number
  totalAvailableDeduction: number
  totalPotentialTaxSaving: number
  alreadySavedTax: number
}

// 거래내역에서 공제 항목 자동 감지
export function detectDeductionsFromTransactions(transactions: Transaction[]): Partial<Record<DeductionType, number>> {
  const detected: Partial<Record<DeductionType, number>> = {}

  for (const tx of transactions) {
    const d = tx.description.toLowerCase()

    if (/노란우산|공제회/.test(d)) {
      detected.yellow_umbrella = (detected.yellow_umbrella ?? 0) + tx.amount
    }
    if (/연금저축|연금신탁/.test(d)) {
      detected.pension_savings = (detected.pension_savings ?? 0) + tx.amount
    }
    if (/irp|퇴직연금|개인형irp/.test(d)) {
      detected.irp = (detected.irp ?? 0) + tx.amount
    }
    if (/국민연금/.test(d)) {
      detected.national_pension = (detected.national_pension ?? 0) + tx.amount
    }
    if (/건강보험|건강보험료/.test(d)) {
      detected.health_insurance = (detected.health_insurance ?? 0) + tx.amount
    }
  }

  return detected
}

export function analyzeDeductions(
  importedItems: DeductionItem[],
  detectedFromBank: Partial<Record<DeductionType, number>>,
  annualRevenue: number,
  marginalRate: number,
): DeductionAnalysis {
  const claimedMap: Partial<Record<DeductionType, number>> = {}

  for (const item of importedItems) {
    claimedMap[item.type] = (claimedMap[item.type] ?? 0) + item.amount
  }
  for (const [type, amount] of Object.entries(detectedFromBank) as [DeductionType, number][]) {
    claimedMap[type] = Math.max(claimedMap[type] ?? 0, amount)
  }

  const gaps: DeductionGap[] = []
  let totalClaimedDeduction = 0
  let totalAvailableDeduction = 0
  let alreadySavedTax = 0
  let totalPotentialTaxSaving = 0

  const keyTypes: DeductionType[] = ['yellow_umbrella', 'pension_savings', 'irp', 'national_pension', 'health_insurance', 'family_salary', 'business_card']

  for (const type of keyTypes) {
    const info = DEDUCTION_LIMITS[type]
    const claimed = claimedMap[type] ?? 0
    const available = info.max > 0 ? Math.max(0, info.max - claimed) : 0

    totalClaimedDeduction += claimed
    totalAvailableDeduction += available

    const claimedTaxSaving = Math.round(claimed * marginalRate)
    const potentialTaxSaving = Math.round(available * marginalRate)

    alreadySavedTax += claimedTaxSaving
    totalPotentialTaxSaving += potentialTaxSaving

    if (info.priority !== 'low' || claimed > 0 || available > 0) {
      gaps.push({
        type,
        label: info.label,
        description: info.description,
        claimed,
        available,
        maxLimit: info.max,
        taxSaving: potentialTaxSaving,
        priority: info.priority,
      })
    }
  }

  return {
    gaps: gaps.sort((a, b) => b.taxSaving - a.taxSaving),
    totalClaimedDeduction,
    totalAvailableDeduction,
    totalPotentialTaxSaving,
    alreadySavedTax,
  }
}

// 절세 코멘트 생성 (Claude API 없이도 룰 기반)
export function generateSavingComments(
  analysis: DeductionAnalysis,
  annualRevenue: number,
  businessType: BusinessType,
): string[] {
  const comments: string[] = []
  const rate = annualRevenue > 88_000_000 ? '35%' : annualRevenue > 50_000_000 ? '24%' : '15%'

  const notClaimed = analysis.gaps.filter(g => g.claimed === 0 && g.priority === 'high')
  if (notClaimed.length > 0) {
    comments.push(`🔴 아직 미가입: ${notClaimed.map(g => g.label).join(', ')} — 최대 ${notClaimed.reduce((s, g) => s + g.taxSaving, 0).toLocaleString('ko-KR')}원 절세 가능`)
  }

  const partial = analysis.gaps.filter(g => g.claimed > 0 && g.available > 0)
  if (partial.length > 0) {
    comments.push(`🟡 한도 미달: ${partial.map(g => `${g.label} ${g.available.toLocaleString('ko-KR')}원 추가 가능`).join(' / ')}`)
  }

  if (analysis.alreadySavedTax > 0) {
    comments.push(`✅ 이미 절세 중: 연 ${analysis.alreadySavedTax.toLocaleString('ko-KR')}원 (한계세율 ${rate} 적용)`)
  }

  if (analysis.totalPotentialTaxSaving > 0) {
    comments.push(`💡 추가 절세 가능: 최대 ${analysis.totalPotentialTaxSaving.toLocaleString('ko-KR')}원 — 지금 바로 시작하세요`)
  }

  return comments
}
