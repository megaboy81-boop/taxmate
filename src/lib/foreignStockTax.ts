export interface ForeignStockTrade {
  id: string;               // 행 고유 ID (crypto.randomUUID)
  ticker: string;           // 종목명/티커
  quantity: number;         // 수량
  buyDate: string;          // 매수일 YYYY-MM-DD
  buyPriceUSD: number;      // 매수가($ per share)
  buyExchangeRate: number;  // 매수일 환율 (₩/$)  — 서울외국환중개 매매기준율(deal_bas_r)
  sellDate: string;         // 매도일 YYYY-MM-DD
  sellPriceUSD: number;     // 매도가($ per share)
  sellExchangeRate: number; // 매도일 환율 (₩/$)  — 서울외국환중개 매매기준율(deal_bas_r)
  feeKRW: number;           // 거래수수료(원)
}

export interface TradeDetail {
  ticker: string;
  quantity: number;
  buyDate: string;
  sellDate: string;
  proceedsKRW: number;      // 양도가액(₩)
  costKRW: number;          // 취득가액(₩)
  feeKRW: number;
  gainKRW: number;          // 차익(음수=손실)
}

export interface ForeignStockTaxResult {
  breakdown: TradeDetail[];
  totalGain: number;        // 손익통산 합계
  basicDeduction: number;   // 기본공제 250만
  taxableAmount: number;    // 과세표준 (max 0)
  incomeTax: number;        // 양도세 20%
  localTax: number;         // 지방소득세 2%
  tax: number;              // 납부 예상세액 (합계 22%)
}

const BASIC_DEDUCTION = 2_500_000; // 250만원
const TAX_RATE = 0.20;            // 양도소득세 20%
const LOCAL_TAX_RATE = 0.02;      // 지방소득세 2%

// H-1: 입력값 방어 검증 헬퍼 (양수 유한값 — 0 허용 안 함)
function assertPositiveFinite(v: number, field: string): void {
  if (!isFinite(v) || v <= 0) {
    throw new Error(`${field} 값이 잘못되었습니다: ${v}`);
  }
}

// N-M1: 수수료 등 0 이상 유한값 검증 헬퍼 (음수/NaN 차단, 0은 허용)
function assertNonNegativeFinite(v: number, field: string): void {
  if (!isFinite(v) || v < 0) {
    throw new Error(`${field} 값이 잘못되었습니다: ${v}`);
  }
}

// P0-NEW: SEC 2024-05-28부터 미국주식 T+1 결제 (이전: T+2)
const US_T1_EFFECTIVE_DATE = '2024-05-28';

export function getSettlementDays(tradeDate: string): number {
  return tradeDate >= US_T1_EFFECTIVE_DATE ? 1 : 2;
}

// P1-A: NYSE 휴장일 2024~2026
export const US_MARKET_HOLIDAYS: string[] = [
  // 2024
  '2024-01-01','2024-01-15','2024-02-19','2024-03-29','2024-05-27','2024-06-19','2024-07-04','2024-09-02','2024-11-28','2024-12-25',
  // 2025
  '2025-01-01','2025-01-20','2025-02-17','2025-04-18','2025-05-26','2025-06-19','2025-07-04','2025-09-01','2025-11-27','2025-12-25',
  // 2026
  '2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25',
];

// P1-A: 한국 공휴일 2025~2026 (환율 고시일 영향)
export const KR_HOLIDAYS: string[] = [
  '2025-01-01','2025-01-28','2025-01-29','2025-01-30','2025-03-03','2025-05-05','2025-05-06','2025-06-06','2025-08-15','2025-10-03','2025-10-06','2025-10-07','2025-10-08','2025-10-09','2025-12-25',
  '2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-03-02','2026-05-05','2026-05-25','2026-06-08','2026-08-15','2026-09-25','2026-09-26','2026-09-27','2026-10-03','2026-10-09','2026-12-25',
];

// T+N 영업일 헬퍼 (결제일 계산 — P0-1, P0-NEW, P1-A)
// holidays: NYSE 휴장일 배열 전달 시 공휴일도 영업일에서 제외
export function addBusinessDays(dateStr: string, days: number, holidays: string[] = []): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    const iso = d.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidays.includes(iso)) added++;
  }
  return d.toISOString().slice(0, 10);
}

export function calculateForeignStockTax(
  trades: ForeignStockTrade[],
  basicDeduction: number = BASIC_DEDUCTION,
): ForeignStockTaxResult {
  // P0-2: basicDeduction 파라미터 검증
  assertNonNegativeFinite(basicDeduction, '기본공제');

  const breakdown: TradeDetail[] = trades.map((t) => {
    // H-1: 각 거래별 핵심 필드 양수 유한값 검증
    assertPositiveFinite(t.quantity, '수량');
    assertPositiveFinite(t.buyPriceUSD, '매수가($)');
    assertPositiveFinite(t.sellPriceUSD, '매도가($)');
    assertPositiveFinite(t.buyExchangeRate, '매수 결제일 환율');
    assertPositiveFinite(t.sellExchangeRate, '매도 결제일 환율');
    // N-M1: 수수료는 0 허용, 음수/NaN 차단
    assertNonNegativeFinite(t.feeKRW, '수수료');

    const proceedsKRW = t.sellPriceUSD * t.quantity * t.sellExchangeRate;
    const costKRW = t.buyPriceUSD * t.quantity * t.buyExchangeRate;
    const gainKRW = proceedsKRW - costKRW - t.feeKRW;

    return {
      ticker: t.ticker,
      quantity: t.quantity,
      buyDate: t.buyDate,
      sellDate: t.sellDate,
      proceedsKRW,
      costKRW,
      feeKRW: t.feeKRW,
      gainKRW,
    };
  });

  // 손익통산
  const totalGain = breakdown.reduce((sum, d) => sum + d.gainKRW, 0);

  // 과세표준 (음수면 0)
  const taxableAmount = Math.max(0, totalGain - basicDeduction);

  // 세액
  const incomeTax = Math.floor(taxableAmount * TAX_RATE);
  const localTax = Math.floor(taxableAmount * LOCAL_TAX_RATE);
  const tax = incomeTax + localTax;

  return {
    breakdown,
    totalGain,
    basicDeduction,
    taxableAmount,
    incomeTax,
    localTax,
    tax,
  };
}

// 금액 포맷 헬퍼
export function formatKRW(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(Math.round(amount));
}

// C-2: 부호 포함 포맷 헬퍼 — 음수 -₩123,456 / 양수 +₩123,456 / 0 ₩0
export function formatSignedKRW(amount: number): string {
  const abs = Math.round(Math.abs(amount));
  if (amount === 0) return '₩0';
  const prefix = amount > 0 ? '+' : '-';
  return `${prefix}₩${new Intl.NumberFormat('ko-KR').format(abs)}`;
}
