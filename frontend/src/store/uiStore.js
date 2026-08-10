import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUIStore = create(
  persist(
    (set, get) => ({
      // Theme
      theme: 'theme-matte',
      setTheme: (theme) => set({ theme }),

      // Active workspace
      activeWorkspaceId: null,
      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

      // Sidebar
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      // Last picked folder path
      lastOpenedPath: null,
      setLastOpenedPath: (path) => set({ lastOpenedPath: path }),

      // View mode for artifact list
      viewMode: 'grid', // 'grid' | 'list'
      setViewMode: (mode) => set({ viewMode: mode }),

      // Command palette
      commandPaletteOpen: false,
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),

      // Active artifact (for editing tabs)
      openArtifactIds: [],
      activeArtifactId: null,
      openArtifact: (id) =>
        set((s) => ({
          openArtifactIds: s.openArtifactIds.includes(id)
            ? s.openArtifactIds
            : [...s.openArtifactIds, id],
          activeArtifactId: id,
        })),
      closeArtifact: (id) =>
        set((s) => {
          const ids = s.openArtifactIds.filter((x) => x !== id);
          return {
            openArtifactIds: ids,
            activeArtifactId: ids[ids.length - 1] || null,
          };
        }),

      // Toasts
      toasts: [],
      notificationHistory: [],
      addToast: (toast) =>
        set((s) => ({
          toasts: [...s.toasts, { id: Date.now(), ...toast }],
          notificationHistory: [{ id: Date.now(), timestamp: Date.now(), ...toast }, ...(s.notificationHistory || [])].slice(0, 50),
        })),
      removeToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      clearNotificationHistory: () => set({ notificationHistory: [] }),
    }),
    {
      name: 'dcc-ui',
      partialize: (s) => ({
        activeWorkspaceId: s.activeWorkspaceId,
        sidebarCollapsed: s.sidebarCollapsed,
        viewMode: s.viewMode,
        notificationHistory: s.notificationHistory,
        theme: s.theme,
      }),
    }
  )
);

// Toast helpers
export const toast = {
  success: (message, options = {}) =>
    useUIStore.getState().addToast({ type: 'success', message, ...options }),
  error: (message, options = {}) =>
    useUIStore.getState().addToast({ type: 'error', message, ...options }),
  warning: (message, options = {}) =>
    useUIStore.getState().addToast({ type: 'warning', message, ...options }),
  info: (message, options = {}) =>
    useUIStore.getState().addToast({ type: 'info', message, ...options }),
};
