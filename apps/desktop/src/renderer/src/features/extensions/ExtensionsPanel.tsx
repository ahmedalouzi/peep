import { useEffect } from 'react';
import { useExtensionsStore } from '../../stores/extensions-store';
import { ExtensionCard } from './ExtensionCard';
import './ExtensionsPanel.css';

export function ExtensionsPanel() {
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    search,
    isSearching,
    searchResults,
    installedExtensions,
    fetchInstalled,
  } = useExtensionsStore();

  useEffect(() => {
    void fetchInstalled();
    void search(''); // Initial fetch of popular extensions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      void search(searchQuery);
    }, 500); // debounce 500ms
    return () => clearTimeout(handler);
  }, [searchQuery, search]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (activeTab === 'installed') {
      setActiveTab('marketplace');
    }
  };

  const extensionsToList = activeTab === 'marketplace' ? searchResults : installedExtensions;

  return (
    <aside className="sidebar extensions-panel">
      <div className="sidebar-header">
        <span className="sidebar-title">Extensions</span>
      </div>

      <div className="extensions-panel__search-box">
        <input
          type="text"
          placeholder="Search extensions in Open VSX..."
          className="extensions-panel__search-input"
          value={searchQuery}
          onChange={handleSearchChange}
        />
      </div>

      <div className="extensions-panel__tabs">
        <button
          type="button"
          className={`extensions-panel__tab ${activeTab === 'marketplace' ? 'active' : ''}`}
          onClick={() => setActiveTab('marketplace')}
        >
          Marketplace
        </button>
        <button
          type="button"
          className={`extensions-panel__tab ${activeTab === 'installed' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('installed');
            void fetchInstalled();
          }}
        >
          Installed <span className="extensions-panel__badge">{installedExtensions.length}</span>
        </button>
      </div>

      <div className="extensions-panel__body">
        {isSearching && activeTab === 'marketplace' && (
          <div className="extensions-panel__loading">Searching Open VSX...</div>
        )}

        {!isSearching && extensionsToList.length === 0 && (
          <div className="extensions-panel__empty">
            {activeTab === 'marketplace'
              ? 'No extensions found.'
              : 'No extensions installed.'}
          </div>
        )}

        <div className="extensions-panel__list">
          {extensionsToList.map((ext) => (
            <ExtensionCard key={ext.id} extension={ext} />
          ))}
        </div>
      </div>
    </aside>
  );
}
