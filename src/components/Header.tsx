import React from 'react'

type Props = {
  activeTab: string
  setActiveTab: (s: string) => void
}

export default function Header({ activeTab, setActiveTab }: Props) {
  return (
    <div className="header">
      <h1>🔥WARMUP 2.0 BMX RACING🔥 </h1>
      <div className="routine-selector">
        <button className={`tab-btn ${activeTab === 'classique' ? 'active' : ''}`} onClick={() => setActiveTab('classique')}>CLASS.</button>
        <button className={`tab-btn ${activeTab === 'routineA' ? 'active' : ''}`} onClick={() => setActiveTab('routineA')}>ROUT. A</button>
        <button className={`tab-btn ${activeTab === 'routineB' ? 'active' : ''}`} onClick={() => setActiveTab('routineB')}>ROUT. B</button>
        <button className={`tab-btn ${activeTab === 'routineC' ? 'active' : ''}`} onClick={() => setActiveTab('routineC')}>ROUT. C</button>
        <button className={`tab-btn ${activeTab === 'routineD' ? 'active' : ''}`} onClick={() => setActiveTab('routineD')}>ROUT. D</button>
      </div>
    </div>
  )
}
