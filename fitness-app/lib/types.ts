export type WorkoutSet = {
  weight: number
  reps: number
  done: boolean
}

export type ExerciseEntry = {
  exerciseId: string
  name: string
  sets: WorkoutSet[]
}

export type Workout = {
  id: string
  date: string        // ISO string
  exercises: ExerciseEntry[]
  finished: boolean
}

export type Exercise = {
  id: string
  name: string
  muscle: string
}
