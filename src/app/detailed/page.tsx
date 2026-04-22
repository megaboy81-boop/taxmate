import Link from 'next/link'

export default function DetailedPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">🚧</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">준비 중입니다</h1>
        <p className="text-gray-500 text-sm mb-2">카드사·은행·홈택스 연동 기능을 개발 중입니다.</p>
        <p className="text-gray-400 text-xs mb-8">간편 계산으로 먼저 세금을 추정해보세요.</p>
        <Link href="/quick" className="inline-block bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-blue-700 transition-colors">
          간편 계산 시작하기
        </Link>
        <div className="mt-4">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← 처음으로</Link>
        </div>
      </div>
    </main>
  )
}
