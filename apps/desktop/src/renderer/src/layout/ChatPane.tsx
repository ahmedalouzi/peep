import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { DiffViewer } from '../features/chat/DiffViewer';
import { useChatStore } from '../stores/chat-store';
import { useWorkspaceStore } from '../stores/workspace-store';
import { useDiagnosticsStore, usePreviewStore } from '../stores/preview-store';
import './ChatPane.css';

interface ChatPaneProps {
  onOpenSettings: () => void;
}

export function ChatPane({ onOpenSettings }: ChatPaneProps) {
  const {
    messages,
    input,
    isStreaming,
    streamStatus,
    proposedEdits,
    setInput,
    addMessage,
    startStreaming,
    setProposedEdits,
  } = useChatStore();

  const project = useWorkspaceStore((s) => s.project);
  const activeFilePath = useWorkspaceStore((s) => s.activeFilePath);
  const openFiles = useWorkspaceStore((s) => s.openFiles);
  const openFile = useWorkspaceStore((s) => s.openFile);
  const diagnostics = useDiagnosticsStore((s) => s.items);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showModelSelect, setShowModelSelect] = useState(false);
  const [selectedModel, setSelectedModel] = useState('Gemini 3.1 Pro (High)');

  const MODELS = [
    { name: 'Gemini 3.5 Flash (Medium)', badge: 'Fast' },
    { name: 'Gemini 3.5 Flash (High)', badge: 'Fast' },
    { name: 'Gemini 3.5 Flash (Low)', badge: 'Fast' },
    { name: 'Gemini 3.1 Pro (Low)' },
    { name: 'Gemini 3.1 Pro (High)' },
    { name: 'Claude Sonnet 4.6 (Thinking)', alert: true },
    { name: 'Claude Opus 4.6 (Thinking)', alert: true },
    { name: 'GPT-OSS 120B (Medium)', alert: true }
  ];

  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamStatus, proposedEdits]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    if (!project) {
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Open a Flutter project first.',
        createdAt: new Date().toISOString(),
      });
      return;
    }

    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    });
    setInput('');

    const assistantId = crypto.randomUUID();
    startStreaming(assistantId);

    void window.peep.sendAgentMessage({
      message: trimmed,
      history: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      projectPath: project.path,
      openFilePath: activeFile?.path,
      openFileContent: activeFile?.content,
      diagnostics,
    });
  };

  const handleApply = (editIds: string[]) => {
    const applied = proposedEdits.filter((e) => editIds.includes(e.id));
    void window.peep.applyAgentEdits(editIds).then(async () => {
      for (const edit of applied) {
        const existing = openFiles.find((f) => f.path === edit.path);
        if (existing) {
          const content = await window.peep.readFile(edit.path);
          openFile({ ...existing, content, dirty: false });
        }
      }
      void window.peep.getPendingEdits().then(setProposedEdits);
      usePreviewStore.getState().bumpIframe();
    });
  };

  const handleReject = (editIds: string[]) => {
    void window.peep.rejectAgentEdits(editIds).then(() => {
      void window.peep.getPendingEdits().then(setProposedEdits);
    });
  };

  return (
    <section className="panel chat-pane">
      <div className="panel-header">
        <span className="panel-title">Agent</span>
        <div className="panel-actions">
          {isStreaming && (
            <button type="button" className="btn btn-ghost" title="Stop" onClick={() => void window.peep.cancelAgent()}>
              ◼
            </button>
          )}
          <button type="button" className="btn btn-ghost" title="New conversation"
            onClick={() => { useChatStore.getState().clearMessages?.(); }}
          >
            +
          </button>
          <button type="button" className="btn btn-ghost" title="Settings" onClick={onOpenSettings}>
            ⚙
          </button>
        </div>
      </div>

      <div className="panel-body chat-pane__messages">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            Ask anything, @ to mention, / for actions.
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div key={message.id} className={`chat-message chat-message--${message.role}`}>
                <span className="chat-message__role">{message.role === 'user' ? 'You' : 'Agent'}</span>
                <p>{message.content || (isStreaming && message.role === 'assistant' ? '…' : '')}</p>
              </div>
            ))}
            {isStreaming && streamStatus && (
              <div className="chat-status">{streamStatus}</div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <DiffViewer edits={proposedEdits} onApply={handleApply} onReject={handleReject} />

      <form className="chat-pane__input-wrapper" onSubmit={handleSubmit}>
        
        {showModelSelect && (
          <div className="model-dropdown">
            <div className="model-dropdown__header">Model</div>
            <div className="model-dropdown__list">
              {MODELS.map(m => (
                <button
                  key={m.name}
                  type="button"
                  className={`model-option ${selectedModel === m.name ? 'model-option--active' : ''}`}
                  onClick={() => {
                    setSelectedModel(m.name);
                    setShowModelSelect(false);
                  }}
                >
                  <span className="model-name">{m.name}</span>
                  {m.badge && <span className="model-badge">{m.badge} ⓘ</span>}
                  {m.alert && <span className="model-alert">⚠</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="chat-pane__input">
          <div className="chat-pane__input-toolbar">
            <button type="button" className="icon-btn" title="Attach context">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
            <button 
              type="button" 
              className="model-select-btn"
              onClick={() => setShowModelSelect(!showModelSelect)}
              title="Select Model (Ctrl+/)"
            >
              {selectedModel}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            <div className="spacer" />
            <button type="button" className="icon-btn" title="Voice input">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" /></svg>
            </button>
          </div>

          <textarea
            value={input}
            placeholder="Open a project to start..."
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
              if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                setShowModelSelect(s => !s);
              }
            }}
          />
          <button type="submit" className="btn btn-primary chat-submit" disabled={!input.trim() || isStreaming}>
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
