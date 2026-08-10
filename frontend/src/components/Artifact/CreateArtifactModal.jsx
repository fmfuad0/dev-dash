import React, { useState } from 'react';
import { X, Plus, ChevronDown } from 'lucide-react';
import Modal from '../UI/Modal.jsx';
import { useCreateArtifact } from '../../hooks/useArtifacts.js';
import { useUIStore } from '../../store/uiStore.js';

import { CATEGORY_GROUPS, CATEGORIES, FILE_TYPE_GROUPS, FILE_TYPES } from '../../utils/artifactResources.js';

export default function CreateArtifactModal({ onClose, onCreated }) {
  const workspaceId = useUIStore((s) => s.activeWorkspaceId);
  const { mutateAsync, isPending } = useCreateArtifact();

  const [form, setForm] = useState({
    kind: 'snippet',
    title: '',
    contentText: '',
    categoryGroup: '',
    category: '',
    fileTypeGroup: '',
    fileType: '',
    tags: [],
    tagInput: '',
  });
  const [fileTypeSearch, setFileTypeSearch] = useState('');
  const [showFileSearchResults, setShowFileSearchResults] = useState(false);
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
    if (!form.category) errs.category = 'Category is required';
    if (!form.fileType) errs.fileType = 'File type is required';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const { tagInput, categoryGroup, fileTypeGroup, ...rest } = form;
    const payload = { ...rest, workspaceId };

    const data = await mutateAsync(payload);
    onCreated?.(data.artifact);
    onClose();
  }

  return (
    <Modal title="New Artifact" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

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

        {/* Category */}
        <div className="input-group">
          <label className="input-label">Categorize Your Artifact</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <select
              className="select"
              style={{ flex: 1 }}
              value={form.categoryGroup}
              onChange={(e) => {
                set('categoryGroup', e.target.value);
                set('category', '');
              }}
            >  
              <option value="" disabled>SELECT CATEGORY GROUP</option>
              {CATEGORY_GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <select
              className="select"
              style={{ flex: 1 }}
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              disabled={!form.categoryGroup}
            >
              <option value="" disabled>SELECT CATEGORY NAME</option>
              {form.categoryGroup && CATEGORIES.filter(c => c.group === form.categoryGroup).map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          {errors.category && <span className="input-error">{errors.category}</span>}
        </div>

        {/* File Type */}
        <div className="input-group">
          <label className="input-label">Assign Language or File Type</label>
          
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <input 
              type="text" 
              className="input" 
              placeholder="Search for a language or file type..."
              value={fileTypeSearch}
              onChange={(e) => {
                setFileTypeSearch(e.target.value);
                setShowFileSearchResults(true);
              }}
              onFocus={() => setShowFileSearchResults(true)}
              onBlur={() => setTimeout(() => setShowFileSearchResults(false), 200)}
            />
            {showFileSearchResults && fileTypeSearch.trim() !== '' && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, 
                background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', 
                maxHeight: 200, overflowY: 'auto', zIndex: 10, borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)', marginTop: 4
              }}>
                {FILE_TYPES.filter(f => 
                  f.label.toLowerCase().includes(fileTypeSearch.toLowerCase()) || 
                  f.ext.toLowerCase().includes(fileTypeSearch.toLowerCase())
                ).map(f => (
                  <div 
                    key={f.ext}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem' }}
                    onMouseEnter={(e) => e.target.style.background = 'var(--bg-overlay)'}
                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    onClick={() => {
                      set('fileTypeGroup', f.group);
                      set('fileType', f.ext);
                      setFileTypeSearch('');
                      setShowFileSearchResults(false);
                    }}
                  >
                    {f.label} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({f.group})</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <select
              className="select"
              style={{ flex: 1 }}
              value={form.fileTypeGroup}
              onChange={(e) => {
                set('fileTypeGroup', e.target.value);
                set('fileType', '');
              }}
            >
              <option value="" disabled>SELECT FILE GROUP</option>
              {FILE_TYPE_GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <select
              className="select"
              style={{ flex: 1 }}
              value={form.fileType}
              onChange={(e) => set('fileType', e.target.value)}
              disabled={!form.fileTypeGroup}
            >
              <option value="" disabled>SELECT FILE TYPE</option>
              {form.fileTypeGroup && FILE_TYPES.filter(f => f.group === form.fileTypeGroup).map((f) => (
                <option key={f.ext} value={f.ext}>{f.label}</option>
              ))}
            </select>
          </div>
          {errors.fileType && <span className="input-error">{errors.fileType}</span>}
        </div>

        {/* Content */}
        <div className="input-group">
          <label className="input-label">Content</label>
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
