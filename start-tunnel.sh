#!/bin/bash
# TaxMate AI 코칭 터널 시작 스크립트
# 실행: ./start-tunnel.sh

echo "=== TaxMate Claude CLI 프록시 시작 ==="

# 프록시 서버 백그라운드 실행
node /Users/megaboy/Developer/taxmate/coach-proxy/server.mjs &
PROXY_PID=$!
echo "[1] 프록시 서버 시작 (PID: $PROXY_PID, port: 3099)"
sleep 1

# cloudflared 터널 시작 (URL이 나올 때까지 대기)
echo "[2] Cloudflare 터널 시작..."
cloudflared tunnel --url http://localhost:3099 2>&1 | while read line; do
  echo "$line"
  # trycloudflare.com URL 감지 시 자동으로 Vercel에 등록
  if echo "$line" | grep -q "trycloudflare.com"; then
    URL=$(echo "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com')
    if [ -n "$URL" ]; then
      echo ""
      echo "✅ 터널 URL: $URL"
      echo "➡ Vercel 환경변수 설정 중..."
      cd /Users/megaboy/Developer/taxmate && \
        echo "$URL" | vercel env add COACH_PROXY_URL production --force 2>/dev/null && \
        vercel --prod --yes 2>/dev/null &
      echo "✅ Vercel 재배포 시작 — 완료까지 1~2분"
      echo ""
      echo "이 터미널을 열어두세요. 닫으면 AI 코칭이 중단됩니다."
    fi
  fi
done

# 종료 시 프록시도 종료
kill $PROXY_PID 2>/dev/null
