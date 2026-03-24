import { Workout, ExerciseEntry } from './types'

const KEY = 'ironlog_workouts'

export function loadWorkouts(): Workout[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function saveWorkouts(workouts: Workout[]): void {
  localStorage.setItem(KEY, JSON.stringify(workouts))
}

export function getWorkout(id: string): Workout | undefined {
  return loadWorkouts().find((w) => w.id === id)
}

export function saveWorkout(workout: Workout): void {
  const all = loadWorkouts()
  const idx = all.findIndex((w) => w.id === workout.id)
  if (idx >= 0) {
    all[idx] = workout
  } else {
    all.unshift(workout)
  }
  saveWorkouts(all)
}

export function deleteWorkout(id: string): void {
  saveWorkouts(loadWorkouts().filter((w) => w.id !== id))
}

/** Returns the last logged set for a given exercise (from finished workouts) */
export function getLastEntry(exerciseId: string): ExerciseEntry | undefined {
  const workouts = loadWorkouts().filter((w) => w.finished)
  for (const workout of workouts) {
    const entry = workout.exercises.find((e) => e.exerciseId === exerciseId)
    if (entry) return entry
  }
  return undefined
}

/** Returns max weight per date for a given exercise */
export function getProgressData(exerciseId: string): { date: string; weight: number }[] {
  const workouts = loadWorkouts().filter((w) => w.finished)
  return workouts
    .map((w) => {
      const entry = w.exercises.find((e) => e.exerciseId === exerciseId)
      if (!entry) return null
      const maxWeight = Math.max(...entry.sets.filter((s) => s.done).map((s) => s.weight), 0)
      if (maxWeight === 0) return null
      return { date: w.date.slice(0, 10), weight: maxWeight }
    })
    .filter(Boolean)
    .reverse() as { date: string; weight: number }[]
}
