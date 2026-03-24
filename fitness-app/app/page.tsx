'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { loadWorkouts, saveWorkout } from '@/lib/storage'
import { Workout } from '@/lib/types'

export default function Home() {
  const router = useRouter()
  const [recent, setRecent] = useState<Workout[]>([])

  useEffect(() => {
    setRecent(loadWorkouts().filter((w) => w.finished).slice(0, 3))
  }, [])

  function startWorkout() {
    const workout: Workout = {
      id: uuidv4(),
      date: new Date().toISOString(),
      exercises: [],
      finished: false,
    }
    saveWorkout(workout)
    router.push(`/workout?id=${workout.id}`)
  }

  return (
    <div className="flex flex-col min-h-[80vh]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">IronLog</h1>
        <p className="text-neutral-500 text-sm mt-1">Krafttraining. Simpel.</p>
      </div>

      {/* Recent workouts */}
      {recent.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
            Zuletzt
          </h2>
          <div className="space-y-2">
            {recent.map((w) => (
              <div
                key={w.id}
                className="bg-[#1a1a1a] rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium">
                    {new Date(w.date).toLocaleDateString('de-DE', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {w.exercises.map((e) => e.name).join(', ') || 'Kein Gerät'}
                  </p>
                </div>
                <span className="text-xs text-neutral-600">
                  {w.exercises.length} Übung{w.exercises.length !== 1 ? 'en' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Start button */}
      <button
        onClick={startWorkout}
        className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold text-lg rounded-2xl py-5 transition-colors"
      >
        + Training starten
      </button>
    </div>
  )
}
