import { NextRequest, NextResponse } from 'next/server';

/**
 * C-1: 서울외국환중개 매매기준율(deal_bas_r) 서버 프록시
 * 브라우저 직접 호출 시 CORS 차단 → Next.js API route에서 server-side 호출
 *
 * GET /api/exchange-rate?date=YYYYMMDD
 * 응답: { rate: number, source_date: string } | { error: string }
 *
 * 주말/공휴일: 1일씩 이전 영업일로 최대 7회 retry
 * KOREAEXIM_API_KEY 환경변수 필요 (없으면 error 메시지 반환)
 */

const MAX_RETRY = 3;

function subtractDay(yyyymmdd: string): string {
  const d = new Date(
    parseInt(yyyymmdd.slice(0, 4)),
    parseInt(yyyymmdd.slice(4, 6)) - 1,
    parseInt(yyyymmdd.slice(6, 8)),
  );
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

// N-M3: RESULT 코드 4(인증 오류) 감지 시 즉시 retry 중단 플래그
type FetchRateResult =
  | { rate: number; source_date: string }
  | { authError: true }   // RESULT=4: 인증 오류 → retry 불필요
  | null;                 // 날짜 데이터 없음 또는 일시 오류 → 다음 날짜로 retry

async function fetchRateForDate(
  dateYYYYMMDD: string,
  apiKey: string,
): Promise<FetchRateResult> {
  const url = `https://www.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${encodeURIComponent(apiKey)}&searchdate=${dateYYYYMMDD}&data=AP01`;

  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(3000), // 3초 타임아웃 (P1-1: 3×3=9s < Vercel 10s 한도)
      // server-side 호출이므로 캐시 최소화
      next: { revalidate: 3600 },
    });
  } catch (e) {
    // AbortError(타임아웃) 포함 모든 fetch 실패 → null 반환 후 다음 retry
    if (e instanceof Error) {
      console.warn(`[exchange-rate] fetch failed (${e.name}): ${e.message}`);
    }
    return null;
  }

  if (!res.ok) return null;

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return null;
  }

  // N-M3: 한국수출입은행 RESULT 코드 확인 (1=성공, 2=DATA없음, 3=날짜형식오류, 4=인증오류)
  // 비배열(오류 객체) 응답 시 RESULT 코드 추출
  if (!Array.isArray(data)) {
    const errObj = data as Record<string, unknown>;
    if (errObj?.RESULT === 4) {
      console.error('[exchange-rate] API auth error (RESULT=4) — stopping retry');
      return { authError: true };
    }
    return null;
  }

  if (data.length === 0) return null;

  const usdRow = (data as Array<{ cur_unit: string; deal_bas_r: string }>).find(
    (r) => r.cur_unit === 'USD',
  );
  if (!usdRow?.deal_bas_r) return null;

  const rate = parseFloat(usdRow.deal_bas_r.replace(/,/g, ''));
  if (!isFinite(rate) || rate <= 0) return null;

  return { rate, source_date: dateYYYYMMDD };
}

export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get('date');

  // 파라미터 유효성 검사
  if (!dateParam || !/^\d{8}$/.test(dateParam)) {
    return NextResponse.json(
      { error: 'date 파라미터 필요 (YYYYMMDD)' },
      { status: 400 },
    );
  }

  const apiKey = process.env.KOREAEXIM_API_KEY ?? '';
  if (!apiKey) {
    // N-C1: 내부 경로(.env.local 언급) 클라이언트 노출 영구 제거
    // N-M2: 200 → 503으로 변경해 클라이언트가 정상 에러 처리하도록
    console.error('[exchange-rate] KOREAEXIM_API_KEY missing');
    return NextResponse.json(
      { error: '환율 조회 서비스가 일시적으로 준비 중입니다. 환율을 수동으로 입력해주세요.' },
      { status: 503 },
    );
  }

  // M-1: 주말/공휴일 → 최대 7일 이전 영업일 retry
  let currentDate = dateParam;
  for (let i = 0; i < MAX_RETRY; i++) {
    const result = await fetchRateForDate(currentDate, apiKey);
    if (result && 'authError' in result) {
      // N-M3: 인증 오류는 날짜 변경해도 해결 안 됨 → 즉시 중단
      return NextResponse.json(
        { error: '환율 조회 서비스가 일시적으로 준비 중입니다. 환율을 수동으로 입력해주세요.' },
        { status: 503 },
      );
    }
    if (result && 'rate' in result) {
      return NextResponse.json(result);
    }
    currentDate = subtractDay(currentDate);
  }

  return NextResponse.json(
    {
      error: `${dateParam} 기준 최대 ${MAX_RETRY}영업일 이전까지 환율 데이터를 찾지 못했습니다. 한국수출입은행 사이트에서 직접 확인해주세요.`,
    },
    { status: 200 },
  );
}
