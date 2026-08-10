import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Pin, Tag, Clock, Code2, PenTool, ExternalLink, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useDeleteArtifact } from '../../hooks/useArtifacts.js';
import { useUIStore } from '../../store/uiStore.js';

import { getFileColor, getCategoryColor } from '../../utils/artifactResources.js';



export default function ArtifactCard({ artifact }) {
  const { _id, title, tags = [], contentText, language, category, fileType, isPinned, updatedAt } = artifact;
  const preview  = contentText?.slice(0, 200);
  const ago      = updatedAt ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true }) : '';

  const navigate = useNavigate();
  const deleteMutation = useDeleteArtifact();
  const openArtifact = useUIStore((s) => s.openArtifact);

  const [contextMenu, setContextMenu] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  return (
    <div 
      onClick={() => navigate(`/artifacts/${_id}`)} 
      className="artifact-card" 
      id={`artifact-${_id}`}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="artifact-card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>

            {category && (
              <span className="badge" style={{ backgroundColor: getCategoryColor(category), color: '#fff', fontSize: '0.68rem', borderColor: 'transparent' }}>
                {category}
              </span>
            )}
            {fileType && (
              <span className="badge" style={{ backgroundColor: getFileColor(fileType), color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', borderColor: 'transparent' }}>
                {fileType}
              </span>
            )}
            {!category && !fileType && language && (
              <span className="badge badge-default" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>
                {language}
              </span>
            )}
            {isPinned && <Pin size={12} style={{ color: 'var(--accent-warning)' }} />}
          </div>
          <div className="artifact-card-title">{title}</div>
        </div>
      </div>

      {preview && (
        <div className="artifact-card-preview">{preview}</div>
      )}

      <div className="artifact-card-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {tags.slice(0, 3).map((tag) => (
            <span key={tag} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: '0.7rem', color: 'var(--text-muted)',
            }}>
              <Tag size={9} />
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>+{tags.length - 3}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.72rem', flexShrink: 0 }}>
          <Clock size={10} />
          {ago}
        </div>
      </div>

      {contextMenu && createPortal(
        <div 
          ref={menuRef}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 99999,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
            padding: '4px',
            minWidth: '220px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
        >
          {(fileType !== 'canvas' && fileType !== 'excalidraw') && (
            <button 
              className="btn btn-ghost btn-sm"
              style={{ justifyContent: 'flex-start', color: 'var(--text-primary)' }}
              onClick={(e) => { e.stopPropagation(); openArtifact(_id); navigate('/editor'); setContextMenu(null); }}
            >
              <Code2 size={14} /> Open with EDITOR
            </button>
          )}
          {(fileType === 'canvas' || fileType === 'excalidraw') && (
            <button 
              className="btn btn-ghost btn-sm"
              style={{ justifyContent: 'flex-start', color: 'var(--text-primary)' }}
              onClick={(e) => { e.stopPropagation(); navigate('/canvas', { state: { artifactId: _id } }); setContextMenu(null); }}
            >
              <PenTool size={14} /> Open with CANVAS
            </button>
          )}
          <button 
            className="btn btn-ghost btn-sm"
            style={{ justifyContent: 'flex-start', color: 'var(--text-primary)' }}
            onClick={(e) => { e.stopPropagation(); navigate(`/artifacts/${_id}`); setContextMenu(null); }}
          >
            <ExternalLink size={14} /> View details
          </button>
          
          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
          
          <button 
            className="btn btn-ghost btn-sm"
            style={{ justifyContent: 'flex-start', color: 'var(--accent-danger)' }}
            onClick={(e) => { 
              e.stopPropagation(); 
              if (window.confirm('Delete permanently? This action cannot be undone.')) {
                deleteMutation.mutateAsync(_id);
              }
              setContextMenu(null); 
            }}
          >
            <Trash2 size={14} /> Delete permanently
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
