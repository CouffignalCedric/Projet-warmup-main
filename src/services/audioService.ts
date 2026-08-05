import enSound from '../assets/audio/en.mp3'
import ralentiSound from '../assets/audio/ralenti.mp3'

let currentAudio: HTMLAudioElement | null = null

export function stopAudio(): void {
  if (currentAudio) {
    try {
      currentAudio.pause()
      currentAudio.currentTime = 0
      currentAudio.onended = null
      currentAudio.onerror = null
    } catch {
      // Ignorer les erreurs si l'élément audio est déjà libéré
    }
    currentAudio = null
  }
}

export function playAudio(src: string): Promise<void> {
  return new Promise((resolve) => {
    // Empêcher les lectures audio simultanées et libérer la ressource précédente
    stopAudio()

    const audio = new Audio(src)
    currentAudio = audio

    const cleanup = () => {
      audio.onended = null
      audio.onerror = null
      if (currentAudio === audio) {
        currentAudio = null
      }
      resolve()
    }

    audio.onended = cleanup
    audio.onerror = cleanup

    audio.play().catch((err) => {
      console.warn('Erreur lors de la lecture audio :', err)
      cleanup()
    })
  })
}

export function playExerciseFinished(): Promise<void> {
  return playAudio(enSound || '/assets/audio/en.mp3')
}

export function playSlowDown(): Promise<void> {
  return playAudio(ralentiSound || '/assets/audio/ralenti.mp3')
}

export default {
  playExerciseFinished,
  playSlowDown,
  stopAudio,
  playAudio
}
