import React from 'react'

type Props = {
  timerSeconds: number
  isRunning: boolean
  toggleTimer: () => void
  resetTimer: () => void
  getPhaseLabel: () => string
}

export default function TimerBar({ timerSeconds, isRunning, toggleTimer, resetTimer, getPhaseLabel }: Props) {
  const minutes = String(Math.floor(timerSeconds / 60)).padStart(2, '0')
  const secs = String(timerSeconds % 60).padStart(2, '0')
  return (
    <div className="sticky-timer-bar" id="timerBar">
      <div className="timer-info">
        <span className="timer-label" id="timerLabel">{getPhaseLabel()}</span>
        <span className="timer-digits" id="timerDisplay">{minutes}:{secs}</span>
      </div>
      <div className="timer-controls">
        <button className="timer-btn primary" onClick={toggleTimer}>{isRunning ? '⏸ PAUSE' : '▶ C’EST PARTI !'}</button>
        <button className="timer-btn secondary" onClick={resetTimer}>🔄 RESET</button>
      </div>
    </div>
  )
}
