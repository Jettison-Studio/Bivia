import { useState } from 'react';
import { backend } from './backend';
export function ScripturePreview({ reference }: { reference: string }) {
  const [passage, setPassage] = useState<{ reference: string; text: string; copyright: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    if (!backend || busy) return;
    setBusy(true); setError('');
    try {
      const { data, error } = await backend.functions.invoke('bible-passage', { body: { reference } });
      if (error || !data?.text) throw new Error('Could not load this NIV passage. Check the reference and retry.');
      setPassage({ ...data, key: reference });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load passage.'); }
    finally { setBusy(false); }
  }
  const current = passage?.key === reference ? passage : null;
  return <div className="scripture-preview">
    <button type="button" className="text-button" disabled={!backend || !reference.trim() || busy} onClick={load}>{busy ? 'Loading Scripture…' : 'Preview full NIV passage'}</button>
    {error && <p role="alert">{error}</p>}
    {current && <><blockquote>{current.text}<footer>{current.reference} · NIV</footer></blockquote><p className="small-note">Scripture provided by YouVersion<br />{current.copyright}</p><p className="small-note">Check the full passage for context and answer giveaways before approving. This preview is not sent to AI.</p></>}
  </div>;
}
