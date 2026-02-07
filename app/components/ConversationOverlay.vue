<script setup lang="ts">
const props = defineProps<{
  isListening: boolean
  isStreaming: boolean
  isSpeaking: boolean
  transcript: string
}>()
const emit = defineEmits<{ close: [] }>()

const state = computed(() => {
  if (props.isSpeaking) return 'speaking'
  if (props.isStreaming) return 'thinking'
  if (props.isListening) return 'listening'
  return 'idle'
})

const stateLabel = computed(() => {
  switch (state.value) {
    case 'listening': return 'Listening...'
    case 'thinking': return 'Thinking...'
    case 'speaking': return 'Speaking...'
    default: return 'Ready'
  }
})
</script>

<template>
  <Transition name="overlay-fade">
    <div class="conversation-overlay">
      <button class="close-btn" @click="emit('close')" title="Exit conversation mode">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div class="orb-container">
        <!-- Glow layer -->
        <div class="orb-glow" :class="state" />
        <!-- Main orb -->
        <div class="orb" :class="state">
          <!-- Sound wave bars (speaking) -->
          <div v-if="state === 'speaking'" class="wave-bars">
            <span v-for="i in 5" :key="i" class="bar" :style="{ animationDelay: `${i * 0.1}s` }" />
          </div>
          <!-- Mic icon (listening) -->
          <svg v-else-if="state === 'listening'" class="orb-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" x2="12" y1="19" y2="22"/>
          </svg>
          <!-- Thinking dots -->
          <div v-else-if="state === 'thinking'" class="thinking-dots">
            <span v-for="i in 3" :key="i" :style="{ animationDelay: `${i * 0.2}s` }" />
          </div>
          <!-- Idle circle -->
          <div v-else class="idle-ring" />
        </div>
        <!-- Ripple rings (listening) -->
        <div v-if="state === 'listening'" class="ripples">
          <div class="ripple" v-for="i in 3" :key="i" :style="{ animationDelay: `${i * 0.6}s` }" />
        </div>
      </div>

      <p class="state-label">{{ stateLabel }}</p>
      <p v-if="state === 'listening' && transcript" class="transcript">{{ transcript }}</p>
    </div>
  </Transition>
</template>

<style scoped>
.conversation-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(8, 8, 12, 0.92);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
}

.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.3s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

.close-btn {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.05);
}

/* --- Orb --- */

.orb-container {
  position: relative;
  width: 180px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.orb-glow {
  position: absolute;
  inset: -20px;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.4;
  transition: background 0.5s ease, opacity 0.5s ease;
}

.orb-glow.listening {
  background: #3b82f6;
  opacity: 0.5;
  animation: glow-pulse 2s ease-in-out infinite;
}

.orb-glow.thinking {
  background: #a855f7;
  opacity: 0.4;
  animation: glow-spin 3s linear infinite;
}

.orb-glow.speaking {
  background: #22c55e;
  opacity: 0.6;
  animation: glow-pulse 1s ease-in-out infinite;
}

.orb-glow.idle {
  background: var(--text-muted);
  opacity: 0.2;
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.1); }
}

@keyframes glow-spin {
  0% { opacity: 0.3; transform: rotate(0deg) scale(1); }
  50% { opacity: 0.5; transform: rotate(180deg) scale(1.05); }
  100% { opacity: 0.3; transform: rotate(360deg) scale(1); }
}

.orb {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
  transition: background 0.5s ease, box-shadow 0.5s ease, transform 0.3s ease;
}

.orb.listening {
  background: radial-gradient(circle at 40% 35%, #3b82f6, #1d4ed8);
  box-shadow: 0 0 30px rgba(59, 130, 246, 0.3);
  animation: orb-breathe 2.5s ease-in-out infinite;
}

.orb.thinking {
  background: radial-gradient(circle at 40% 35%, #a855f7, #7c3aed);
  box-shadow: 0 0 30px rgba(168, 85, 247, 0.3);
  animation: orb-breathe 1.5s ease-in-out infinite;
}

.orb.speaking {
  background: radial-gradient(circle at 40% 35%, #22c55e, #16a34a);
  box-shadow: 0 0 30px rgba(34, 197, 94, 0.3);
  animation: orb-speak 0.8s ease-in-out infinite;
}

.orb.idle {
  background: radial-gradient(circle at 40% 35%, #374151, #1f2937);
  box-shadow: 0 0 15px rgba(55, 65, 81, 0.2);
}

@keyframes orb-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes orb-speak {
  0%, 100% { transform: scale(1); }
  25% { transform: scale(1.08); }
  75% { transform: scale(0.97); }
}

/* --- Orb icon --- */

.orb-icon {
  color: rgba(255, 255, 255, 0.9);
}

/* --- Wave bars (speaking) --- */

.wave-bars {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 40px;
}

.wave-bars .bar {
  width: 5px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 3px;
  animation: wave-bar 0.8s ease-in-out infinite alternate;
}

@keyframes wave-bar {
  0% { height: 8px; }
  100% { height: 36px; }
}

/* --- Thinking dots --- */

.thinking-dots {
  display: flex;
  gap: 8px;
}

.thinking-dots span {
  width: 10px;
  height: 10px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  animation: thinking-bounce 1s ease-in-out infinite;
}

@keyframes thinking-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-12px); opacity: 1; }
}

/* --- Idle ring --- */

.idle-ring {
  width: 40px;
  height: 40px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
}

/* --- Ripple rings (listening) --- */

.ripples {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ripple {
  position: absolute;
  width: 140px;
  height: 140px;
  border: 1.5px solid rgba(59, 130, 246, 0.4);
  border-radius: 50%;
  animation: ripple-expand 2s ease-out infinite;
}

@keyframes ripple-expand {
  0% { transform: scale(1); opacity: 0.5; }
  100% { transform: scale(1.8); opacity: 0; }
}

/* --- Labels --- */

.state-label {
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
}

.transcript {
  max-width: 500px;
  text-align: center;
  font-size: 1.25rem;
  color: var(--text-primary);
  line-height: 1.5;
  font-style: italic;
  opacity: 0.8;
}
</style>
