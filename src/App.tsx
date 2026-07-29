import React, { useEffect, useMemo, useRef, useState } from 'react'

const SOUND_BMX_GATE = '/watch_the_gate.mp3' 

type GridDef = { id: string; type: 'gate' | 'sprint'; base: number; prefix: string; name: string; routine: string }

const GRIDS: GridDef[] = [
  { id: 'grid-gate-classique', type: 'gate', base: 4, prefix: 'G', name: 'Départs sur la grille', routine: 'Classique' },
  { id: 'grid-turbo-classique', type: 'sprint', base: 4, prefix: 'V', name: 'Sprints de vitesse', routine: 'Classique' },
  { id: 'grid-force-routineA', type: 'sprint', base: 4, prefix: 'F', name: 'Exercices de force', routine: 'Routine A' },
  { id: 'grid-relance-routineA', type: 'gate', base: 4, prefix: 'R', name: 'Relances après les virages', routine: 'Routine A' },
  { id: 'grid-gate-routineB', type: 'gate', base: 5, prefix: 'G', name: 'Enchaînements de grilles', routine: 'Routine B' },
  { id: 'grid-sprint-routineB', type: 'sprint', base: 3, prefix: 'A', name: 'Sprints de section', routine: 'Routine B' },
  { id: 'grid-long-routineC', type: 'sprint', base: 3, prefix: 'L', name: 'Tenir jusqu’à la fin', routine: 'Routine C' },
  { id: 'grid-relance-routineC', type: 'gate', base: 4, prefix: 'RA', name: 'Multi-relances', routine: 'Routine C' },
  { id: 'grid-freq-routineD', type: 'sprint', base: 4, prefix: 'V', name: 'Vitesse maximum des jambes', routine: 'Routine D' },
  { id: 'grid-flash-routineD', type: 'gate', base: 4, prefix: 'EF', name: 'Jeux de réflexes (Flash)', routine: 'Routine D' }
]

const DEFAULT_EXERCISE_DURATION: Record<string, number> = {
  'grid-gate-classique': 240,
  'grid-turbo-classique': 180,
  'grid-force-routineA': 240,
  'grid-relance-routineA': 180,
  'grid-gate-routineB': 240,
  'grid-sprint-routineB': 180,
  'grid-long-routineC': 240,
  'grid-relance-routineC': 180,
  'grid-freq-routineD': 240,
  'grid-flash-routineD': 180
}

const MAX_REPS = 12

function getWorkoutConfig(ageValue: string) {
  if (ageValue === 'elite')
    return {
      gateEffort: 5,
      gateRest: 60,
      sprintEffort: 15,
      sprintRest: 60,
      gateDesc: 'Pars comme un éclair dès que le signal retentit !',
      sprintDesc: 'Donne tout ce que tu as sur tes pédales sans rebondir sur la selle.'
    }
  const age = parseInt(ageValue)
  const gateEffort = Math.round(3 + ((age - 8) / 9) * 2)
  const sprintEffort = Math.round(6 + ((age - 8) / 9) * 5)
  const restTime = Math.round(30 + ((age - 8) / 9) * 20)
  let sprintDesc = `Sprint de ${sprintEffort} secondes. `
  if (age <= 10) sprintDesc += 'Garde le haut du corps bien droit et pédale super vite sans sautiller sur ta selle !'
  else if (age <= 14) sprintDesc += 'Tire bien sur ton guidon et pousse sur tes pédales avec toute ton énergie.'
  else sprintDesc += 'Effort intense, donne ton maximum !'
  const gateDesc = `Effort de ${gateEffort} secondes à fond, puis ${restTime} secondes de repos pour souffler.`
  return { gateEffort, gateRest: restTime, sprintEffort, sprintRest: restTime, gateDesc, sprintDesc }
}

