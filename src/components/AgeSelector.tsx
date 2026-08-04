import React from 'react'

type Props = {
  age: string
  setAge: (s: string) => void
}

export default function AgeSelector({ age, setAge }: Props) {
  return (
    <div className="age-selector-container">
      <label htmlFor="ageSelect">Quel est ton âge ?</label>
      <select id="ageSelect" value={age} onChange={e => setAge(e.target.value)}>
        {['8','9','10','11','12','13','14','15','16','17','elite'].map(v => (
          <option key={v} value={v}>{v === 'elite' ? 'Pro / Élite' : `${v} ans`}</option>
        ))}
      </select>
    </div>
  )
}
