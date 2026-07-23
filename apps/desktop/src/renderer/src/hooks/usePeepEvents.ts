import { useEffect } from 'react';
import { usePreviewStore, useDiagnosticsStore } from '../stores/preview-store';
import { useChatStore } from '../stores/chat-store';
import { useWorkspaceStore } from '../stores/workspace-store';
import { useComposerStore } from '../stores/composer-store';

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
      const isComposer = useComposerStore.getState().isOpen;
      if (isComposer) {
        const composerStore = useComposerStore.getState();
        if (event.type === 'status') {
          composerStore.setStreamStatus(event.content);
        } else if (event.type === 'done') {
          composerStore.setStreaming(false);
          composerStore.setStreamStatus('Done!');
        } else if (event.type === 'error') {
          composerStore.setStreamStatus(`Error: ${event.content}`);
          composerStore.setStreaming(false);
        }
      } else {
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
      }
    });

    const unsubEdits = window.peep.onProposedEdits((edits) => {
      const isComposer = useComposerStore.getState().isOpen;
      const workspaceStore = useWorkspaceStore.getState();

      // Sync active editor tabs immediately so changes reflect on screen
      for (const edit of edits) {
        const existing = workspaceStore.openFiles.find((f) => f.path === edit.path);
        if (existing) {
          workspaceStore.openFile({ ...existing, content: edit.proposedContent, dirty: true });
        }
      }

      if (isComposer) {
        useComposerStore.getState().setProposedEdits(edits);
      } else {
        setProposedEdits(edits);
        
        if (edits.length > 0) {
          const workspaceStore = useWorkspaceStore.getState();
          const planFile = workspaceStore.openFiles.find(
            (f) => f.path.endsWith('.peep/plan.md') || f.path.endsWith('.peep\\plan.md')
          );
          if (planFile) {
            workspaceStore.setActiveFile(planFile.path);
          } else if (workspaceStore.project) {
            const planPath = `${workspaceStore.project.path}/.peep/plan.md`.replace(/\\/g, '/');
            void window.peep.readFile(planPath).then((content) => {
              workspaceStore.openFile({
                path: planPath,
                name: '📋 Implementation Plan',
                content,
                dirty: false,
              });
            }).catch(() => {});
          }
        }
      }
    });

    const unsubOpenFile = window.peep.onOpenFile((file) => {
      const workspaceStore = useWorkspaceStore.getState();
      workspaceStore.openFile({
        path: file.path,
        name: file.name,
        content: file.content,
        dirty: file.dirty
      });
    });

    return () => {
      unsubPreview();
      unsubDiagnostics();
      unsubLog();
      unsubAgent();
      unsubEdits();
      unsubOpenFile();
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
