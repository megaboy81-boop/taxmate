'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  context?: string  // 사용자 데이터 컨텍스트
  placeholder?: string
}

const QUICK_QUESTIONS = [
  '내 업종의 경비율이 얼마나 되나요?',
  '간이과세자와 일반과세자 차이가 뭐예요?',
  '노란우산공제 가입하면 세금이 얼마나 줄어요?',
  '연금저축 IRP를 최대로 넣으면 얼마 절세돼요?',
  '해외결제가 왜 부가세 환급이 안 되나요?',
  '가족한테 월급 주면 경비 처리 되나요?',
]

export default function CoachingChat({ context, placeholder = '세금·절세 질문을 입력하세요...' }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [apiKeyMissing, setApiKeyMissing] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages([...newMessages, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)
    setApiKeyMissing(false)

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          context,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (err.error?.includes('API key') || res.status === 401) {
          setApiKeyMissing(true)
        }
        setMessages(prev => prev.slice(0, -1).concat({ role: 'assistant', content: '⚠ 오류가 발생했습니다. API 키를 확인해주세요.' }))
        return
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: accumulated },
          ])
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => prev.slice(0, -1).concat({ role: 'assistant', content: '⚠ 연결 오류가 발생했습니다.' }))
      }
    } finally {
      setStreaming(false)
    }
  }, [messages, streaming, context])

  return (
    <div className="flex flex-col h-full">
      {/* API 키 경고 */}
      {apiKeyMissing && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-3 text-sm">
          <p className="font-semibold text-orange-800">API 키가 필요합니다</p>
          <p className="text-orange-600 text-xs mt-1"><code>.env.local</code>에 <code>ANTHROPIC_API_KEY</code>를 입력하고 서버를 재시작하세요</p>
        </div>
      )}

      {/* 채팅 영역 */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-0">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 text-center py-2">자주 묻는 질문</p>
            {QUICK_QUESTIONS.map((q, i) => (
              <button key={i} onClick={() => sendMessage(q)}
                className="w-full text-left text-sm text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 rounded-xl px-3 py-2.5 transition-colors border border-gray-100">
                {q}
              </button>
            ))}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm'}`}>
                {msg.content || (streaming && i === messages.length - 1 ? (
                  <span className="flex gap-1 items-center py-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                ) : '')}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
          placeholder={placeholder}
          rows={1}
          disabled={streaming}
          className="flex-1 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-gray-900 placeholder:text-gray-400"
        />
        <button
          onClick={() => streaming ? abortRef.current?.abort() : sendMessage(input)}
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors
            ${streaming ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200'}`}
          disabled={!streaming && !input.trim()}
        >
          {streaming
            ? <span className="w-3 h-3 bg-white rounded-sm" />
            : <span className="text-white text-lg leading-none">↑</span>}
        </button>
      </div>
      <p className="text-xs text-gray-400 text-center mt-2">참고용 정보입니다. 실제 신고는 세무사와 확인하세요.</p>
    </div>
  )
}
