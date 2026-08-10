import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore.js';
import { searchApi } from '../../api/index.js';
import ArtifactCard from '../Artifact/ArtifactCard.jsx';
import { getFileColor, getCategoryColor } from '../../utils/artifactResources.js';

export default function GlobalSearchbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isActive, setIsActive] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [suggestions, setSuggestions] = useState({ categories: [], languages: [] });
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  
  const inputRef = useRef(null);

  // Fetch suggestions once when opened
  useEffect(() => {
    if (isActive && suggestions.categories.length === 0) {
      searchApi.suggestions().then(setSuggestions).catch(console.error);
    }
  }, [isActive]);

  // Handle browser back button restoring the search state via react-router location state
  useEffect(() => {
    if (location.state?.searchOpen) {
      setIsActive(true);
      navigate('.', { replace: true, state: { ...location.state, searchOpen: false } });
    }
  }, [location.state]);

  // Debounced search
  useEffect(() => {
    if (!isActive) return;
    
    if (!query && !selectedCategory && !selectedLanguage) {
      setResults([]);
      return;
    }
    
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const params = { q: query || undefined, limit: 15 };
        if (selectedCategory) params.categories = selectedCategory;
        if (selectedLanguage) params.language = selectedLanguage;
        
        const res = await searchApi.search(params);
        setResults(res.results || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);
    
    return () => clearTimeout(timeout);
  }, [query, selectedCategory, selectedLanguage, isActive]);
  
  const handleClose = () => {
    setIsActive(false);
  };
  
  const handleOpen = () => {
    setIsActive(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleModalClick = (e) => {
    e.stopPropagation();
  };
  
  // Close search when an artifact is clicked, and save state for back button
  const handleResultClick = (e) => {
    const link = e.target.closest('a');
    if (link) {
      e.preventDefault();
      const href = link.getAttribute('href');
      navigate('.', { replace: true, state: { ...location.state, searchOpen: true } });
      setTimeout(() => {
        navigate(href);
        handleClose();
      }, 0);
    }
  };

  if (!isActive) {
    return (
      <div 
        className="global-searchbar-container"
        style={{
          padding: '24px 40px 0',
          display: 'flex',
          justifyContent: 'flex-start',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'transparent',
          pointerEvents: 'none',
        }}
      >
        <div 
          className="search-bar" 
          onClick={handleOpen}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-elevated)',
            border: `1px solid ${isHovered ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            gap: 12,
            width: '100%',
            maxWidth: isHovered ? '450px' : '400px',
            cursor: 'text',
            boxShadow: isHovered ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <Search size={14} style={{ color: isHovered ? 'var(--accent-primary)' : 'var(--text-muted)', transition: 'color 0.25s' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', flex: 1, fontFamily: 'var(--font-sans)' }}>
            Search across all workspaces...
          </span>
          <kbd style={{
            background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 4, padding: '2px 6px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
          }}>⌘K</kbd>
        </div>
      </div>
    );
  }

  // Active Full-Screen Modal
  return (
    <div 
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: '18vh',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={handleClose}
    >
      <div 
        style={{
          width: '100%', maxWidth: '750px', 
          display: 'flex', flexDirection: 'column', gap: 16,
          animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          padding: '0 20px'
        }}
        onClick={handleModalClick}
      >
        {/* Search Input Box */}
        <div style={{
          display: 'flex', alignItems: 'center',
          background: 'var(--bg-elevated)', border: '1px solid var(--accent-primary)',
          padding: '16px 24px', borderRadius: 16, gap: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 24px rgba(230, 57, 70, 0.2)', // Matches primary accents roughly
        }}>
          <Search size={22} style={{ color: 'var(--accent-primary)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search artifacts, categories, or languages..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: '1.2rem', fontFamily: 'var(--font-sans)',
            }}
          />
          {query && (
            <button 
              onClick={() => setQuery('')} 
              style={{ 
                background: 'transparent', border: 'none', padding: 4, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', borderRadius: '50%',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Suggestions Row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 8px' }}>
          {suggestions.categories.map(cat => (
            <div 
              key={cat} 
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              style={{
                fontSize: '0.8rem', padding: '4px 12px', borderRadius: 12, cursor: 'pointer', fontWeight: 500,
                background: selectedCategory === cat ? getCategoryColor(cat) : 'rgba(255,255,255,0.05)',
                color: selectedCategory === cat ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${selectedCategory === cat ? getCategoryColor(cat) : 'rgba(255,255,255,0.1)'}`,
                transition: 'all 0.2s',
                boxShadow: selectedCategory === cat ? `0 0 12px ${getCategoryColor(cat)}40` : 'none'
              }}
            >
              {cat}
            </div>
          ))}
          {suggestions.categories.length > 0 && suggestions.languages.length > 0 && (
            <div style={{ width: 1, background: 'var(--border-subtle)', margin: '0 4px' }} />
          )}
          {suggestions.languages.map(lang => (
            <div 
              key={lang} 
              onClick={() => setSelectedLanguage(selectedLanguage === lang ? null : lang)}
              style={{
                fontSize: '0.8rem', padding: '4px 12px', borderRadius: 12, cursor: 'pointer', fontFamily: 'var(--font-mono)',
                background: selectedLanguage === lang ? getFileColor(lang) : 'rgba(255,255,255,0.05)',
                color: selectedLanguage === lang ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${selectedLanguage === lang ? getFileColor(lang) : 'rgba(255,255,255,0.1)'}`,
                transition: 'all 0.2s',
                boxShadow: selectedLanguage === lang ? `0 0 12px ${getFileColor(lang)}40` : 'none'
              }}
            >
              {lang}
            </div>
          ))}
        </div>

        {/* Results */}
        <div style={{
          maxHeight: '55vh', overflowY: 'auto',
          scrollBehavior: 'smooth', width: '100%',
          padding: '4px',
        }}>
          <div 
            onClickCapture={handleResultClick}
            className="artifact-grid"
            style={{ width: '100%' }}
          >
            {loading && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40, fontWeight: 500, gridColumn: '1 / -1' }}>Searching...</div>}
            {!loading && !query && !selectedCategory && !selectedLanguage && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40, fontWeight: 500, gridColumn: '1 / -1' }}>Start typing to search or select a category or file type...</div>
            )}
            {!loading && results.length === 0 && (query || selectedCategory || selectedLanguage) && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40, fontWeight: 500, gridColumn: '1 / -1' }}>No results found.</div>
            )}
            {!loading && results.map(artifact => (
              <ArtifactCard key={artifact._id} artifact={artifact} />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
