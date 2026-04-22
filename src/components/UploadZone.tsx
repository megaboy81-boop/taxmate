'use client'

import { useState, useCallback } from 'react'
import type { ParseResult } from '@/types/transaction'
import { parseBankCSV } from '@/lib/csvParser'

interface Props {
  onParsed: (result: ParseResult, filename: string) => void
  label: string
  hint: string
  accept?: string
}

export default function UploadZone({ onParsed, label, hint, accept = '.csv,.txt' }: Props) {
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle')
  const [filename, setFilename] = useState('')
  const [rowCount, setRowCount] = useState(0)

  const process = useCallback(async (file: File) => {
    setStatus('parsing')
    setFilename(file.name)
    try {
      const text = await file.text()
      const result = parseBankCSV(text)
      setRowCount(result.transactions.length)
      setStatus('done')
      onParsed(result, file.name)
    } catch {
      setStatus('error')
    }
  }, [onParsed])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) process(file)
  }, [process])

  const onInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) process(file)
  }, [process])

  return (
    <label
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`block cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all
        ${dragging ? 'border-blue-400 bg-blue-50' : status === 'done' ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300'}`}
    >
      <input type="file" accept={accept} className="hidden" onChange={onInput} />

      {status === 'idle' && (
        <>
          <div className="text-2xl mb-2">📂</div>
          <p className="text-sm font-semibold text-gray-700">{label}</p>
          <p className="text-xs text-gray-400 mt-1">{hint}</p>
          <p className="text-xs text-blue-500 mt-2">클릭하거나 파일을 여기에 드래그</p>
        </>
      )}

      {status === 'parsing' && (
        <div className="text-sm text-gray-500">⏳ 분석 중...</div>
      )}

      {status === 'done' && (
        <>
          <div className="text-2xl mb-1">✅</div>
          <p className="text-sm font-semibold text-green-700">{filename}</p>
          <p className="text-xs text-green-600 mt-1">{rowCount}건 거래 파싱 완료</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="text-2xl mb-1">❌</div>
          <p className="text-sm text-red-600">파싱 오류 — CSV 형식을 확인하세요</p>
        </>
      )}
    </label>
  )
}
