import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { DiffViewer } from '../features/chat/DiffViewer';
import { useChatStore } from '../stores/chat-store';
import { useWorkspaceStore } from '../stores/workspace-store';
import { useDiagnosticsStore, usePreviewStore } from '../stores/preview-store';

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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [selectedModel, setSelectedModel] = useState('Gemini 3.1 Pro (High)');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const AI_MODELS = [
    { id: 'gemini-3.5-flash-medium', name: 'Gemini 3.5 Flash (Medium)', badge: 'Fast ⓘ' },
    { id: 'gemini-3.5-flash-high', name: 'Gemini 3.5 Flash (High)', badge: 'Fast ⓘ' },
    { id: 'gemini-3.5-flash-low', name: 'Gemini 3.5 Flash (Low)', badge: 'Fast ⓘ' },
    { id: 'gemini-3.1-pro-low', name: 'Gemini 3.1 Pro (Low)' },
    { id: 'gemini-3.1-pro-high', name: 'Gemini 3.1 Pro (High)' },
    { id: 'claude-sonnet-4.6', name: 'Claude Sonnet 4.6 (Thinking)' },
    { id: 'claude-opus-4.6', name: 'Claude Opus 4.6 (Thinking)' },
    { id: 'gpt-oss-120b', name: 'GPT-OSS 120B (Medium)' },
  ];

  const activeFile = openFiles.find((f) => f.path === activeFilePath);

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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    if (!project) {
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Open a project first.',
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
            <svg style={{width:'9px',height:'9px',stroke:'currentColor',fill:'none',strokeWidth:'2',marginLeft:'4px'}} viewBox="0 0 16 16"><path d="M4 6l4 4 4-4"/></svg>
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
              {AI_MODELS.map(model => (
                <div 
                  key={model.id}
                  onClick={() => { setSelectedModel(model.name); setIsModelDropdownOpen(false); }}
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
                Ask anything. Use <code style={{color:'var(--gold)',fontFamily:'var(--font-code)',fontSize:'10px',background:'var(--gold-dim)',padding:'1px 4px',borderRadius:'3px'}}>@</code> to mention context, <code style={{color:'var(--gold)',fontFamily:'var(--font-code)',fontSize:'10px',background:'var(--gold-dim)',padding:'1px 4px',borderRadius:'3px'}}>/</code> for actions.
              </div>
              <div className="msg-hint">Powered by Gemini 3.1 Pro - Context-aware - Multimodal</div>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="msg-system">
              <div className="msg-avatar" style={message.role === 'user' ? {background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)'} : {}}>
                {message.role === 'user' ? 'U' : 'Ag'}
              </div>
              <div className="msg-body">
                <div className="msg-sender" style={message.role === 'user' ? {color: 'var(--text-secondary)'} : {}}>
                  {message.role === 'user' ? 'You' : 'Antigravity AI'}
                </div>
                <div className="msg-text" style={message.role === 'user' ? {borderColor: 'var(--border-bright)'} : {}}>
                  {message.content || (isStreaming && message.role === 'assistant' ? '…' : '')}
                </div>
              </div>
            </div>
          ))
        )}
        {isStreaming && streamStatus && (
          <div className="msg-hint" style={{textAlign: 'center'}}>{streamStatus}</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <DiffViewer edits={proposedEdits} onApply={handleApply} onReject={handleReject} />

      <div className="agent-quick-actions">
        <button className="quick-action" onClick={() => { useChatStore.getState().clearMessages?.(); }}>+ New Chat</button>
        <button className="quick-action" onClick={onOpenSettings}>⚙ Settings</button>
        {isStreaming && <button className="quick-action" onClick={() => void window.peep.cancelAgent()}>◼ Stop</button>}
      </div>

      <form className="agent-input-area" onSubmit={handleSubmit}>
        <div className="agent-input-wrap">
          <textarea 
            className="agent-input" 
            placeholder="Ask the agent..."
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          ></textarea>
          <button type="submit" className="agent-send" disabled={!input.trim() || isStreaming}>
            <svg style={{width:'14px',height:'14px'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
        <div className="agent-footer-text">{selectedModel} · Context: {activeFile?.name ?? 'None'}</div>
      </form>
    </div>
  );
}
