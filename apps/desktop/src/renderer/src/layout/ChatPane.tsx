import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createTwoFilesPatch } from 'diff';
import { useChatStore } from '../stores/chat-store';
import { useWorkspaceStore } from '../stores/workspace-store';
import { useDiagnosticsStore, usePreviewStore } from '../stores/preview-store';

interface ChatPaneProps {
  onOpenSettings: () => void;
}

function getDiffStats(original: string, proposed: string) {
  let added = 0;
  let removed = 0;
  try {
    const patch = createTwoFilesPatch('a', 'b', original, proposed);
    const lines = patch.split('\n');
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        added++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        removed++;
      }
    }
  } catch (e) {
    console.error(e);
  }
  return { added, removed };
}

export function ChatPane({ onOpenSettings: _onOpenSettings }: ChatPaneProps) {
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
  const activeFile = openFiles.find((f) => f.path === activeFilePath) ?? null;
  const diagnostics = useDiagnosticsStore((s) => s.items);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);


  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [changesBarExpanded, setChangesBarExpanded] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const MODELS = [
    { name: 'gemini-3.5-flash', label: 'gemini-3.5-flash', provider: 'google', badge: 'Fast' },
    { name: 'gemini-3.1-pro', label: 'gemini-3.1-pro', provider: 'google' },
    { name: 'gemini-3', label: 'gemini-3', provider: 'google' },
    { name: 'gemini-3-flash', label: 'gemini-3-flash', provider: 'google', badge: 'Fast' },
    { name: 'gemini-2.5-flash', label: 'gemini-2.5-flash', provider: 'google', badge: 'Fast' },
    { name: 'gemini-1.5-flash', label: 'gemini-1.5-flash', provider: 'google', badge: 'Fast' },
    { name: 'gemini-1.5-pro', label: 'gemini-1.5-pro', provider: 'google' },
    { name: 'gpt-4o-mini', label: 'gpt-4o-mini', provider: 'openai', badge: 'Fast' },
    { name: 'gpt-4o', label: 'gpt-4o', provider: 'openai' },
    { name: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo', provider: 'openai' },
    { name: 'o1-mini', label: 'o1-mini', provider: 'openai', badge: 'Reasoning' },
    { name: 'o3-mini', label: 'o3-mini', provider: 'openai', badge: 'Reasoning' },
    { name: 'claude-3-5-sonnet', label: 'claude-3-5-sonnet', provider: 'openai', badge: 'Coding' },
    { name: 'claude-3-5-haiku', label: 'claude-3-5-haiku', provider: 'openai', badge: 'Fast' },
    { name: 'claude-3-opus', label: 'claude-3-opus', provider: 'openai' },
    { name: 'llama-3.3-70b', label: 'llama-3.3-70b', provider: 'openai' },
    { name: 'codestral', label: 'codestral', provider: 'openai', badge: 'Coding' },
  ];

  const fetchSettings = () => {
    void window.peep.getSettings().then((s) => {
      setSelectedModel(s.apiModel ?? 'gpt-4o-mini');
    });
  };

  useEffect(() => {
    fetchSettings();
    window.addEventListener('peep:settings-closed', fetchSettings);
    return () => window.removeEventListener('peep:settings-closed', fetchSettings);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamStatus, proposedEdits]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleTriggerAgent = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; previewError?: string }>;
      const { message, previewError } = customEvent.detail;

      addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
      });
      setInput('');

      const assistantId = crypto.randomUUID();
      startStreaming(assistantId);

      void window.peep.sendAgentMessage({
        message,
        history: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        projectPath: project?.path,
        openFilePath: activeFile?.path,
        openFileContent: activeFile?.content,
        diagnostics,
        previewError,
      });
    };

    window.addEventListener('peep:trigger-agent', handleTriggerAgent as EventListener);
    return () => window.removeEventListener('peep:trigger-agent', handleTriggerAgent as EventListener);
  }, [messages, project, activeFile, diagnostics]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    });
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const assistantId = crypto.randomUUID();
    startStreaming(assistantId);

    void window.peep.sendAgentMessage({
      message: trimmed,
      history: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      projectPath: project?.path,
      openFilePath: activeFile?.path,
      openFileContent: activeFile?.content,
      diagnostics,
      autoApplyEdits: true,
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
    <div className="agent-panel">
      <div className="agent-header">
        <span className="agent-title">Agent</span>
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <div
            className="agent-model-badge"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <div className="agent-ai-dot"></div>
            {selectedModel}
            <svg style={{ width: '9px', height: '9px', stroke: 'currentColor', fill: 'none', strokeWidth: '2', marginLeft: '4px' }} viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" /></svg>
          </div>
          {isModelDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: '4px',
              background: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: '6px',
              padding: '4px 0',
              zIndex: 100,
              width: 'max-content',
              minWidth: '180px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}>
              <div style={{ padding: '2px 10px', fontSize: '10px', color: '#8b949e', marginBottom: '2px' }}>Model</div>
              {MODELS.map(model => (
                <div
                  key={model.name}
                  onClick={async () => {
                    setSelectedModel(model.name);
                    setIsModelDropdownOpen(false);
                    await window.peep.setSettings({
                      apiModel: model.name,
                      apiProvider: model.provider as any,
                    });
                  }}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    color: selectedModel === model.name ? 'var(--gold)' : '#c9d1d9',
                    background: selectedModel === model.name ? 'var(--gold-dim)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = selectedModel === model.name ? 'var(--gold-dim)' : 'rgba(255,255,255,0.04)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = selectedModel === model.name ? 'var(--gold-dim)' : 'transparent'}
                >
                  <span>{model.name}</span>
                  {model.badge && (
                    <span style={{
                      fontSize: '9px',
                      background: 'rgba(255,255,255,0.06)',
                      padding: '2px 4px',
                      borderRadius: '8px',
                      color: selectedModel === model.name ? 'var(--gold)' : '#8b949e',
                    }}>{model.badge}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="agent-messages">
        {messages.length === 0 ? (
          <div className="msg-system">
            <div className="msg-avatar">Ag</div>
            <div className="msg-body">
              <div className="msg-sender">Antigravity AI</div>
              <div className="msg-text">
                Ask anything. Use <code style={{ color: 'var(--gold)', fontFamily: 'var(--font-code)', fontSize: '10px', background: 'var(--gold-dim)', padding: '1px 4px', borderRadius: '3px' }}>@</code> to mention context, <code style={{ color: 'var(--gold)', fontFamily: 'var(--font-code)', fontSize: '10px', background: 'var(--gold-dim)', padding: '1px 4px', borderRadius: '3px' }}>/</code> for actions.
              </div>
              <div className="msg-hint">Powered by Gemini 3.1 Pro - Context-aware - Multimodal</div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, idx) => {
              const isLastAssistantMessage = message.role === 'assistant' && idx === messages.length - 1;
              return (
                <div key={message.id} className={`chat-message chat-message--${message.role}`}>
                  <span className="chat-message__role">{message.role === 'user' ? 'You' : 'Agent'}</span>
                  <p dangerouslySetInnerHTML={{ __html: (message.content || (isStreaming && message.role === 'assistant' ? '…' : '')).replace(/\n/g, '<br />') }} />

                  {isLastAssistantMessage && proposedEdits.length > 0 && (
                    <div className="proposed-changes-chat-card" onClick={(e) => e.stopPropagation()}>
                      <div className="proposed-card-header">
                        <span className="proposed-card-icon">📄</span>
                        <span className="proposed-card-title">Proposed Code Edits</span>
                      </div>
                      <div className="proposed-card-files">
                        {proposedEdits.map((edit) => {
                          const stats = getDiffStats(edit.originalContent, edit.proposedContent);
                          return (
                            <div key={edit.id} className="proposed-card-file-row">
                              <span className="file-name">{edit.path.split(/[\\/]/).pop()}</span>
                              <span className="file-stats">
                                <span className="additions">+{stats.added}</span>
                                <span className="deletions">-{stats.removed}</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="proposed-card-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-reject-proposed"
                          onClick={() => handleReject(proposedEdits.map((e) => e.id))}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-apply-proposed"
                          onClick={() => handleApply(proposedEdits.map((e) => e.id))}
                        >
                          Apply Changes
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {proposedEdits.length > 0 && (
        <div className="changes-summary-bar-container">
          {changesBarExpanded && (
            <div className="changes-summary-dropdown">
              {proposedEdits.map((edit) => {
                const stats = getDiffStats(edit.originalContent, edit.proposedContent);
                return (
                  <div
                    key={edit.id}
                    className="changes-summary-row"
                    onClick={() => {
                      openFile({
                        path: edit.path,
                        name: edit.path.split(/[\\/]/).pop() ?? edit.path,
                        content: edit.proposedContent,
                        dirty: true,
                      });
                    }}
                  >
                    <span className="changes-row-dot">●</span>
                    <span className="changes-row-stats">
                      <span className="additions">+{stats.added}</span>
                      <span className="deletions">-{stats.removed}</span>
                    </span>
                    <span className="changes-row-filename">{edit.path.split(/[\\/]/).pop()}</span>
                    <span className="changes-row-path">{edit.path}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="changes-summary-bar">
            <span className="summary-left" onClick={() => setChangesBarExpanded(!changesBarExpanded)}>
              📄 {proposedEdits.length} Files With Changes
            </span>
            <div className="summary-right">
              <button
                type="button"
                className="btn btn-ghost summary-btn-reject"
                onClick={() => handleReject(proposedEdits.map((e) => e.id))}
              >
                Reject all
              </button>
              <button
                type="button"
                className="summary-btn-accept"
                onClick={() => handleApply(proposedEdits.map((e) => e.id))}
              >
                Accept all
              </button>
              <button
                type="button"
                className="summary-chevron-btn"
                onClick={() => setChangesBarExpanded(!changesBarExpanded)}
              >
                {changesBarExpanded ? '▼' : '▲'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="chat-pane__input-wrapper">
        {isStreaming && streamStatus && (
          <div className="agent-streaming-status-bar">
            <span className="spinner">◌</span> {streamStatus}
          </div>
        )}

        <div className="chat-pane__input">
          <div className="chat-pane__input-toolbar">
            <button type="button" className="icon-btn" title="Attach context">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
            <div className="spacer" />
            <button type="button" className="icon-btn" title="Voice input">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" /></svg>
            </button>
          </div>

          <form className="agent-input-area" onSubmit={handleSubmit}>
            <div className="agent-input-wrap">
              <textarea
                ref={textareaRef}
                className="agent-input"
                placeholder="Ask the agent..."
                value={input}
                rows={1}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              ></textarea>
              <button type="submit" className="agent-send" disabled={!input.trim() || isStreaming}>
                <svg style={{ width: '14px', height: '14px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z" /></svg>
              </button>
            </div>
            <div className="agent-footer-text">{selectedModel} · Context: {activeFile?.name ?? 'None'}</div>
          </form>
        </div>
      </div>
    </div>
  );
}
