'use client'

import { useMemo, useState } from 'react'
import type { Transaction, Subscription, ForeignPayment } from '@/types/transaction'
import type { ExpenseCategory } from '@/types/transaction'

function won(n: number) { return n.toLocaleString('ko-KR') + '원' }

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: '임대료', salary: '인건비', utility: '공과금', telecom: '통신비',
  supply: '원재료', food: '식비', transport: '교통', marketing: '광고',
  subscription: '구독', foreign: '해외결제', insurance: '보험',
  education: '교육', personal: '개인', family: '가족', uncategorized: '기타',
}

const CATEGORY_COLORS: Partial<Record<ExpenseCategory, string>> = {
  rent: 'bg-blue-500', salary: 'bg-purple-500', utility: 'bg-yellow-500',
  telecom: 'bg-cyan-500', supply: 'bg-orange-500', food: 'bg-red-400',
  transport: 'bg-teal-500', marketing: 'bg-pink-500', subscription: 'bg-indigo-500',
  foreign: 'bg-red-600', uncategorized: 'bg-gray-400',
}

interface Props {
  transactions: Transaction[]
  subscriptions: Subscription[]
  foreignPayments: ForeignPayment[]
  period?: { from: string; to: string }
}

export default function Dashboard({ transactions, subscriptions, foreignPayments, period }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'subscriptions' | 'foreign' | 'detail'>('overview')

  const stats = useMemo(() => {
    const outflows = transactions.filter(t => t.amount > 0)
    const totalExpense = outflows.reduce((s, t) => s + t.amount, 0)
    const deductible = outflows.filter(t => t.isDeductible).reduce((s, t) => s + t.amount, 0)
    const nonDeductible = totalExpense - deductible

    const byCategory: Partial<Record<ExpenseCategory, number>> = {}
    for (const tx of outflows) {
      byCategory[tx.category] = (byCategory[tx.category] ?? 0) + tx.amount
    }
    const topCategories = Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5) as [ExpenseCategory, number][]

    const subscriptionTotal = subscriptions.reduce((s, sub) => s + sub.amount, 0)
    const foreignTotal = foreignPayments.reduce((s, p) => s + p.amount, 0)
    const monthlyData = buildMonthly(outflows)

    return { totalExpense, deductible, nonDeductible, topCategories, subscriptionTotal, foreignTotal, monthlyData }
  }, [transactions, subscriptions, foreignPayments])

  return (
    <div className="space-y-4">
      {/* 기간 헤더 */}
      {period && (
        <p className="text-xs text-gray-400 text-center">{period.from} ~ {period.to} 분석 결과</p>
      )}

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([
          ['overview', '요약'],
          ['subscriptions', `구독 (${subscriptions.length})`],
          ['foreign', `해외 (${foreignPayments.length})`],
          ['detail', '내역'],
        ] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${activeTab === tab ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* 요약 탭 */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          {/* 지출 요약 카드 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">총 지출</p>
              <p className="text-base font-bold text-gray-900">{won(stats.totalExpense)}</p>
            </div>
            <div className="text-center border-x border-gray-100">
              <p className="text-xs text-gray-400 mb-1">경비 인정</p>
              <p className="text-base font-bold text-blue-600">{won(stats.deductible)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">개인지출</p>
              <p className="text-base font-bold text-gray-500">{won(stats.nonDeductible)}</p>
            </div>
          </div>

          {/* 경비율 바 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>경비 인정 비율</span>
              <span className="font-bold text-blue-600">
                {stats.totalExpense > 0 ? Math.round((stats.deductible / stats.totalExpense) * 100) : 0}%
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${stats.totalExpense > 0 ? (stats.deductible / stats.totalExpense) * 100 : 0}%` }} />
            </div>
            {stats.subscriptionTotal > 0 && (
              <p className="text-xs text-indigo-600 mt-2">
                구독 서비스 월 {won(stats.subscriptionTotal)} 지출 중
              </p>
            )}
            {stats.foreignTotal > 0 && (
              <p className="text-xs text-red-500 mt-1">
                ⚠ 해외결제 {won(stats.foreignTotal)} — 부가세 환급 불가
              </p>
            )}
          </div>

          {/* 카테고리 Top 5 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-500 mb-3">지출 카테고리 Top 5</p>
            <div className="space-y-2">
              {stats.topCategories.map(([cat, amt]) => (
                <div key={cat} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${CATEGORY_COLORS[cat] ?? 'bg-gray-300'}`} />
                  <span className="text-xs text-gray-600 w-16 flex-shrink-0">{CATEGORY_LABELS[cat]}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full ${CATEGORY_COLORS[cat] ?? 'bg-gray-400'}`}
                      style={{ width: `${stats.totalExpense > 0 ? (amt / stats.totalExpense) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs text-gray-700 font-medium w-20 text-right flex-shrink-0">{won(amt)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 월별 추이 */}
          {stats.monthlyData.length > 1 && (
            <MonthlyChart data={stats.monthlyData} />
          )}
        </div>
      )}

      {/* 구독 탭 */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-2">
          {subscriptions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">구독 서비스가 감지되지 않았습니다</div>
          ) : (
            <>
              <div className="bg-indigo-50 rounded-xl px-4 py-3 text-sm text-indigo-800 font-medium">
                월 구독 합계: <span className="font-bold">{won(subscriptions.reduce((s, sub) => s + sub.amount, 0))}</span>
                <span className="text-xs text-indigo-500 ml-1">
                  (연 {won(subscriptions.reduce((s, sub) => s + sub.amount * (sub.cycle === 'monthly' ? 12 : 1), 0))})
                </span>
              </div>
              {subscriptions.map((sub, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{sub.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {sub.cycle === 'monthly' ? '월정액' : '연간'} · {sub.category}
                      {sub.isForeign && <span className="text-red-500 ml-1">· 해외</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{won(sub.amount)}</p>
                    {sub.lastDate && <p className="text-xs text-gray-400">마지막 {sub.lastDate}</p>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* 해외결제 탭 */}
      {activeTab === 'foreign' && (
        <div className="space-y-2">
          {foreignPayments.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">해외결제 내역이 없습니다</div>
          ) : (
            <>
              <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-800">
                <p className="font-bold">⚠ 해외결제 {won(foreignPayments.reduce((s, p) => s + p.amount, 0))}</p>
                <p className="text-xs text-red-600 mt-1">사업용 해외결제는 부가세 매입세액 불공제 대상입니다. 비용 처리는 가능하나 부가세 환급은 받을 수 없습니다.</p>
              </div>
              {foreignPayments.map((p, i) => (
                <div key={i} className="bg-white rounded-xl border border-red-100 px-4 py-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{p.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{p.date}</p>
                    </div>
                    <p className="text-sm font-bold text-red-600">{won(p.amount)}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* 상세 내역 탭 */}
      {activeTab === 'detail' && (
        <div className="space-y-1">
          {transactions.filter(t => t.amount > 0).slice(0, 50).map(tx => (
            <div key={tx.id} className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 flex items-center justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${CATEGORY_COLORS[tx.category] ?? 'bg-gray-300'}`} />
                  <p className="text-sm text-gray-800 truncate">{tx.description}</p>
                  {tx.isForeign && <span className="text-xs text-red-400 flex-shrink-0">해외</span>}
                  {tx.isSubscription && <span className="text-xs text-indigo-400 flex-shrink-0">구독</span>}
                </div>
                <p className="text-xs text-gray-400 ml-3">{tx.date} · {CATEGORY_LABELS[tx.category]}</p>
                {tx.note && <p className="text-xs text-orange-500 ml-3 mt-0.5">{tx.note}</p>}
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <p className={`text-sm font-semibold ${tx.isDeductible ? 'text-blue-600' : 'text-gray-500'}`}>
                  {won(tx.amount)}
                </p>
              </div>
            </div>
          ))}
          {transactions.filter(t => t.amount > 0).length > 50 && (
            <p className="text-center text-xs text-gray-400 py-2">상위 50건 표시</p>
          )}
        </div>
      )}
    </div>
  )
}

function buildMonthly(txs: Transaction[]) {
  const map = new Map<string, number>()
  for (const tx of txs) {
    const key = `${tx.year}-${String(tx.month).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + tx.amount)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
}

function MonthlyChart({ data }: { data: [string, number][] }) {
  const max = Math.max(...data.map(([, v]) => v))
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-xs font-semibold text-gray-500 mb-3">월별 지출 추이</p>
      <div className="flex items-end gap-1 h-20">
        {data.map(([month, amt]) => (
          <div key={month} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full bg-blue-500 rounded-t" style={{ height: `${max > 0 ? (amt / max) * 72 : 0}px` }} />
            <span className="text-xs text-gray-400">{month.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
