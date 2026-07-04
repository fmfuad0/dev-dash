import React, { useState, useEffect } from 'react';
import { useIdeStore } from '../../store/ideStore';
import api from '../../api/client';
import { toast } from '../../store/uiStore';
import { Package, Search as SearchIcon, Download, Trash2, Loader2, RefreshCw } from 'lucide-react';

export default function ExtensionsPanel() {
  const rootPath = useIdeStore((s) => s.rootPath);
  const [installed, setInstalled] = useState([]);
  const [isNode, setIsNode] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingPkg, setLoadingPkg] = useState(null); // name of package currently installing/uninstalling

  const fetchInstalled = async () => {
    if (!rootPath) return;
    try {
      const res = await api.get('/npm/installed', { params: { root: rootPath } });
      setIsNode(res.data.isNodeProject);
      setInstalled(res.data.installed || []);
    } catch {
      toast.error('Failed to load installed packages');
    }
  };

  useEffect(() => {
    fetchInstalled();
  }, [rootPath]);

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await api.get('/npm/search', { params: { q: query } });
      setResults(res.data.results || []);
    } catch {
      toast.error('Search failed');
    }
    setSearching(false);
  };

  const handleInstall = async (pkg, isDev) => {
    setLoadingPkg(pkg);
    try {
      await api.post('/npm/install', { root: rootPath, pkg, isDev });
      toast.success(`Installed ${pkg}`);
      fetchInstalled();
    } catch (err) {
      toast.error(`Failed to install ${pkg}`);
    }
    setLoadingPkg(null);
  };

  const handleUninstall = async (pkg) => {
    setLoadingPkg(pkg);
    try {
      await api.post('/npm/uninstall', { root: rootPath, pkg });
      toast.success(`Uninstalled ${pkg}`);
      fetchInstalled();
    } catch (err) {
      toast.error(`Failed to uninstall ${pkg}`);
    }
    setLoadingPkg(null);
  };

  if (!isNode) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="vsc-sidebar-title">PACKAGES</div>
        <div style={{ padding: '20px', color: '#858585', fontSize: '13px', textAlign: 'center' }}>
          No package.json found. Open a Node.js project to manage packages.
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="vsc-sidebar-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>NPM PACKAGES</span>
        <button onClick={fetchInstalled} style={{ background: 'none', border: 'none', color: '#cccccc', cursor: 'pointer' }} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      <div style={{ padding: '8px', flexShrink: 0 }}>
        <input
          className="vsc-search-input"
          placeholder="Search NPM registry"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          style={{ marginBottom: 4 }}
        />
        <button
          onClick={doSearch}
          disabled={searching}
          style={{ width: '100%', background: '#0e639c', color: 'white', border: 'none', padding: '4px', cursor: 'pointer', fontSize: '12px', borderRadius: 2, marginTop: 4 }}
        >
          {searching ? 'Searching…' : 'Search NPM'}
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {results.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#cccccc', marginBottom: 8 }}>SEARCH RESULTS</div>
            {results.map((r) => (
              <div key={r.name} style={{ background: '#252526', padding: '8px', marginBottom: '8px', borderRadius: '4px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ fontWeight: 'bold', color: '#3794ff', wordBreak: 'break-all' }}>{r.name}</div>
                  <div style={{ color: '#858585', fontSize: '10px' }}>v{r.version}</div>
                </div>
                <div style={{ color: '#cccccc', marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {r.description}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button 
                    onClick={() => handleInstall(r.name, false)}
                    disabled={loadingPkg === r.name}
                    style={{ flex: 1, background: '#0e639c', color: 'white', border: 'none', padding: '4px', borderRadius: 2, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}
                  >
                    {loadingPkg === r.name ? <Loader2 size={12} className="spin" /> : <Download size={12} />} Install
                  </button>
                  <button 
                    onClick={() => handleInstall(r.name, true)}
                    disabled={loadingPkg === r.name}
                    style={{ flex: 1, background: '#3c3c3c', color: 'white', border: 'none', padding: '4px', borderRadius: 2, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}
                  >
                    Dev
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#cccccc', marginBottom: 8 }}>INSTALLED ({installed.length})</div>
          {installed.length === 0 ? (
            <div style={{ color: '#858585', fontSize: '12px' }}>No dependencies</div>
          ) : (
            installed.map((pkg) => (
              <div key={pkg.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #2d2d2d' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                  <Package size={14} color={pkg.type === 'dev' ? '#858585' : '#cca700'} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: '#cccccc', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{pkg.name}</span>
                    <span style={{ fontSize: '10px', color: '#858585' }}>{pkg.version}</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleUninstall(pkg.name)}
                  disabled={loadingPkg === pkg.name}
                  style={{ background: 'none', border: 'none', color: '#f14c4c', cursor: 'pointer', opacity: loadingPkg === pkg.name ? 0.5 : 1 }}
                  title="Uninstall"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
