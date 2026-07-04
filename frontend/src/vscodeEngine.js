/**
 * VS Code Engine Initializer
 * Bootstraps the @codingame/monaco-vscode-api services before the editor loads.
 * Import this ONCE at the top of main.jsx before anything else monaco-related.
 */

// ─── Worker Setup ─────────────────────────────────────────────────────────────
// Use a URL-based worker so it works in both Vite dev and build modes
window.MonacoEnvironment = {
  getWorker(_moduleId, _label) {
    // Use blob-URL approach: import the worker script as a URL
    const workerUrl = new URL(
      '@codingame/monaco-vscode-editor-api/esm/vs/editor/editor.worker',
      import.meta.url
    );
    return new Worker(workerUrl, { type: 'module' });
  },
};

// ─── VS Code Service Overrides ────────────────────────────────────────────────
import { initialize } from 'vscode/services';
import getConfigurationServiceOverride from '@codingame/monaco-vscode-configuration-service-override';
import getTextmateServiceOverride from '@codingame/monaco-vscode-textmate-service-override';
import getThemeServiceOverride from '@codingame/monaco-vscode-theme-service-override';
import getLanguagesServiceOverride from '@codingame/monaco-vscode-languages-service-override';
import getFilesServiceOverride from '@codingame/monaco-vscode-files-service-override';
import getEditorServiceOverride from '@codingame/monaco-vscode-editor-service-override';

// ─── Default Extensions (syntax + themes) ─────────────────────────────────────
import '@codingame/monaco-vscode-theme-defaults-default-extension';
import '@codingame/monaco-vscode-javascript-default-extension';
import '@codingame/monaco-vscode-typescript-basics-default-extension';
import '@codingame/monaco-vscode-json-default-extension';
import '@codingame/monaco-vscode-html-language-features-default-extension';
import '@codingame/monaco-vscode-css-language-features-default-extension';
import '@codingame/monaco-vscode-markdown-basics-default-extension';
import '@codingame/monaco-vscode-python-default-extension';

let _initialized = false;
let _initPromise = null;

export function initializeVSCodeEngine() {
  if (_initialized) return Promise.resolve();
  if (_initPromise) return _initPromise;

  _initPromise = initialize(
    {
      ...getConfigurationServiceOverride(),
      ...getTextmateServiceOverride(),
      ...getThemeServiceOverride(),
      ...getLanguagesServiceOverride(),
      ...getFilesServiceOverride(),
      ...getEditorServiceOverride(async () => undefined),
    },
    document.body,           // container element for workbench services
    {
      developmentOptions: {
        enableSmokeTestDriver: false,
      },
    }
  ).then(() => {
    _initialized = true;
    console.log('[DEV-DASH] VS Code Engine initialized ✓');
  }).catch((err) => {
    console.error('[DEV-DASH] VS Code Engine init failed:', err);
    // Don't throw – fall back gracefully so the rest of the app still loads
  });

  return _initPromise;
}
