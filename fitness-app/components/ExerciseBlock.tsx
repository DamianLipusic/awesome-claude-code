'use client'

import { ExerciseEntry, WorkoutSet } from '@/lib/types'
import SetRow from './SetRow'

type Props = {
  entry: ExerciseEntry
  lastEntry?: ExerciseEntry
  onChange: (updated: ExerciseEntry) => void
  onRemove: () => void
}

export default function ExerciseBlock({ entry, lastEntry, onChange, onRemove }: Props) {
  function updateSet(i: number, updated: WorkoutSet) {
    const sets = [...entry.sets]
    sets[i] = updated
    onChange({ ...entry, sets })
  }

  function removeSet(i: number) {
    const sets = entry.sets.filter((_, idx) => idx !== i)
    onChange({ ...entry, sets })
  }

  function addSet() {
    const last = entry.sets[entry.sets.length - 1]
    const newSet: WorkoutSet = {
      weight: last?.weight ?? 0,
      reps: last?.reps ?? 0,
      done: false,
    }
    onChange({ ...entry, sets: [...entry.sets, newSet] })
  }

  // Build "last time" hint from last session
  const lastHint = (() => {
    if (!lastEntry) return null
    const doneSets = lastEntry.sets.filter((s) => s.done)
    if (doneSets.length === 0) return null
    const maxWeight = Math.max(...doneSets.map((s) => s.weight))
    const bestSet = doneSets.find((s) => s.weight === maxWeight)
    if (!bestSet) return null
    return `Letztes Mal: ${bestSet.weight} kg × ${bestSet.reps}`
  })()

  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-base">{entry.name}</h3>
          {lastHint && <p className="text-xs text-neutral-500 mt-0.5">{lastHint}</p>}
        </div>
        <button
          onClick={onRemove}
          className="text-neutral-600 hover:text-red-400 transition-colors p-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>

      {/* Sets */}
      <div className="space-y-2">
        {entry.sets.map((set, i) => (
          <SetRow
            key={i}
            set={set}
            index={i}
            onChange={(updated) => updateSet(i, updated)}
            onRemove={() => removeSet(i)}
          />
        ))}
      </div>

      {/* Add set */}
      <button
        onClick={addSet}
        className="w-full text-orange-500 text-sm font-medium py-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 transition-colors"
      >
        + Satz hinzufügen
      </button>
    </div>
  )
}
