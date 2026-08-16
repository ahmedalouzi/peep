import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chat-store';

const ICONS: Record<string, string> = {
  understanding: '🧠',
  reading: '📖',
  exploring: '🔍',
  searching: '🔎',
  editing: '✏️',
  running: '▶️',
  validating: '🧪',
  error: '❌',
  completed: '✅',
};

export function AgentTimeline() {
  const activities = useChatStore((s) => s.timelineActivities);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activities]);

  if (activities.length === 0) return null;

  return (
    <div className="agent-timeline" style={{
      margin: '12px 16px',
      padding: '12px',
      background: 'var(--bg-secondary)',
      borderRadius: '8px',
      border: '1px solid var(--border)',
      fontFamily: 'var(--font-system)'
    }}>
      <div className="agent-timeline-header" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        <span className="agent-timeline-title">Agent Execution Timeline</span>
        {isStreaming && <span className="agent-timeline-spinner spinner">◌</span>}
      </div>
      <div className="agent-timeline-list" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxHeight: '300px',
        overflowY: 'auto'
      }}>
        {activities.map((act) => {
          const icon = ICONS[act.type] || '⚙️';
          const isError = act.status === 'failed' || act.type === 'error';
          const isDone = act.status === 'completed' || act.type === 'completed';
          const isInProgress = act.status === 'in_progress';
          
          return (
            <div key={act.id} className={`agent-timeline-item ${act.status}`} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '13px',
              color: isError ? '#f85149' : (isDone ? '#8b949e' : '#c9d1d9'),
              opacity: isDone ? 0.8 : 1,
            }}>
              <div className="agent-timeline-icon" style={{ 
                width: '16px', 
                textAlign: 'center',
                filter: isDone && act.type !== 'completed' ? 'grayscale(100%) opacity(0.7)' : 'none'
              }}>
                {isError ? '❌' : (isDone && act.type !== 'completed' ? '✓' : icon)}
              </div>
              <div className="agent-timeline-content" style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1
              }}>
                <span className="agent-timeline-message" style={{
                  textDecoration: isDone && act.type !== 'completed' ? 'line-through' : 'none',
                  textDecorationColor: 'rgba(255,255,255,0.2)'
                }}>
                  {act.message}
                </span>
                {(act.file || act.command) && (
                  <span className="agent-timeline-detail" style={{
                    fontSize: '11px',
                    color: '#8b949e',
                    fontFamily: 'var(--font-code)',
                    marginTop: '2px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '300px'
                  }}>
                    {act.file ? `📄 ${act.file.split(/[\\/]/).pop()}` : ''}
                    {act.command ? `> ${act.command}` : ''}
                  </span>
                )}
              </div>
              {isInProgress && (
                <div className="agent-timeline-pulse spinner" style={{ color: 'var(--gold)' }}>◌</div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
