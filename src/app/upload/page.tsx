'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import UploadZone from '@/components/UploadZone'
import type { ParseResult } from '@/types/transaction'
import { classifyTransactions, extractSubscriptions, extractForeignPayments } from '@/lib/classifier'

export default function UploadPage() {
  const router = useRouter()
  const [bankResult, setBankResult] = useState<ParseResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  function handleBankUpload(result: ParseResult) {
    setBankResult(result)
  }

  function handleAnalyze() {
    if (!bankResult) return
    setAnalyzing(true)

    const classified = classifyTransactions(bankResult.transactions)
    const subscriptions = extractSubscriptions(classified)
    const foreignPayments = extractForeignPayments(classified)

    // sessionStorage에 분석 결과 저장 후 대시보드로 이동
    sessionStorage.setItem('txData', JSON.stringify({
      transactions: classified,
      subscriptions,
      foreignPayments,
      period: bankResult.period,
    }))

    router.push('/dashboard')
  }

  const canAnalyze = bankResult && bankResult.transactions.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← TaxMate</Link>
        <span className="text-sm font-semibold text-gray-700">데이터 업로드</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">내역을 올려주세요</h1>
          <p className="text-sm text-gray-500">통장 출금내역 CSV 하나로 모든 분석을 시작합니다.</p>
        </div>

        {/* 통장 내역 */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">통장 출금내역 (필수)</p>
          <UploadZone
            onParsed={handleBankUpload}
            label="통장 거래내역 CSV"
            hint="홈뱅킹 → 거래내역 → CSV 내보내기 (국민·신한·우리·하나·기업은행 지원)"
          />
          {bankResult && (
            <div className="mt-2 text-xs text-gray-500 bg-white rounded-xl p-3 border border-gray-100">
              <span className="font-semibold">{bankResult.transactions.length}건</span> 파싱
              {bankResult.period && (
                <span className="text-gray-400 ml-2">{bankResult.period.from} ~ {bankResult.period.to}</span>
              )}
              {bankResult.errorRows > 0 && (
                <span className="text-orange-500 ml-2">오류 {bankResult.errorRows}행 제외</span>
              )}
            </div>
          )}
        </div>

        {/* CSV 받는 방법 안내 */}
        <div className="bg-blue-50 rounded-2xl p-4 text-sm">
          <p className="font-semibold text-blue-800 mb-2">📱 CSV 받는 방법</p>
          <ul className="space-y-1 text-blue-700 text-xs">
            <li>• <strong>국민은행</strong>: 인터넷뱅킹 → 거래내역조회 → 엑셀 저장</li>
            <li>• <strong>신한은행</strong>: 쏠 앱 → 계좌 → 거래내역 → CSV 내보내기</li>
            <li>• <strong>카카오뱅크</strong>: 앱 → 거래내역 → 내역 내보내기</li>
            <li>• <strong>토스뱅크</strong>: 앱 → 거래내역 → 다운로드</li>
          </ul>
        </div>

        <div className="bg-gray-100 rounded-xl px-4 py-3 text-xs text-gray-500">
          업로드된 파일은 귀하의 브라우저에서만 처리되며 서버에 저장되지 않습니다.
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!canAnalyze || analyzing}
          className="w-full bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-2xl py-4 text-sm transition-colors hover:bg-blue-700"
        >
          {analyzing ? '분석 중...' : `분석 시작 →`}
        </button>
      </div>
    </div>
  )
}
