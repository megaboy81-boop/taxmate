'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  ForeignStockTrade,
  ForeignStockTaxResult,
  calculateForeignStockTax,
  addBusinessDays,
  getSettlementDays,
  US_MARKET_HOLIDAYS,
  formatKRW,
  formatSignedKRW,
} from '@/lib/foreignStockTax'

// M-5: 연도 동적 계산
const TAX_YEAR = new Date().getFullYear() - 1

// P2: 신고기한 자동 계산 (5월 31일이 주말이면 익영업일로 연장)
function getFilingDeadline(year: number): string {
  const may31 = new Date(year, 4, 31);
  const dow = may31.getDay();
  if (dow === 0) return `${year}년 6월 1일 (5월 31일이 일요일이므로 연장)`;
  if (dow === 6) return `${year}년 6월 2일 (5월 31일이 토요일이므로 연장)`;
  return `${year}년 5월 31일`;
}
const FILING_DEADLINE = getFilingDeadline(new Date().getFullYear())

const LS_KEY = 'taxmate-foreign-trades'

// N-H2: Safari 15.4 미만 crypto.randomUUID 미지원 폴백
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function makeEmptyTrade(): ForeignStockTrade {
  return {
    id: generateId(),
    ticker: '',
    quantity: 0,
    buyDate: '',
    buyPriceUSD: 0,
    buyExchangeRate: 0,
    sellDate: '',
    sellPriceUSD: 0,
    sellExchangeRate: 0,
    feeKRW: 0,
  }
}

// H-2: localStorage에서 초기 trades 로드 (SSR 안전: typeof window 체크)
// N-H1: id 필드 없는 구버전 데이터 자동 마이그레이션 (generateId() 폴백 포함)
function loadTradesFromStorage(): ForeignStockTrade[] {
  if (typeof window === 'undefined') return [makeEmptyTrade()]
  try {
    const saved = localStorage.getItem(LS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<ForeignStockTrade>[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        // 구버전 데이터(id 없음) 자동 마이그레이션
        return parsed.map((t) => ({ ...t, id: t.id ?? generateId() } as ForeignStockTrade))
      }
    }
  } catch { /* ignore */ }
  return [makeEmptyTrade()]
}

// C-1: 서버 프록시 경유 환율 조회
async function fetchExchangeRate(date: string): Promise<number | null> {
  try {
    const yyyymmdd = date.replace(/-/g, '')
    const res = await fetch(`/api/exchange-rate?date=${yyyymmdd}`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.error) {
      // API key 미설정 등 서버 측 에러 메시지 전달
      throw new Error(data.error)
    }
    const rate = data.rate
    return typeof rate === 'number' && isFinite(rate) && rate > 0 ? rate : null
  } catch (e: unknown) {
    if (e instanceof Error) throw e
    return null
  }
}

