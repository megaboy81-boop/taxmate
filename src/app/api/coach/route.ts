import { NextRequest } from 'next/server'
import { execFile } from 'child_process'

const SYSTEM_PROMPT = `당신은 한국 자영업자 전문 세무·재무 코칭 AI입니다.

핵심 원칙:
- 모든 응답은 한국어로, 친절하고 명확하게
- 구체적인 금액과 비율을 제시
- "참고용 정보"임을 명시, 실제 신고는 세무사 권고
- 복잡한 세무 용어는 쉽게 풀어서 설명
- 업종별 특성(음식점/서비스/프리랜서/소매) 반영

전문 영역:
- 종합소득세 (단순경비율/기준경비율/간편장부 비교)
- 부가세 (간이과세자 기준: 연 1억 400만원, 납부면제: 연 4,800만원)
- 절세 공제 (노란우산공제/연금저축/IRP/국민연금/건강보험)
- 해외결제 부가세 매입세액 불공제 규정
- 가족 인건비 원천세 신고 전략
- 사업용 신용카드 등록 및 경비 처리

응답 형식:
- 핵심 답변 먼저 (2~3문장)
- 구체적 수치와 근거
- 실행 가능한 액션 1~2개
- 3~5문장 이내로 간결하게`

function buildPrompt(messages: {role:string;content:string}[], context?: string): string {
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content ?? ''
  const history = messages.slice(0, -1)
    .map(m => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`)
    .join('\n')
  return [
    SYSTEM_PROMPT,
    context ? `\n[사용자 데이터]\n${context}` : '',
    history ? `\n[대화 기록]\n${history}` : '',
    `\n사용자: ${lastUserMsg}\nAI:`,
  ].filter(Boolean).join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json()
    const prompt = buildPrompt(messages, context)

    // 우선순위 1: 로컬 Claude CLI 프록시 (맥에서 cloudflared 터널 실행 중일 때)
    const proxyUrl = process.env.COACH_PROXY_URL
    if (proxyUrl) return respondViaProxy(prompt, proxyUrl)

    // 우선순위 2: Anthropic API 키
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (apiKey && apiKey.startsWith('sk-ant-')) return respondWithSDK(prompt, apiKey)

    // 우선순위 3: 로컬 Claude CLI (localhost 환경)
    return respondWithCLI(prompt)

  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

// 로컬 프록시 (Vercel → 맥 터널 → Claude CLI)
async function respondViaProxy(prompt: string, proxyUrl: string) {
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch(`${proxyUrl}/coach`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
          signal: AbortSignal.timeout(55_000),
        })
        const text = await res.text()
        controller.enqueue(encoder.encode(text))
      } catch (err) {
        controller.enqueue(encoder.encode(`⚠ 프록시 연결 실패 — 맥이 켜져 있고 터널이 실행 중인지 확인하세요. (${(err as Error).message})`))
      }
      controller.close()
    },
  })
  return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

// Anthropic SDK (API 키 있을 때)
function respondWithSDK(prompt: string, apiKey: string) {
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk')
        const client = new Anthropic({ apiKey })
        const stream = await client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        })
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`⚠ ${(err as Error).message}`))
      }
      controller.close()
    },
  })
  return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

// 로컬 Claude CLI (localhost 개발 환경)
function respondWithCLI(prompt: string) {
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    start(controller) {
      execFile('/bin/zsh', ['-i', '-c', `claude -p ${JSON.stringify(prompt)} --output-format text`], {
        maxBuffer: 512 * 1024,
        timeout: 60_000,
        env: { ...process.env, TERM: 'xterm-256color' },
      }, (err, stdout) => {
        if (err) {
          controller.enqueue(encoder.encode('⚠ AI 코칭을 사용하려면 COACH_PROXY_URL 또는 ANTHROPIC_API_KEY를 설정하세요.'))
        } else {
          const clean = stdout.replace(/\x1B\[[0-9;]*m/g, '').trim()
          controller.enqueue(encoder.encode(clean))
        }
        controller.close()
      })
    },
  })
  return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
