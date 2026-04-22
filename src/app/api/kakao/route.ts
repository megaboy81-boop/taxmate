import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const KAKAO_SYSTEM = `당신은 카카오톡 자영업자 세무 코칭 봇입니다.
- 카카오톡 특성: 짧고 명확하게 (최대 200자)
- 이모지 활용으로 가독성 향상
- 핵심 수치 강조
- 마지막에 항상 다음 액션 1개 제안`

// 카카오 챗봇 스킬 응답 형식
interface KakaoSkillResponse {
  version: string
  template: {
    outputs: { simpleText: { text: string } }[]
    quickReplies?: { label: string; action: string; messageText: string }[]
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const userText = body?.userRequest?.utterance ?? ''

    if (!userText) {
      return Response.json(kakaoReply('안녕하세요! 세무 궁금증을 물어보세요 😊\n\n예: "부가세 간이과세자 기준이 뭐야?" "노란우산공제 얼마나 절세돼?"'))
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: KAKAO_SYSTEM,
      messages: [{ role: 'user', content: userText }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : '잠시 후 다시 시도해주세요'

    return Response.json(kakaoReply(text, [
      { label: '절세 팁', action: 'message', messageText: '지금 당장 할 수 있는 절세 방법 알려줘' },
      { label: '부가세 확인', action: 'message', messageText: '내 부가세 유형이 뭔지 알고 싶어' },
    ]))
  } catch (err) {
    return Response.json(kakaoReply('일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요 🙏'))
  }
}

function kakaoReply(text: string, quickReplies?: KakaoSkillResponse['template']['quickReplies']): KakaoSkillResponse {
  return {
    version: '2.0',
    template: {
      outputs: [{ simpleText: { text } }],
      ...(quickReplies ? { quickReplies } : {}),
    },
  }
}
