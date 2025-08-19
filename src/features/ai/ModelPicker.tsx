import React from 'react';

type Props = {
  provider: 'openai' | 'gemini';
  model: string;
  onProviderChange: (p: 'openai' | 'gemini') => void;
  onModelChange: (m: string) => void;
};

const OPENAI_MODELS = ['gpt-5', 'gpt-4o', 'gpt-4'];
const GEMINI_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash'];

export default function ModelPicker({ provider, model, onProviderChange, onModelChange }: Props) {
  const models = provider === 'openai' ? OPENAI_MODELS : GEMINI_MODELS;
  React.useEffect(() => {
    if (!models.includes(model)) onModelChange(models[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <label>
        Anbieter:&nbsp;
        <select value={provider} onChange={e => onProviderChange(e.target.value as any)}>
          <option value="openai">OpenAI</option>
          <option value="gemini">Google Gemini</option>
        </select>
      </label>
      <label>
        Modell:&nbsp;
        <select value={model} onChange={e => onModelChange(e.target.value)}>
          {models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
    </div>
  );
}
