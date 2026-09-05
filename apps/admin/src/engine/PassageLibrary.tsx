import { useState } from "react";
import { engineRpc, type Passage } from "./api";
import { sourceLink } from "./brief";
const emptyPassage: Omit<Passage, "id"> = {
  reference: "",
  text: "",
  translation: "NIV",
  verified: false,
  rightsAttested: false,
  aiUseAttested: false,
  rightsNote: "",
  sourceUrl: "",
  context: "",
};
export function PassageLibrary({
  passages,
  refresh,
  busy: parentBusy,
}: {
  passages: Passage[];
  refresh: () => Promise<void>;
  busy: boolean;
}) {
  const [editor, setEditor] = useState<Omit<Passage, "id"> & { id?: string }>(
    emptyPassage,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function save() {
    setError("");
    setNotice("");
    if (
      !editor.reference.trim() ||
      !editor.text.trim() ||
      !editor.context.trim() ||
      !sourceLink(editor.sourceUrl) ||
      !editor.rightsNote.trim()
    ) {
      setError(
        "Add the reference, exact licensed text, source URL, surrounding context, and AI-use permission details.",
      );
      return;
    }
    if (!editor.verified || !editor.rightsAttested || !editor.aiUseAttested) {
      setError(
        "Confirm both source verification and explicit permission for AI processing before saving.",
      );
      return;
    }
    setBusy(true);
    try {
      const saved = await engineRpc<Passage>("passage_save", editor);
      await refresh();
      setEditor(saved);
      setNotice("Verified passage saved to the source library.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the passage.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="engine-library">
      <div className="section-heading">
        <h2>
          Verified NIV passages <span className="count">{passages.length}</span>
        </h2>
        <button
          className="text-button"
          disabled={busy || parentBusy}
          onClick={() => {
            setEditor(emptyPassage);
            setError("");
            setNotice("");
          }}
        >
          New passage
        </button>
      </div>
      <p className="engine-note">
        Only provide NIV text covered by permission that explicitly allows this
        AI use. A publicly accessible Bible page is a source for checking text,
        not an AI-use license. Original clue mode remains available without
        supplying NIV quotations.
      </p>
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      <div className="passage-layout">
        <div className="passage-list">
          {passages.length ? (
            passages.map((passage) => (
              <button
                key={passage.id}
                className={`passage-row ${editor.id === passage.id ? "selected" : ""}`}
                disabled={busy || parentBusy}
                onClick={() => {
                  setEditor(passage);
                  setError("");
                  setNotice("");
                }}
              >
                <strong>{passage.reference}</strong>
                <small>
                  {passage.verified &&
                  passage.rightsAttested &&
                  passage.aiUseAttested
                    ? "Verified · AI rights attested"
                    : "Not eligible for generation"}
                </small>
              </button>
            ))
          ) : (
            <p className="muted">No verified passages supplied.</p>
          )}
        </div>
        <fieldset className="engine-brief" disabled={busy || parentBusy}>
          <legend className="sr-only">Licensed passage editor</legend>
          <label>
            Reference
            <input
              value={editor.reference}
              onChange={(e) =>
                setEditor({ ...editor, reference: e.target.value })
              }
              placeholder="Book chapter:verse"
              maxLength={180}
            />
          </label>
          <label>
            Exact licensed NIV text
            <textarea
              rows={5}
              value={editor.text}
              onChange={(e) => setEditor({ ...editor, text: e.target.value })}
              maxLength={8000}
            />
          </label>
          <label>
            Source URL
            <input
              type="url"
              value={editor.sourceUrl}
              onChange={(e) =>
                setEditor({ ...editor, sourceUrl: e.target.value })
              }
              placeholder="https://…"
            />
          </label>
          <label>
            Surrounding context
            <textarea
              rows={3}
              value={editor.context}
              onChange={(e) =>
                setEditor({ ...editor, context: e.target.value })
              }
              placeholder="Who is speaking? What does the passage mean in context?"
              maxLength={3000}
            />
          </label>
          <label>
            Permission for AI processing
            <textarea
              rows={3}
              value={editor.rightsNote}
              onChange={(e) =>
                setEditor({ ...editor, rightsNote: e.target.value })
              }
              placeholder="Identify the license or written permission that explicitly authorizes AI use."
              maxLength={3000}
            />
          </label>
          <label className="engine-checkbox">
            <input
              type="checkbox"
              checked={editor.verified}
              onChange={(e) =>
                setEditor({ ...editor, verified: e.target.checked })
              }
            />
            I checked this exact text and its context against the stated source.
          </label>
          <label className="engine-checkbox">
            <input
              type="checkbox"
              checked={editor.rightsAttested && editor.aiUseAttested}
              onChange={(e) =>
                setEditor({
                  ...editor,
                  rightsAttested: e.target.checked,
                  aiUseAttested: e.target.checked,
                })
              }
            />
            I attest that our permission explicitly allows this text to be
            processed by the AI engine.
          </label>
          <button className="primary" onClick={save}>
            {busy ? "Saving…" : "Save verified passage"}
          </button>
        </fieldset>
      </div>
    </section>
  );
}
