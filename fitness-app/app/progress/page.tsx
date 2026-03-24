'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { EXERCISES } from '@/lib/exercises'
import { getProgressData } from '@/lib/storage'

// Recharts uses browser APIs — load client-only
const ProgressChart = dynamic(() => import('@/components/ProgressChart'), { ssr: false })

export default function ProgressPage() {
  const [selectedId, setSelectedId] = useState(EXERCISES[0]?.id ?? '')
  const [data, setData] = useState<{ date: string; weight: number }[]>([])

  useEffect(() => {
    setData(getProgressData(selectedId))
  }, [selectedId])

  const selected = EXERCISES.find((e) => e.id === selectedId)

  // Best ever for this exercise
  const best = data.length ? Math.max(...data.map((d) => d.weight)) : null

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Fortschritt</h1>

      {/* Exercise selector */}
      <div className="bg-[#1a1a1a] rounded-xl px-4 py-3 mb-4">
        <label className="text-xs text-neutral-500 block mb-1">Übung</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="bg-transparent text-white font-semibold w-full outline-none text-sm"
        >
          {EXERCISES.map((e) => (
            <option key={e.id} value={e.id} className="bg-[#1a1a1a]">
              {e.name}
            </option>
          ))}
        </select>
      </div>

      {/* Best ever */}
      {best !== null && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs text-orange-400/70 mb-0.5">Persönlicher Rekord</p>
          <p className="text-2xl font-bold text-orange-400">{best} kg</p>
          <p className="text-xs text-neutral-500">{selected?.name}</p>
        </div>
      )}

      {/* Chart */}
      <div className="bg-[#1a1a1a] rounded-2xl p-4">
        <p className="text-xs text-neutral-500 mb-3">Maximales Gewicht pro Training</p>
        <ProgressChart data={data} />
      </div>
    </div>
  )
}
