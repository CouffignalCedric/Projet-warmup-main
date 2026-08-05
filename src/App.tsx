import { useEffect, useRef, useState } from 'react'
import Header from './components/Header'
import AgeSelector from './components/AgeSelector'
import TimerBar from './components/TimerBar'
import GridControls from './components/GridControls'
import TaskCard from './components/TaskCard'
import { playExerciseFinished, playSlowDown, stopAudio } from './services/audioService'

const SOUND_BMX_GATE = '/watch_the_gate.mp3'

type GridDef = { id: string; type: 'gate' | 'sprint'; base: number; prefix: string; name: string; routine: string }
type OverlayType = 'go' | 'rest' | 'finish' | null

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
  const age = parseInt(ageValue, 10)
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

  const [overlayType, setOverlayType] = useState<OverlayType>(null)
  const overlayTimerRef = useRef<number | null>(null)

  // Préchargement des images au montage du composant
  useEffect(() => {
    const images = [
      '/start.webp',
      '/ralenti.webp',
      '/end.webp'
    ]

    images.forEach(src => {
      const img = new Image()
      img.src = src
    })
  }, [])

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs === 0 ? `${minutes} min` : `${minutes} min ${secs}s`
  }

  const [timerSeconds, setTimerSeconds] = useState<number>(0)
  const [isRunning, setIsRunning] = useState(false)
  const [isAudioPending, setIsAudioPending] = useState(false)
  const timerRef = useRef<number | null>(null)
  const currentPhase = useRef<'idle' | 'effort' | 'rest' | 'single'>('idle')
  const savedRest = useRef<number>(35)
  const totalTaskDuration = useRef<number>(0)
  const isRandomBeepMode = useRef<boolean>(false)
  const lastBeepTimerSeconds = useRef<number>(9999)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioStartTimeoutRef = useRef<number | null>(null)
  const hasTriggeredEffort = useRef<boolean>(false)

  const currentRepRef = useRef<number>(1)
  const totalRepsRef = useRef<number>(1)
  const effortRef = useRef<number>(0)
  const currentGridIdRef = useRef<string>('')

  function triggerOverlay(type: OverlayType, durationMs: number) {
    if (overlayTimerRef.current !== null) {
      window.clearTimeout(overlayTimerRef.current)
      overlayTimerRef.current = null
    }
    setOverlayType(type)
    overlayTimerRef.current = window.setTimeout(() => {
      setOverlayType(null)
      overlayTimerRef.current = null
    }, durationMs)
  }

  useEffect(() => {
    updateGrids()
    resetTimer()
    const cfg = getWorkoutConfig(age)
    const newPerRep = Object.fromEntries(GRIDS.map(g => [g.id, getDefaultRepDuration(g.type, cfg)]))
    setPerRepDurations(newPerRep)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [age])

  function unlockAudio() {
    // La fonction d'origine manipulait l'AudioContext, conservée pour compatibilité
  }

  function startDoubleTimer(effort: number, rest: number) {
    clearIntervalIfAny()
    effortRef.current = effort
    savedRest.current = rest
    launchGateAudioAndEffort()
  }

  function launchGateAudioAndEffort() {
    stopCurrentAudio()
    setIsAudioPending(true)
    hasTriggeredEffort.current = false
    const audio = new Audio(SOUND_BMX_GATE)
    currentAudioRef.current = audio

    // Affichage immédiat de l'image de départ dès le lancement de l'audio
    triggerOverlay('go', 7000)

    const handleStartEffort = () => {
      if (hasTriggeredEffort.current) return
      hasTriggeredEffort.current = true
      stopCurrentAudio()
      currentPhase.current = 'effort'
      setTimerSeconds(effortRef.current)
      setIsRunning(true)
    }

    audio.onended = handleStartEffort
    audio.onerror = handleStartEffort

    audio.play().catch(handleStartEffort)
  }

  function playAndSound() {
    playExerciseFinished()
  }

  function playRalentiSound() {
    playSlowDown()
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
    resetTimer()

    const gridId = id.replace(/-\d+$/, '')
    const repMatch = id.match(/-(\d+)$/)
    const startRep = repMatch ? parseInt(repMatch[1], 10) : 1

    const grid = GRIDS.find(g => g.id === gridId)
    const gridMetrics = grid
      ? getGridMetrics(grid, DEFAULT_EXERCISE_DURATION[grid.id] ?? 180)
      : { reps: 1 }

    currentGridIdRef.current = gridId
    currentRepRef.current = startRep
    totalRepsRef.current = gridMetrics.reps
    effortRef.current = effort

    setDoneTasks(prev => ({
      ...prev,
      [id]: true
    }))

    startDoubleTimer(effortRef.current, rest)
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
    const ageFactor = age === 'elite' ? 2 : (parseInt(age, 10) >= 14 ? 1 : 0)
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
    resetTimer()
    currentRepRef.current = 1
    totalRepsRef.current = 1
    effortRef.current = 0
    currentGridIdRef.current = ''
    const cfg = getWorkoutConfig(age)
    const newExerciseDurations = Object.fromEntries(GRIDS.map(g => [g.id, DEFAULT_EXERCISE_DURATION[g.id] ?? 180]))
    const newPerRep = Object.fromEntries(GRIDS.map(g => [g.id, getDefaultRepDuration(g.type, cfg)]))
    setExerciseDurations(newExerciseDurations)
    setPerRepDurations(newPerRep)
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
    cardIds.forEach(id => { newDone[id] = false })
    setDoneTasks(newDone)
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
          if (lastBeepTimerSeconds.current - timerSeconds >= 10) {
            if (Math.random() < 0.30) {
              playAndSound()
              if ((navigator as unknown as { vibrate?: (pattern: number | number[]) => boolean }).vibrate) {
                (navigator as unknown as { vibrate: (pattern: number | number[]) => boolean }).vibrate([150, 80, 150])
              }
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
          playRalentiSound()
          triggerOverlay('rest', 7000)
        } else if (currentPhase.current === 'rest') {
          clearIntervalIfAny()
          setIsRunning(false)

          if (currentRepRef.current < totalRepsRef.current) {
            currentRepRef.current++
            const nextId = `${currentGridIdRef.current}-${currentRepRef.current}`
            setDoneTasks(prev => ({
              ...prev,
              [nextId]: true
            }))
            launchGateAudioAndEffort()
            return
          }

          terminateTimer('EXERCICE TERMINÉ')
          triggerOverlay('finish', 7000)
          return
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerSeconds])

  function clearAudioStartTimeout() {
    if (audioStartTimeoutRef.current !== null) {
      window.clearTimeout(audioStartTimeoutRef.current)
      audioStartTimeoutRef.current = null
    }
  }

  function stopCurrentAudio() {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.currentTime = 0
      currentAudioRef.current = null
    }
    clearAudioStartTimeout()
    setIsAudioPending(false)
    stopAudio()
  }

  function startSingleTimer(duration: number, randomBeepsActive: boolean) {
    stopCurrentAudio()
    clearIntervalIfAny()
    currentPhase.current = 'single'
    totalTaskDuration.current = duration
    isRandomBeepMode.current = randomBeepsActive
    lastBeepTimerSeconds.current = duration
    setTimerSeconds(duration)
    setIsRunning(true)
  }

  function clearIntervalIfAny() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function terminateTimer(label?: string) {
    stopCurrentAudio()
    clearIntervalIfAny()
    setIsRunning(false)
    currentPhase.current = 'idle'
    isRandomBeepMode.current = false
    setTimerSeconds(0)
    playExerciseFinished()
  }

  function resetTimer() {
    stopCurrentAudio()
    clearIntervalIfAny()
    if (overlayTimerRef.current !== null) {
      window.clearTimeout(overlayTimerRef.current)
      overlayTimerRef.current = null
    }
    setOverlayType(null)
    setIsRunning(false)
    currentPhase.current = 'idle'
    isRandomBeepMode.current = false
    setTimerSeconds(0)
    currentRepRef.current = 1
    totalRepsRef.current = 1
    effortRef.current = 0
    currentGridIdRef.current = ''
  }

  function toggleTimer() {
    unlockAudio()
    if (isRunning) {
      setIsRunning(false)
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
      try { unlockAudio() } catch { }
      window.removeEventListener('click', once)
      window.removeEventListener('touchstart', once)
    }
    window.addEventListener('click', once, { once: true })
    window.addEventListener('touchstart', once, { once: true })
  }, [])

  const getPhaseLabel = () => {
    if (!isRunning && timerSeconds === 0) return 'Prêt'
    if (!isRunning) return 'En pause'
    if (currentPhase.current === 'effort') return '🔥 À FOND !'
    if (currentPhase.current === 'rest') return '🧘 REPOS (Souffle)'
    return '⏱️ EN COURS'
  }

  return (
    <div>
      {overlayType && (
        <div className={`bmx-overlay-container ${overlayType ? 'active' : ''}`}>
          <div className="bmx-overlay-content">
            {overlayType === 'go' && (
              <>
                <h1 className="bmx-overlay-title">🚀 GO GO GO !</h1>
                <div className="bmx-overlay-img-wrapper">
                  <img
                    src="/start.webp"
                    alt="BMX Départ Explosif"
                    className="bmx-overlay-image"
                  />
                </div>
              </>
            )}
            {overlayType === 'rest' && (
              <>
                <h1 className="bmx-overlay-title">😎 RALENTI !</h1>
                <div className="bmx-overlay-img-wrapper">
                  <img
                    src="/ralenti.webp"
                    alt="BMX Récupération"
                    className="bmx-overlay-image"
                  />
                </div>
              </>
            )}
            {overlayType === 'finish' && (
              <>
                <h1 className="bmx-overlay-title">🏆 EXERCICE TERMINÉ !</h1>
                <div className="bmx-overlay-img-wrapper">
                  <img
                    src="/end.webp"
                    alt="Podium BMX Trophée"
                    className="bmx-overlay-image"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <AgeSelector age={age} setAge={setAge} />

      <div className="global-controls">
        <button className="btn-reset-all" type="button" onClick={resetAllGridSettings}>Remettre tous les réglages à zéro</button>
        <span className="saved-note">Sauvegardé automatiquement sur ton appareil</span>
      </div>

      {/* VUE CLASSIQUE */}
      <div id="classique" style={{ display: activeTab === 'classique' ? 'block' : 'none' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">🟢 1. RÉVEIL DU CORPS</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Réveiller tes jambes et ton cœur en douceur.</strong><ul><li>Pédale tranquillement, respire bien et détends tes bras.</li></ul></div>
          <TaskCard id="card-classique-1" title="🚴 Pédalage facile et souple" badgeTime="⏱️ 3 MIN" done={!!doneTasks['card-classique-1']} onToggle={() => toggleTask('card-classique-1', 180, false)}>
            <span>{doneTasks['card-classique-1'] ? '☑' : '☐'}</span>
          </TaskCard>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">🔴 2. DÉPARTS SUR LA GRILLE</span><span className="badge-time">⏱️ {formatTime(exerciseDurations['grid-gate-classique'] ?? 240)}</span></div>
          <div className="consignes"><strong>Objectif : Réagir au quart de tour et partir comme une fusée !</strong><ul><li>{getWorkoutConfig(age).gateDesc}</li></ul></div>
          <GridControls id="grid-gate-classique" type="gate" base={4} prefix="G" defaultExerciseDuration={240} exerciseDurations={exerciseDurations} perRepDurations={perRepDurations} doneTasks={doneTasks} setExerciseDurations={setExerciseDurations} setPerRepDurations={setPerRepDurations} toggleRep={toggleRep} resetGridSettings={resetGridSettings} getWorkoutConfig={getWorkoutConfig} age={age} />
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">🟠 3. SPRINTS DE VITESSE</span><span className="badge-time">⏱️ {formatTime(exerciseDurations['grid-turbo-classique'] ?? 180)}</span></div>
          <div className="consignes"><strong>Objectif : Faire tourner tes jambes le plus vite possible.</strong><ul><li>{getWorkoutConfig(age).sprintDesc}</li></ul></div>
          <GridControls id="grid-turbo-classique" type="sprint" base={4} prefix="V" defaultExerciseDuration={180} exerciseDurations={exerciseDurations} perRepDurations={perRepDurations} doneTasks={doneTasks} setExerciseDurations={setExerciseDurations} setPerRepDurations={setPerRepDurations} toggleRep={toggleRep} resetGridSettings={resetGridSettings} getWorkoutConfig={getWorkoutConfig} age={age} />
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">🔵 4. RETOUR AU CALME</span><span className="badge-time">⏱️ 2 MIN</span></div>
          <TaskCard id="card-classique-4" title="🧘 On souffle, on détend ses bras et ses jambes" badgeTime="⏱️ 2 MIN" done={!!doneTasks['card-classique-4']} onToggle={() => toggleTask('card-classique-4', 120, false)}>
            <span>{doneTasks['card-classique-4'] ? '☑' : '☐'}</span>
          </TaskCard>
        </div>
      </div>

      {/* ROUTINES A, B, C, D */}
      <div id="routineA" style={{ display: activeTab === 'routineA' ? 'block' : 'none' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">🟣 1. MISE EN ROUTE</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Faire chauffer doucement les muscles.</strong><ul><li>Pédale en faisant un petit effort régulier.</li></ul></div>
          <TaskCard id="card-routineA-1" title="🚴 Pédalage avec un peu de résistance" badgeTime="⏱️ 3 MIN" done={!!doneTasks['card-routineA-1']} onToggle={() => toggleTask('card-routineA-1', 180, false)} />
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">⚡ 2. EXERCICES DE FORCE</span><span className="badge-time">⏱️ {formatTime(exerciseDurations['grid-force-routineA'] ?? 240)}</span></div>
          <div className="consignes"><strong>Objectif : Avoir des jambes de plus en plus fortes.</strong><ul><li>Reste bien assis sur ta selle et pousse fort sur les pédales en gardant tes coudes écartés.</li></ul></div>
          <GridControls id="grid-force-routineA" type="sprint" base={4} prefix="F" defaultExerciseDuration={240} exerciseDurations={exerciseDurations} perRepDurations={perRepDurations} doneTasks={doneTasks} setExerciseDurations={setExerciseDurations} setPerRepDurations={setPerRepDurations} toggleRep={toggleRep} resetGridSettings={resetGridSettings} getWorkoutConfig={getWorkoutConfig} age={age} />
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🔥 3. RELANCES APRÈS LES VIRAGES</span><span className="badge-time">⏱️ {formatTime(exerciseDurations['grid-relance-routineA'] ?? 180)}</span></div>
          <div className="consignes"><strong>Objectif : Ré-accélérer fort comme dans un vrai virage.</strong><ul><li>{getWorkoutConfig(age).gateDesc}</li></ul></div>
          <GridControls id="grid-relance-routineA" type="gate" base={4} prefix="R" defaultExerciseDuration={180} exerciseDurations={exerciseDurations} perRepDurations={perRepDurations} doneTasks={doneTasks} setExerciseDurations={setExerciseDurations} setPerRepDurations={setPerRepDurations} toggleRep={toggleRep} resetGridSettings={resetGridSettings} getWorkoutConfig={getWorkoutConfig} age={age} />
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🟢 4. RETOUR AU CALME</span><span className="badge-time">⏱️ 2 MIN</span></div>
          <div className="consignes"><strong>Objectif : Récupérer et relâcher les muscles.</strong><ul><li>On roule tout doucement pour souffler</li></ul></div>
          <TaskCard id="card-routineA-4" title="🧘 On roule tout doucement pour souffler" badgeTime="⏱️ 2 MIN" done={!!doneTasks['card-routineA-4']} onToggle={() => toggleTask('card-routineA-4', 120, false)} />
        </div>
      </div>

      <div id="routineB" style={{ display: activeTab === 'routineB' ? 'block' : 'none' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">🟡 1. JEU DE RÉFLEXES (BIPS SURPRISES)</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Réveiller tes réflexes et ta vitesse de réaction.</strong><ul><li>Pédale léger et tends l'oreille. Des doubles bips surprises retentiront de temps en temps (avec au moins 10 secondes d'écart) : réagis instantanément par deux coup de pédale fulgurant dès que tu les entends !</li></ul></div>
          <TaskCard id="card-routineB-1" title="🚴 Lancer le jeu des bips surprises" badgeTime="⏱️ 3 MIN" done={!!doneTasks['card-routineB-1']} onToggle={() => toggleTask('card-routineB-1', 180, true)} />
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">⚡ 2. ENCHAÎNEMENTS DE GRILLES</span><span className="badge-time">⏱️ 4 MIN</span></div>
          <div className="consignes"><strong>Objectif : S'élancer super vite de la grille.</strong><ul><li>{getWorkoutConfig(age).gateDesc}</li></ul></div>
          <GridControls id="grid-gate-routineB" type="gate" base={5} prefix="G" defaultExerciseDuration={240} exerciseDurations={exerciseDurations} perRepDurations={perRepDurations} doneTasks={doneTasks} setExerciseDurations={setExerciseDurations} setPerRepDurations={setPerRepDurations} toggleRep={toggleRep} resetGridSettings={resetGridSettings} getWorkoutConfig={getWorkoutConfig} age={age} />
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🚀 3. SPRINTS DE SECTION</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Garder de la vitesse sur la piste.</strong><ul><li>{getWorkoutConfig(age).sprintDesc}</li></ul></div>
          <GridControls id="grid-sprint-routineB" type="sprint" base={3} prefix="A" defaultExerciseDuration={180} exerciseDurations={exerciseDurations} perRepDurations={perRepDurations} doneTasks={doneTasks} setExerciseDurations={setExerciseDurations} setPerRepDurations={setPerRepDurations} toggleRep={toggleRep} resetGridSettings={resetGridSettings} getWorkoutConfig={getWorkoutConfig} age={age} />
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🟢 4. RETOUR AU CALME</span><span className="badge-time">⏱️ 2 MIN</span></div>
          <div className="consignes"><strong>Objectif : Revenir au calme et reprendre une respiration régulière.</strong><ul><li>On souffle et on détend tout le corps.</li></ul></div>
          <TaskCard id="card-routineB-4" title="🧘 On souffle et on détend tout le corps" badgeTime="⏱️ 2 MIN" done={!!doneTasks['card-routineB-4']} onToggle={() => toggleTask('card-routineB-4', 120, false)} />
        </div>
      </div>

      <div id="routineC" style={{ display: activeTab === 'routineC' ? 'block' : 'none' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">🟢 1. ÉCHAUFFEMENT FACILE</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Bien préparer ton corps.</strong><ul><li>Pédale tranquillement pour te mettre en route.</li></ul></div>
          <TaskCard id="card-routineC-1" title="🚴 Pédalage en douceur" badgeTime="⏱️ 3 MIN" done={!!doneTasks['card-routineC-1']} onToggle={() => toggleTask('card-routineC-1', 180, false)} />
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">⚡ 2. TENIR JUSQU’À LA FIN</span><span className="badge-time">⏱️ {formatTime(exerciseDurations['grid-long-routineC'] ?? 240)}</span></div>
          <div className="consignes"><strong>Objectif : Garder une bonne intensité jusqu’au bout de la série.</strong><ul><li>{getWorkoutConfig(age).sprintDesc}</li></ul></div>
          <GridControls id="grid-long-routineC" type="sprint" base={3} prefix="L" defaultExerciseDuration={240} exerciseDurations={exerciseDurations} perRepDurations={perRepDurations} doneTasks={doneTasks} setExerciseDurations={setExerciseDurations} setPerRepDurations={setPerRepDurations} toggleRep={toggleRep} resetGridSettings={resetGridSettings} getWorkoutConfig={getWorkoutConfig} age={age} />
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🔥 3. MULTI-RELANCES</span><span className="badge-time">⏱️ {formatTime(exerciseDurations['grid-relance-routineC'] ?? 180)}</span></div>
          <div className="consignes"><strong>Objectif : Repartir avec énergie après chaque relance.</strong><ul><li>{getWorkoutConfig(age).gateDesc}</li></ul></div>
          <GridControls id="grid-relance-routineC" type="gate" base={4} prefix="RA" defaultExerciseDuration={180} exerciseDurations={exerciseDurations} perRepDurations={perRepDurations} doneTasks={doneTasks} setExerciseDurations={setExerciseDurations} setPerRepDurations={setPerRepDurations} toggleRep={toggleRep} resetGridSettings={resetGridSettings} getWorkoutConfig={getWorkoutConfig} age={age} />
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🟢 4. RETOUR AU CALME</span><span className="badge-time">⏱️ 2 MIN</span></div>
          <div className="consignes"><strong>Objectif : Revenir doucement à un rythme maîtrisé.</strong><ul><li>Respire profondément en gonflant bien ton ventre.</li></ul></div>
          <TaskCard id="card-routineC-4" title="🧘 Respire profondément en gonflant bien ton ventre" badgeTime="⏱️ 2 MIN" done={!!doneTasks['card-routineC-4']} onToggle={() => toggleTask('card-routineC-4', 120, false)} />
        </div>
      </div>

      <div id="routineD" style={{ display: activeTab === 'routineD' ? 'block' : 'none' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">🔵 1. PÉDALAGE LÉGER</span><span className="badge-time">⏱️ 3 MIN</span></div>
          <div className="consignes"><strong>Objectif : Faire tourner tes jambes sans forcer.</strong><ul><li>Pédale de façon souple pour préparer la suite.</li></ul></div>
          <TaskCard id="card-routineD-1" title="🚴 Pédalage souple" badgeTime="⏱️ 3 MIN" done={!!doneTasks['card-routineD-1']} onToggle={() => toggleTask('card-routineD-1', 180, false)} />
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">⚡ 2. VITESSE MAXIMUM DES JAMBES</span><span className="badge-time">⏱️ {formatTime(exerciseDurations['grid-freq-routineD'] ?? 240)}</span></div>
          <div className="consignes"><strong>Objectif : Faire tourner tes jambes à pleine vitesse.</strong><ul><li>{getWorkoutConfig(age).sprintDesc}</li></ul></div>
          <GridControls id="grid-freq-routineD" type="sprint" base={4} prefix="V" defaultExerciseDuration={240} exerciseDurations={exerciseDurations} perRepDurations={perRepDurations} doneTasks={doneTasks} setExerciseDurations={setExerciseDurations} setPerRepDurations={setPerRepDurations} toggleRep={toggleRep} resetGridSettings={resetGridSettings} getWorkoutConfig={getWorkoutConfig} age={age} />
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🎮 3. JEUX DE RÉFLEXES (FLASH)</span><span className="badge-time">⏱️ {formatTime(exerciseDurations['grid-flash-routineD'] ?? 180)}</span></div>
          <div className="consignes"><strong>Objectif : Démarrer instantanément au signal.</strong><ul><li>{getWorkoutConfig(age).gateDesc}</li></ul></div>
          <GridControls id="grid-flash-routineD" type="gate" base={4} prefix="EF" defaultExerciseDuration={180} exerciseDurations={exerciseDurations} perRepDurations={perRepDurations} doneTasks={doneTasks} setExerciseDurations={setExerciseDurations} setPerRepDurations={setPerRepDurations} toggleRep={toggleRep} resetGridSettings={resetGridSettings} getWorkoutConfig={getWorkoutConfig} age={age} />
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🟢 4. RETOUR AU CALME</span><span className="badge-time">⏱️ 2 MIN</span></div>
          <div className="consignes"><strong>Objectif : Finir en douceur et détendre les muscles.</strong><ul><li>Roule lentement et respire calmement.</li></ul></div>
          <TaskCard id="card-routineD-4" title="🧘 Roule lentement et respire calmement" badgeTime="⏱️ 2 MIN" done={!!doneTasks['card-routineD-4']} onToggle={() => toggleTask('card-routineD-4', 120, false)} />
        </div>
      </div>

      <TimerBar
  timerSeconds={timerSeconds}
  isRunning={isRunning}
  isAudioPending={isAudioPending}
  getPhaseLabel={getPhaseLabel}
  toggleTimer={toggleTimer}
  resetTimer={resetTimer}
/>
    </div>
  )
}