export default function App() {
  const STORAGE_KEY = 'warmup-react-grid-settings'
  const loadStoredSettings = () => {
    if (typeof window === 'undefined') return { exerciseDurations: {}, perRepDurations: {} }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return { exerciseDurations: {}, perRepDurations: {} }
      const parsed = JSON.parse(raw)
      return {
        exerciseDurations: parsed.exerciseDurations ?? parsed.seriesDurations ?? {},
        perRepDurations: parsed.perRepDurations ?? {}
      }
    } catch {
      return { exerciseDurations: {}, perRepDurations: {} }
    }
  }
  const { exerciseDurations: storedExerciseDurations, perRepDurations: storedPerRepDurations } = loadStoredSettings()
  const [age, setAge] = useState<string>('8')
  const [activeTab, setActiveTab] = useState<string>('classique')
  const [doneTasks, setDoneTasks] = useState<Record<string, boolean>>({})
  const [exerciseDurations, setExerciseDurations] = useState<Record<string, number>>(storedExerciseDurations)
  const [perRepDurations, setPerRepDurations] = useState<Record<string, number>>(storedPerRepDurations)

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs === 0 ? `${minutes} min` : `${minutes} min ${secs}s`
  }

  const [timerSeconds, setTimerSeconds] = useState<number>(0)
  const [isRunning, setIsRunning] = useState(false)
  const timerRef = useRef<number | null>(null)
  const currentPhase = useRef<'idle' | 'effort' | 'rest' | 'single'>('idle')
  const savedRest = useRef<number>(35)
  const totalTaskDuration = useRef<number>(0)
  const isRandomBeepMode = useRef<boolean>(false)
  const lastBeepTimerSeconds = useRef<number>(9999)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    updateGrids()
    resetTimer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [age])

  const audioCtxRef = useRef<AudioContext | null>(null)
  function unlockAudio() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }
  }

  function playDoubleBeep() {
    unlockAudio()
    if (audioCtxRef.current) {
      try {
        const ctx = audioCtxRef.current
        const now = ctx.currentTime

        const osc1 = ctx.createOscillator()
        const gain1 = ctx.createGain()
        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(880, now)
        gain1.gain.setValueAtTime(0.15, now)
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
        osc1.connect(gain1)
        gain1.connect(ctx.destination)
        osc1.start(now)
        osc1.stop(now + 0.12)

        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(1174.66, now + 0.18)
        gain2.gain.setValueAtTime(0.15, now + 0.18)
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.start(now + 0.18)
        osc2.stop(now + 0.3)
      } catch (err) {
        console.log('Erreur lecture double bip:', err)
      }
    }
  }

  function speak(text: string) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      if (!text) return
      const msg = new SpeechSynthesisUtterance(text)
      msg.lang = 'fr-FR'
      msg.rate = 1.2
      window.speechSynthesis.speak(msg)
    }
  }

  function updateGrids() {
    const newDone: Record<string, boolean> = {}
    GRIDS.forEach(g => {
      const { reps } = getGridMetrics(g, DEFAULT_EXERCISE_DURATION[g.id] ?? 180)
      for (let i = 1; i <= reps; i++) newDone[`${g.id}-${i}`] = false
    })
    const cardIds = [
      'card-classique-1', 'card-classique-4',
      'card-routineA-1', 'card-routineA-4',
      'card-routineB-1', 'card-routineB-4',
      'card-routineC-1', 'card-routineC-4',
      'card-routineD-1', 'card-routineD-4'
    ]
    cardIds.forEach(id => { if (!(id in newDone)) newDone[id] = false })
    setDoneTasks(prev => ({ ...newDone, ...prev }))
  }

  function toggleRep(id: string, effort: number, rest: number) {
    unlockAudio()
    setDoneTasks(prev => ({ ...prev, [id]: !prev[id] }))
    if (!doneTasks[id]) startDoubleTimer(effort, rest)
  }

  function toggleTask(id: string, duration: number, randomBeeps: boolean) {
    unlockAudio()
    setDoneTasks(prev => ({ ...prev, [id]: !prev[id] }))
    if (!doneTasks[id]) startSingleTimer(duration, randomBeeps)
  }

  function getDefaultRepDuration(type: 'gate' | 'sprint', cfg: ReturnType<typeof getWorkoutConfig>) {
    return type === 'gate' ? cfg.gateEffort : cfg.sprintEffort
  }

  function resetGridSettings(id: string, type: 'gate' | 'sprint') {
    const cfg = getWorkoutConfig(age)
    setExerciseDurations(prev => ({ ...prev, [id]: DEFAULT_EXERCISE_DURATION[id] ?? 180 }))
    setPerRepDurations(prev => ({ ...prev, [id]: getDefaultRepDuration(type, cfg) }))
  }

  function getGridMetrics(grid: GridDef, defaultExerciseDuration: number) {
    const cfg = getWorkoutConfig(age)
    const ageFactor = age === 'elite' ? 2 : (parseInt(age) >= 14 ? 1 : 0)
    const defaultEffort = grid.type === 'gate' ? cfg.gateEffort : cfg.sprintEffort
    const exerciseDuration = exerciseDurations[grid.id] ?? defaultExerciseDuration
    const perRep = perRepDurations[grid.id] ?? defaultEffort
    const exerciseMinutes = Math.round(exerciseDuration / 60)
    const defaultExerciseMinutes = Math.round(defaultExerciseDuration / 60)
    const rawReps = Math.max(1, grid.base + exerciseMinutes - defaultExerciseMinutes)
    const minReps = grid.base + (grid.type === 'sprint' ? ageFactor : 0)
    const reps = Math.max(minReps, Math.min(rawReps, MAX_REPS))
    return { exerciseDuration, perRep, rawReps, reps }
  }

  function resetAllGridSettings() {
    const cfg = getWorkoutConfig(age)
    const newExerciseDurations = Object.fromEntries(GRIDS.map(g => [g.id, DEFAULT_EXERCISE_DURATION[g.id] ?? 180]))
    const newPerRep = Object.fromEntries(GRIDS.map(g => [g.id, getDefaultRepDuration(g.type, cfg)]))
    setExerciseDurations(newExerciseDurations)
    setPerRepDurations(newPerRep)
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ exerciseDurations, perRepDurations }))
  }, [exerciseDurations, perRepDurations])

  useEffect(() => {
    if (isRunning) {
      timerRef.current = window.setInterval(() => setTimerSeconds(s => s - 1), 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRunning])

  useEffect(() => {
    if (isRunning) {
      if (isRandomBeepMode.current) {
        if (timerSeconds > 5 && timerSeconds < (totalTaskDuration.current - 5)) {
          // Vérifie qu'il y a un laps de temps d'au moins 10 secondes depuis le dernier bip
          if (lastBeepTimerSeconds.current - timerSeconds >= 10) {
            if (Math.random() < 0.30) {
              playDoubleBeep()
              if ((navigator as any).vibrate) (navigator as any).vibrate([150, 80, 150])
              lastBeepTimerSeconds.current = timerSeconds
            }
          }
        }
      }
      if (timerSeconds <= 0) {
        if (currentPhase.current === 'effort') {
          currentPhase.current = 'rest'
          const rest = savedRest.current
          setTimerSeconds(rest)
          speak('Ralenti !')
          return
        }
        terminateTimer('PRÊT POUR LA SUITE !', 'Série terminée')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerSeconds])

  function stopCurrentAudio() {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.currentTime = 0
      currentAudioRef.current = null
    }
  }

  function startSingleTimer(duration: number, randomBeepsActive: boolean) {
    stopCurrentAudio()
    clearIntervalIfAny()
    currentPhase.current = 'single'
    totalTaskDuration.current = duration
    isRandomBeepMode.current = randomBeepsActive
    lastBeepTimerSeconds.current = duration // Permet au premier bip d'intervenir après au moins 10 secondes
    setTimerSeconds(duration)
    setIsRunning(true)
  }

  function startDoubleTimer(effort: number, rest: number) {
    stopCurrentAudio()
    clearIntervalIfAny()
    isRandomBeepMode.current = false
    savedRest.current = rest
    currentPhase.current = 'effort'

    const audio = new Audio(SOUND_BMX_GATE)
    currentAudioRef.current = audio

    audio.onended = () => {
      setTimerSeconds(effort)
      setIsRunning(true)
    }

    audio.onerror = () => {
      setTimerSeconds(effort)
      setIsRunning(true)
    }

    audio.play().catch(() => {
      setTimerSeconds(effort)
      setIsRunning(true)
    })
  }

  function clearIntervalIfAny() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function terminateTimer(label: string, vocal: string) {
    stopCurrentAudio()
    clearIntervalIfAny()
    setIsRunning(false)
    currentPhase.current = 'idle'
    isRandomBeepMode.current = false
    setTimerSeconds(0)
    speak(vocal)
  }

  function resetTimer() {
    stopCurrentAudio()
    clearIntervalIfAny()
    setIsRunning(false)
    currentPhase.current = 'idle'
    isRandomBeepMode.current = false
    setTimerSeconds(0)
  }

  function toggleTimer() {
    unlockAudio()
    if (isRunning) {
      setIsRunning(false)
      speak('Pause')
      return
    }
    const cfg = getWorkoutConfig(age)
    if (timerSeconds <= 0) {
      startSingleTimer(cfg.gateEffort, false)
    } else {
      setIsRunning(true)
    }
  }

  useEffect(() => {
    const once = () => { 
      try { unlockAudio() } catch {} 
      window.removeEventListener('click', once)
      window.removeEventListener('touchstart', once) 
    }
    window.addEventListener('click', once, { once: true })
    window.addEventListener('touchstart', once, { once: true })
  }, [])

  function renderGrid(id: string, type: 'gate' | 'sprint', base: number, prefix: string, defaultExerciseDuration = 180) {
    const ageFactor = age === 'elite' ? 2 : (parseInt(age) >= 14 ? 1 : 0)
    const cfg = getWorkoutConfig(age)
    const defaultEffort = type === 'gate' ? cfg.gateEffort : cfg.sprintEffort
    const exerciseDuration = exerciseDurations[id] ?? defaultExerciseDuration
    const perRep = perRepDurations[id] ?? defaultEffort
    const exerciseMinutes = Math.round(exerciseDuration / 60)
    const defaultExerciseMinutes = Math.round(defaultExerciseDuration / 60)
    const rawReps = Math.max(1, base + exerciseMinutes - defaultExerciseMinutes)
    const minReps = base + (type === 'sprint' ? ageFactor : 0)
    const reps = Math.max(minReps, Math.min(rawReps, MAX_REPS))
    const exceedsMax = rawReps > MAX_REPS

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
              {[3, 4, 5].map(min => (
                <button
                  key={min}
                  type="button"
                  className={`preset-btn ${exerciseMinutes === min ? 'active' : ''}`}
                  onClick={() => setExerciseDurations(s => ({ ...s, [id]: min * 60 }))}
                >
                  {min} min
                </button>
              ))}
            </div>
            <span className="preset-note">Choix actuel : {Math.max(1, Math.round(exerciseDuration / 60))} min</span>
          </label>

          <label>
            Durée accélération :
            <div className="time-presets">
              {[3, 4, 5].map(sec => (
                <button
                  key={sec}
                  type="button"
                  className={`preset-btn ${perRep === sec ? 'active' : ''}`}
                  onClick={() => setPerRepDurations(p => ({ ...p, [id]: sec }))}
                >
                  {sec}s
                </button>
              ))}
            </div>
            <span className="preset-note">Temps actuel : {perRep}s</span>
          </label>

          <button className="btn-reset-grid" type="button" onClick={() => resetGridSettings(id, type)}>
            Remettre à zéro
          </button>
        </div>
        <div className="grid-summary">
          <span>{formatTime(exerciseDuration)} en tout • effort de {perRep}s</span>
          {exceedsMax && (
            <span className="warning">Affichage limité à {MAX_REPS} répétitions sur {rawReps} prévues.</span>
          )}
        </div>
        <div className="reps-grid">{buttons}</div>
      </div>
    )
  }

  function checkVictoryFor(tab: string) {
    const PROGRAM_CARDS: Record<string, string[]> = {
      classique: ['card-classique-1', 'card-classique-4'],
      routineA: ['card-routineA-1', 'card-routineA-4'],
      routineB: ['card-routineB-1', 'card-routineB-4'],
      routineC: ['card-routineC-1', 'card-routineC-4'],
      routineD: ['card-routineD-1', 'card-routineD-4']
    }
    const keys: string[] = []
    if (PROGRAM_CARDS[tab]) keys.push(...PROGRAM_CARDS[tab])
    GRIDS.forEach(g => {
      const matches = g.id.includes(tab === 'classique' ? 'classique' : tab)
      if (matches) {
        const metrics = getGridMetrics(g, DEFAULT_EXERCISE_DURATION[g.id] ?? 180)
        for (let i = 1; i <= metrics.reps; i++) keys.push(`${g.id}-${i}`)
      }
    })
    if (keys.length === 0) return false
    return keys.every(k => !!doneTasks[k])
  }

  const getPhaseLabel = () => {
    if (!isRunning && timerSeconds === 0) return 'Prêt'
    if (!isRunning) return 'En pause'
    if (currentPhase.current === 'effort') return '🔥 À FOND !'
    if (currentPhase.current === 'rest') return '🧘 REPOS (Souffle)'
    return '⏱️ EN COURS'
  }

  return (
    <div>
      <div className="header">
        <h1>⚙️ WARMUP 2.0 // PRO BMX (SHEET VIEW)</h1>
        <div className="routine-selector">
          <button className={`tab-btn ${activeTab === 'classique' ? 'active' : ''}`} onClick={() => setActiveTab('classique')}>CLASS.</button>
          <button className={`tab-btn ${activeTab === 'routineA' ? 'active' : ''}`} onClick={() => setActiveTab('routineA')}>ROUT. A</button>
          <button className={`tab-btn ${activeTab === 'routineB' ? 'active' : ''}`} onClick={() => setActiveTab('routineB')}>ROUT. B</button>
          <button className={`tab-btn ${activeTab === 'routineC' ? 'active' : ''}`} onClick={() => setActiveTab('routineC')}>ROUT. C</button>
          <button className={`tab-btn ${activeTab === 'routineD' ? 'active' : ''}`} onClick={() => setActiveTab('routineD')}>ROUT. D</button>
    {/*     <button className={`tab-btn ${activeTab === 'sheet' ? 'active' : ''}`} onClick={() => setActiveTab('sheet')}>📊 RECAp'</button> */}
        </div>
      </div>

      <div className="age-selector-container">
        <label htmlFor="ageSelect">Quel est ton âge ?</label>
        <select id="ageSelect" value={age} onChange={e => setAge(e.target.value)}>
          {['8','9','10','11','12','13','14','15','16','17','elite'].map(v => (
            <option key={v} value={v}>{v === 'elite' ? 'Pro / Élite' : `${v} ans`}</option>
          ))}
        </select>
      </div>

      <div className="global-controls">
        <button className="btn-reset-all" type="button" onClick={resetAllGridSettings}>Remettre tous les réglages à zéro</button>
        <span className="saved-note">Sauvegardé automatiquement sur ton appareil</span>
      </div>

      {/* VUE TABLEUR / SHEET */}
     {/*} <div id="sheet" style={{ display: activeTab === 'sheet' ? 'block' : 'none', overflowX: 'auto', marginBottom: '100px' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">📊 TABLEAU DE TOUTES LES SÉANCES (SHEET)</span>
            <span className="badge-time">GLOBAL</span>
          </div>
          <div className="consignes">
            <strong>Tableau récapitulatif pour le profil : {age === 'elite' ? 'Pro / Élite' : `${age} ans`}</strong>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc', background: '#f5f5f5' }}>
                <th style={{ padding: '10px' }}>Routine</th>
                <th style={{ padding: '10px' }}>Exercice</th>
                <th style={{ padding: '10px' }}>Type</th>
                <th style={{ padding: '10px' }}>Durée Totale</th>
                <th style={{ padding: '10px' }}>Effort / Rép</th>
                <th style={{ padding: '10px' }}>Nombre de fois</th>
              </tr>
            </thead>
            <tbody>
              {GRIDS.map(g => {
                const metrics = getGridMetrics(g, DEFAULT_EXERCISE_DURATION[g.id] ?? 180)
                return (
                  <tr key={g.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{g.routine}</td>
                    <td style={{ padding: '10px' }}>{g.name}</td>
                    <td style={{ padding: '10px', textTransform: 'uppercase' }}>{g.type}</td>
                    <td style={{ padding: '10px' }}>{formatTime(metrics.exerciseDuration)}</td>
                    <td style={{ padding: '10px' }}>{metrics.perRep}s</td>
                    <td style={{ padding: '10px' }}>{metrics.reps} fois ({g.prefix}1 à {g.prefix}{metrics.reps})</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
*/}
      {/* VUE CLASSIQUE */}
      <div id="classique" style={{ display: activeTab === 'classique' ? 'block' : 'none' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">🟢 1. RÉVEIL DU CORPS</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Réveiller tes jambes et ton cœur en douceur.</strong><ul><li>Pédale tranquillement, respire bien et détends tes bras.</li></ul></div>
          <button className={`btn-check-list ${doneTasks['card-classique-1'] ? 'done' : ''}`} onClick={() => toggleTask('card-classique-1', 180, false)}><span>🚴 Pédalage facile et souple</span> <span>{doneTasks['card-classique-1'] ? '☑' : '☐'}</span></button>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🔴 2. DÉPARTS SUR LA GRILLE</span><span className="badge-time">⏱️ {formatTime(exerciseDurations['grid-gate-classique'] ?? 240)}</span></div>
          <div className="consignes"><strong>Objectif : Réagir au quart de tour et partir comme une fusée !</strong><ul><li>{getWorkoutConfig(age).gateDesc}</li></ul></div>
          {renderGrid('grid-gate-classique', 'gate', 4, 'G', 240)}
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🟠 3. SPRINTS DE VITESSE</span><span className="badge-time">⏱️ {formatTime(exerciseDurations['grid-turbo-classique'] ?? 180)}</span></div>
          <div className="consignes"><strong>Objectif : Faire tourner tes jambes le plus vite possible.</strong><ul><li>{getWorkoutConfig(age).sprintDesc}</li></ul></div>
          {renderGrid('grid-turbo-classique', 'sprint', 4, 'V', 180)}
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🔵 4. RETOUR AU CALME</span><span className="badge-time">⏱️ 2 MIN</span></div>
          <button className={`btn-check-list ${doneTasks['card-classique-4'] ? 'done' : ''}`} onClick={() => toggleTask('card-classique-4', 120, false)}><span>🧘 On souffle, on détend ses bras et ses jambes</span> <span>{doneTasks['card-classique-4'] ? '☑' : '☐'}</span></button>
        </div>
      </div>

      {/* VUE ROUTINE A */}
      <div id="routineA" style={{ display: activeTab === 'routineA' ? 'block' : 'none' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">🟣 1. MISE EN ROUTE</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Faire chauffer doucement les muscles.</strong><ul><li>Pédale en faisant un petit effort régulier.</li></ul></div>
          <button className={`btn-check-list ${doneTasks['card-routineA-1'] ? 'done' : ''}`} onClick={() => toggleTask('card-routineA-1', 180, false)}><span>🚴 Pédalage avec un peu de résistance</span> <span>{doneTasks['card-routineA-1'] ? '☑' : '☐'}</span></button>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">⚡ 2. EXERCICES DE FORCE</span><span className="badge-time">⏱️ {formatTime(exerciseDurations['grid-force-routineA'] ?? 240)}</span></div>
          <div className="consignes"><strong>Objectif : Avoir des jambes de plus en plus fortes.</strong><ul><li>Reste bien assis sur ta selle et pousse fort sur les pédales en gardant tes coudes écartés.</li></ul></div>
          {renderGrid('grid-force-routineA', 'sprint', 4, 'F', 240)}
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🔥 3. RELANCES APRÈS LES VIRAGES</span><span className="badge-time">⏱️ {formatTime(exerciseDurations['grid-relance-routineA'] ?? 180)}</span></div>
          <div className="consignes"><strong>Objectif : Ré-accélérer fort comme dans un vrai virage.</strong><ul><li>{getWorkoutConfig(age).gateDesc}</li></ul></div>
          {renderGrid('grid-relance-routineA', 'gate', 4, 'R', 180)}
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🟢 4. RETOUR AU CALME</span><span className="badge-time">⏱️ 2 MIN</span></div>
          <button className={`btn-check-list ${doneTasks['card-routineA-4'] ? 'done' : ''}`} onClick={() => toggleTask('card-routineA-4', 120, false)}><span>🧘 On roule tout doucement pour souffler</span> <span>{doneTasks['card-routineA-4'] ? '☑' : '☐'}</span></button>
        </div>
      </div>

      {/* VUE ROUTINE B */}
      <div id="routineB" style={{ display: activeTab === 'routineB' ? 'block' : 'none' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">🟡 1. JEU DE RÉFLEXES (BIPS SURPRISES)</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes">
            <strong>Objectif : Réveiller tes réflexes et ta vitesse de réaction.</strong>
            <ul>
              <li>Pédale léger et tends l'oreille. Des doubles bips surprises retentiront de temps en temps (avec au moins 10 secondes d'écart) : réagis instantanément par deux coup de pédale fulgurant dès que tu les entends !</li>
            </ul>
          </div>
          <button className={`btn-check-list ${doneTasks['card-routineB-1'] ? 'done' : ''}`} onClick={() => toggleTask('card-routineB-1', 180, true)}><span>🚴 Lancer le jeu des bips surprises</span> <span>{doneTasks['card-routineB-1'] ? '☑' : '☐'}</span></button>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">⚡ 2. ENCHAÎNEMENTS DE GRILLES</span><span className="badge-time">⏱️ 4 MIN</span></div>
          <div className="consignes"><strong>Objectif : S'élancer super vite de la grille.</strong><ul><li>{getWorkoutConfig(age).gateDesc}</li></ul></div>
          {renderGrid('grid-gate-routineB', 'gate', 5, 'G', 240)}
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🚀 3. SPRINTS DE SECTION</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Garder de la vitesse sur la piste.</strong><ul><li>{getWorkoutConfig(age).sprintDesc}</li></ul></div>
          {renderGrid('grid-sprint-routineB', 'sprint', 3, 'A', 180)}
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🧘 4. RETOUR AU CALME</span><span className="badge-time">⏱️ 2 MIN</span></div>
          <button className={`btn-check-list ${doneTasks['card-routineB-4'] ? 'done' : ''}`} onClick={() => toggleTask('card-routineB-4', 120, false)}><span>🧘 On souffle et on détend tout le corps</span> <span>{doneTasks['card-routineB-4'] ? '☑' : '☐'}</span></button>
        </div>
      </div>

      {/* VUE ROUTINE C */}
      <div id="routineC" style={{ display: activeTab === 'routineC' ? 'block' : 'none' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">🟢 1. ÉCHAUFFEMENT FACILE</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Bien préparer ton corps.</strong><ul><li>Pédale tranquillement pour te mettre en route.</li></ul></div>
          <button className={`btn-check-list ${doneTasks['card-routineC-1'] ? 'done' : ''}`} onClick={() => toggleTask('card-routineC-1', 180, false)}><span>🚴 Pédalage en douceur</span> <span>{doneTasks['card-routineC-1'] ? '☑' : '☐'}</span></button>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🔥 2. TENIR JUSQU'À LA FIN</span><span className="badge-time">⏱️ 4 MIN</span></div>
          <div className="consignes"><strong>Objectif : Ne rien lâcher même quand ça pique un peu dans les jambes.</strong><ul><li>{getWorkoutConfig(age).sprintDesc}</li></ul></div>
          {renderGrid('grid-long-routineC', 'sprint', 3, 'L', 240)}
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">⚡ 3. MULTI-RELANCES</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Enchaîner les efforts avec du punch.</strong><ul><li>{getWorkoutConfig(age).gateDesc}</li></ul></div>
          {renderGrid('grid-relance-routineC', 'gate', 4, 'RA', 180)}
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🧘 4. RETOUR AU CALME PROFOND</span><span className="badge-time">⏱️ 2 MIN</span></div>
          <button className={`btn-check-list ${doneTasks['card-routineC-4'] ? 'done' : ''}`} onClick={() => toggleTask('card-routineC-4', 120, false)}><span>🧘 Respire profondément en gonflant bien ton ventre</span> <span>{doneTasks['card-routineC-4'] ? '☑' : '☐'}</span></button>
        </div>
      </div>

      {/* VUE ROUTINE D */}
      <div id="routineD" style={{ display: activeTab === 'routineD' ? 'block' : 'none' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">🔵 1. PÉDALAGE LÉGER</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Faire tourner tes jambes à fond sans forcer.</strong><ul><li>Pédale le plus vite possible mais sans résistance.</li></ul></div>
          <button className={`btn-check-list ${doneTasks['card-routineD-1'] ? 'done' : ''}`} onClick={() => toggleTask('card-routineD-1', 180, false)}><span>🚴 Vélocité maximale à vide</span> <span>{doneTasks['card-routineD-1'] ? '☑' : '☐'}</span></button>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">⚡ 2. VITESSE MAXIMUM DES JAMBES</span><span className="badge-time">⏱️ 4 MIN</span></div>
          <div className="consignes"><strong>Objectif : Aller le plus vite possible sur tes pédales.</strong><ul><li>{getWorkoutConfig(age).sprintDesc}</li></ul></div>
          {renderGrid('grid-freq-routineD', 'sprint', 4, 'V', 240)}
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🚀 3. JEU DE RÉFLEXES (FLASH)</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes">
            <strong>Objectif : Devenir un super-héros de la rapidité !</strong>
            <ul>
              <li>Pédale léger et tiens-toi prêt. Des doubles bips retentiront de façon aléatoire (avec au moins 10 secondes d'écart) pour déclencher un grand coup de pédale hyper rapide.</li>
            </ul>
          </div>
          {renderGrid('grid-flash-routineD', 'gate', 4, 'EF', 180)}
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🧘 4. FIN DE SÉANCE</span><span className="badge-time">⏱️ 2 MIN</span></div>
          <button className={`btn-check-list ${doneTasks['card-routineD-4'] ? 'done' : ''}`} onClick={() => toggleTask('card-routineD-4', 120, false)}><span>🧘 On se détend, bravo, c'est terminé !</span> <span>{doneTasks['card-routineD-4'] ? '☑' : '☐'}</span></button>
        </div>
      </div>

      <div id="victoryCard" className={`victory-card ${checkVictoryFor(activeTab) ? 'show' : ''}`}>
        <h2 style={{ margin: '0 0 4px 0' }}>🏆 WARMUP VALIDÉ !</h2>
        <p style={{ margin: 0, fontWeight: 'bold' }}>Super boulot, tu es prêt à tout déchirer sur la piste !</p>
      </div>

      <div className="sticky-timer-bar" id="timerBar">
        <div className="timer-info">
          <span className="timer-label" id="timerLabel">{getPhaseLabel()}</span>
          <span className="timer-digits" id="timerDisplay">
            {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:
            {String(timerSeconds % 60).padStart(2, '0')}
          </span>
        </div>
        <div className="timer-controls">
          <button className="timer-btn primary" onClick={toggleTimer}>
            {isRunning ? '⏸ PAUSE' : '▶ C’EST PARTI !'}
          </button>
          <button className="timer-btn secondary" onClick={resetTimer}>
            🔄 RESET
          </button>
        </div>
      </div>
    </div>
  )
}