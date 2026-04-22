// 로컬 Claude CLI 프록시 서버 — Vercel에서 이 서버를 호출
import { createServer } from 'http'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const PORT = 3099

createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  if (req.method !== 'POST' || req.url !== '/coach') {
    res.writeHead(404); res.end('Not found'); return
  }

  let body = ''
  req.on('data', chunk => body += chunk)
  req.on('end', async () => {
    try {
      const { prompt } = JSON.parse(body)
      if (!prompt) { res.writeHead(400); res.end('prompt required'); return }

      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })

      // zsh -i -c 로 Claude Code CLI 인증 환경 로드
      const { stdout } = await execFileAsync('/bin/zsh', [
        '-i', '-c',
        `claude -p ${JSON.stringify(prompt)} --output-format text`
      ], {
        maxBuffer: 512 * 1024,
        timeout: 60_000,
        env: { ...process.env, TERM: 'xterm-256color' },
      })

      // ANSI 이스케이프 제거
      const clean = stdout.replace(/\x1B\[[0-9;]*m/g, '').trim()
      res.end(clean)
    } catch (err) {
      res.end(`⚠ 프록시 오류: ${err.message}`)
    }
  })
}).listen(PORT, () => {
  console.log(`[TaxMate Coach Proxy] http://localhost:${PORT}`)
  console.log('cloudflared 터널을 별도 터미널에서 실행하세요:')
  console.log(`  cloudflared tunnel --url http://localhost:${PORT}`)
})
