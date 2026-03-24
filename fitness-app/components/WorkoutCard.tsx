'use client'

import { Workout } from '@/lib/types'

type Props = {
  workout: Workout
  onDelete: () => void
}

export default function WorkoutCard({ workout, onDelete }: Props) {
  const totalVolume = workout.exercises.reduce((acc, e) => {
    return acc + e.sets.filter((s) => s.done).reduce((a, s) => a + s.weight * s.reps, 0)
  }, 0)

  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-sm">
            {new Date(workout.date).toLocaleDateString('de-DE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          {totalVolume > 0 && (
            <p className="text-xs text-neutral-500 mt-0.5">{totalVolume.toLocaleString()} kg Volumen</p>
          )}
        </div>
        <button
          onClick={onDelete}
          className="text-neutral-700 hover:text-red-400 transition-colors p-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>

      <div className="space-y-1">
        {workout.exercises.map((e, i) => {
          const doneSets = e.sets.filter((s) => s.done)
          const maxWeight = doneSets.length ? Math.max(...doneSets.map((s) => s.weight)) : 0
          return (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-neutral-300">{e.name}</span>
              <span className="text-neutral-600 text-xs">
                {doneSets.length} × {maxWeight > 0 ? `${maxWeight} kg` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
