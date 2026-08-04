import React from 'react'

type Props = {
  id: string
  type: 'gate' | 'sprint'
  base: number
  prefix: string
  defaultExerciseDuration: number
  exerciseDurations: Record<string, number>
  perRepDurations: Record<string, number>
  doneTasks: Record<string, boolean>
  setExerciseDurations: (fn: (prev: Record<string, number>) => Record<string, number>) => void
  setPerRepDurations: (fn: (prev: Record<string, number>) => Record<string, number>) => void
  toggleRep: (id: string, effort: number, rest: number) => void
  resetGridSettings: (id: string, type: 'gate' | 'sprint') => void
  getWorkoutConfig: (ageValue: string) => any
  age: string
}

export default function GridControls({ id, type, base, prefix, defaultExerciseDuration, exerciseDurations, perRepDurations, doneTasks, setExerciseDurations, setPerRepDurations, toggleRep, resetGridSettings, getWorkoutConfig, age }: Props) {
  const cfg = getWorkoutConfig(age)
  const defaultEffort = type === 'gate' ? cfg.gateEffort : cfg.sprintEffort
  const exerciseDuration = exerciseDurations[id] ?? defaultExerciseDuration
  const perRep = perRepDurations[id] ?? defaultEffort
  const exerciseMinutes = Math.round(exerciseDuration / 60)
  const defaultExerciseMinutes = Math.round(defaultExerciseDuration / 60)
  const rawReps = Math.max(1, base + exerciseMinutes - defaultExerciseMinutes)
  const ageFactor = age === 'elite' ? 2 : (parseInt(age) >= 14 ? 1 : 0)
  const minReps = base + (type === 'sprint' ? ageFactor : 0)
  const reps = Math.max(minReps, Math.min(rawReps, 12))
  const exceedsMax = rawReps > 12

  const buttons = []
  for (let i = 1; i <= reps; i++) {
    const btnId = `${id}-${i}`
    buttons.push(
      <button key={btnId} className={`btn-check ${doneTasks[btnId] ? 'done' : ''}`} onClick={() => toggleRep(btnId, perRep, type === 'gate' ? cfg.gateRest : cfg.sprintRest)}>
        {prefix}{i} ({perRep}s)
      </button>
    )
  }

  return (
    <div>
      <div className="grid-controls">
        <label>
          Durée exercice :
          <div className="time-presets">
            {[3,4,5].map(min => (
              <button key={min} type="button" className={`preset-btn ${Math.max(1, Math.round(exerciseDuration/60)) === min ? 'active' : ''}`} onClick={() => setExerciseDurations(s => ({ ...s, [id]: min * 60 }))}>{min} min</button>
            ))}
          </div>
          <span className="preset-note">Choix actuel : {Math.max(1, Math.round(exerciseDuration/60))} min</span>
        </label>

        <label>
          Durée accélération :
          <div className="time-presets">
            {(() => {
              const center = type === 'gate' ? cfg.gateEffort : cfg.sprintEffort
              const opts = Array.from(new Set([Math.max(1, center - 1), center, center + 1]))
              return opts.map(sec => (
                <button key={sec} type="button" className={`preset-btn ${perRep === sec ? 'active' : ''}`} onClick={() => setPerRepDurations(p => ({ ...p, [id]: sec }))}>{sec}s</button>
              ))
            })()}
          </div>
          <span className="preset-note">Temps actuel : {perRep}s</span>
        </label>

        <button className="btn-reset-grid" type="button" onClick={() => resetGridSettings(id, type)}>Remettre à zéro</button>
      </div>
      <div className="grid-summary">
        <span>{Math.floor(exerciseDuration/60)} min{exerciseDuration%60!==0?` ${exerciseDuration%60}s`:''} en tout • effort de {perRep}s</span>
        {exceedsMax && <span className="warning">Affichage limité à 12 répétitions sur {rawReps} prévues.</span>}
      </div>
      <div className="reps-grid">{buttons}</div>
    </div>
  )
}
