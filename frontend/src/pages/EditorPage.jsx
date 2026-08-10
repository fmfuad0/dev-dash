import React, { useState, useEffect, useRef } from 'react';
import { useIdeStore } from '../store/ideStore.js';
import { toast } from '../store/uiStore.js';
import { loadStateFromDesktop } from '../utils/indexedDbSync.js';

export default function EditorPage() {
  const [iframeSrc, setIframeSrc] = useState('');
  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const iframeRef = useRef(null);

  // Persist the last folder the user opened in VS Code
  const storedFolder = useIdeStore((s) => s.rootPath);
  const setRootPath = useIdeStore((s) => s.setRootPath);

  // 1. Sync Desktop State into IndexedDB *before* loading iframe
  useEffect(() => {
    let mounted = true;
    const syncState = async () => {
      try {
        await loadStateFromDesktop();
      } catch (err) {
        console.error('Failed to sync desktop state:', err);
      }
      if (mounted) {
        setIsStateLoaded(true);
      }
    };
    syncState();
    return () => { mounted = false; };
  }, []);

  // 2. Set the initial iframe src immediately after state loads
  useEffect(() => {
    if (isStateLoaded && !iframeSrc) {
      const folderParam = storedFolder ? `folder=${encodeURIComponent(storedFolder)}&` : '';
      setIframeSrc(`/vscode/?${folderParam}tkn=devdash-token`);
    }
  }, [isStateLoaded, iframeSrc, storedFolder]);

  // 2. Poll the iframe URL to detect which folder VS Code has opened
  useEffect(() => {
    const poll = setInterval(() => {
      try {
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentWindow) return;
        const search = iframe.contentWindow.location.search;
        
        let folder = '';
        if (search) {
          const params = new URLSearchParams(search);
          folder = params.get('folder') || '';
        }

        if (folder !== storedFolder) {
          setRootPath(folder);
        }
      } catch {
        // cross-origin guard — safe to ignore
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [storedFolder, setRootPath]);

  // 3. Monitor backend status gracefully (Native toast for disconnects)
  useEffect(() => {
    let active = true;
    let wasDisconnected = false;

    const check = async () => {
      if (!active) return;
      try {
        const res = await fetch('/api/vscode/status');
        const data = await res.json();
        if (!data.ready && !wasDisconnected) {
          toast.warning('VS Code Engine disconnected. Waiting for backend...');
          wasDisconnected = true;
        } else if (data.ready && wasDisconnected) {
          toast.success('VS Code Engine restored!');
          wasDisconnected = false;
        }
      } catch {
        if (!wasDisconnected && active) {
          toast.error('Backend offline. VS Code Engine unavailable.');
          wasDisconnected = true;
        }
      }
      setTimeout(check, 3000);
    };
    check();
    return () => { active = false; };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#1e1e1e' }}>
      {!isStateLoaded && (
        <div style={{ color: 'white', padding: '20px', fontFamily: 'sans-serif' }}>
          Syncing Desktop VS Code state...
        </div>
      )}
      {isStateLoaded && iframeSrc && (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          title="VS Code"
          allow="clipboard-read; clipboard-write"
        />
      )}
    </div>
  );
}
