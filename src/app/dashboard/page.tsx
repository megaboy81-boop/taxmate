'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Dashboard from '@/components/Dashboard'
import DeductionGauge from '@/components/DeductionGauge'
import YearlyCompare from '@/components/YearlyCompare'
import type { Transaction, Subscription, ForeignPayment } from '@/types/transaction'
import { analyzeDeductions, detectDeductionsFromTransactions } from '@/lib/deductionEngine'

interface StoredData {
  transactions: Transaction[]
  subscriptions: Subscription[]
  foreignPayments: ForeignPayment[]
  period?: { from: string; to: string }
}

function won(n: number) { return n.toLocaleString('ko-KR') + '원' }

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<StoredData | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('txData')
    if (!raw) { router.push('/upload'); return }
    try { setData(JSON.parse(raw)) } catch { router.push('/upload') }
  }, [router])

  const deductionAnalysis = data ? (() => {
    const detected = detectDeductionsFromTransactions(data.transactions)
    const marginalRate = 0.264  // 24% + 지방세 10% = 26.4%
    return analyzeDeductions([], detected, 0, marginalRate)
  })() : null

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">데이터 불러오는 중...</div>
      </div>
    )
  }

  const outflows = data.transactions.filter(t => t.amount > 0)
  const totalExpense = outflows.reduce((s, t) => s + t.amount, 0)
  const deductible = outflows.filter(t => t.isDeductible).reduce((s, t) => s + t.amount, 0)
  const hasMultiYear = new Set(data.transactions.map(t => t.year)).size >= 2

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-100 bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← TaxMate</Link>
        <span className="text-sm font-semibold text-gray-700">AI 분석 대시보드</span>
        <Link href="/upload" className="text-xs text-blue-500 hover:text-blue-600">새 파일</Link>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* 핵심 지표 헤더 */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white">
          <p className="text-xs opacity-70 mb-1">
            {data.period ? `${data.period.from} ~ ${data.period.to}` : '분석 결과'}
          </p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div>
              <p className="text-xs opacity-70">총 지출</p>
              <p className="text-base font-bold">{won(totalExpense)}</p>
            </div>
            <div>
              <p className="text-xs opacity-70">경비 인정</p>
              <p className="text-base font-bold text-blue-200">{won(deductible)}</p>
            </div>
            <div>
              <p className="text-xs opacity-70">해외결제</p>
              <p className="text-base font-bold text-red-300">
                {won(data.foreignPayments.reduce((s, p) => s + p.amount, 0))}
              </p>
            </div>
          </div>
          {/* AI 코칭 바로가기 */}
          <Link href="/coaching"
            className="flex items-center justify-between bg-white/10 hover:bg-white/20 rounded-xl px-4 py-2.5 transition-colors">
            <div>
              <p className="text-sm font-semibold">AI 세무 코칭 받기</p>
              <p className="text-xs opacity-70">내 데이터 기반 맞춤 질문</p>
            </div>
            <span className="text-lg">→</span>
          </Link>
        </div>

        {/* 절세 공제 현황 */}
        {deductionAnalysis && deductionAnalysis.gaps.length > 0 && (
          <DeductionGauge analysis={deductionAnalysis} annualRevenue={totalExpense} />
        )}

        {/* 지출 대시보드 */}
        <Dashboard
          transactions={data.transactions}
          subscriptions={data.subscriptions}
          foreignPayments={data.foreignPayments}
          period={data.period}
        />

        {/* 전년도 비교 (다연도 데이터가 있을 때만) */}
        {hasMultiYear && (
          <YearlyCompare transactions={data.transactions} />
        )}

        {/* 세금 계산 연결 */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/quick"
            className="bg-white border border-gray-200 rounded-2xl p-4 text-center hover:border-blue-300 transition-colors">
            <p className="text-2xl mb-1">⚡</p>
            <p className="text-sm font-semibold text-gray-800">세금 계산</p>
            <p className="text-xs text-gray-400 mt-0.5">예상 종합소득세</p>
          </Link>
          <Link href="/coaching"
            className="bg-white border border-gray-200 rounded-2xl p-4 text-center hover:border-blue-300 transition-colors">
            <p className="text-2xl mb-1">💬</p>
            <p className="text-sm font-semibold text-gray-800">AI 코칭</p>
            <p className="text-xs text-gray-400 mt-0.5">실시간 질문 답변</p>
          </Link>
        </div>

        {/* 구독 요약 (있을 때만) */}
        {data.subscriptions.length > 0 && (
          <div className="bg-indigo-50 rounded-2xl p-4">
            <p className="text-sm font-semibold text-indigo-800 mb-2">
              구독 서비스 {data.subscriptions.length}건 · 월 {won(data.subscriptions.reduce((s, sub) => s + sub.amount, 0))}
            </p>
            <div className="flex flex-wrap gap-2">
              {data.subscriptions.map((sub, i) => (
                <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium
                  ${sub.isForeign ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  {sub.name} {won(sub.amount)}
                  {sub.isForeign && ' 🌍'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 해외결제 경고 (있을 때만) */}
        {data.foreignPayments.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
            <p className="text-sm font-semibold text-red-800 mb-1">
              ⚠ 해외결제 {data.foreignPayments.length}건 — 부가세 환급 불가
            </p>
            <p className="text-xs text-red-600">
              {data.foreignPayments.slice(0, 3).map(p => p.description).join(' · ')}
              {data.foreignPayments.length > 3 && ` 외 ${data.foreignPayments.length - 3}건`}
            </p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-2">
          본 결과는 참고용이며 실제 신고는 세무사 확인이 필요합니다
        </p>
      </div>
    </div>
  )
}
