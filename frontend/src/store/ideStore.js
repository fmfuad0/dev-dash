import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Global IDE state store — persists across route navigation so no content is ever lost.
 */
export const useIdeStore = create(
  persist(
    (set, get) => ({
      // File explorer root path
      rootPath: '',
      setRootPath: (path) => set({ rootPath: path }),

      // Open file tabs: [{ path, name, language, content, isDirty }]
      openTabs: [],
      activeTabPath: null,

      openFile: (file) => {
        const { openTabs } = get();
        const existing = openTabs.find((t) => t.path === file.path);
        if (existing) {
          set({ activeTabPath: file.path });
          return;
        }
        const newTab = {
          path: file.path,
          name: file.name,
          language: file.language || detectLanguage(file.name),
          content: file.content || '',
          isDirty: false,
        };
        set({ openTabs: [...openTabs, newTab], activeTabPath: file.path });
      },

      closeTab: (path) => {
        const { openTabs, activeTabPath } = get();
        const newTabs = openTabs.filter((t) => t.path !== path);
        let newActive = activeTabPath;
        if (activeTabPath === path) {
          const idx = openTabs.findIndex((t) => t.path === path);
          newActive = newTabs[Math.max(0, idx - 1)]?.path || newTabs[0]?.path || null;
        }
        set({ openTabs: newTabs, activeTabPath: newActive });
      },

      setActiveTab: (path) => set({ activeTabPath: path }),

      updateTabContent: (path, content) => {
        const { openTabs } = get();
        set({
          openTabs: openTabs.map((t) =>
            t.path === path ? { ...t, content, isDirty: true } : t
          ),
        });
      },

      markTabSaved: (path) => {
        const { openTabs } = get();
        set({
          openTabs: openTabs.map((t) =>
            t.path === path ? { ...t, isDirty: false } : t
          ),
        });
      },

      // Layout & Settings
      ideMode: 'vscode', // 'vscode' | 'dev-dash'
      setIdeMode: (mode) => set({ ideMode: mode }),
      showSidebar: true,
      showPanel: true,
      wordWrap: 'off',
      theme: 'vs-dark',
      fontSize: 14,
      activeSidebarView: 'explorer', // 'explorer' | 'search' | 'git' | 'extensions' | 'settings' | 'notifications'
      toggleSidebar: () => set((s) => ({ showSidebar: !s.showSidebar })),
      togglePanel: () => set((s) => ({ showPanel: !s.showPanel })),
      toggleWordWrap: () => set((s) => ({ wordWrap: s.wordWrap === 'on' ? 'off' : 'on' })),
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setSidebarView: (view) => set({ activeSidebarView: view }),

      // Terminal ID for the IDE panel
      panelTermId: null,
      setPanelTermId: (id) => set({ panelTermId: id }),

      // Search state
      searchQuery: '',
      setSearchQuery: (q) => set({ searchQuery: q }),
    }),
    {
      name: 'dcc-ide',
      partialize: (s) => ({
        rootPath: s.rootPath,
        openTabs: s.openTabs,
        activeTabPath: s.activeTabPath,
        showSidebar: s.showSidebar,
        showPanel: s.showPanel,
        wordWrap: s.wordWrap,
        theme: s.theme,
        fontSize: s.fontSize,
        activeSidebarView: s.activeSidebarView,
        ideMode: s.ideMode,
      }),
    }
  )
);

function detectLanguage(filename) {
  const ext = filename?.split('.').pop()?.toLowerCase();
  const map = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', html: 'html', css: 'css', scss: 'scss',
    json: 'json', md: 'markdown', sh: 'shell', bash: 'shell',
    yml: 'yaml', yaml: 'yaml', xml: 'xml', sql: 'sql',
    c: 'c', cpp: 'cpp', cs: 'csharp', java: 'java', go: 'go',
    rs: 'rust', php: 'php', rb: 'ruby', swift: 'swift', kt: 'kotlin',
  };
  return map[ext] || 'plaintext';
}

export { detectLanguage };
