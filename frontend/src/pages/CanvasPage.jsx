import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import CanvasEditor from '../components/Canvas/CanvasEditor.jsx';
import { useArtifacts, useArtifact, useCreateArtifact, useUpdateArtifact } from '../hooks/useArtifacts.js';
import { useWorkspaces } from '../hooks/useWorkspaces.js';
import { useUIStore } from '../store/uiStore.js';

export default function CanvasPage() {
  const activeWorkspaceId = useUIStore((s) => s.activeWorkspaceId);
  const { data: wsData } = useWorkspaces();
  const targetWorkspaceId = activeWorkspaceId || wsData?.workspaces?.[0]?._id;
  
  const { data: listData, isLoading: isListLoading } = useArtifacts({ 
    workspaceId: targetWorkspaceId, 
    fileType: 'excalidraw'
  });
  
  const location = useLocation();
  const passedArtifactId = location.state?.artifactId;
  
  const [artifactId, setArtifactId] = useState(passedArtifactId || null);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCanvasTitle, setNewCanvasTitle] = useState('My New Canvas');
  const createMutation = useCreateArtifact();

  useEffect(() => {
    if (passedArtifactId) {
      setArtifactId(passedArtifactId);
    }
  }, [passedArtifactId]);

  useEffect(() => {
    if (passedArtifactId) return; // Skip default loading if an ID was explicitly requested

    if (!isListLoading && listData && !artifactId) {
      if (listData.artifacts && listData.artifacts.length > 0) {
        setArtifactId(listData.artifacts[0]._id);
      } else if (targetWorkspaceId && !createMutation.isPending) {
        // Create default canvas
        createMutation.mutateAsync({
          workspaceId: targetWorkspaceId,
          title: 'Main Canvas',
          category: 'Canvas mockup/schema',
          fileType: 'excalidraw',
          contentText: JSON.stringify({ engine: 'excalidraw', elements: [], appState: {} })
        }).then(res => {
          setArtifactId(res.artifact._id);
        });
      }
    }
  }, [isListLoading, listData, targetWorkspaceId, createMutation.isPending, artifactId, passedArtifactId]);

  const { data: artifactData, isLoading: isArtifactLoading } = useArtifact(artifactId);
  const activeArtifact = artifactData?.artifact;
  
  const updateMutation = useUpdateArtifact(artifactId);
  const localContentRef = React.useRef('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (activeArtifact) {
      localContentRef.current = activeArtifact.contentText || '';
      setTitle(activeArtifact.title || '');
    }
  }, [activeArtifact]);

  const handleContentChange = (content) => {
    localContentRef.current = content;
  };

  const handleManualSave = () => {
    if (artifactId) {
      updateMutation.mutateAsync({ title: title.trim() || 'Untitled Canvas', contentText: localContentRef.current });
    }
  };

  const handleCreateNewSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!newCanvasTitle.trim()) return;
    
    try {
      const res = await createMutation.mutateAsync({
        workspaceId: targetWorkspaceId,
        title: newCanvasTitle.trim(),
        category: 'Canvas mockup/schema',
        fileType: 'excalidraw',
        contentText: JSON.stringify({ type: 'excalidraw', version: 2, elements: [], appState: {} })
      });
      setArtifactId(res.artifact._id);
      setShowCreateModal(false);
      setNewCanvasTitle('My New Canvas'); // reset for next time
    } catch (err) {
      // Error handled by mutation
    }
  };

  if (isListLoading || isArtifactLoading || (!activeArtifact && createMutation.isPending)) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', paddingTop: '64px' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div className="page-container" style={{ height: '100%', display: 'flex', flexDirection: 'column', paddingTop: '80px' }}>
        {/* Top Toolbar */}
        <div style={{position: 'absolute', left: 0, right: 0, top: '20px', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 5%', marginBottom: '20px' }}>
          
          {/* Left Side: File Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>File name :</span>
            <input 
              type="text" 
              className="form-control form-control-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Canvas File Name"
              style={{ 
                width: '250px', 
                backgroundColor: 'rgba(255, 255, 255, 0.1)', 
                backdropFilter: 'blur(5px)', 
                border: '1px solid rgba(255, 255, 255, 0.2)', 
                color: 'var(--text-primary)',
                fontSize: '1rem',
                fontWeight: '500',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)'
              }}
            />
          </div>

          {/* Right Side: Actions */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => setShowOpenModal(true)}
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(5px)', border: '1px solid rgba(255, 255, 255, 0.2)' }}
            >
              Open Existing Canvas Artifact
            </button>

            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => setShowCreateModal(true)}
              disabled={createMutation.isPending}
            >
              + Create New
            </button>

            <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 5px' }}></div>

            {updateMutation.isPending && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Saving...</span>}
            <button 
              className="btn btn-primary btn-sm"
              onClick={handleManualSave}
              disabled={updateMutation.isPending}
            >
              Save Canvas
            </button>
          </div>
        </div>
      <div className="page-content" style={{ flex: 1, padding: 0, overflow: 'hidden', position: 'relative', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
        {activeArtifact && (
          <CanvasEditor 
            key={activeArtifact._id}
            content={activeArtifact.contentText} 
            onChange={handleContentChange} 
            isReadOnly={false} 
          />
        )}
      </div>

      {/* Glassmorphic Modal */}
      {showOpenModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(10px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'rgba(30, 30, 30, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 'var(--radius-lg)',
            width: '400px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem' }}>Open Existing Canvas</h3>
              <button 
                onClick={() => setShowOpenModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(!listData?.artifacts || listData.artifacts.length === 0) ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No canvas artifacts found.</div>
              ) : (
                listData.artifacts.map(art => (
                  <button
                    key={art._id}
                    onClick={() => {
                      setArtifactId(art._id);
                      setShowOpenModal(false);
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                  >
                    {art.title}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create New Canvas Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(10px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'rgba(30, 30, 30, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 'var(--radius-lg)',
            width: '350px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem' }}>Create New Canvas</h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateNewSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>File Name</label>
                <input 
                  type="text" 
                  autoFocus
                  className="form-control"
                  value={newCanvasTitle}
                  onChange={(e) => setNewCanvasTitle(e.target.value)}
                  placeholder="e.g. System Architecture"
                  style={{ width: '100%', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn btn-primary"
                  disabled={!newCanvasTitle.trim() || createMutation.isPending}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}