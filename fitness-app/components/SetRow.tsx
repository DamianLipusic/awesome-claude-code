'use client'

import { WorkoutSet } from '@/lib/types'

type Props = {
  set: WorkoutSet
  index: number
  onChange: (updated: WorkoutSet) => void
  onRemove: () => void
}

export default function SetRow({ set, index, onChange, onRemove }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-neutral-600 text-sm w-5 text-right shrink-0">{index + 1}</span>

      {/* Weight */}
      <div className="flex items-center bg-[#222] rounded-lg px-3 py-2 gap-1 flex-1">
        <input
          type="number"
          inputMode="decimal"
          value={set.weight || ''}
          onChange={(e) => onChange({ ...set, weight: parseFloat(e.target.value) || 0 })}
          placeholder="0"
          className="bg-transparent w-full text-white text-base font-semibold outline-none min-w-0"
        />
        <span className="text-neutral-500 text-sm shrink-0">kg</span>
      </div>

      <span className="text-neutral-600 text-sm">×</span>

      {/* Reps */}
      <div className="flex items-center bg-[#222] rounded-lg px-3 py-2 gap-1 flex-1">
        <input
          type="number"
          inputMode="numeric"
          value={set.reps || ''}
          onChange={(e) => onChange({ ...set, reps: parseInt(e.target.value) || 0 })}
          placeholder="0"
          className="bg-transparent w-full text-white text-base font-semibold outline-none min-w-0"
        />
        <span className="text-neutral-500 text-sm shrink-0">Wdh</span>
      </div>

      {/* Done toggle */}
      <button
        onClick={() => onChange({ ...set, done: !set.done })}
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
          set.done ? 'bg-orange-500 text-white' : 'bg-[#222] text-neutral-600'
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="w-9 h-9 rounded-lg bg-[#222] flex items-center justify-center shrink-0 text-neutral-600 active:text-red-400 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
