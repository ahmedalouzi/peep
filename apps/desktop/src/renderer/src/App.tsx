import { useEffect, useState, lazy, Suspense } from 'react';
import { AppShell } from './layout/AppShell';
import { UpdateBanner } from './features/shared/UpdateBanner';
import { usePeepEvents } from './hooks/usePeepEvents';
import { DetachedPreview } from './features/preview/DetachedPreview';
import { useComposerStore } from './stores/composer-store';
import { useAuthStore } from './stores/auth-store';
import { useWorkspaceStore } from './stores/workspace-store';
import { useChatStore } from './stores/chat-store';
import { LoginScreen } from './features/auth/LoginScreen';
import { HomeScreen } from './features/home/HomeScreen';

const FilePicker = lazy(() => import('./features/explorer/FilePicker').then(m => ({ default: m.FilePicker })));
const SettingsModal = lazy(() => import('./features/settings/SettingsModal').then(m => ({ default: m.SettingsModal })));
const NewProjectModal = lazy(() => import('./features/project/NewProjectModal').then(m => ({ default: m.NewProjectModal })));
const OnboardingWizard = lazy(() => import('./features/onboarding/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })));
const KeyboardHelp = lazy(() => import('./features/shared/KeyboardHelp').then(m => ({ default: m.KeyboardHelp })));
const PublishModal = lazy(() => import('./features/publish/PublishModal').then(m => ({ default: m.PublishModal })));

export default function App() {
  usePeepEvents();

  const query = new URLSearchParams(window.location.search);
  const windowType = query.get('windowType');

  // ALL hooks must be declared before any conditional return
  const { authState, checkSession, setAuthState } = useAuthStore();
  const project = useWorkspaceStore((s) => s.project);
  const [globalPickerOpen, setGlobalPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  // Check session on mount
  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  // Handle transitions between authenticated home and active workspace
  useEffect(() => {
    if (authState === 'AUTHENTICATED_HOME' && project) {
      setAuthState('WORKSPACE');
    } else if (authState === 'WORKSPACE' && !project) {
      setAuthState('AUTHENTICATED_HOME');
    }
  }, [project, authState, setAuthState]);

  const loadHistory = useChatStore((s) => s.loadHistory);
  useEffect(() => {
    if (project?.path) {
      void loadHistory(project.path);
    }
  }, [project?.path, loadHistory]);

  useEffect(() => {
    void window.peep.getSettings().then((settings) => {
      setShowOnboarding(!settings.onboardingCompleted);
    });
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const ctrl = event.ctrlKey || event.metaKey;
      const key  = event.key.toLowerCase();

      if (ctrl && key === 'p') { event.preventDefault(); setGlobalPickerOpen(true); }
      if (ctrl && key === ',') { event.preventDefault(); setSettingsOpen(true); }
      if (ctrl && key === 'n') { event.preventDefault(); setNewProjectOpen(true); }
      if (ctrl && key === 'i') {
        event.preventDefault();
        const { isOpen, setOpen } = useComposerStore.getState();
        setOpen(!isOpen);
      }
      if (event.key === 'F1' || (event.shiftKey && key === '?')) {
        event.preventDefault();
        setHelpOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Custom events from UI buttons
  useEffect(() => {
    const onOpenPicker = () => setGlobalPickerOpen(true);
    const onOpenSettings = () => setSettingsOpen(true);
    const onOpenPublish = () => setPublishOpen(true);
    const onOpenComposer = (e: Event) => {
      const customEvent = e as CustomEvent<{ filePath: string }>;
      const { stageFile, setOpen } = useComposerStore.getState();
      stageFile(customEvent.detail.filePath);
      setOpen(true);
    };
    const onNewProject = () => setNewProjectOpen(true);

    window.addEventListener('peep:open-picker', onOpenPicker);
    window.addEventListener('peep:open-settings', onOpenSettings);
    window.addEventListener('peep:open-publish', onOpenPublish);
    window.addEventListener('peep:open-composer', onOpenComposer);
    window.addEventListener('peep:new-project', onNewProject);

    return () => {
      window.removeEventListener('peep:open-picker', onOpenPicker);
      window.removeEventListener('peep:open-settings', onOpenSettings);
      window.removeEventListener('peep:open-publish', onOpenPublish);
      window.removeEventListener('peep:open-composer', onOpenComposer);
      window.removeEventListener('peep:new-project', onNewProject);
    };
  }, []);

  // Early return for detached preview window — AFTER all hooks
  if (windowType === 'preview') {
    return <DetachedPreview />;
  }

  if (authState === 'BOOTING' || authState === 'AUTHENTICATING') {
    return (
      <div style={{ display: 'flex', flex: 1, height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0b0e', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255, 255, 255, 0.05)', borderTopColor: '#60a5fa', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: '13px', fontWeight: 500, letterSpacing: '0.05em' }}>Loading Workspace…</span>
        </div>
      </div>
    );
  }

  if (authState === 'LOGIN') {
    return <LoginScreen />;
  }

  if (authState === 'AUTHENTICATED_HOME') {
    return (
      <>
        <UpdateBanner />
        <HomeScreen />
        <Suspense fallback={null}>
          {settingsOpen && <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
          {newProjectOpen && (
            <NewProjectModal
              open={newProjectOpen}
              onClose={() => setNewProjectOpen(false)}
              onCreated={() => undefined}
            />
          )}
          {helpOpen && <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />}
        </Suspense>
      </>
    );
  }

  if (showOnboarding === null) return null;

  return (
    <>
      <UpdateBanner />

      <AppShell
        onOpenSettings={() => setSettingsOpen(true)}
        onNewProject={() => setNewProjectOpen(true)}
      />

      <Suspense fallback={null}>
        {globalPickerOpen && <FilePicker open={globalPickerOpen} onClose={() => setGlobalPickerOpen(false)} />}
        {settingsOpen && <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
        {newProjectOpen && (
          <NewProjectModal
            open={newProjectOpen}
            onClose={() => setNewProjectOpen(false)}
            onCreated={() => undefined}
          />
        )}
        {publishOpen && <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} />}
        {helpOpen && <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />}
        {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}
      </Suspense>
    </>
  );
}
