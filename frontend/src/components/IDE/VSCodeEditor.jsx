/**
 * VSCodeEditor Component
 * Uses the true VS Code engine (@codingame/monaco-vscode-api) to render
 * a full-featured code editor. All your existing DEV-DASH UI wrapping remains;
 * only this inner editor component is powered by the VS Code core.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
// 'monaco-editor' is aliased in package.json to @codingame/monaco-vscode-editor-api
import * as monaco from 'monaco-editor';

const VSCodeEditor = React.memo(function VSCodeEditor({
  value,
  language,
  theme,
  path,
  fontSize,
  wordWrap,
  onChange,
  onMount,
}) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const modelRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Create editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    // Create a URI-based model so VS Code can identify the file by path/language
    const uri = monaco.Uri.parse(`file:///${(path || 'untitled').replace(/\\/g, '/')}`);
    
    // Reuse or create model
    let model = monaco.editor.getModel(uri);
    if (!model) {
      model = monaco.editor.createModel(value ?? '', language ?? 'plaintext', uri);
    } else {
      // Update language if it changed
      monaco.editor.setModelLanguage(model, language ?? 'plaintext');
      if (model.getValue() !== value) {
        model.setValue(value ?? '');
      }
    }
    modelRef.current = model;

    // Create the editor instance
    // Map ideStore theme values → Monaco built-in theme names
    const resolveTheme = (t) => {
      if (t === 'vs-dark') return 'Default Dark Modern';
      if (t === 'vs-light') return 'Default Light Modern';
      if (t === 'hc-black') return 'hc-black';
      return 'Default Dark Modern';
    };

    const editor = monaco.editor.create(containerRef.current, {
      model,
      theme: resolveTheme(theme),
      fontSize: fontSize ?? 14,
      fontFamily: '"Cascadia Code", "JetBrains Mono", "Consolas", monospace',
      fontLigatures: true,
      wordWrap: wordWrap ?? 'off',
      automaticLayout: true,
      
      // Full VS Code feature flags
      minimap: { enabled: true, autohide: true },
      lineNumbers: 'on',
      glyphMargin: true,
      folding: true,
      foldingHighlight: true,
      showFoldingControls: 'mouseover',
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true },
      renderLineHighlight: 'all',
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'blink',
      cursorSmoothCaretAnimation: 'on',
      multiCursorModifier: 'ctrlCmd',
      
      // Intellisense / suggestions
      quickSuggestions: { other: true, comments: true, strings: true },
      suggestOnTriggerCharacters: true,
      parameterHints: { enabled: true },
      suggest: { showIcons: true, shareSuggestSelections: true, preview: true },
      inlayHints: { enabled: 'on' },
      
      // Format
      formatOnPaste: true,
      formatOnType: true,
      autoIndent: 'full',
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: true,
      
      // Auto-close
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      linkedEditing: true,
      
      // Code actions
      lightbulb: { enabled: 'on' },
      codeLens: true,
      colorDecorators: true,
      
      // Scroll
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      padding: { top: 8, bottom: 8 },
      
      // Whitespace
      renderWhitespace: 'selection',
      
      // Accessibility
      accessibilitySupport: 'off',
    });

    editorRef.current = editor;

    // Fire onChange when content changes
    const disposable = model.onDidChangeContent(() => {
      onChange?.(model.getValue());
    });

    // Expose editor ref to parent
    onMount?.(editor);

    setReady(true);

    return () => {
      disposable.dispose();
      editor.dispose();
      editorRef.current = null;
    };
  // Only run once on mount - we handle value/language/theme updates below
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Sync value changes from parent without recreating editor
  useEffect(() => {
    const model = modelRef.current;
    if (!model || !editorRef.current) return;
    if (model.getValue() !== value) {
      // Preserve cursor/selection while updating
      const selections = editorRef.current.getSelections();
      model.setValue(value ?? '');
      if (selections) editorRef.current.setSelections(selections);
    }
  }, [value]);

  // Sync language changes
  useEffect(() => {
    if (!modelRef.current || !language) return;
    monaco.editor.setModelLanguage(modelRef.current, language);
  }, [language]);

  // Sync theme changes — monaco is a static import (never falsy), safe to call directly
  useEffect(() => {
    const resolveTheme = (t) => {
      if (t === 'vs-dark')  return 'Default Dark Modern';
      if (t === 'vs-light') return 'Default Light Modern';
      if (t === 'hc-black') return 'hc-black';
      return 'Default Dark Modern';
    };
    monaco.editor.setTheme(resolveTheme(theme));
  }, [theme]);

  // Sync fontSize
  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize: fontSize ?? 14 });
  }, [fontSize]);

  // Sync wordWrap
  useEffect(() => {
    editorRef.current?.updateOptions({ wordWrap: wordWrap ?? 'off' });
  }, [wordWrap]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    />
  );
});

export default VSCodeEditor;
