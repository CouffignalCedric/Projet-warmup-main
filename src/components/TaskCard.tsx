import React from 'react'

type Props = {
  id: string
  title: string
  badgeTime: string
  children?: React.ReactNode
  done: boolean
  onToggle: () => void
}

export default function TaskCard({ id, title, done, onToggle, children }: Props) {
  return (
    <div>
      {/* Parent provides header and consignes; TaskCard only renders the action button */}
      <button className={`btn-check-list ${done ? 'done' : ''}`} onClick={onToggle} aria-pressed={done} aria-labelledby={`${id}-label`}>
        <span id={`${id}-label`} className="task-label">{title}</span>
      {/*  <span className="task-state">{done ? '☑' : '☐'}</span>*/}
      </button>
    </div>
  )
}
