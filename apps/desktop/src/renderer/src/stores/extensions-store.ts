import { create } from 'zustand';
import type { ExtensionInfo } from '@peep/shared';

interface ExtensionsState {
  searchResults: ExtensionInfo[];
  installedExtensions: ExtensionInfo[];
  searchQuery: string;
  isSearching: boolean;
  isInstalling: Record<string, boolean>; // id -> true if installing/uninstalling
  activeTab: 'marketplace' | 'installed';

  setSearchQuery: (query: string) => void;
  setActiveTab: (tab: 'marketplace' | 'installed') => void;
  search: (query: string) => Promise<void>;
  fetchInstalled: () => Promise<void>;
  install: (id: string, url?: string) => Promise<void>;
  uninstall: (id: string) => Promise<void>;
}

export const useExtensionsStore = create<ExtensionsState>((set, get) => ({
  searchResults: [],
  installedExtensions: [],
  searchQuery: '',
  isSearching: false,
  isInstalling: {},
  activeTab: 'marketplace',

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  
  setActiveTab: (activeTab) => set({ activeTab }),

  search: async (query) => {
    set({ isSearching: true });
    try {
      const result = await window.peep.searchExtensions(query);
      set({ searchResults: result.extensions });
    } catch (err) {
      console.error('Failed to search extensions:', err);
    } finally {
      set({ isSearching: false });
    }
  },

  fetchInstalled: async () => {
    try {
      const installed = await window.peep.getInstalledExtensions();
      set({ installedExtensions: installed });
    } catch (err) {
      console.error('Failed to fetch installed extensions:', err);
    }
  },

  install: async (id, url) => {
    set((state) => ({ isInstalling: { ...state.isInstalling, [id]: true } }));
    try {
      await window.peep.installExtension(id, url);
      await get().fetchInstalled();
      
      // Update installed flag in search results
      set((state) => ({
        searchResults: state.searchResults.map((ext) => 
          ext.id === id ? { ...ext, installed: true } : ext
        )
      }));
    } catch (err) {
      console.error(`Failed to install ${id}:`, err);
    } finally {
      set((state) => ({ isInstalling: { ...state.isInstalling, [id]: false } }));
    }
  },

  uninstall: async (id) => {
    set((state) => ({ isInstalling: { ...state.isInstalling, [id]: true } }));
    try {
      await window.peep.uninstallExtension(id);
      await get().fetchInstalled();
      
      // Update installed flag in search results
      set((state) => ({
        searchResults: state.searchResults.map((ext) => 
          ext.id === id ? { ...ext, installed: false } : ext
        )
      }));
    } catch (err) {
      console.error(`Failed to uninstall ${id}:`, err);
    } finally {
      set((state) => ({ isInstalling: { ...state.isInstalling, [id]: false } }));
    }
  },
}));
