import {
  Bot,
  Check,
  ChevronDown,
  CircleStop,
  Menu,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  RefreshCw,
  SendHorizontal,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const suggestions = [
  "Explain recursion with a simple analogy",
  "Write a Python function to sort a list",
  "Give me three ideas for a weekend project",
  "Summarize how large language models work",
];

function formatThreadTime(value) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function ChatTemplate({ state, actions, refs }) {
  const {
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
    threadCount,
  } = state;

  const {
    checkConnection,
    closeSidebar,
    deleteThread,
    handleKeyDown,
    openSidebar,
    selectModel,
    selectThread,
    sendMessage,
    setInput,
    startNewChat,
    stopStreaming,
    toggleThreadMenu,
  } = actions;

  const { messagesEndRef, textareaRef } = refs;

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          type="button"
          aria-label="Close sidebar"
          onClick={closeSidebar}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark">
            <Sparkles size={18} strokeWidth={2.2} />
          </div>
          <div className="brand-copy">
            <strong>Local chat</strong>
            <span>Powered by Ollama</span>
          </div>
          <button
            className="icon-button sidebar-close"
            type="button"
            aria-label="Close sidebar"
            onClick={closeSidebar}
          >
            <PanelLeftClose size={19} />
          </button>
        </div>

        <button className="new-chat-button" type="button" onClick={startNewChat}>
          <Plus size={18} />
          New conversation
        </button>

        <div className="thread-heading">
          <span>Recent chats</span>
          <span>{threadCount}</span>
        </div>

        <nav className="thread-list" aria-label="Saved conversations">
          {sortedThreads.length === 0 ? (
            <div className="empty-threads">
              <MessageSquare size={21} />
              <p>Your conversations will appear here.</p>
            </div>
          ) : (
            sortedThreads.map((thread) => (
              <div
                className={`thread-item ${thread.id === activeThreadId ? "thread-item--active" : ""}`}
                key={thread.id}
              >
                <button
                  className="thread-select"
                  type="button"
                  onClick={() => selectThread(thread.id)}
                >
                  <MessageSquare size={16} />
                  <span className="thread-copy">
                    <strong>{thread.title}</strong>
                    <small>{formatThreadTime(thread.updatedAt)}</small>
                  </span>
                </button>
                <button
                  className="thread-menu-button"
                  type="button"
                  aria-label={`Actions for ${thread.title}`}
                  onClick={() => toggleThreadMenu(thread.id)}
                >
                  <MoreHorizontal size={17} />
                </button>
                {openMenuId === thread.id && (
                  <div className="thread-menu">
                    <button type="button" onClick={() => deleteThread(thread.id)}>
                      <Trash2 size={15} /> Delete chat
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </nav>

        <div className="sidebar-footer">
          <span className={`status-dot status-dot--${connection}`} />
          <div>
            <strong>
              {connection === "online"
                ? "Ollama connected"
                : connection === "checking"
                  ? "Checking Ollama"
                  : "Ollama offline"}
            </strong>
            <span>{connection === "online" ? "Running locally" : "Check your API server"}</span>
          </div>
          <button type="button" aria-label="Check connection" onClick={checkConnection}>
            <RefreshCw size={15} className={connection === "checking" ? "spin" : ""} />
          </button>
        </div>
      </aside>

      <main className="chat-panel">
        <header className="chat-header">
          <button
            className="icon-button mobile-menu"
            type="button"
            aria-label="Open sidebar"
            onClick={openSidebar}
          >
            <Menu size={21} />
          </button>
          <div className="header-title">
            <strong>{activeThread?.title ?? "New conversation"}</strong>
            <span>Private conversations, stored in this browser</span>
          </div>
          <label className="model-select">
            <Bot size={16} />
            <select value={selectedModel} onChange={selectModel} aria-label="Chat model">
              {models.length === 0 && <option value={selectedModel}>{selectedModel}</option>}
              {models.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
        </header>

        <section className={`conversation ${!activeThread ? "conversation--empty" : ""}`}>
          {!activeThread ? (
            <div className="welcome">
              <div className="welcome-mark"><Sparkles size={29} /></div>
              <p className="eyebrow">YOUR PRIVATE AI WORKSPACE</p>
              <h1>What can I help you explore?</h1>
              <p className="welcome-copy">
                Ask a question, write some code, or think through an idea. Your chats stay
                saved in this browser and your model runs through Ollama.
              </p>
              <div className="suggestion-grid">
                {suggestions.map((suggestion, index) => (
                  <button
                    type="button"
                    key={suggestion}
                    onClick={(event) => sendMessage(event, suggestion)}
                  >
                    <span>0{index + 1}</span>
                    {suggestion}
                    <SendHorizontal size={15} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {activeThread.messages.map((message, index) => (
                <article
                  className={`message message--${message.role} ${message.error ? "message--error" : ""}`}
                  key={message.id}
                >
                  <div className="message-avatar">
                    {message.role === "assistant" ? <Sparkles size={17} /> : <UserRound size={17} />}
                  </div>
                  <div className="message-body">
                    <div className="message-meta">
                      <strong>{message.role === "assistant" ? "Ollama" : "You"}</strong>
                      {message.role === "assistant"
                        && index === activeThread.messages.length - 1
                        && isStreaming && <span className="writing-label">writing</span>}
                    </div>
                    {message.content ? (
                      message.role === "assistant" ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                      ) : (
                        <p>{message.content}</p>
                      )
                    ) : (
                      <div className="typing-indicator" aria-label="Ollama is writing">
                        <span /><span /><span />
                      </div>
                    )}
                  </div>
                </article>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </section>

        <footer className="composer-area">
          <form className="composer" onSubmit={sendMessage}>
            <textarea
              ref={textareaRef}
              value={input}
              rows={1}
              disabled={isStreaming}
              placeholder={isStreaming ? "Ollama is responding…" : "Message your local model…"}
              aria-label="Message"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            {isStreaming ? (
              <button
                className="send-button stop-button"
                type="button"
                onClick={stopStreaming}
                aria-label="Stop response"
              >
                <CircleStop size={19} />
              </button>
            ) : (
              <button
                className="send-button"
                type="submit"
                disabled={!input.trim()}
                aria-label="Send message"
              >
                <SendHorizontal size={19} />
              </button>
            )}
          </form>
          <p className="composer-hint">
            <span><Check size={12} /> Chats saved locally</span>
            <span>Enter to send · Shift + Enter for a new line</span>
          </p>
        </footer>
      </main>
    </div>
  );
}

export default ChatTemplate;
