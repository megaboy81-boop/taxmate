'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">TaxMate</h1>
          <p className="mt-2 text-gray-500 text-sm">당신이 놓치고 있는 돈, AI가 먼저 찾아드립니다</p>
        </div>

        <div className="space-y-3">
          {/* 통장 분석 (메인) */}
          <Link href="/upload">
            <div className="bg-blue-600 rounded-2xl p-5 cursor-pointer hover:bg-blue-700 transition-colors group">
              <div className="flex items-start gap-4">
                <div className="text-3xl">📊</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-white">통장 분석</h2>
                    <span className="text-xs bg-white/20 text-white font-semibold px-2 py-0.5 rounded-full">추천</span>
                  </div>
                  <p className="text-sm text-blue-100 mb-2">CSV 하나로 모든 걸 분석</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-blue-200">
                    <span>• 구독 서비스 자동 탐지</span>
                    <span>• 해외결제 경고</span>
                    <span>• 경비 자동 분류</span>
                    <span>• 절세 공제 현황</span>
                  </div>
                </div>
                <div className="text-white/60 group-hover:translate-x-1 transition-transform text-xl mt-1">→</div>
              </div>
            </div>
          </Link>

          {/* 간편 세금 계산 */}
          <Link href="/quick">
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-5 cursor-pointer hover:border-blue-300 transition-colors group">
              <div className="flex items-start gap-4">
                <div className="text-3xl">⚡</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-gray-900">간편 세금 계산</h2>
                    <span className="text-xs bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full">5분</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">직접 입력으로 세금 바로 추정</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-400">
                    <span>• 업종별 경비율 자동 적용</span>
                    <span>• 간이/일반과세 자동 판별</span>
                    <span>• 경비율 vs 장부 비교</span>
                    <span>• 절세 코칭</span>
                  </div>
                </div>
                <div className="text-gray-300 group-hover:text-blue-400 group-hover:translate-x-1 transition-all text-xl mt-1">→</div>
              </div>
            </div>
          </Link>

          {/* AI 코칭 */}
          <Link href="/coaching">
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-5 cursor-pointer hover:border-purple-300 transition-colors group">
              <div className="flex items-start gap-4">
                <div className="text-3xl">💬</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-gray-900">AI 세무 코칭</h2>
                    <span className="text-xs bg-purple-50 text-purple-600 font-semibold px-2 py-0.5 rounded-full">실시간</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">궁금한 세금 질문을 바로 물어보세요</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-400">
                    <span>• 업종별 전문 코칭</span>
                    <span>• 절세 방법 안내</span>
                    <span>• 부가세·소득세 Q&A</span>
                    <span>• 내 데이터 기반 분석</span>
                  </div>
                </div>
                <div className="text-gray-300 group-hover:text-purple-400 group-hover:translate-x-1 transition-all text-xl mt-1">→</div>
              </div>
            </div>
          </Link>
        </div>

        {/* 하단 링크 */}
        <div className="flex items-center justify-between mt-5">
          <p className="text-xs text-gray-400">참고용 정보 제공 · 실제 신고는 세무사 확인 필요</p>
          <Link href="/settings" className="text-xs text-gray-400 hover:text-gray-600">⚙ 설정</Link>
        </div>
      </div>
    </main>
  )
}
