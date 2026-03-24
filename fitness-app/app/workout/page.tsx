'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getWorkout, saveWorkout, getLastEntry } from '@/lib/storage'
import { Workout, ExerciseEntry, WorkoutSet, WorkoutTemplate } from '@/lib/types'
import { EXERCISES, MUSCLES } from '@/lib/exercises'
import { getTemplate, saveUserTemplate } from '@/lib/templates'
import ExerciseBlock from '@/components/ExerciseBlock'

function WorkoutScreen() {
  const router = useRouter()
  const params = useSearchParams()
  const id = params.get('id') ?? ''
  const templateId = params.get('template') ?? ''

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [muscle, setMuscle] = useState('Alle')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [templateName, setTemplateName] = useState('')

  useEffect(() => {
    if (!id) { router.replace('/'); return }
    const w = getWorkout(id)
    if (!w) { router.replace('/'); return }

    let tmpl: WorkoutTemplate | null = null
    if (templateId) {
      tmpl = getTemplate(templateId) ?? null
      setTemplate(tmpl)
    }

    if (w.exercises.length === 0) {
      if (tmpl?.exercises?.length) {
        // User template with saved exercises → pre-load them
        const exercises: ExerciseEntry[] = tmpl.exercises.map((te) => {
          const last = getLastEntry(te.exerciseId)
          const sets: WorkoutSet[] = last
            ? last.sets.filter((s) => s.done).map((s) => ({ ...s, done: false })).slice(0, tmpl!.defaultSets)
            : Array.from({ length: tmpl!.defaultSets }, () => ({
                weight: 0,
                reps: tmpl!.defaultReps,
                done: false,
              }))
          return {
            exerciseId: te.exerciseId,
            name: te.name,
            sets: sets.length ? sets : [{ weight: 0, reps: tmpl!.defaultReps, done: false }],
          }
        })
        const updated = { ...w, exercises }
        setWorkout(updated)
        saveWorkout(updated)
        return
      }
      // Preset or empty → open picker
      setShowPicker(true)
      if (tmpl?.suggestedMuscles?.length) {
        setMuscle(tmpl.suggestedMuscles[0])
      }
    }

    setWorkout(w)
  }, [id, templateId, router])

  const persist = useCallback((updated: Workout) => {
    setWorkout(updated)
    saveWorkout(updated)
  }, [])

  function addExercise(exerciseId: string, name: string) {
    if (!workout) return
    const defaultReps = template?.defaultReps ?? 0
    const targetSets = template?.defaultSets ?? 1
    const last = getLastEntry(exerciseId)
    const sets: WorkoutSet[] = last
      ? last.sets.filter((s) => s.done).map((s) => ({ ...s, done: false })).slice(0, targetSets)
      : Array.from({ length: targetSets }, () => ({ weight: 0, reps: defaultReps, done: false }))
    const entry: ExerciseEntry = {
      exerciseId,
      name,
      sets: sets.length ? sets : [{ weight: 0, reps: defaultReps, done: false }],
    }
    persist({ ...workout, exercises: [...workout.exercises, entry] })
    setShowPicker(false)
    setSearch('')
  }

  function updateEntry(i: number, updated: ExerciseEntry) {
    if (!workout) return
    const exercises = [...workout.exercises]
    exercises[i] = updated
    persist({ ...workout, exercises })
  }

  function removeEntry(i: number) {
    if (!workout) return
    persist({ ...workout, exercises: workout.exercises.filter((_, idx) => idx !== i) })
  }

  function finishWorkout() {
    if (!workout) return
    persist({ ...workout, finished: true })
    // Suggest a name based on muscles used or template name
    const muscles = [
      ...new Set(
        workout.exercises
          .map((e) => EXERCISES.find((x) => x.id === e.exerciseId)?.muscle ?? '')
          .filter(Boolean)
      ),
    ]
    const suggested = template?.name ?? muscles.slice(0, 2).join(' + ') || 'Mein Training'
    setTemplateName(suggested)
    setShowSaveModal(true)
  }

  function handleSaveTemplate() {
    if (!workout) { router.replace('/'); return }
    if (templateName.trim()) {
      const newTemplate: WorkoutTemplate = {
        id: uuidv4(),
        name: templateName.trim(),
        description: `${workout.exercises.length} Übungen`,
        tag: 'Eigene',
        defaultSets: template?.defaultSets ?? 3,
        defaultReps: template?.defaultReps ?? 10,
        suggestedMuscles: [],
        isPreset: false,
        exercises: workout.exercises.map((e) => ({ exerciseId: e.exerciseId, name: e.name })),
      }
      saveUserTemplate(newTemplate)
    }
    router.replace('/')
  }

  function cancelWorkout() {
    if (!workout) return
    const all = JSON.parse(localStorage.getItem('ironlog_workouts') || '[]')
    localStorage.setItem(
      'ironlog_workouts',
      JSON.stringify(all.filter((w: Workout) => w.id !== workout.id))
    )
    router.replace('/')
  }

  // Split filtered list: suggested first (only when no search + "Alle" filter active)
  const showSuggested =
    !search && muscle === 'Alle' && (template?.suggestedMuscles?.length ?? 0) > 0
  const suggestedIds = new Set(
    showSuggested
      ? EXERCISES.filter((e) => template!.suggestedMuscles.includes(e.muscle)).map((e) => e.id)
      : []
  )

  const baseFiltered = EXERCISES.filter((e) => {
    const matchMuscle = muscle === 'Alle' || e.muscle === muscle
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase())
    return matchMuscle && matchSearch
  })

  const sortedFiltered = showSuggested
    ? [
        ...baseFiltered.filter((e) => suggestedIds.has(e.id)),
        ...baseFiltered.filter((e) => !suggestedIds.has(e.id)),
      ]
    : baseFiltered

  const alreadyAdded = new Set(workout?.exercises.map((e) => e.exerciseId) ?? [])

  if (!workout) return null

  return (
    <div className="flex flex-col min-h-[calc(100vh-5rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#0a0a0a] py-2 z-10">
        <button onClick={cancelWorkout} className="text-neutral-500 text-sm">
          Abbrechen
        </button>
        <div className="text-center">
          <h1 className="font-bold text-base">
            {new Date(workout.date).toLocaleDateString('de-DE', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
            })}
          </h1>
          {template && <p className="text-xs text-orange-500">{template.name}</p>}
        </div>
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

      {/* Exercise picker */}
      {showPicker && (
        <div className="fixed inset-0 bg-[#0a0a0a] z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-[#1e1e1e]">
            <h2 className="font-bold text-lg">Übung wählen</h2>
            <button
              onClick={() => { setShowPicker(false); setSearch('') }}
              className="text-neutral-500 text-sm"
            >
              Schließen
            </button>
          </div>

          {/* Suggested muscle chips */}
          {(template?.suggestedMuscles?.length ?? 0) > 0 && (
            <div className="px-4 pt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-neutral-600">Empfohlen:</span>
              {template!.suggestedMuscles.map((m) => (
                <button
                  key={m}
                  onClick={() => setMuscle(m)}
                  className="text-xs px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors"
                >
                  {m}
                </button>
              ))}
            </div>
          )}

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

          {/* Template hint for sets×reps */}
          {template && (
            <div className="px-4 pb-2">
              <p className="text-xs text-neutral-600">
                Sätze werden als{' '}
                <span className="text-orange-500">
                  {template.defaultSets}×{template.defaultReps}
                </span>{' '}
                vorausgefüllt
              </p>
            </div>
          )}

          {/* Exercise list */}
          <div className="flex-1 overflow-y-auto px-4 space-y-1 pb-6">
            {sortedFiltered.length === 0 && (
              <p className="text-neutral-600 text-sm text-center py-8">Keine Übungen gefunden</p>
            )}
            {showSuggested && sortedFiltered.some((e) => suggestedIds.has(e.id)) && (
              <p className="text-xs text-neutral-600 px-1 pt-1 pb-0.5">Vorgeschlagen</p>
            )}
            {sortedFiltered.map((e, idx) => {
              const added = alreadyAdded.has(e.id)
              const isSuggested = suggestedIds.has(e.id)
              const prevWasSuggested = idx > 0 && suggestedIds.has(sortedFiltered[idx - 1].id)
              const showDivider = showSuggested && !isSuggested && prevWasSuggested
              return (
                <div key={e.id}>
                  {showDivider && (
                    <p className="text-xs text-neutral-600 px-1 pt-3 pb-0.5">Alle Übungen</p>
                  )}
                  <button
                    onClick={() => !added && addExercise(e.id, e.name)}
                    disabled={added}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-colors text-left ${
                      added
                        ? 'opacity-30'
                        : isSuggested
                        ? 'bg-orange-500/10 hover:bg-orange-500/15 active:bg-orange-500/20'
                        : 'bg-[#1a1a1a] hover:bg-[#242424] active:bg-[#2a2a2a]'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-sm">{e.name}</p>
                      <p className="text-xs text-neutral-500">{e.muscle}</p>
                    </div>
                    {!added && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={isSuggested ? '#f97316' : '#f97316'}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Save as template bottom sheet */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
          <div className="w-full bg-[#1a1a1a] rounded-t-3xl p-6 pb-10">
            <h2 className="font-bold text-lg mb-1">Als Vorlage speichern?</h2>
            <p className="text-sm text-neutral-500 mb-4">
              Übungen & Sätze werden für zukünftige Trainings gespeichert.
            </p>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Name der Vorlage"
              className="w-full bg-[#222] rounded-xl px-4 py-3 text-white placeholder-neutral-600 outline-none text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => router.replace('/')}
                className="flex-1 py-3.5 rounded-xl bg-[#222] text-neutral-400 font-medium text-sm"
              >
                Überspringen
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim()}
                className="flex-1 py-3.5 rounded-xl bg-orange-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-semibold text-sm transition-colors"
              >
                Speichern
              </button>
            </div>
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
