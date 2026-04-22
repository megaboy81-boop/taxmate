'use client'

import Link from 'next/link'

export default function SettingsPage() {
  const apiUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/kakao` : '/api/kakao'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← TaxMate</Link>
        <span className="text-sm font-semibold text-gray-700">설정 / 연동</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Claude API 설정 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🤖</span>
            <h2 className="font-semibold text-gray-800">Claude AI 연결</h2>
          </div>
          <p className="text-sm text-gray-500 mb-3">실시간 AI 세무 코칭에 필요합니다.</p>
          <div className="bg-gray-50 rounded-xl p-3 font-mono text-xs text-gray-700 mb-3">
            <p className="text-gray-400 mb-1"># .env.local 파일에 입력</p>
            <p>ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxx</p>
          </div>
          <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
            <li>console.anthropic.com 에서 API 키 발급</li>
            <li>프로젝트 폴더의 <code className="bg-gray-100 px-1 rounded">.env.local</code> 파일에 입력</li>
            <li>서버 재시작 (<code className="bg-gray-100 px-1 rounded">npm run dev</code>)</li>
          </ol>
        </div>

        {/* 카카오 챗봇 설정 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💬</span>
            <h2 className="font-semibold text-gray-800">카카오톡 챗봇 연동</h2>
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">선택</span>
          </div>
          <p className="text-sm text-gray-500 mb-3">카카오 비즈니스 채널에 세무 코칭 봇을 연결합니다.</p>
          <div className="bg-gray-50 rounded-xl p-3 mb-3">
            <p className="text-xs font-semibold text-gray-600 mb-1">스킬 서버 URL</p>
            <p className="text-xs font-mono text-blue-600 break-all">{apiUrl}</p>
          </div>
          <ol className="text-xs text-gray-500 space-y-1.5 list-decimal list-inside">
            <li>카카오 비즈니스 채널 개설 (business.kakao.com)</li>
            <li>카카오 챗봇 → 스킬 서버 URL에 위 주소 입력</li>
            <li>인증 토큰을 <code className="bg-gray-100 px-1 rounded">.env.local</code>에 입력</li>
            <li>배포 후 외부 URL 필요 (ngrok 또는 Vercel 권장)</li>
          </ol>
        </div>

        {/* Vercel 배포 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🚀</span>
            <h2 className="font-semibold text-gray-800">외부 배포 (Vercel)</h2>
          </div>
          <p className="text-sm text-gray-500 mb-3">지인에게 공유하거나 카카오봇 연결을 위해 필요합니다.</p>
          <div className="bg-gray-50 rounded-xl p-3 font-mono text-xs text-gray-700 mb-3">
            <p className="text-gray-400"># 터미널에서</p>
            <p>npm i -g vercel</p>
            <p>vercel --prod</p>
          </div>
          <p className="text-xs text-gray-400">환경변수는 Vercel 대시보드 → Settings → Environment Variables에서 설정</p>
        </div>

        {/* 데이터 보안 */}
        <div className="bg-blue-50 rounded-2xl p-4 text-sm">
          <p className="font-semibold text-blue-800 mb-1">🔒 데이터 보안</p>
          <ul className="text-blue-700 text-xs space-y-1">
            <li>• 업로드 파일은 브라우저 메모리에서만 처리됩니다</li>
            <li>• 서버에 저장되지 않으며 페이지 새로고침 시 삭제됩니다</li>
            <li>• AI 코칭 질문만 Claude API로 전송됩니다</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
