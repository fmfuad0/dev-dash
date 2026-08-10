import React, { useMemo } from 'react';
import ExcalidrawEditor from './ExcalidrawEditor.jsx';

export default function CanvasEditor({ content, onChange, isReadOnly }) {
  const parsedData = useMemo(() => {
    try {
      return content ? JSON.parse(content) : null;
    } catch (e) {
      return null;
    }
  }, [content]);

  const handleSaveData = (data) => {
    if (onChange) {
      // Keep engine field for backward compatibility with older artifacts if needed,
      // but default to excalidraw structure.
      onChange(JSON.stringify({ engine: 'excalidraw', ...data })); 
    }
  }; 

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
      <div style={{ flex: 1, position: 'relative', background: 'var(--bg-elevated)' }}>
        <ExcalidrawEditor 
          initialData={parsedData?.elements ? parsedData : null} 
          onChange={handleSaveData} 
          isReadOnly={isReadOnly} 
        />
      </div>
    </div>
  );
}
