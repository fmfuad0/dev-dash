import React from 'react';
import { Link } from 'react-router-dom';
import { Pin, Tag, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const KIND_LABELS = {
  snippet:         { label: 'Snippet',    cls: 'kind-snippet' },
  markdown:        { label: 'Markdown',   cls: 'kind-markdown' },
  canvas:          { label: 'Canvas',     cls: 'kind-canvas' },
  credential:      { label: 'Vault',      cls: 'kind-credential' },
  remoteConnection:{ label: 'Remote',     cls: 'kind-remote' },
  terminalEvent:   { label: 'Terminal',   cls: 'kind-terminal' },
  image:           { label: 'Image',      cls: 'kind-markdown' },
  remoteFile:      { label: 'File',       cls: 'kind-remote' },
  astIndex:        { label: 'AST',        cls: 'kind-snippet' },
};

export default function ArtifactCard({ artifact }) {
  const { _id, title, kind, tags = [], contentText, language, isPinned, updatedAt } = artifact;
  const kindMeta = KIND_LABELS[kind] || { label: kind, cls: 'badge-default' };
  const preview  = contentText?.slice(0, 200);
  const ago      = updatedAt ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true }) : '';

  return (
    <Link to={`/artifacts/${_id}`} className="artifact-card" id={`artifact-${_id}`}>
      <div className="artifact-card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className={`badge badge-default ${kindMeta.cls}`}>{kindMeta.label}</span>
            {language && (
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
    </Link>
  );
}
