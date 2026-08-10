import React, { useState, useEffect } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

export default function ExcalidrawEditor({ initialData, onChange, isReadOnly }) {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);

  const onChangeRef = React.useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (excalidrawAPI && !isReadOnly) {
      let timeoutId;
      excalidrawAPI.onChange((elements, state) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (onChangeRef.current) {
            onChangeRef.current({ elements, appState: { viewBackgroundColor: state.viewBackgroundColor } });
          }
        }, 1000);
      });
    }
  }, [excalidrawAPI, isReadOnly]);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        initialData={initialData ? { elements: initialData.elements, appState: initialData.appState } : null}
        viewModeEnabled={isReadOnly}
        theme="dark"
      />
    </div>
  );
}
