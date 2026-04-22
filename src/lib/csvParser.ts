import type { RawTransaction, ParseResult } from '@/types/transaction'

// 날짜 정규화: 다양한 형식 → YYYY-MM-DD
function normalizeDate(raw: string): string {
  const s = raw.trim().replace(/\./g, '-').replace(/\//g, '-')
  // YYYYMMDD → YYYY-MM-DD
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  // YYYY-MM-DD (already)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return s
}

function parseAmount(raw: string): number {
  return Number(raw.replace(/,/g, '').replace(/[^\d.-]/g, '')) || 0
}

// 국민은행 형식: 거래일자,적요,출금액,입금액,잔액
function parseKB(lines: string[]): RawTransaction[] {
  return lines.slice(1).flatMap((line, i) => {
    const cols = line.split(',')
    if (cols.length < 4) return []
    const withdrawal = parseAmount(cols[2])
    const deposit = parseAmount(cols[3])
    const amount = withdrawal > 0 ? withdrawal : -deposit
    if (amount === 0) return []
    return [{
      date: normalizeDate(cols[0]),
      description: cols[1]?.trim() ?? '',
      amount,
      balance: cols[4] ? parseAmount(cols[4]) : undefined,
      bankCode: 'kb',
      raw: line,
    }]
  })
}

// 신한은행 형식: 날짜,시간,내용,출금,입금,잔액
function parseShinhan(lines: string[]): RawTransaction[] {
  return lines.slice(1).flatMap(line => {
    const cols = line.split(',')
    if (cols.length < 5) return []
    const withdrawal = parseAmount(cols[3])
    const deposit = parseAmount(cols[4])
    const amount = withdrawal > 0 ? withdrawal : -deposit
    if (amount === 0) return []
    return [{
      date: normalizeDate(cols[0]),
      description: cols[2]?.trim() ?? '',
      amount,
      balance: cols[5] ? parseAmount(cols[5]) : undefined,
      bankCode: 'shinhan',
      raw: line,
    }]
  })
}

// 우리은행 형식: 거래일,적요,찾으신금액,맡기신금액,잔액
function parseWoori(lines: string[]): RawTransaction[] {
  return lines.slice(1).flatMap(line => {
    const cols = line.split(',')
    if (cols.length < 4) return []
    const withdrawal = parseAmount(cols[2])
    const deposit = parseAmount(cols[3])
    const amount = withdrawal > 0 ? withdrawal : -deposit
    if (amount === 0) return []
    return [{
      date: normalizeDate(cols[0]),
      description: cols[1]?.trim() ?? '',
      amount,
      balance: cols[4] ? parseAmount(cols[4]) : undefined,
      bankCode: 'woori',
      raw: line,
    }]
  })
}

// 범용 파서: 헤더 기반 자동 감지
function parseGeneric(lines: string[]): RawTransaction[] {
  if (lines.length < 2) return []
  const header = lines[0].toLowerCase()

  if (header.includes('출금액') && header.includes('kb')) return parseKB(lines)
  if (header.includes('출금액') && header.includes('신한')) return parseShinhan(lines)
  if (header.includes('찾으신')) return parseWoori(lines)

  // 헤더 컬럼 위치 자동 탐지
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const dateIdx = headers.findIndex(h => h.includes('일자') || h.includes('날짜') || h.includes('date'))
  const descIdx = headers.findIndex(h => h.includes('적요') || h.includes('내용') || h.includes('desc'))
  const withdrawIdx = headers.findIndex(h => h.includes('출금') || h.includes('찾') || h.includes('debit'))
  const depositIdx = headers.findIndex(h => h.includes('입금') || h.includes('맡') || h.includes('credit'))
  const balIdx = headers.findIndex(h => h.includes('잔액') || h.includes('balance'))

  if (dateIdx < 0 || descIdx < 0) return []

  return lines.slice(1).flatMap(line => {
    const cols = line.split(',')
    const withdrawal = withdrawIdx >= 0 ? parseAmount(cols[withdrawIdx] ?? '0') : 0
    const deposit = depositIdx >= 0 ? parseAmount(cols[depositIdx] ?? '0') : 0
    const amount = withdrawal > 0 ? withdrawal : -deposit
    if (amount === 0 && withdrawal === 0 && deposit === 0) return []
    return [{
      date: normalizeDate(cols[dateIdx] ?? ''),
      description: cols[descIdx]?.trim() ?? '',
      amount,
      balance: balIdx >= 0 ? parseAmount(cols[balIdx] ?? '0') : undefined,
      raw: line,
    }]
  })
}

export function parseBankCSV(content: string): ParseResult {
  const raw = content.trim()
  // BOM 제거
  const cleaned = raw.startsWith('﻿') ? raw.slice(1) : raw
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim())

  let transactions: RawTransaction[] = []
  let errorRows = 0

  try {
    const header = lines[0]?.toLowerCase() ?? ''
    if (header.includes('kb') || (header.includes('출금액') && header.includes('입금액'))) {
      transactions = parseKB(lines)
    } else if (header.includes('신한')) {
      transactions = parseShinhan(lines)
    } else if (header.includes('찾으신')) {
      transactions = parseWoori(lines)
    } else {
      transactions = parseGeneric(lines)
    }
  } catch {
    errorRows++
  }

  // 날짜 범위 추출
  const dates = transactions.map(t => t.date).filter(Boolean).sort()
  const period = dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : undefined

  return {
    transactions,
    source: 'bank',
    period,
    totalRows: lines.length - 1,
    errorRows,
  }
}

// 홈택스 절세 데이터 파서 (소득공제 내역 CSV)
export function parseHomtaxDeductions(content: string): { type: string; amount: number; year: number }[] {
  const cleaned = content.startsWith('﻿') ? content.slice(1) : content
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim())

  return lines.slice(1).flatMap(line => {
    const cols = line.split(',')
    if (cols.length < 3) return []
    const amount = parseAmount(cols[1] ?? '0')
    if (amount === 0) return []
    return [{ type: cols[0]?.trim() ?? '', amount, year: parseInt(cols[2] ?? '0') || new Date().getFullYear() }]
  })
}
