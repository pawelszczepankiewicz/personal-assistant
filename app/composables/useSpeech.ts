export interface VoiceOption {
  id: string
  label: string
  lang: string
  engine: string
}

export function useSpeech() {
  const isListening = ref(false)
  const isSpeaking = ref(false)
  const transcript = ref('')
  const autoSpeak = ref(true)
  const autoConversation = ref(false)
  const sttSupported = ref(false)
  const ttsAvailable = ref(false)
  const selectedVoice = ref('tara')
  const availableVoices = ref<VoiceOption[]>([])

  let recognition: SpeechRecognition | null = null
  let silenceTimer: ReturnType<typeof setTimeout> | null = null
  let onSilenceCallback: ((text: string) => void) | null = null
  let audioContext: AudioContext | null = null
  let scheduledEndTime = 0
  let abortController: AbortController | null = null

  const SILENCE_TIMEOUT = 1500

  const LANG_MAP: Record<string, string> = {
    en: 'en-US',
    pl: 'pl-PL',
  }

  const sttLang = computed(() => {
    const voice = availableVoices.value.find((v: VoiceOption) => v.id === selectedVoice.value)
    if (voice) return LANG_MAP[voice.lang] || voice.lang
    return navigator.language || 'en-US'
  })

  onMounted(async () => {
    sttSupported.value = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window

    try {
      const res = await fetch('/api/voices')
      if (res.ok) {
        const data = await res.json()
        availableVoices.value = data.voices || []
        ttsAvailable.value = true
        if (availableVoices.value.length && !availableVoices.value.find((v: VoiceOption) => v.id === selectedVoice.value)) {
          selectedVoice.value = availableVoices.value[0].id
        }
      }
    } catch {
      ttsAvailable.value = false
    }
  })

  // --- STT ---

  function clearSilenceTimer() {
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
  }

  function startListening() {
    if (!sttSupported.value || isListening.value) return

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition
    recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = sttLang.value

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      clearSilenceTimer()

      let final = ''
      let interim = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }
      transcript.value = final || interim

      if (final) {
        silenceTimer = setTimeout(() => {
          const text = transcript.value.trim()
          if (text && onSilenceCallback) {
            stopListening()
            onSilenceCallback(text)
          }
        }, SILENCE_TIMEOUT)
      }
    }

    recognition.onend = () => {
      isListening.value = false
      clearSilenceTimer()
    }

    recognition.onerror = (e) => {
      if (e.error === 'no-speech' && autoConversation.value) {
        isListening.value = false
        startListening()
        return
      }
      isListening.value = false
      clearSilenceTimer()
    }

    transcript.value = ''
    isListening.value = true
    recognition.start()
  }

  function stopListening() {
    clearSilenceTimer()
    if (recognition) {
      recognition.onend = () => { isListening.value = false }
      recognition.stop()
      recognition = null
    }
  }

  function onSilence(cb: (text: string) => void) {
    onSilenceCallback = cb
  }

  // --- TTS ---

  function getAudioContext(): AudioContext {
    if (!audioContext) {
      audioContext = new AudioContext({ sampleRate: 24000 })
    }
    return audioContext
  }

  /**
   * Speak text using Orpheus TTS server with streaming PCM playback.
   * Audio chunks are scheduled on the Web Audio API as they arrive,
   * so playback starts almost immediately.
   */
  async function speak(text: string) {
    if (!text.trim()) return

    // If Orpheus TTS isn't available, fall back to browser TTS
    if (!ttsAvailable.value) {
      speakBrowser(text)
      return
    }

    stopSpeaking()
    isSpeaking.value = true

    const ctx = getAudioContext()
    if (ctx.state === 'suspended') await ctx.resume()
    scheduledEndTime = ctx.currentTime

    abortController = new AbortController()

    try {
      const params = new URLSearchParams({
        text,
        voice: selectedVoice.value,
      })

      const response = await fetch(`/api/tts?${params}`, {
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`TTS error: ${response.status}`)
      }

      const reader = response.body!.getReader()
      let pcmBuffer = new Uint8Array(0)

      // Play chunks of ~2048 samples (~85ms at 24kHz) for low latency
      const CHUNK_SAMPLES = 2048
      const CHUNK_BYTES = CHUNK_SAMPLES * 2 // 16-bit = 2 bytes per sample

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Append new data to buffer
        const newBuf = new Uint8Array(pcmBuffer.length + value.length)
        newBuf.set(pcmBuffer)
        newBuf.set(value, pcmBuffer.length)
        pcmBuffer = newBuf

        // Schedule complete chunks
        while (pcmBuffer.length >= CHUNK_BYTES) {
          const chunkData = pcmBuffer.slice(0, CHUNK_BYTES)
          pcmBuffer = pcmBuffer.slice(CHUNK_BYTES)
          scheduleChunk(ctx, chunkData)
        }
      }

      // Schedule remaining samples
      if (pcmBuffer.length >= 2) {
        scheduleChunk(ctx, pcmBuffer)
      }

      // Wait for all audio to finish playing
      const remainingTime = scheduledEndTime - ctx.currentTime
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime * 1000))
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      console.error('TTS error:', err)
    } finally {
      isSpeaking.value = false
      abortController = null
      if (autoConversation.value) {
        startListening()
      }
    }
  }

  function scheduleChunk(ctx: AudioContext, pcmBytes: Uint8Array) {
    const int16 = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength / 2)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000)
    audioBuffer.getChannelData(0).set(float32)

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer

    source.connect(ctx.destination)

    const startTime = Math.max(ctx.currentTime, scheduledEndTime)
    source.start(startTime)
    scheduledEndTime = startTime + audioBuffer.duration
  }

  /**
   * Split text into sentences and speak each one immediately via Orpheus,
   * queuing them so playback is continuous. This allows starting speech
   * before the full LLM response is available.
   */
  async function speakStreaming(text: string) {
    if (!text.trim()) return

    if (!ttsAvailable.value) {
      speakBrowser(text)
      return
    }

    // Split into sentences
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text]
    const trimmed = sentences.map(s => s.trim()).filter(s => s.length > 0)

    stopSpeaking()
    isSpeaking.value = true

    const ctx = getAudioContext()
    if (ctx.state === 'suspended') await ctx.resume()
    scheduledEndTime = ctx.currentTime

    abortController = new AbortController()

    try {
      for (const sentence of trimmed) {
        if (abortController.signal.aborted) break

        const params = new URLSearchParams({
          text: sentence,
          voice: selectedVoice.value,
        })

        const response = await fetch(`/api/tts?${params}`, {
          signal: abortController.signal,
        })

        if (!response.ok) continue

        const reader = response.body!.getReader()
        let pcmBuffer = new Uint8Array(0)
        const CHUNK_BYTES = 2048 * 2

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const newBuf = new Uint8Array(pcmBuffer.length + value.length)
          newBuf.set(pcmBuffer)
          newBuf.set(value, pcmBuffer.length)
          pcmBuffer = newBuf

          while (pcmBuffer.length >= CHUNK_BYTES) {
            const chunkData = pcmBuffer.slice(0, CHUNK_BYTES)
            pcmBuffer = pcmBuffer.slice(CHUNK_BYTES)
            scheduleChunk(ctx, chunkData)
          }
        }

        if (pcmBuffer.length >= 2) {
          scheduleChunk(ctx, pcmBuffer)
        }
      }

      // Wait for playback to finish
      const remainingTime = scheduledEndTime - ctx.currentTime
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime * 1000))
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      console.error('TTS streaming error:', err)
    } finally {
      isSpeaking.value = false
      abortController = null
      if (autoConversation.value) {
        startListening()
      }
    }
  }

  /** Fallback: browser built-in SpeechSynthesis */
  function speakBrowser(text: string) {
    window.speechSynthesis.cancel()

    const clean = text
      .replace(/```[\s\S]*?```/g, ' code block ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[>\-*_~]/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim()

    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.lang = navigator.language || 'en-US'
    utterance.onstart = () => { isSpeaking.value = true }
    utterance.onend = () => {
      isSpeaking.value = false
      if (autoConversation.value) startListening()
    }
    utterance.onerror = () => { isSpeaking.value = false }
    window.speechSynthesis.speak(utterance)
  }

  function stopSpeaking() {
    // Abort any in-flight TTS fetch
    if (abortController) {
      abortController.abort()
      abortController = null
    }

    // Stop Web Audio playback
    if (audioContext) {
      audioContext.close()
      audioContext = null
    }

    // Also stop browser TTS if active
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

    isSpeaking.value = false
  }

  return {
    isListening,
    isSpeaking,
    transcript,
    autoSpeak,
    autoConversation,
    sttSupported,
    ttsAvailable,
    selectedVoice,
    availableVoices,
    startListening,
    stopListening,
    speak,
    speakStreaming,
    stopSpeaking,
    onSilence,
  }
}
