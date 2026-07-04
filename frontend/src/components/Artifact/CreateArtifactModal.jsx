import React, { useState } from 'react';
import { X, Plus, ChevronDown } from 'lucide-react';
import Modal from '../UI/Modal.jsx';
import { useCreateArtifact } from '../../hooks/useArtifacts.js';
import { useUIStore } from '../../store/uiStore.js';

const KINDS = [
  { value: 'snippet',  label: 'Code Snippet' },
  { value: 'markdown', label: 'Markdown Note' },
  { value: 'canvas',   label: 'Canvas' },
];

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'bash', 'sql',
  'json', 'yaml', 'html', 'css', 'go', 'rust', 'java', 'php', 'ruby', 'other',
];

export default function CreateArtifactModal({ onClose, onCreated }) {
  const workspaceId = useUIStore((s) => s.activeWorkspaceId);
  const { mutateAsync, isPending } = useCreateArtifact();

  const [form, setForm] = useState({
    kind: 'snippet',
    title: '',
    contentText: '',
    language: 'javascript',
    tags: [],
    tagInput: '',
  });
  const [errors, setErrors] = useState({});

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })); }

  function addTag(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = form.tagInput.trim().toLowerCase();
      if (tag && !form.tags.includes(tag)) {
        set('tags', [...form.tags, tag]);
      }
      set('tagInput', '');
    }
  }

  function removeTag(tag) { set('tags', form.tags.filter((t) => t !== tag)); }

  function validate() {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!workspaceId) errs.workspace = 'Please select a workspace first';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const { tagInput, ...rest } = form;
    const payload = { ...rest, workspaceId };
    if (form.kind !== 'snippet') delete payload.language;

    const data = await mutateAsync(payload);
    onCreated?.(data.artifact);
    onClose();
  }

  return (
    <Modal title="New Artifact" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Kind selector */}
        <div className="input-group">
          <label className="input-label">Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => set('kind', k.value)}
                className={`btn ${form.kind === k.value ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="input-group">
          <label className="input-label">Title *</label>
          <input
            id="artifact-title"
            className="input"
            placeholder={form.kind === 'snippet' ? 'e.g. useDebounce hook' : 'e.g. Architecture notes'}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
          {errors.title && <span className="input-error">{errors.title}</span>}
        </div>

        {/* Language (snippets only) */}
        {form.kind === 'snippet' && (
          <div className="input-group">
            <label className="input-label">Language</label>
            <select
              className="select"
              value={form.language}
              onChange={(e) => set('language', e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        )}

        {/* Content */}
        <div className="input-group">
          <label className="input-label">Content</label>
          {form.kind === 'snippet' ? (
            <textarea
              className="editor-textarea"
              style={{
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                minHeight: 220,
              }}
              placeholder={`// Paste your code here…`}
              value={form.contentText}
              onChange={(e) => set('contentText', e.target.value)}
            />
          ) : (
            <textarea
              className="textarea"
              placeholder="Write your notes in Markdown…"
              value={form.contentText}
              onChange={(e) => set('contentText', e.target.value)}
              style={{ minHeight: 180 }}
            />
          )}
        </div>

        {/* Tags */}
        <div className="input-group">
          <label className="input-label">Tags</label>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6,
            padding: '6px 10px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
          }}>
            {form.tags.map((tag) => (
              <span key={tag} className="badge badge-primary" style={{ gap: 4 }}>
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              style={{ flex: 1, minWidth: 80, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              placeholder="Add tag, press Enter…"
              value={form.tagInput}
              onChange={(e) => set('tagInput', e.target.value)}
              onKeyDown={addTag}
            />
          </div>
        </div>

        {errors.workspace && (
          <div className="badge badge-danger" style={{ padding: '8px 12px' }}>{errors.workspace}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isPending}>
            {isPending ? 'Creating…' : 'Create Artifact'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
