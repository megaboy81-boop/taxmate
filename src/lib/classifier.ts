import type { RawTransaction, Transaction, ExpenseCategory, Subscription, ForeignPayment } from '@/types/transaction'

let idSeq = 0
function makeId() { return `tx_${++idSeq}_${Date.now()}` }

// 해외결제 키워드 (영문 상호명, 화폐단위 혼재 패턴)
const FOREIGN_PATTERNS = [
  /\busd\b/i, /\beur\b/i, /\bgbp\b/i, /\bjpy\b/i, /\bcny\b/i,
  /해외/i, /해외가맹점/i, /overseas/i, /\bpaypal\b/i, /\bstripe\b/i,
  /\bapple\.com\/bill/i, /\bgoogle\b.*\b(ireland|llc)\b/i,
  /netlify/i, /vercel/i, /openai/i, /anthropic/i, /github/i,
  /\baws\b/i, /amazon web/i, /cloudflare/i, /digitalocean/i,
  /\badobe\b/i, /\bfigma\b/i, /notion/i,
]

// 구독 서비스 키워드
const SUBSCRIPTION_PATTERNS: { pattern: RegExp; name: string; category: Subscription['category'] }[] = [
  { pattern: /넷플릭스|netflix/i, name: '넷플릭스', category: 'streaming' },
  { pattern: /유튜브.*프리미엄|youtube.*premium/i, name: 'YouTube Premium', category: 'streaming' },
  { pattern: /왓챠|watcha/i, name: '왓챠', category: 'streaming' },
  { pattern: /티빙|tving/i, name: '티빙', category: 'streaming' },
  { pattern: /쿠팡플레이|coupang.*play/i, name: '쿠팡플레이', category: 'streaming' },
  { pattern: /웨이브|wavve/i, name: '웨이브', category: 'streaming' },
  { pattern: /spotify|스포티파이/i, name: 'Spotify', category: 'streaming' },
  { pattern: /멜론|melon/i, name: '멜론', category: 'streaming' },
  { pattern: /지니뮤직|genie/i, name: '지니뮤직', category: 'streaming' },
  { pattern: /chatgpt|openai/i, name: 'ChatGPT', category: 'saas' },
  { pattern: /claude|anthropic/i, name: 'Claude', category: 'saas' },
  { pattern: /notion/i, name: 'Notion', category: 'saas' },
  { pattern: /figma/i, name: 'Figma', category: 'saas' },
  { pattern: /adobe/i, name: 'Adobe', category: 'saas' },
  { pattern: /microsoft 365|office 365/i, name: 'Microsoft 365', category: 'saas' },
  { pattern: /google workspace|gsuite/i, name: 'Google Workspace', category: 'saas' },
  { pattern: /slack/i, name: 'Slack', category: 'saas' },
  { pattern: /zoom/i, name: 'Zoom', category: 'saas' },
  { pattern: /github/i, name: 'GitHub', category: 'saas' },
  { pattern: /aws|amazon web/i, name: 'AWS', category: 'cloud' },
  { pattern: /google cloud|gcp/i, name: 'Google Cloud', category: 'cloud' },
  { pattern: /vercel/i, name: 'Vercel', category: 'cloud' },
  { pattern: /netlify/i, name: 'Netlify', category: 'cloud' },
  { pattern: /digitalocean/i, name: 'DigitalOcean', category: 'cloud' },
  { pattern: /icloud/i, name: 'iCloud', category: 'cloud' },
  { pattern: /네이버플러스|naver.*plus/i, name: '네이버플러스', category: 'other' },
  { pattern: /카카오.*구독|kakao.*plus/i, name: '카카오 구독', category: 'other' },
]

