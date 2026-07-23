import { useEffect, useState } from 'react';
import { AppShell } from './layout/AppShell';
import { FilePicker } from './features/explorer/FilePicker';
import { SettingsModal } from './features/settings/SettingsModal';
import { NewProjectModal } from './features/project/NewProjectModal';
import { OnboardingWizard } from './features/onboarding/OnboardingWizard';
import { UpdateBanner } from './features/shared/UpdateBanner';
import { KeyboardHelp } from './features/shared/KeyboardHelp';
import { usePeepEvents } from './hooks/usePeepEvents';
import { DetachedPreview } from './features/preview/DetachedPreview';
import { PublishModal } from './features/publish/PublishModal';
import { useComposerStore } from './stores/composer-store';

export default function App() {
  usePeepEvents();

  const query = new URLSearchParams(window.location.search);
  const windowType = query.get('windowType');

  // ALL hooks must be declared before any conditional return
  const [globalPickerOpen, setGlobalPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

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

  if (showOnboarding === null) return null;

  return (
    <>
      <UpdateBanner />

      <AppShell
        onOpenSettings={() => setSettingsOpen(true)}
        onNewProject={() => setNewProjectOpen(true)}
      />

      <FilePicker open={globalPickerOpen} onClose={() => setGlobalPickerOpen(false)} />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreated={() => undefined}
      />

      <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} />

      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />

      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
      )}
    </>
  );
}
