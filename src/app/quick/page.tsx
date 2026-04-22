import QuickWizard from '@/components/QuickWizard'
import Link from 'next/link'

export default function QuickPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← TaxMate</Link>
        <span className="text-sm font-semibold text-gray-700">간편 계산</span>
      </div>
      <QuickWizard />
    </div>
  )
}
