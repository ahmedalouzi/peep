import { useEffect, useState } from 'react';
import { AppShell } from './layout/AppShell';
import { FilePicker } from './features/explorer/FilePicker';
import { SettingsModal } from './features/settings/SettingsModal';
import { NewProjectModal } from './features/project/NewProjectModal';
import { OnboardingWizard } from './features/onboarding/OnboardingWizard';
import { UpdateBanner } from './features/shared/UpdateBanner';
import { KeyboardHelp } from './features/shared/KeyboardHelp';
import { usePeepEvents } from './hooks/usePeepEvents';

export default function App() {
  usePeepEvents();

  const [globalPickerOpen, setGlobalPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Onboarding state — null = loading from settings
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

    window.addEventListener('peep:open-picker', onOpenPicker);
    window.addEventListener('peep:open-settings', onOpenSettings);

    return () => {
      window.removeEventListener('peep:open-picker', onOpenPicker);
      window.removeEventListener('peep:open-settings', onOpenSettings);
    };
  }, []);

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

      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />

      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
      )}
    </>
  );
}
