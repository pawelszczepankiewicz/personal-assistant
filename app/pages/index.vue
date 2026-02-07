<script setup lang="ts">
const {
  messages,
  selectedModel,
  isStreaming,
  error,
  systemPrompt,
  sendMessage,
  clearChat,
} = useChat();
const showSystemPrompt = ref(false);
const {
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
} = useSpeech();

const messagesContainer = ref<HTMLElement | null>(null);
const inputText = ref("");

// Sync speech transcript into the input field as user speaks
watch(transcript, (val) => {
  if (val) inputText.value = val;
});

// Auto-send when silence is detected after speech
onSilence((text) => {
  inputText.value = "";
  sendMessage(text);
});

// Auto-speak assistant responses when streaming finishes
// Single request with streaming PCM playback — faster than sentence-by-sentence
// After speak() finishes, useSpeech auto-starts listening if autoConversation is on
watch(isStreaming, (streaming, wasStreaming) => {
  if (wasStreaming && !streaming && autoSpeak.value) {
    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg?.role === "assistant" && lastMsg.content) {
      speak(lastMsg.content);
    }
  }
});

function toggleMic() {
  if (isListening.value) {
    stopListening();
    // Manual stop: send whatever we have
    nextTick(() => {
      setTimeout(() => {
        if (inputText.value.trim()) {
          sendMessage(inputText.value.trim());
          inputText.value = "";
        }
      }, 300);
    });
  } else {
    stopSpeaking();
    startListening();
  }
}

function toggleConversation() {
  autoConversation.value = !autoConversation.value;
  if (autoConversation.value) {
    autoSpeak.value = true;
    stopSpeaking();
    startListening();
  } else {
    stopListening();
    stopSpeaking();
  }
}

watch(
  messages,
  () => {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop =
          messagesContainer.value.scrollHeight;
      }
    });
  },
  { deep: true },
);
</script>

<template>
  <div class="chat-page">
    <header class="chat-header">
      <h1>LM Chat</h1>
      <div class="header-controls">
        <ModelSelector v-model="selectedModel" />

        <div v-if="availableVoices.length" class="voice-selector">
          <select v-model="selectedVoice" title="TTS voice">
            <optgroup label="English (Orpheus)">
              <option
                v-for="v in availableVoices.filter((v) => v.lang === 'en')"
                :key="v.id"
                :value="v.id"
              >
                {{ v.label }}
              </option>
            </optgroup>
            <optgroup label="Polish (Piper)">
              <option
                v-for="v in availableVoices.filter((v) => v.lang === 'pl')"
                :key="v.id"
                :value="v.id"
              >
                {{ v.label }}
              </option>
            </optgroup>
          </select>
        </div>
        <button
          v-if="sttSupported"
          class="conversation-toggle"
          :class="{ active: autoConversation }"
          :title="
            autoConversation
              ? 'Stop conversation mode'
              : 'Start conversation mode (hands-free)'
          "
          @click="toggleConversation"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
          Conversation
        </button>
        <label class="auto-speak-toggle" title="Auto-read responses aloud">
          <input type="checkbox" v-model="autoSpeak" />
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        </label>
        <button
          class="icon-button"
          title="System prompt"
          @click="showSystemPrompt = !showSystemPrompt"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
            />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <button class="clear-button" :disabled="isStreaming" @click="clearChat">
          Clear
        </button>
      </div>
    </header>

    <div v-if="showSystemPrompt" class="system-prompt-panel">
      <textarea
        v-model="systemPrompt"
        placeholder="System prompt..."
        rows="3"
      />
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <main ref="messagesContainer" class="messages-container">
      <div v-if="messages.length === 0" class="empty-state">
        <p>Send a message to start a conversation.</p>
      </div>
      <ChatMessage
        v-for="(msg, i) in messages"
        :key="i"
        :message="msg"
        :is-speaking="isSpeaking"
        :tts-supported="ttsAvailable"
        @speak="speakStreaming"
        @stop-speaking="stopSpeaking"
      />
      <div
        v-if="isStreaming && messages[messages.length - 1]?.content === ''"
        class="streaming-indicator"
      >
        <span class="dot-pulse" />
      </div>
    </main>

    <ChatInput
      v-model:input-text="inputText"
      :disabled="isStreaming || !selectedModel"
      :is-listening="isListening"
      :stt-supported="sttSupported"
      @send="sendMessage"
      @toggle-mic="toggleMic"
    />

    <ConversationOverlay
      v-if="autoConversation"
      :is-listening="isListening"
      :is-streaming="isStreaming"
      :is-speaking="isSpeaking"
      :transcript="transcript"
      @close="toggleConversation"
    />
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 40px);
  max-width: 1000px;
  margin: 20px auto;
  background: var(--surface-base);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--surface-elevated);
  flex-shrink: 0;
}

.chat-header h1 {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.voice-selector select {
  background: var(--surface-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  font-family: inherit;
  cursor: pointer;
  text-transform: capitalize;
}

.voice-selector select:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-glow);
}

.conversation-toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.conversation-toggle:hover {
  color: var(--text-primary);
  border-color: var(--text-secondary);
}

.conversation-toggle.active {
  background: rgba(34, 197, 94, 0.15);
  border-color: #22c55e;
  color: #22c55e;
  animation: pulse-green 2s infinite;
}

@keyframes pulse-green {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.3);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0);
  }
}

.auto-speak-toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s ease;
}

.auto-speak-toggle:has(input:checked) {
  color: var(--accent-color);
}

.auto-speak-toggle input {
  display: none;
}

.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-button:hover {
  color: var(--text-primary);
  border-color: var(--text-secondary);
}

.system-prompt-panel {
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--surface-elevated);
  flex-shrink: 0;
}

.system-prompt-panel textarea {
  width: 100%;
  background: var(--surface-base);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;
}

.system-prompt-panel textarea:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-glow);
}

.clear-button {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.clear-button:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--text-secondary);
}

.clear-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.error-banner {
  background: var(--error-bg);
  color: var(--error-text);
  padding: 0.75rem 1.25rem;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
}

.streaming-indicator {
  padding: 0.5rem 0;
}

.dot-pulse {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: var(--accent-color);
  border-radius: 50%;
  animation: dot-pulse 1.2s infinite ease-in-out;
}

@keyframes dot-pulse {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
