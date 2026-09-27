import { useEffect, useMemo, useRef, useState } from "react";

import ChatTemplate from "./ChatTemplate.jsx";

const THREADS_KEY = "ollama-chat-threads-v1";
const MODEL_KEY = "ollama-chat-model-v1";
const DEFAULT_MODEL = "qwen2.5:7b";

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function loadThreads() {
  try {
    const value = JSON.parse(localStorage.getItem(THREADS_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

const initialThreads = loadThreads();

function threadTitle(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 42 ? `${clean.slice(0, 42)}...` : clean;
}

function App() {
  const [threads, setThreads] = useState(initialThreads);
  const [activeThreadId, setActiveThreadId] = useState(initialThreads[0]?.id ?? null);
  const [input, setInput] = useState("");
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(
    () => localStorage.getItem(MODEL_KEY) || DEFAULT_MODEL,
  );
  const [connection, setConnection] = useState("checking");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [threads, activeThreadId],
  );

  const sortedThreads = useMemo(
    () => [...threads].sort((a, b) => b.updatedAt - a.updatedAt),
    [threads],
  );

  useEffect(() => {
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
  }, [threads]);

  useEffect(() => {
    localStorage.setItem(MODEL_KEY, selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeThread?.messages, isStreaming]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [input]);

  async function checkConnection() {
    setConnection("checking");
    try {
      const response = await fetch("/api/models");
      if (!response.ok) throw new Error("Ollama is unavailable");
      const data = await response.json();
      const availableModels = data.models ?? [];
      setModels(availableModels);
      if (availableModels.length && !availableModels.includes(selectedModel)) {
        setSelectedModel(availableModels[0]);
      }
      setConnection("online");
    } catch {
      setConnection("offline");
    }
  }

  function updateThread(id, updater) {
    setThreads((current) =>
      current.map((thread) => (thread.id === id ? updater(thread) : thread)),
    );
  }

  function startNewChat() {
    abortRef.current?.abort();
    setIsStreaming(false);
    setActiveThreadId(null);
    setInput("");
    setSidebarOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function selectThread(id) {
    setActiveThreadId(id);
    setSidebarOpen(false);
  }

  function deleteThread(id) {
    setThreads((current) => {
      const remaining = current.filter((thread) => thread.id !== id);
      if (activeThreadId === id) setActiveThreadId(remaining[0]?.id ?? null);
      return remaining;
    });
    setOpenMenuId(null);
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  async function sendMessage(event, suggestedPrompt) {
    event?.preventDefault();
    const content = (suggestedPrompt ?? input).trim();
    if (!content || isStreaming) return;

    const now = Date.now();
    const threadId = activeThread?.id ?? makeId();
    const userMessage = { id: makeId(), role: "user", content };
    const assistantMessage = { id: makeId(), role: "assistant", content: "" };
    const previousMessages = activeThread?.messages ?? [];
    const nextMessages = [...previousMessages, userMessage, assistantMessage];

    if (activeThread) {
      updateThread(threadId, (thread) => ({
        ...thread,
        messages: nextMessages,
        updatedAt: now,
      }));
    } else {
      setThreads((current) => [
        {
          id: threadId,
          title: threadTitle(content),
          messages: nextMessages,
          createdAt: now,
          updatedAt: now,
        },
        ...current,
      ]);
      setActiveThreadId(threadId);
    }

    setInput("");
    setSidebarOpen(false);
    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    let receivedText = "";

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: selectedModel,
          messages: [...previousMessages, userMessage].map(({ role, content: text }) => ({
            role,
            content: text,
          })),
        }),
      });

      if (!response.ok) {
        let detail = `Request failed with status ${response.status}`;
        try {
          const data = await response.json();
          detail = data.detail || detail;
        } catch {
          // Keep the status-based message when the body is not JSON.
        }
        throw new Error(detail);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        receivedText += chunk;
        updateThread(threadId, (thread) => ({
          ...thread,
          updatedAt: Date.now(),
          messages: thread.messages.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, content: message.content + chunk }
              : message,
          ),
        }));
      }
      setConnection("online");
    } catch (error) {
      const message =
        error.name === "AbortError"
          ? receivedText
            ? ""
            : "Response stopped."
          : `I couldn't complete that request. ${error.message}`;

      if (message) {
        updateThread(threadId, (thread) => ({
          ...thread,
          messages: thread.messages.map((item) =>
            item.id === assistantMessage.id
              ? { ...item, content: message, error: true }
              : item,
          ),
        }));
      }
      if (error.name !== "AbortError") setConnection("offline");
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <ChatTemplate
      state={{
        activeThread,
        activeThreadId,
        connection,
        input,
        isStreaming,
        models,
        openMenuId,
        selectedModel,
        sidebarOpen,
        sortedThreads,
        threadCount: threads.length,
      }}
      actions={{
        checkConnection,
        closeSidebar: () => setSidebarOpen(false),
        deleteThread,
        handleKeyDown,
        openSidebar: () => setSidebarOpen(true),
        selectModel: (event) => setSelectedModel(event.target.value),
        selectThread,
        sendMessage,
        setInput,
        startNewChat,
        stopStreaming,
        toggleThreadMenu: (id) => setOpenMenuId(openMenuId === id ? null : id),
      }}
      refs={{ messagesEndRef, textareaRef }}
    />
  );
}

export default App;