// 카테고리 분류 규칙
const CATEGORY_RULES: { pattern: RegExp; category: ExpenseCategory; deductible: boolean }[] = [
  { pattern: /월세|임대료|임차료|보증금/, category: 'rent', deductible: true },
  { pattern: /급여|인건비|알바|아르바이트|직원/, category: 'salary', deductible: true },
  { pattern: /관리비|전기|수도|가스|도시가스|전력/, category: 'utility', deductible: true },
  { pattern: /통신|kt|skt|lg유플|olleh|t월드/, category: 'telecom', deductible: true },
  { pattern: /재료|원재료|식자재|소모품|문구/, category: 'supply', deductible: true },
  { pattern: /식당|음식|배달|맛집|커피|카페/, category: 'food', deductible: true },
  { pattern: /택시|주유|주차|하이패스|교통|ktx|항공/, category: 'transport', deductible: true },
  { pattern: /광고|마케팅|홍보|sns|인스타|블로그/, category: 'marketing', deductible: true },
  { pattern: /보험/, category: 'insurance', deductible: true },
  { pattern: /학원|교육|책|도서|온라인강의/, category: 'education', deductible: true },
  // 개인지출 (비경비 처리)
  { pattern: /마트|이마트|홈플러스|코스트코|다이소/, category: 'personal', deductible: false },
  { pattern: /병원|약국|의원|한의원/, category: 'personal', deductible: false },
  { pattern: /헬스|피트니스|gym/, category: 'personal', deductible: false },
]

function detectForeign(desc: string): boolean {
  return FOREIGN_PATTERNS.some(p => p.test(desc))
}

function detectSubscription(desc: string): { isSubscription: boolean; info?: typeof SUBSCRIPTION_PATTERNS[0] } {
  const match = SUBSCRIPTION_PATTERNS.find(s => s.pattern.test(desc))
  return { isSubscription: !!match, info: match }
}

function classifyCategory(desc: string): { category: ExpenseCategory; deductible: boolean } {
  const match = CATEGORY_RULES.find(r => r.pattern.test(desc))
  if (match) return { category: match.category, deductible: match.deductible }
  return { category: 'uncategorized', deductible: false }
}

export function classifyTransactions(raws: RawTransaction[]): Transaction[] {
  return raws.map(raw => {
    const d = raw.description
    const isForeign = detectForeign(d)
    const subResult = detectSubscription(d)
    const { category, deductible } = classifyCategory(d)

    const date = new Date(raw.date)
    const year = date.getFullYear()
    const month = date.getMonth() + 1

    let note: string | undefined
    if (isForeign && deductible) {
      note = '⚠ 해외결제: 부가세 매입세액 불공제 대상입니다'
    }

    return {
      ...raw,
      id: makeId(),
      category: subResult.isSubscription ? 'subscription' : isForeign ? 'foreign' : category,
      isDeductible: isForeign ? false : deductible,
      isForeign,
      isSubscription: subResult.isSubscription,
      merchantName: subResult.info?.name,
      note,
      year,
      month,
    }
  })
}

export function extractSubscriptions(transactions: Transaction[]): Subscription[] {
  const map = new Map<string, { amounts: number[]; dates: string[]; isForeign: boolean; category: Subscription['category'] }>()

  for (const tx of transactions) {
    if (!tx.isSubscription) continue
    const key = tx.merchantName ?? tx.description.slice(0, 20)
    const existing = map.get(key)
    const subInfo = SUBSCRIPTION_PATTERNS.find(s => s.pattern.test(tx.description))
    if (existing) {
      existing.amounts.push(tx.amount)
      existing.dates.push(tx.date)
    } else {
      map.set(key, { amounts: [tx.amount], dates: [tx.date], isForeign: tx.isForeign, category: subInfo?.category ?? 'other' })
    }
  }

  return Array.from(map.entries()).map(([name, data]) => {
    const avgAmount = Math.round(data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length)
    const sortedDates = data.dates.sort()
    const lastDate = sortedDates[sortedDates.length - 1]
    const cycle: Subscription['cycle'] = data.amounts.length === 1 ? 'annual' : 'monthly'
    return { name, amount: avgAmount, cycle, lastDate, isForeign: data.isForeign, category: data.category }
  })
}

export function extractForeignPayments(transactions: Transaction[]): ForeignPayment[] {
  return transactions
    .filter(tx => tx.isForeign)
    .map(tx => ({
      date: tx.date,
      description: tx.merchantName ?? tx.description,
      amount: tx.amount,
      warning: '해외결제는 부가세 매입세액 불공제 대상으로, 사업용으로 사용해도 부가세 환급이 불가합니다.',
    }))
}
