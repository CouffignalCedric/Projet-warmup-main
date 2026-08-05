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

    await slowAudio.play()
    slowAudio.pause()

    endAudio.currentTime = 0
    slowAudio.currentTime = 0

    endAudio.muted = false
    slowAudio.muted = false

    unlocked = true
  } catch (err) {
    console.warn(err)
  }
}

export function stopAudio() {
  endAudio.pause()
  slowAudio.pause()

  endAudio.currentTime = 0
  slowAudio.currentTime = 0
}

export function playExerciseFinished() {
  endAudio.currentTime = 0
  return endAudio.play()
}

export function playSlowDown() {
  slowAudio.currentTime = 0
  return slowAudio.play()
}