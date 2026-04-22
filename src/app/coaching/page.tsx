'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import CoachingChat from '@/components/CoachingChat'
import type { Transaction, Subscription, ForeignPayment } from '@/types/transaction'

interface StoredData {
  transactions: Transaction[]
  subscriptions: Subscription[]
  foreignPayments: ForeignPayment[]
  period?: { from: string; to: string }
}

function buildContext(data: StoredData): string {
  const outflows = data.transactions.filter(t => t.amount > 0)
  const totalExpense = outflows.reduce((s, t) => s + t.amount, 0)
  const deductible = outflows.filter(t => t.isDeductible).reduce((s, t) => s + t.amount, 0)
  const foreignTotal = data.foreignPayments.reduce((s, p) => s + p.amount, 0)
  const subTotal = data.subscriptions.reduce((s, s2) => s + s2.amount, 0)

  const lines = [
    `분석 기간: ${data.period?.from ?? '?'} ~ ${data.period?.to ?? '?'}`,
    `총 지출: ${totalExpense.toLocaleString('ko-KR')}원`,
    `경비 인정: ${deductible.toLocaleString('ko-KR')}원 (${totalExpense > 0 ? Math.round((deductible / totalExpense) * 100) : 0}%)`,
    `해외결제: ${foreignTotal.toLocaleString('ko-KR')}원`,
    `구독 서비스: 월 ${subTotal.toLocaleString('ko-KR')}원 (${data.subscriptions.length}건)`,
    data.subscriptions.length > 0 ? `구독 목록: ${data.subscriptions.map(s => s.name).join(', ')}` : '',
    data.foreignPayments.length > 0 ? `해외결제 항목: ${data.foreignPayments.map(p => p.description).join(', ')}` : '',
  ].filter(Boolean)

  return lines.join('\n')
}

export default function CoachingPage() {
  const [context, setContext] = useState<string | undefined>()
  const [hasData, setHasData] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem('txData')
    if (raw) {
      try {
        const data: StoredData = JSON.parse(raw)
        setContext(buildContext(data))
        setHasData(true)
      } catch {}
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="border-b border-gray-100 bg-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← TaxMate</Link>
        <span className="text-sm font-semibold text-gray-700">AI 세무 코칭</span>
        {hasData && (
          <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">내 데이터 연동</span>
        )}
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4 flex flex-col" style={{ height: 'calc(100vh - 52px)' }}>
        {/* 업종별 전문가 버튼 */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 flex-shrink-0">
          {['음식점', '프리랜서', '소매업', '유튜버', '학원'].map(type => (
            <button key={type}
              className="flex-shrink-0 text-xs bg-white border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 px-3 py-1.5 rounded-full transition-colors">
              {type} 전문가
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0">
          <CoachingChat
            context={context}
            placeholder={hasData ? '내 데이터 기반으로 질문하세요...' : '세금·절세 질문을 입력하세요...'}
          />
        </div>
      </div>
    </div>
  )
}
