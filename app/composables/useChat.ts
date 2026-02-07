export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const DEFAULT_SYSTEM_PROMPT = "";

export function useChat() {
  const messages = ref<ChatMessage[]>([]);
  const selectedModel = ref("");
  const isStreaming = ref(false);
  const error = ref<string | null>(null);
  const systemPrompt = ref(DEFAULT_SYSTEM_PROMPT);

  async function sendMessage(userContent: string) {
    if (!userContent.trim() || !selectedModel.value || isStreaming.value)
      return;

    error.value = null;
    messages.value.push({ role: "user", content: userContent });

    const assistantMessage: ChatMessage = { role: "assistant", content: "" };
    messages.value.push(assistantMessage);
    const assistantIndex = messages.value.length - 1;

    isStreaming.value = true;

    try {
      // Build input as the full conversation for context
      // LM Studio REST API takes `input` as a string for the latest message
      // and we pass conversation history via previous_response_id or just send latest
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel.value,
          input: userContent,
          system_prompt: systemPrompt.value,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Server error: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Parse SSE format: "event: <type>\ndata: <json>"
          if (trimmed.startsWith("data: ")) {
            const jsonStr = trimmed.slice(6);
            if (jsonStr === "[DONE]") continue;

            try {
              const chunk = JSON.parse(jsonStr);

              // LM Studio REST API streaming events
              // message.delta contains { content: "..." }
              if (chunk.type === "message.delta" && chunk.content) {
                messages.value[assistantIndex].content += chunk.content;
              }
              // Also handle OpenAI-compatible format as fallback
              if (chunk.choices?.[0]?.delta?.content) {
                messages.value[assistantIndex].content +=
                  chunk.choices[0].delta.content;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (err: any) {
      error.value = err.message || "Failed to send message";
      if (messages.value[assistantIndex].content === "") {
        messages.value.splice(assistantIndex, 1);
      }
    } finally {
      isStreaming.value = false;
    }
  }

  function clearChat() {
    messages.value = [];
    error.value = null;
  }

  return {
    messages,
    selectedModel,
    isStreaming,
    error,
    systemPrompt,
    sendMessage,
    clearChat,
  };
}
