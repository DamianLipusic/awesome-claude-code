'use client'

import { useEffect, useState } from 'react'
import { loadWorkouts, deleteWorkout } from '@/lib/storage'
import { Workout } from '@/lib/types'
import WorkoutCard from '@/components/WorkoutCard'

export default function HistoryPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])

  useEffect(() => {
    setWorkouts(loadWorkouts().filter((w) => w.finished))
  }, [])

  function handleDelete(id: string) {
    deleteWorkout(id)
    setWorkouts((prev) => prev.filter((w) => w.id !== id))
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Verlauf</h1>

      {workouts.length === 0 ? (
        <div className="text-center text-neutral-600 mt-20">
          <p className="text-4xl mb-3">🏋️</p>
          <p className="text-sm">Noch keine Trainings</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workouts.map((w) => (
            <WorkoutCard key={w.id} workout={w} onDelete={() => handleDelete(w.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
