
// OPTIONAL Beispiel-App, die die Save-Toolbar über den Editor setzt.
// Wenn du diese Datei als src/App.tsx verwendest, wird der bestehende Editor nicht verändert.
import React from 'react';
import KirmasEditor from './features/editor/KirmasEditor';
import EditorSaveToolbar from './features/editor/EditorSaveToolbar';

export default function App() {
  const [schema, setSchema] = React.useState<any>({ title: 'Neue Erhebung', pages: [] });

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottom: '1px solid #EAECF0' }}>
        <div style={{ fontWeight: 700 }}>KIRMAS – Editor</div>
        <EditorSaveToolbar getSchema={() => schema} />
      </header>
      <main style={{ overflow: 'auto' }}>
        <KirmasEditor schema={schema} onChange={setSchema} />
      </main>
    </div>
  );
}
