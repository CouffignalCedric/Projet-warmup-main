import enSound from '../assets/audio/en.mp3'
import ralentiSound from '../assets/audio/ralenti.mp3'

const endAudio = new Audio(enSound)
const slowAudio = new Audio(ralentiSound)

let unlocked = false

export async function unlockAudio() {
  if (unlocked) return

  try {
    endAudio.muted = true
    slowAudio.muted = true

    await endAudio.play()
    endAudio.pause()
    endAudio.currentTime = 0

    await slowAudio.play()
    slowAudio.pause()
    slowAudio.currentTime = 0

    endAudio.muted = false
    slowAudio.muted = false

    unlocked = true
  } catch (e) {
    console.warn('Audio non débloqué', e)
  }
}

export async function playExerciseFinished() {
  endAudio.currentTime = 0
  return endAudio.play()
}

export async function playSlowDown() {
  slowAudio.currentTime = 0
  return slowAudio.play()
}
