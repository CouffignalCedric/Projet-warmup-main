import React, { useEffect, useMemo, useRef, useState } from 'react'

// 🎵 Nom de votre fichier unique situé dans le dossier public/ (ajustez l'extension si besoin : .mp3, .wav...)
const SOUND_BMX_GATE = '/watch_the_gate.mp3' 
const SOUND_SINGLE_BEEP = '/beep.mp3'

type GridDef = { id: string; type: 'gate' | 'sprint'; base: number; prefix: string }

const GRIDS: GridDef[] = [
  { id: 'grid-gate-classique', type: 'gate', base: 4, prefix: 'G' },
  { id: 'grid-turbo-classique', type: 'sprint', base: 4, prefix: 'V' },
  { id: 'grid-force-routineA', type: 'sprint', base: 4, prefix: 'F' },
  { id: 'grid-relance-routineA', type: 'gate', base: 4, prefix: 'R' },
  { id: 'grid-gate-routineB', type: 'gate', base: 5, prefix: 'G' },
  { id: 'grid-sprint-routineB', type: 'sprint', base: 3, prefix: 'A' },
  { id: 'grid-long-routineC', type: 'sprint', base: 3, prefix: 'L' },
  { id: 'grid-relance-routineC', type: 'gate', base: 4, prefix: 'RA' },
  { id: 'grid-freq-routineD', type: 'sprint', base: 4, prefix: 'V' },
  { id: 'grid-flash-routineD', type: 'gate', base: 4, prefix: 'EF' }
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
      gateDesc: 'Départ maximal sec de 5 secondes. Arrachage de grille.',
      sprintDesc: 'Sprint lactique intense de 15 secondes.'
    }
  const age = parseInt(ageValue)
  const gateEffort = Math.round(3 + ((age - 8) / 9) * 2)
  const sprintEffort = Math.round(6 + ((age - 8) / 9) * 5)
  const restTime = Math.round(30 + ((age - 8) / 9) * 20)
  let sprintDesc = `Sprint de ${sprintEffort} secondes. `
  if (age <= 10) sprintDesc += 'Garde le haut du corps gainé, vélocité fluide sans rebondir sur la selle.'
  else if (age <= 14) sprintDesc += 'Tire sur tes pédales, engagement complet du haut du corps.'
  else sprintDesc += 'Recrutement maximal de la filière anaérobie.'
  const gateDesc = `Effort explosif de ${gateEffort} secondes, suivi de ${restTime} secondes de récupération active.`
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

  // timer
  const [timerSeconds, setTimerSeconds] = useState<number>(0)
  const [isRunning, setIsRunning] = useState(false)
  const timerRef = useRef<number | null>(null)
  const currentPhase = useRef<'idle' | 'effort' | 'rest' | 'single'>('idle')
  const savedRest = useRef<number>(35)
  const totalTaskDuration = useRef<number>(0)
  const isRandomBeepMode = useRef<boolean>(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    updateGrids()
    resetTimer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [age])

  const audioCtxRef = useRef<AudioContext | null>(null)
  function unlockAudio() {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
  }

  // 🔊 Joue le bip isolé (pour les exercices d'agilité/réactivité)
  function playSingleRandomBeep() {
    unlockAudio()
    const audio = new Audio(SOUND_SINGLE_BEEP)
    audio.play().catch(err => console.log('Erreur lecture MP3 bip:', err))
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

  // TIMER FUNCTIONS
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
          if (Math.random() < 0.15) {
            playSingleRandomBeep()
            if ((navigator as any).vibrate) (navigator as any).vibrate(200)
          }
        }
      }
      if (timerSeconds <= 0) {
        if (currentPhase.current === 'effort') {
          currentPhase.current = 'rest'
          const rest = savedRest.current
          setTimerSeconds(rest)
          speak('Récupération')
          return
        }
        terminateTimer('PRÊT POUR LE SUIVANT', 'Série terminée')
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
    setTimerSeconds(duration)
    setIsRunning(true)
  }

  // 🚦 Lance l'annonce MP3 "Watch the gate" puis démarre l'effort dès la fin du son
  function startDoubleTimer(effort: number, rest: number) {
    stopCurrentAudio()
    clearIntervalIfAny()
    isRandomBeepMode.current = false
    savedRest.current = rest
    currentPhase.current = 'effort'

    const audio = new Audio(SOUND_BMX_GATE)
    currentAudioRef.current = audio

    // Dès que l'enregistrement audio "Watch the gate..." se termine, l'effort commence
    audio.onended = () => {
      setTimerSeconds(effort)
      setIsRunning(true)
    }

    // Sécurité au cas où le fichier audio est manquant ou échoue
    audio.onerror = () => {
      console.warn('Erreur de chargement audio, lancement direct du timer.')
      setTimerSeconds(effort)
      setIsRunning(true)
    }

    audio.play().catch(err => {
      console.log('Erreur de lecture audio:', err)
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
            <span className="preset-note">Sélection actuelle : {Math.max(1, Math.round(exerciseDuration / 60))} min</span>
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
            <span className="preset-note">Valeur actuelle : {perRep}s</span>
          </label>

          <button className="btn-reset-grid" type="button" onClick={() => resetGridSettings(id, type)}>
            Réinitialiser
          </button>
        </div>
        <div className="grid-summary">
          <span>{formatTime(exerciseDuration)} d'exercice • accélération {perRep}s</span>
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
    if (currentPhase.current === 'effort') return '🔥 EFFORT'
    if (currentPhase.current === 'rest') return '🧘 RÉCUPÉRATION'
    return '⏱️ EN COURS'
  }

  return (
    <div>
      <div className="header">
        <h1>⚙️ WARMUP 2.0 // PRO BMX</h1>
        <div className="routine-selector">
          <button className={`tab-btn ${activeTab === 'classique' ? 'active' : ''}`} onClick={() => setActiveTab('classique')}>CLASS.</button>
          <button className={`tab-btn ${activeTab === 'routineA' ? 'active' : ''}`} onClick={() => setActiveTab('routineA')}>ROUT. A</button>
          <button className={`tab-btn ${activeTab === 'routineB' ? 'active' : ''}`} onClick={() => setActiveTab('routineB')}>ROUT. B</button>
          <button className={`tab-btn ${activeTab === 'routineC' ? 'active' : ''}`} onClick={() => setActiveTab('routineC')}>ROUT. C</button>
          <button className={`tab-btn ${activeTab === 'routineD' ? 'active' : ''}`} onClick={() => setActiveTab('routineD')}>ROUT. D</button>
        </div>
      </div>

      <div className="age-selector-container">
        <label htmlFor="ageSelect">Pilote ciblé :</label>
        <select id="ageSelect" value={age} onChange={e => setAge(e.target.value)}>
          {['8','9','10','11','12','13','14','15','16','17','elite'].map(v => (
            <option key={v} value={v}>{v === 'elite' ? 'Élite / Pro' : `${v} ans`}</option>
          ))}
        </select>
      </div>

      <div className="global-controls">
        <button className="btn-reset-all" type="button" onClick={resetAllGridSettings}>Réinitialiser tous les réglages</button>
        <span className="saved-note">Paramètres sauvegardés automatiquement</span>
      </div>

      <div id="classique" style={{ display: activeTab === 'classique' ? 'block' : 'none' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">🟢 1. MONTÉE EN PRESSION CARDIO</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Activer le système aérobie et lubrifier les genoux.</strong><ul><li>Pédalage fluide, haut du corps détendu, respiration ample.</li></ul></div>
          <button className={`btn-check-list ${doneTasks['card-classique-1'] ? 'done' : ''}`} onClick={() => toggleTask('card-classique-1', 180, false)}><span>🚴 Pédalage souple continu</span> <span>{doneTasks['card-classique-1'] ? '☑' : '☐'}</span></button>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">🔴 2. SIMULATIONS DE GRILLE (PRO START)</span><span className="badge-time">⏱️ {formatTime(exerciseDurations['grid-gate-classique'] ?? 240)}</span></div>
          <div className="consignes"><strong>Objectif : Recrutement explosif instantané.</strong><ul><li>{getWorkoutConfig(age).gateDesc}</li></ul></div>
          {renderGrid('grid-gate-classique', 'gate', 4, 'G', 240)}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">🟠 3. SPRINTS DE FRÉQUENCE (CADENCE)</span><span className="badge-time">⏱️ {formatTime(exerciseDurations['grid-turbo-classique'] ?? 180)}</span></div>
          <div className="consignes"><strong>Objectif : Vitesse maximale de rotation des jambes sans rebondir.</strong><ul><li>{getWorkoutConfig(age).sprintDesc}</li></ul></div>
          {renderGrid('grid-turbo-classique', 'sprint', 4, 'V', 180)}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">🔵 4. RETOUR AU CALME</span><span className="badge-time">⏱️ 2 MIN</span></div>
          <button className={`btn-check-list ${doneTasks['card-classique-4'] ? 'done' : ''}`} onClick={() => toggleTask('card-classique-4', 120, false)}><span>🧘 Respiration & Décontraction</span> <span>{doneTasks['card-classique-4'] ? '☑' : '☐'}</span></button>
        </div>
      </div>

      <div id="routineA" style={{ display: activeTab === 'routineA' ? 'block' : 'none' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">🟣 1. MISE EN ROUTE PROGRESSIVE</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Éveiller les muscles stabilisateurs du tronc.</strong><ul><li>Pédalage avec résistance modérée sur le rouleau.</li></ul></div>
          <button className={`btn-check-list ${doneTasks['card-routineA-1'] ? 'done' : ''}`} onClick={() => toggleTask('card-routineA-1', 180, false)}><span>🚴 Pédalage résistance croissante</span> <span>{doneTasks['card-routineA-1'] ? '☑' : '☐'}</span></button>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">⚡ 2. BLOCS DE FORCE SOUS-MAXIMALE</span><span className="badge-time">⏱️ {formatTime(exerciseDurations['grid-force-routineA'] ?? 240)}</span></div>
          <div className="consignes"><strong>Objectif : Engager les fibres musculaires profondes.</strong><ul><li>Rester bien assis, pousser lourd, garder les coudes écartés.</li></ul></div>
          {renderGrid('grid-force-routineA', 'sprint', 4, 'F', 240)}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">🔥 3. RELANCES SORTIE DE VIRAGE</span><span className="badge-time">⏱️ {formatTime(exerciseDurations['grid-relance-routineA'] ?? 180)}</span></div>
          <div className="consignes"><strong>Objectif : Capacité à ré-accélérer fort après un freinage.</strong><ul><li>{getWorkoutConfig(age).gateDesc}</li></ul></div>
          {renderGrid('grid-relance-routineA', 'gate', 4, 'R', 180)}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">🟢 4. DÉCRASSAGE DOUX</span><span className="badge-time">⏱️ 2 MIN</span></div>
          <button className={`btn-check-list ${doneTasks['card-routineA-4'] ? 'done' : ''}`} onClick={() => toggleTask('card-routineA-4', 120, false)}><span>🧘 Retour au calme</span> <span>{doneTasks['card-routineA-4'] ? '☑' : '☐'}</span></button>
        </div>
      </div>

      <div id="routineB" style={{ display: activeTab === 'routineB' ? 'block' : 'none' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">🟡 1. FLASH RÉACTIVITÉ (NEURO-TRAINING)</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Vitesse de conduction nerveuse (cerveau-muscle).</strong><ul><li>Souple, fluide et ultra-léger (zéro résistance).</li></ul></div>
          <button className={`btn-check-list ${doneTasks['card-routineB-1'] ? 'done' : ''}`} onClick={() => toggleTask('card-routineB-1', 180, true)}><span>🚴 Lancer le Réveil Nerveux (Bips Aléatoires)</span> <span>{doneTasks['card-routineB-1'] ? '☑' : '☐'}</span></button>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">⚡ 2. ENCHAÎNEMENT DE GRILLES COURTES</span><span className="badge-time">⏱️ 4 MIN</span></div>
          <div className="consignes"><strong>Objectif : Vitesse de sortie de grille pure.</strong><ul><li>{getWorkoutConfig(age).gateDesc}</li></ul></div>
          {renderGrid('grid-gate-routineB', 'gate', 5, 'G', 240)}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">🚀 3. SPRINTS DE SECTION (PREMIÈRE LIGNE)</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Maintenir la puissance sur les premiers mètres.</strong><ul><li>{getWorkoutConfig(age).sprintDesc}</li></ul></div>
          {renderGrid('grid-sprint-routineB', 'sprint', 3, 'A', 180)}
        </div>
      </div>

      <div id="routineC" style={{ display: activeTab === 'routineC' ? 'block' : 'none' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">🟢 1. ÉCHAUFFEMENT PROGRESSIF</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Élever la température centrale.</strong><ul><li>Pédalage fluide.</li></ul></div>
          <button className={`btn-check-list ${doneTasks['card-routineC-1'] ? 'done' : ''}`} onClick={() => toggleTask('card-routineC-1', 180, false)}><span>🚴 Cardio progressif</span> <span>{doneTasks['card-routineC-1'] ? '☑' : '☐'}</span></button>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">🔥 2. SOUTIEN DE FIN DE PARCOURS</span><span className="badge-time">⏱️ 4 MIN</span></div>
          <div className="consignes"><strong>Objectif : Encaisser l'acide lactique.</strong><ul><li>{getWorkoutConfig(age).sprintDesc}</li></ul></div>
          {renderGrid('grid-long-routineC', 'sprint', 3, 'L', 240)}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">⚡ 3. RELANCES MULTIPLES</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Enchaîner les efforts sous contrainte.</strong><ul><li>{getWorkoutConfig(age).gateDesc}</li></ul></div>
          {renderGrid('grid-relance-routineC', 'gate', 4, 'RA', 180)}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">🧘 4. RETOUR AU CALME PROFOND</span><span className="badge-time">⏱️ 2 MIN</span></div>
          <button className={`btn-check-list ${doneTasks['card-routineC-4'] ? 'done' : ''}`} onClick={() => toggleTask('card-routineC-4', 120, false)}><span>🧘 Respiration ventouse</span> <span>{doneTasks['card-routineC-4'] ? '☑' : '☐'}</span></button>
        </div>
      </div>

      <div id="routineD" style={{ display: activeTab === 'routineD' ? 'block' : 'none' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">🔵 1. SOUPLESSE DE PÉDALAGE</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Fluidité du tour de pédale.</strong><ul><li>Pédaler très vite avec quasi zéro résistance.</li></ul></div>
          <button className={`btn-check-list ${doneTasks['card-routineD-1'] ? 'done' : ''}`} onClick={() => toggleTask('card-routineD-1', 180, false)}><span>🚴 Vélocité pure à vide</span> <span>{doneTasks['card-routineD-1'] ? '☑' : '☐'}</span></button>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">⚡ 2. SPRINTS DE FRÉQUENCE MAX</span><span className="badge-time">⏱️ 4 MIN</span></div>
          <div className="consignes"><strong>Objectif : Vitesse maximale des pieds sur le rouleau.</strong><ul><li>{getWorkoutConfig(age).sprintDesc}</li></ul></div>
          {renderGrid('grid-freq-routineD', 'sprint', 4, 'V', 240)}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">🚀 3. EXPLO-FLASH (RÉACTIVITÉ COURTE)</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Gagner en punch sur le premier impact (bips aléatoires).</strong><ul><li>Réagir instantanément au signal sonore inopiné par un coup de pédale violent.</li></ul></div>
          {renderGrid('grid-flash-routineD', 'gate', 4, 'EF', 180)}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">🧘 4. DÉCRASSAGE FIN DE SÉANCE</span><span className="badge-time">⏱️ 2 MIN</span></div>
          <button className={`btn-check-list ${doneTasks['card-routineD-4'] ? 'done' : ''}`} onClick={() => toggleTask('card-routineD-4', 120, false)}><span>🧘 Retour au calme</span> <span>{doneTasks['card-routineD-4'] ? '☑' : '☐'}</span></button>
        </div>
      </div>

      <div id="victoryCard" className={`victory-card ${checkVictoryFor(activeTab) ? 'show' : ''}`}>
        <h2 style={{ margin: '0 0 4px 0' }}>🏆 WARMUP VALIDÉ !</h2>
        <p style={{ margin: 0, fontWeight: 'bold' }}>Super boulot, moteur activé pour la journée !</p>
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
            {isRunning ? '⏸ PAUSE' : '▶ DÉMARRER'}
          </button>
          <button className="timer-btn secondary" onClick={resetTimer}>
            🔄 RESET
          </button>
        </div>
      </div>
    </div>
  )
}