export default function ForeignStockPage() {
  // H-2: useState initializer에서 localStorage 복원 (useEffect 내 setState 회피)
  const [trades, setTrades] = useState<ForeignStockTrade[]>(loadTradesFromStorage)
  const [result, setResult] = useState<ForeignStockTaxResult | null>(null)
  const [fetchingRate, setFetchingRate] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const lastSavedRef = useRef<string | null>(null)
  const [lastSavedDisplay, setLastSavedDisplay] = useState<string | null>(null)
  // P0-2: 기본공제 파라미터화 (1인당 연 250만원 한도, 복수 증권사 시 차감 입력)
  const [basicDeduction, setBasicDeduction] = useState<number>(2_500_000)

  // H-2: trades 변경 시 자동 저장 (setLastSaved는 setTimeout으로 비동기 처리 — effect 내 동기 setState 회피)
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(trades))
      const now = new Date()
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      lastSavedRef.current = timeStr
      // 비동기 업데이트로 cascading render 차단
      const t = setTimeout(() => setLastSavedDisplay(timeStr), 0)
      return () => clearTimeout(t)
    } catch { /* ignore */ }
  }, [trades])

  const updateTrade = useCallback((idx: number, field: keyof ForeignStockTrade, value: string | number) => {
    setTrades((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
    setResult(null)
  }, [])

  const addRow = () => {
    setTrades((prev) => [...prev, makeEmptyTrade()])
    setResult(null)
  }

  const removeRow = (idx: number) => {
    setTrades((prev) => prev.filter((_, i) => i !== idx))
    setResult(null)
  }

  // P0-1: T+2 결제일 기준 환율 자동조회
  const handleFetchRate = async (
    idx: number,
    dateField: 'buyDate' | 'sellDate',
    rateField: 'buyExchangeRate' | 'sellExchangeRate',
  ) => {
    const tradeDate = trades[idx][dateField] as string
    if (!tradeDate) {
      alert('날짜를 먼저 입력해주세요.')
      return
    }
    // P0-NEW: T+1/T+2 동적 분기 + P1-A: NYSE 공휴일 반영
    const days = getSettlementDays(tradeDate)
    const settleDate = addBusinessDays(tradeDate, days, US_MARKET_HOLIDAYS)
    const key = `${idx}-${dateField}`
    setFetchingRate((prev) => ({ ...prev, [key]: true }))
    try {
      const rate = await fetchExchangeRate(settleDate)
      if (rate) {
        updateTrade(idx, rateField, rate)
      } else {
        alert(
          `결제일(${settleDate}) 환율을 가져오지 못했습니다.\n한국수출입은행 사이트(https://www.koreaexim.go.kr)에서 직접 확인 후 입력해주세요.\n※ 결제일(T+1 또는 T+2) 기준 서울외국환중개 매매기준율을 사용하세요.`,
        )
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '환율 조회 실패'
      alert(msg)
    } finally {
      setFetchingRate((prev) => ({ ...prev, [key]: false }))
    }
  }

  const handleCalculate = () => {
    setError(null)
    for (let i = 0; i < trades.length; i++) {
      const t = trades[i]
      if (!t.ticker.trim()) { setError(`${i + 1}번째 행: 종목명을 입력해주세요.`); return }
      if (!t.quantity || t.quantity <= 0) { setError(`${i + 1}번째 행: 수량을 확인해주세요.`); return }
      if (!t.buyDate) { setError(`${i + 1}번째 행: 매수일을 입력해주세요.`); return }
      if (!t.buyPriceUSD || isNaN(t.buyPriceUSD) || t.buyPriceUSD <= 0) { setError(`${i + 1}번째 행: 매수가를 확인해주세요.`); return }
      if (!t.buyExchangeRate || isNaN(t.buyExchangeRate) || t.buyExchangeRate <= 0) { setError(`${i + 1}번째 행: 매수일 환율을 입력해주세요.`); return }
      if (!t.sellDate) { setError(`${i + 1}번째 행: 매도일을 입력해주세요.`); return }
      if (!t.sellPriceUSD || isNaN(t.sellPriceUSD) || t.sellPriceUSD <= 0) { setError(`${i + 1}번째 행: 매도가를 확인해주세요.`); return }
      if (!t.sellExchangeRate || isNaN(t.sellExchangeRate) || t.sellExchangeRate <= 0) { setError(`${i + 1}번째 행: 매도일 환율을 입력해주세요.`); return }
      // M-4: 매도일 < 매수일 검증
      if (t.sellDate < t.buyDate) { setError(`${i + 1}번째 행: 매도일(${t.sellDate})이 매수일(${t.buyDate})보다 빠릅니다.`); return }
    }
    // P0-2: basicDeduction 검증
    if (!isFinite(basicDeduction) || basicDeduction < 0) {
      setError('기본공제 값이 잘못되었습니다.')
      return
    }
    try {
      const res = calculateForeignStockTax(trades, basicDeduction)
      setResult(res)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '계산 중 오류가 발생했습니다.')
    }
  }

  // H-2: 초기화 시 localStorage도 clear
  const handleReset = () => {
    setTrades([makeEmptyTrade()])
    setResult(null)
    setError(null)
    try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ }
    lastSavedRef.current = null
    setLastSavedDisplay(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 네비 */}
      <div className="border-b border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← TaxMate</Link>
        <span className="text-sm font-semibold text-gray-700">해외주식 양도세 계산</span>
        {/* M-5: 연도 동적 */}
        <span className="ml-auto text-xs bg-green-50 text-green-700 font-semibold px-2 py-0.5 rounded-full">{TAX_YEAR}년 신고용</span>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* 기존 안내 배너 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <strong>미국주식 양도세</strong> 신고 기간: <strong>매년 5월 1일~31일</strong><br />
          카카오페이증권 등에서 발급하는 &quot;해외주식 양도소득 내역&quot; 자료를 참고하여 입력하세요.
        </div>

        {/* P0-NEW + P1-A: T+1/T+2 동적 결제일 + NYSE 공휴일 안내 배너 */}
        <div className="bg-teal-50 border border-teal-300 rounded-xl p-4 text-sm text-teal-900">
          <strong>결제일 기준 환율 안내 (T+1 / T+2 자동 전환)</strong><br />
          <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs">
            <li>2024년 5월 28일 이후 체결: T+1 (SEC 규정 개정, 2024-05-28 시행)</li>
            <li>2024년 5월 27일 이전 체결: T+2 (종전 규정)</li>
          </ul>
          &quot;조회&quot; 버튼 클릭 시 해당 규정에 맞는 결제일 환율을 자동으로 가져옵니다.<br />
          <span className="text-teal-700 text-xs">※ NYSE 휴장일 반영. 12월 말 거래는 결제일이 다음 연도로 넘어가면 해당 연도 귀속에 주의하세요.</span>
        </div>

        {/* P1-B: 다건 거래 환율 조회 Rate Limit 안내 */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700">
          <strong>거래 건수 50건 초과 시 환율 조회 안내</strong><br />
          거래 건수가 많은 경우 환율 자동조회 시 Rate Limit이 발생할 수 있습니다.<br />
          <span className="text-xs text-gray-500">이 경우 카카오페이증권 발급 &quot;해외주식 양도소득 내역&quot; PDF의 환율을 직접 입력하는 것이 안전합니다.</span>
        </div>

        {/* P2: 신고기한 자동 계산 배너 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <strong>신고기한</strong><br />
          {new Date().getFullYear()}년 양도소득세 확정신고 기한: <strong>{FILING_DEADLINE}</strong><br />
          <span className="text-xs text-blue-600">※ 신고기한이 토·일요일이면 다음 첫 번째 평일로 자동 연장됩니다.</span>
        </div>

        {/* P0-4: 손익통산 범위 안내 (정확화) */}
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 text-sm text-yellow-900">
          <strong>손익통산 범위 안내</strong><br />
          본 계산기는 <strong>해외주식 종목 간 손익통산만</strong> 적용합니다.<br />
          <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs">
            <li>국내 상장주식(소액주주 보유분): 양도세 비과세 → 통산 대상 아님</li>
            <li>국내 비상장 주식 / 대주주 상장주식: 해외주식과 통산 가능하나 본 계산기 미지원 (세무사 자문 권고)</li>
          </ul>
        </div>

        {/* H-4: 부분매도 안내 */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700">
          <strong>부분매도 입력 방법</strong><br />
          동일 종목을 여러 차례 매수 후 일부 매도한 경우: <strong>실제 매도된 수량</strong>과 해당 분의 <strong>평균 매수단가</strong>를 입력하세요.
          (FIFO 또는 이동평균법 적용)
        </div>

        {/* 세무-H2: 분류과세 안내 */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-800">
          <strong>분류과세 안내</strong><br />
          해외주식 양도소득세는 <strong>분류과세</strong>로 종합소득과 합산되지 않습니다.
        </div>

        {/* 입력 테이블 */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">매매 내역 입력</h2>
            <div className="flex items-center gap-2">
              {lastSavedDisplay && (
                <span className="text-xs text-gray-400">자동 저장됨 · {lastSavedDisplay}</span>
              )}
              <button
                onClick={addRow}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                + 행 추가
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">종목명</th>
                  <th className="px-3 py-3 text-left font-semibold">수량</th>
                  <th className="px-3 py-3 text-left font-semibold">매수일</th>
                  <th className="px-3 py-3 text-left font-semibold">매수가($)</th>
                  <th className="px-3 py-3 text-left font-semibold">매수 결제일 환율(₩)<br /><span className="font-normal normal-case text-gray-400">T+1/T+2 자동</span></th>
                  <th className="px-3 py-3 text-left font-semibold">매도일</th>
                  <th className="px-3 py-3 text-left font-semibold">매도가($)</th>
                  <th className="px-3 py-3 text-left font-semibold">매도 결제일 환율(₩)<br /><span className="font-normal normal-case text-gray-400">T+1/T+2 자동</span></th>
                  <th className="px-3 py-3 text-left font-semibold">
                    수수료(₩)
                    <span className="ml-1 text-gray-400 font-normal normal-case">원화</span>
                  </th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* M-2: key={trade.id} */}
                {trades.map((trade, idx) => (
                  <tr key={trade.id} className="hover:bg-gray-50/50">
                    {/* 종목명 */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="AAPL"
                        value={trade.ticker}
                        onChange={(e) => updateTrade(idx, 'ticker', e.target.value)}
                        className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                      />
                    </td>
                    {/* 수량 */}
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="10"
                        value={trade.quantity || ''}
                        onChange={(e) => updateTrade(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                      />
                    </td>
                    {/* 매수일 */}
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={trade.buyDate}
                        onChange={(e) => updateTrade(idx, 'buyDate', e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                      />
                    </td>
                    {/* 매수가 */}
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="150.00"
                        value={trade.buyPriceUSD || ''}
                        onChange={(e) => updateTrade(idx, 'buyPriceUSD', parseFloat(e.target.value) || 0)}
                        className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                      />
                    </td>
                    {/* 매수환율 */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="1350.00"
                          value={trade.buyExchangeRate || ''}
                          onChange={(e) => updateTrade(idx, 'buyExchangeRate', parseFloat(e.target.value) || 0)}
                          title="기준환율 (외환매매기준율) — 서울외국환중개 매매기준율(deal_bas_r)"
                          className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                        />
                        <button
                          onClick={() => handleFetchRate(idx, 'buyDate', 'buyExchangeRate')}
                          disabled={fetchingRate[`${idx}-buyDate`]}
                          title="기준환율 자동 조회 (서울외국환중개 매매기준율)"
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-1.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {fetchingRate[`${idx}-buyDate`] ? '...' : '조회'}
                        </button>
                      </div>
                    </td>
                    {/* 매도일 */}
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={trade.sellDate}
                        onChange={(e) => updateTrade(idx, 'sellDate', e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                      />
                    </td>
                    {/* 매도가 */}
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="180.00"
                        value={trade.sellPriceUSD || ''}
                        onChange={(e) => updateTrade(idx, 'sellPriceUSD', parseFloat(e.target.value) || 0)}
                        className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                      />
                    </td>
                    {/* 매도환율 */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="1380.00"
                          value={trade.sellExchangeRate || ''}
                          onChange={(e) => updateTrade(idx, 'sellExchangeRate', parseFloat(e.target.value) || 0)}
                          title="기준환율 (외환매매기준율) — 서울외국환중개 매매기준율(deal_bas_r)"
                          className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                        />
                        <button
                          onClick={() => handleFetchRate(idx, 'sellDate', 'sellExchangeRate')}
                          disabled={fetchingRate[`${idx}-sellDate`]}
                          title="기준환율 자동 조회 (서울외국환중개 매매기준율)"
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-1.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {fetchingRate[`${idx}-sellDate`] ? '...' : '조회'}
                        </button>
                      </div>
                    </td>
                    {/* 수수료 — H-3 */}
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="예: 3,500 (원화)"
                        value={trade.feeKRW || ''}
                        onChange={(e) => updateTrade(idx, 'feeKRW', parseFloat(e.target.value) || 0)}
                        title="미국 현지 SEC Fee/TAF, 카카오페이 수수료 모두 합산 (원화)"
                        className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                      />
                    </td>
                    {/* 삭제 */}
                    <td className="px-3 py-2">
                      {trades.length > 1 && (
                        <button
                          onClick={() => removeRow(idx)}
                          className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                          title="행 삭제"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 환율 조회 안내 — 세무-H1 레이블 반영 */}
          <div className="px-5 py-3 bg-gray-50 text-xs text-gray-400 border-t border-gray-100">
            &quot;조회&quot; 버튼: 기준환율(외환매매기준율) 자동 조회 — 서울외국환중개 매매기준율(한국수출입은행 고시 deal_bas_r).
            주말·공휴일은 직전 영업일 환율을 자동으로 시도합니다.
          </div>
        </div>

        {/* P0-2: 기본공제 입력 필드 */}
        <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4">
          <label className="block text-sm font-semibold text-gray-800 mb-1">
            기본공제 한도 (₩)
          </label>
          <input
            type="number"
            min="0"
            max="2500000"
            step="10000"
            value={basicDeduction}
            onChange={(e) => setBasicDeduction(parseFloat(e.target.value) || 0)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 w-48"
          />
          <p className="mt-1 text-xs text-gray-400">
            1인당 연 250만원 한도. 복수 증권사 이용 시 타사에서 이미 공제받은 금액을 차감해서 입력하세요.
          </p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 계산/초기화/저장 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={handleCalculate}
            className="flex-1 bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors text-base"
          >
            양도세 계산하기
          </button>
          <button
            onClick={handleReset}
            className="px-6 bg-gray-200 text-gray-600 font-semibold py-3.5 rounded-xl hover:bg-gray-300 transition-colors"
          >
            초기화
          </button>
        </div>

        {/* 결과 영역 */}
        {result && (
          <div className="space-y-4">
            {/* 메인 결과 카드 */}
            <div className={`rounded-2xl p-6 text-center ${result.tax > 0 ? 'bg-blue-600' : 'bg-green-600'}`}>
              <p className="text-sm font-medium text-white/80 mb-1">납부 예상세액</p>
              <p className="text-4xl font-black text-white">
                ₩{formatKRW(result.tax)}
              </p>
              {result.tax === 0 && (
                <p className="mt-2 text-sm text-white/80">
                  {result.totalGain <= 0 ? '손실 또는 손익 없음 — 세금 없음' : '기본공제 250만원 이내 — 세금 없음'}
                </p>
              )}
            </div>

            {/* 세무-H3: 가산세 경고 */}
            <div className="bg-orange-50 border border-orange-300 rounded-xl px-5 py-4 text-sm text-orange-900">
              <p className="font-semibold mb-1">⚠️ 신고 의무 및 가산세 안내</p>
              <p>
                손익이 발생한 경우 세금이 0원이어도 신고 의무가 있을 수 있습니다.<br />
                미신고 시: <strong>무신고 가산세 20%</strong>, 과소신고 가산세 10%, 납부지연 가산세 미납일수 × 0.022%/일
              </p>
            </div>

            {/* 세액 상세 */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">계산 상세</h3>
              </div>
              <div className="divide-y divide-gray-100">
                <div className="flex justify-between px-5 py-3 text-sm">
                  <span className="text-gray-600">손익통산 합계</span>
                  {/* C-2: formatSignedKRW 사용 */}
                  <span className={`font-semibold ${result.totalGain >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {formatSignedKRW(result.totalGain)}
                  </span>
                </div>
                <div className="flex justify-between px-5 py-3 text-sm">
                  <span className="text-gray-600">기본공제</span>
                  <span className="font-semibold text-gray-900">- ₩{formatKRW(result.basicDeduction)}</span>
                </div>
                <div className="flex justify-between px-5 py-3 text-sm bg-gray-50">
                  <span className="font-semibold text-gray-900">과세표준</span>
                  <span className="font-bold text-gray-900">₩{formatKRW(result.taxableAmount)}</span>
                </div>
                <div className="flex justify-between px-5 py-3 text-sm">
                  <span className="text-gray-600">양도소득세 (20%)</span>
                  <span className="font-semibold text-gray-900">₩{formatKRW(result.incomeTax)}</span>
                </div>
                <div className="flex justify-between px-5 py-3 text-sm">
                  <span className="text-gray-600">지방소득세 (2%)</span>
                  <span className="font-semibold text-gray-900">₩{formatKRW(result.localTax)}</span>
                </div>
                <div className="flex justify-between px-5 py-4 bg-blue-50">
                  <span className="font-bold text-blue-900">납부 예상세액 (22%)</span>
                  <span className="font-black text-blue-900 text-lg">₩{formatKRW(result.tax)}</span>
                </div>
              </div>
            </div>

            {/* 종목별 상세 표 */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">종목별 차익/손실</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">종목</th>
                      <th className="px-4 py-3 text-right font-semibold">수량</th>
                      <th className="px-4 py-3 text-right font-semibold">양도가액(₩)</th>
                      <th className="px-4 py-3 text-right font-semibold">취득가액(₩)</th>
                      <th className="px-4 py-3 text-right font-semibold">수수료(₩)</th>
                      <th className="px-4 py-3 text-right font-semibold">차익/손실(₩)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.breakdown.map((d, idx) => (
                      <tr key={`${d.ticker}-${d.sellDate}-${d.buyDate}-${idx}`} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-semibold text-gray-900">{d.ticker}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{d.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatKRW(d.proceedsKRW)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatKRW(d.costKRW)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatKRW(d.feeKRW)}</td>
                        {/* C-2: formatSignedKRW 일관 사용 */}
                        <td className={`px-4 py-3 text-right font-bold ${d.gainKRW >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {formatSignedKRW(d.gainKRW)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td colSpan={5} className="px-4 py-3 font-bold text-gray-900">합계 (손익통산)</td>
                      <td className={`px-4 py-3 text-right font-black text-base ${result.totalGain >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                        {formatSignedKRW(result.totalGain)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* M-3: 결과 카드 직후 압축 면책 인라인 */}
            <div className="text-xs text-gray-400 px-1">
              본 결과는 참고용입니다. 손익통산은 해외주식 간만 적용 | 이월공제 불가 | 분류과세 | 실제 신고는 홈택스 또는 세무사 자문 권고
            </div>
          </div>
        )}

        {/* 세무-M2: 종합 면책 문구 (푸터) */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
          <p className="font-semibold mb-2">참고용 안내 (법적 효력 없음)</p>
          <ul className="space-y-1 text-xs list-disc list-inside">
            <li>환율: 거래일 서울외국환중개 매매기준율(한국수출입은행 고시 deal_bas_r) 기준</li>
            <li>손익통산: 해외주식 종목 간만 적용 — 국내 상장주식 소액주주 보유분과 통산 불가</li>
            <li>이월공제: 해외주식 양도손실은 당해 연도 이익과만 통산 가능하며, 다음 연도로 이월되지 않습니다.</li>
            <li>분류과세: 해외주식 양도소득세는 종합소득과 합산되지 않습니다.</li>
            <li>실제 신고: 카카오페이증권 발급 양도소득 자료를 기준으로 세무사 자문 또는 홈택스 직접 신고 권고</li>
            <li>신고기간: 매년 5월 1일 ~ {FILING_DEADLINE} (주말 시 익영업일 자동 연장)</li>
            <li>가산세: 무신고 20%, 과소신고 10%, 납부지연 미납일수 × 0.022%/일</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
