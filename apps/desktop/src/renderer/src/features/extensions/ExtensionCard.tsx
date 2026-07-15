import type { ExtensionInfo } from '@peep/shared';
import { useExtensionsStore } from '../../stores/extensions-store';
import { useWorkspaceStore } from '../../stores/workspace-store';
import './ExtensionsPanel.css';

interface ExtensionCardProps {
  extension: ExtensionInfo;
}

export function ExtensionCard({ extension }: ExtensionCardProps) {
  const isInstalling = useExtensionsStore((s) => s.isInstalling[extension.id]);
  const install = useExtensionsStore((s) => s.install);
  const uninstall = useExtensionsStore((s) => s.uninstall);
  const openFile = useWorkspaceStore((s) => s.openFile);

  const formatNumber = (num?: number) => {
    if (!num) return '0';
    if (num > 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num > 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const handleInstallClick = () => {
    if (extension.installed) {
      void uninstall(extension.id);
    } else {
      void install(extension.id, extension.downloadUrl);
    }
  };

  const handleCardClick = () => {
    openFile({
      path: `extension://${extension.id}`,
      name: `Extension: ${extension.displayName || extension.name}`,
      content: '',
      dirty: false,
    });
  };

  return (
    <div className="extension-card" onClick={handleCardClick} style={{ cursor: 'pointer' }}>
      <div className="extension-card__icon">
        {extension.iconUrl ? (
          <img src={extension.iconUrl} alt={extension.name} />
        ) : (
          <div className="extension-card__icon-placeholder">
            {extension.name.substring(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="extension-card__content">
        <div className="extension-card__title">
          <span className="extension-card__name" title={extension.displayName || extension.name}>
            {extension.displayName || extension.name}
          </span>
        </div>
        <div className="extension-card__description" title={extension.description}>
          {extension.description || 'No description available'}
        </div>
        <div className="extension-card__meta">
          <span className="extension-card__publisher">{extension.namespace}</span>
          {extension.downloadCount !== undefined && (
            <span className="extension-card__downloads">
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z"></path><path d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z"></path></svg>
              {formatNumber(extension.downloadCount)}
            </span>
          )}
          {extension.averageRating !== undefined && extension.averageRating > 0 && (
            <span className="extension-card__rating">
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"></path></svg>
              {extension.averageRating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <div className="extension-card__actions">
        <button
          type="button"
          className={`btn-extension ${extension.installed ? 'btn-extension-uninstall' : 'btn-extension-install'}`}
          onClick={(e) => {
            e.stopPropagation();
            handleInstallClick();
          }}
          disabled={isInstalling}
        >
          {isInstalling ? 'Installing...' : extension.installed ? 'Uninstall' : 'Install'}
        </button>
      </div>
    </div>
  );
}
