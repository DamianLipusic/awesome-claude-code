'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { getWorkout, saveWorkout, getLastEntry } from '@/lib/storage'
import { Workout, ExerciseEntry, WorkoutSet } from '@/lib/types'
import { EXERCISES, MUSCLES } from '@/lib/exercises'
import ExerciseBlock from '@/components/ExerciseBlock'

function WorkoutScreen() {
  const router = useRouter()
  const params = useSearchParams()
  const id = params.get('id') ?? ''

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [muscle, setMuscle] = useState('Alle')

  useEffect(() => {
    if (!id) { router.replace('/'); return }
    const w = getWorkout(id)
    if (!w) { router.replace('/'); return }
    setWorkout(w)
    if (w.exercises.length === 0) setShowPicker(true)
  }, [id, router])

  const persist = useCallback((updated: Workout) => {
    setWorkout(updated)
    saveWorkout(updated)
  }, [])

  function addExercise(exerciseId: string, name: string) {
    if (!workout) return
    const defaultSet: WorkoutSet = { weight: 0, reps: 0, done: false }
    const last = getLastEntry(exerciseId)
    const sets: WorkoutSet[] = last
      ? last.sets.filter((s) => s.done).map((s) => ({ ...s, done: false })).slice(0, 3)
      : [defaultSet]
    const entry: ExerciseEntry = { exerciseId, name, sets: sets.length ? sets : [defaultSet] }
    persist({ ...workout, exercises: [...workout.exercises, entry] })
    setShowPicker(false)
    setSearch('')
    setMuscle('Alle')
  }

  function updateEntry(i: number, updated: ExerciseEntry) {
    if (!workout) return
    const exercises = [...workout.exercises]
    exercises[i] = updated
    persist({ ...workout, exercises })
  }

  function removeEntry(i: number) {
    if (!workout) return
    const exercises = workout.exercises.filter((_, idx) => idx !== i)
    persist({ ...workout, exercises })
  }

  function finishWorkout() {
    if (!workout) return
    persist({ ...workout, finished: true })
    router.replace('/')
  }

  function cancelWorkout() {
    if (!workout) return
    // Remove the unfinished workout
    const all = JSON.parse(localStorage.getItem('ironlog_workouts') || '[]')
    localStorage.setItem('ironlog_workouts', JSON.stringify(all.filter((w: Workout) => w.id !== workout.id)))
    router.replace('/')
  }

  const filtered = EXERCISES.filter((e) => {
    const matchMuscle = muscle === 'Alle' || e.muscle === muscle
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase())
    return matchMuscle && matchSearch
  })

  const alreadyAdded = new Set(workout?.exercises.map((e) => e.exerciseId) ?? [])

  if (!workout) return null

  return (
    <div className="flex flex-col min-h-[calc(100vh-5rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#0a0a0a] py-2 z-10">
        <button onClick={cancelWorkout} className="text-neutral-500 text-sm">
          Abbrechen
        </button>
        <h1 className="font-bold text-base">
          {new Date(workout.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' })}
        </h1>
        <button
          onClick={finishWorkout}
          disabled={workout.exercises.length === 0}
          className="bg-orange-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          Fertig
        </button>
      </div>

      {/* Exercise list */}
      <div className="space-y-4 flex-1">
        {workout.exercises.map((entry, i) => (
          <ExerciseBlock
            key={entry.exerciseId + i}
            entry={entry}
            lastEntry={getLastEntry(entry.exerciseId)}
            onChange={(updated) => updateEntry(i, updated)}
            onRemove={() => removeEntry(i)}
          />
        ))}
      </div>

      {/* Add exercise button */}
      {!showPicker && (
        <button
          onClick={() => setShowPicker(true)}
          className="mt-6 w-full border border-dashed border-[#333] text-neutral-500 font-medium py-4 rounded-2xl hover:border-orange-500 hover:text-orange-500 transition-colors"
        >
          + Übung hinzufügen
        </button>
      )}

      {/* Exercise picker modal */}
      {showPicker && (
        <div className="fixed inset-0 bg-[#0a0a0a] z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-[#1e1e1e]">
            <h2 className="font-bold text-lg">Übung wählen</h2>
            <button
              onClick={() => { setShowPicker(false); setSearch(''); setMuscle('Alle') }}
              className="text-neutral-500 text-sm"
            >
              Schließen
            </button>
          </div>

          {/* Search */}
          <div className="px-4 pt-3 pb-2">
            <input
              autoFocus
              type="text"
              placeholder="Suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#1a1a1a] rounded-xl px-4 py-3 text-white placeholder-neutral-600 outline-none text-sm"
            />
          </div>

          {/* Muscle filter */}
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
            {['Alle', ...MUSCLES].map((m) => (
              <button
                key={m}
                onClick={() => setMuscle(m)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors ${
                  muscle === m ? 'bg-orange-500 text-white' : 'bg-[#1a1a1a] text-neutral-400'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Exercise list */}
          <div className="flex-1 overflow-y-auto px-4 space-y-1 pb-6">
            {filtered.map((e) => {
              const added = alreadyAdded.has(e.id)
              return (
                <button
                  key={e.id}
                  onClick={() => !added && addExercise(e.id, e.name)}
                  disabled={added}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-colors text-left ${
                    added
                      ? 'opacity-30'
                      : 'bg-[#1a1a1a] hover:bg-[#242424] active:bg-[#2a2a2a]'
                  }`}
                >
                  <div>
                    <p className="font-medium text-sm">{e.name}</p>
                    <p className="text-xs text-neutral-500">{e.muscle}</p>
                  </div>
                  {!added && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function WorkoutPage() {
  return (
    <Suspense>
      <WorkoutScreen />
    </Suspense>
  )
}
