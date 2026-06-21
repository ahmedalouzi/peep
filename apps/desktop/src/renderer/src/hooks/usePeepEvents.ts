import { useEffect } from 'react';
import { usePreviewStore, useDiagnosticsStore } from '../stores/preview-store';
import { useChatStore } from '../stores/chat-store';

export function usePeepEvents(): void {
  const setSession = usePreviewStore((s) => s.setSession);
  const addLog = usePreviewStore((s) => s.addLog);
  const bumpIframe = usePreviewStore((s) => s.bumpIframe);
  const setDiagnostics = useDiagnosticsStore((s) => s.setItems);

  const appendDelta = useChatStore((s) => s.appendToStreamingMessage);
  const setStreamStatus = useChatStore((s) => s.setStreamStatus);
  const finishStreaming = useChatStore((s) => s.finishStreaming);
  const setProposedEdits = useChatStore((s) => s.setProposedEdits);

  useEffect(() => {
    void window.peep.getPendingEdits().then(setProposedEdits);

    const unsubPreview = window.peep.onPreviewStatus((session) => {
      setSession(session);
      if (session.status === 'running') bumpIframe();
    });

    const unsubDiagnostics = window.peep.onDiagnostics(setDiagnostics);
    const unsubLog = window.peep.onPreviewLog(addLog);

    const unsubAgent = window.peep.onAgentStream((event) => {
      if (event.type === 'status') {
        setStreamStatus(event.content);
      } else if (event.type === 'delta') {
        appendDelta(event.content);
      } else if (event.type === 'done') {
        finishStreaming();
      } else if (event.type === 'error') {
        appendDelta(`\n\n⚠️ ${event.content}`);
        finishStreaming();
      }
    });

    const unsubEdits = window.peep.onProposedEdits(setProposedEdits);

    return () => {
      unsubPreview();
      unsubDiagnostics();
      unsubLog();
      unsubAgent();
      unsubEdits();
    };
  }, [
    setSession,
    addLog,
    bumpIframe,
    setDiagnostics,
    appendDelta,
    setStreamStatus,
    finishStreaming,
    setProposedEdits,
  ]);
}
