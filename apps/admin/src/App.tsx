import { EngineWorkspace } from "./engine/EngineWorkspace";
import { useEffect, useMemo, useRef, useState } from "react";
import { CategoryManager } from "./CategoryManager";
import {
  categoryStorageKey,
  loadLocalCategories,
  type EditorialCategory,
} from "./categories";
import {
  backend,
  loadContent,
  saveContent,
  saveBackendCategory,
} from "./backend";
import {
  blankQuestion,
  blankQuiz,
  download,
  loadWorkspace,
  parseQuestions,
  storageKey,
  validate,
  type EditorialQuiz,
} from "./workspace";
import { QuestionEditor } from "./QuestionEditor";
import { Preview } from "./Preview";

export function App() {
  const [initial] = useState(loadWorkspace);
  const [categories, setCategories] =
    useState<EditorialCategory[]>(loadLocalCategories);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [quizzes, setQuizzes] = useState(initial.quizzes);
  const [editor, setEditor] = useState<EditorialQuiz | null>(null);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [notice, setNotice] = useState(initial.error);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [settings, setSettings] = useState(false);
  const [categoryPage, setCategoryPage] = useState(false);
  const [enginePage, setEnginePage] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const visible = useMemo(
    () =>
      quizzes.filter(
        (q) =>
          (filter === "all" || q.status === filter) &&
          `${q.title} ${categories.find((c) => c.id === q.categoryId)?.name}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [quizzes, filter, search, categories],
  );
  const update = (changes: Partial<EditorialQuiz>) => {
    if (editor && !busy) {
      setEditor({ ...editor, ...changes });
      setDirty(true);
      setErrors([]);
    }
  };
  const leave = () => {
    if (busy) return false;
    if (dirty && !window.confirm("Discard your unsaved edits?")) return false;
    setEditor(null);
    setDirty(false);
    setErrors([]);
    return true;
  };
  const connect = async () => {
    if (!backend || busy) return;
    setBusy(true);
    setErrors([]);
    try {
      const { error } = await backend.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      const content = await loadContent();
      setQuizzes(content.quizzes);
      setCategories(content.categories);
      setConnected(true);
      setPassword("");
      setNotice(
        "Connected to the content service. Changes are saved to the backend.",
      );
    } catch (error) {
      await backend.auth.signOut();
      setErrors([
        error instanceof Error
          ? error.message
          : String(
              (error as { message?: string }).message ?? "Could not connect.",
            ),
      ]);
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async () => {
    if (!leave()) return;
    await backend?.auth.signOut();
    setConnected(false);
    const local = loadWorkspace();
    setQuizzes(local.quizzes);
    setCategories(loadLocalCategories());
    setNotice("Returned to your local workspace.");
  };
  const save = async (status: EditorialQuiz["status"]) => {
    if (!editor || busy) return;
    const problems =
      status === "draft" && !connected
        ? !editor.title.trim()
          ? ["Give your draft a title before saving."]
          : []
        : validate(editor).filter(
            (error) =>
              error !== "Choose a category." ||
              !categories.some((c) => c.id === editor.categoryId),
          );
    if (
      status === "scheduled" &&
      (!editor.scheduledAt ||
        !Number.isFinite(Date.parse(editor.scheduledAt)) ||
        new Date(editor.scheduledAt) <= new Date())
    )
      problems.push("Choose a future date and time.");
    if (problems.length) {
      setErrors(problems);
      return;
    }
    const saved: EditorialQuiz = {
      ...editor,
      title: editor.title.trim(),
      status,
      publishedAt: status === "published" ? new Date().toISOString() : "",
      updatedAt: new Date().toISOString(),
    };
    if (connected) {
      setBusy(true);
      try {
        const id = await saveContent(saved);
        const content = await loadContent();
        setQuizzes(content.quizzes);
        setCategories(content.categories);
        setEditor(content.quizzes.find((q) => q.id === id) ?? saved);
        setDirty(false);
        setErrors([]);
        setNotice(
          status === "published"
            ? "Quiz published to the player catalog."
            : status === "scheduled"
              ? "Quiz scheduled. Players can access it at the selected time."
              : "Draft saved to the backend.",
        );
      } catch (error) {
        setErrors([
          error instanceof Error
            ? error.message
            : String(
                (error as { message?: string }).message ??
                  "Could not save changes.",
              ),
        ]);
      } finally {
        setBusy(false);
      }
      return;
    }
    const next = quizzes.some((q) => q.id === saved.id)
      ? quizzes.map((q) => (q.id === saved.id ? saved : q))
      : [saved, ...quizzes];
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setErrors([
        "Your browser could not save this workspace. Export this quiz to keep your changes.",
      ]);
      return;
    }
    setQuizzes(next);
    setEditor(saved);
    setDirty(false);
    setErrors([]);
    setNotice(
      status === "published"
        ? "Marked published in this local workspace. Export to keep a copy; this does not publish to the player app."
        : status === "scheduled"
          ? "Schedule saved locally. Automatic publishing requires the production backend."
          : "Draft saved in this browser.",
    );
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (leave()) {
              setSettings(false);
              setCategoryPage(false);
              setEnginePage(false);
            }
          }}
        >
          bivia<span>.</span>
        </a>
        <div className="workspace-name">Editorial workspace</div>
        <nav aria-label="Admin navigation">
          <button
            className={
              !settings && !categoryPage && !enginePage
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => {
              if (leave()) {
                setSettings(false);
                setCategoryPage(false);
                setEnginePage(false);
              }
            }}
          >
            <span aria-hidden="true">▤</span> Quizzes
          </button>
          <button
            className={settings ? "nav-item active" : "nav-item"}
            onClick={() => {
              if (leave()) {
                setSettings(true);
                setCategoryPage(false);
                setEnginePage(false);
              }
            }}
          >
            <span aria-hidden="true">⚙</span> Workspace
          </button>
          <button
            className={categoryPage ? "nav-item active" : "nav-item"}
            onClick={() => {
              if (leave()) {
                setCategoryPage(true);
                setSettings(false);
                setEnginePage(false);
              }
            }}
          >
            <span aria-hidden="true">◈</span> Categories
          </button>
          <button
            className={enginePage ? "nav-item active" : "nav-item"}
            onClick={() => {
              if (leave()) {
                setEnginePage(true);
                setCategoryPage(false);
                setSettings(false);
              }
            }}
          >
            <span aria-hidden="true">✧</span> Trivia engine
          </button>
        </nav>
        <div className="sidebar-bottom">
          <span className="local-dot" />{" "}
          {connected ? "Connected workspace" : "Local workspace"}
          <p>
            {connected
              ? "Changes are saved to your backend."
              : "Content stays in this browser."}
          </p>
          <button
            className="text-button"
            onClick={() =>
              download("bivia-workspace.json", { quizzes, categories })
            }
          >
            Export all quizzes
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Bivia /{" "}
            {enginePage
              ? "Trivia engine"
              : categoryPage
                ? "Categories"
                : settings
                  ? "Workspace"
                  : editor
                    ? "Quizzes / Editor"
                    : "Quizzes"}
          </span>
          <span className="local-badge">
            {busy
              ? "Working…"
              : connected
                ? "Connected workspace"
                : "Local workspace"}
          </span>
        </header>
        <main>
          {notice && (
            <div role="status" className="notice">
              <span>{notice}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                ×
              </button>
            </div>
          )}
          {enginePage ? (
            <EngineWorkspace
              connected={connected}
              categories={categories}
              connect={() => {
                setEnginePage(false);
                setSettings(true);
              }}
              openDraft={async (quizId) => {
                const content = await loadContent();
                const draft = content.quizzes.find(
                  (quiz) => quiz.id === quizId,
                );
                if (!draft)
                  throw new Error(
                    "The exported draft could not be loaded. Refresh the quiz library.",
                  );
                setQuizzes(content.quizzes);
                setCategories(content.categories);
                setEditor(draft);
                setDirty(false);
                setEnginePage(false);
                setNotice(
                  "Approved round opened as a draft. Review it before publishing.",
                );
              }}
            />
          ) : categoryPage ? (
            <CategoryManager
              categories={categories}
              connected={connected}
              onDirty={setDirty}
              onSave={async (category) => {
                if (connected) {
                  await saveBackendCategory(category);
                  const content = await loadContent();
                  setCategories(content.categories);
                } else {
                  const next = categories.some((c) => c.id === category.id)
                    ? categories.map((c) =>
                        c.id === category.id ? category : c,
                      )
                    : [...categories, category];
                  localStorage.setItem(
                    categoryStorageKey,
                    JSON.stringify(next),
                  );
                  setCategories(next);
                }
              }}
            />
          ) : settings ? (
            <>
              <div className="page-heading">
                <div>
                  <h1>Your workspace</h1>
                  <p>The tools behind every good trivia day.</p>
                </div>
              </div>
              <section className="settings-panel">
                <h2>
                  {connected
                    ? "Connected editorial workspace"
                    : "Local editorial workspace"}
                </h2>
                <p>
                  {connected
                    ? "Content loads from the backend. Export a copy at any time. Local drafts remain saved separately in this browser."
                    : "Drafts, schedules, and publication labels are saved in this browser. They are separate from the player app. Export regularly to keep your work."}
                </p>
                <button
                  className="secondary"
                  onClick={() =>
                    download("bivia-workspace.json", { quizzes, categories })
                  }
                >
                  Export workspace JSON
                </button>
                <hr />
                <h2>Content service</h2>
                {connected ? (
                  <>
                    <p>
                      You are signed in with editorial access. Saving and
                      publishing update the connected backend.
                    </p>
                    <button className="secondary" onClick={disconnect}>
                      Sign out and use local workspace
                    </button>
                  </>
                ) : backend ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void connect();
                    }}
                  >
                    <p>
                      Sign in with an administrator account to load and manage
                      backend content. Your local drafts remain separate.
                    </p>
                    <label>
                      Email
                      <input
                        type="email"
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Password
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </label>
                    <button className="primary" disabled={busy} type="submit">
                      {busy ? "Connecting…" : "Sign in to content service"}
                    </button>
                  </form>
                ) : (
                  <p>
                    No content service is configured. Add the Supabase URL and
                    publishable key to the admin environment to enable sign in.
                  </p>
                )}
                {errors.length > 0 && (
                  <div className="error-box" role="alert">
                    {errors.join(" ")}
                  </div>
                )}
                <h2>Trivia engine</h2>
                <p>
                  Create a round brief, run the research and review stages, and
                  approve a complete round before exporting it as a draft.
                  Generation requires an authenticated backend; provider
                  credentials stay on the server.
                </p>
                <button
                  className="secondary"
                  onClick={() => {
                    setSettings(false);
                    setEnginePage(true);
                  }}
                >
                  Open trivia engine
                </button>
              </section>
            </>
          ) : editor ? (
            <>
              <button className="back-link" onClick={leave}>
                ← All quizzes
              </button>
              <div className="page-heading">
                <div>
                  <h1>{editor.title || "Create a quiz"}</h1>
                  <p>
                    {dirty
                      ? "Unsaved changes"
                      : "Build a little curiosity into someone’s day."}
                  </p>
                </div>
                <div className="button-row">
                  <button
                    className="secondary"
                    onClick={() => setPreview(true)}
                  >
                    Preview
                  </button>
                  <button
                    className="primary"
                    onClick={() => save("draft")}
                    disabled={busy}
                  >
                    {busy ? "Saving…" : "Save draft"}
                  </button>
                </div>
              </div>
              {errors.length > 0 && (
                <div className="error-box" role="alert">
                  <strong>A few things need your attention</strong>
                  <ul>
                    {errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="editor-layout">
                <div className="editor-content">
                  <section className="details-panel">
                    <h2>Quiz details</h2>
                    <label>
                      Title
                      <input
                        value={editor.title}
                        onChange={(e) => update({ title: e.target.value })}
                        placeholder="A curious little challenge"
                        maxLength={120}
                      />
                    </label>
                    <label>
                      Description
                      <input
                        value={editor.subtitle}
                        onChange={(e) => update({ subtitle: e.target.value })}
                        placeholder="What can players look forward to?"
                        maxLength={240}
                      />
                    </label>
                    <div className="two-columns">
                      <label>
                        Category
                        <select
                          value={editor.categoryId}
                          onChange={(e) =>
                            update({ categoryId: e.target.value })
                          }
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {connected
                          ? "Game modes are chosen by players"
                          : "Game mode"}
                        <select
                          disabled={connected}
                          value={editor.mode}
                          onChange={(e) =>
                            update({
                              mode: e.target.value as EditorialQuiz["mode"],
                            })
                          }
                        >
                          <option value="category">Category trivia</option>
                          <option value="timed">Timed trivia</option>
                          <option value="challenger">Challenger</option>
                        </select>
                      </label>
                    </div>
                  </section>
                  <div className="section-heading questions-heading">
                    <h2>
                      Questions{" "}
                      <span className="count">{editor.questions.length}</span>
                    </h2>
                    <button
                      className="text-button"
                      onClick={() => upload.current?.click()}
                    >
                      Import JSON
                    </button>
                    <input
                      ref={upload}
                      hidden
                      aria-label="Import questions JSON"
                      type="file"
                      accept=".json,application/json"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          if (file.size > 1_000_000)
                            throw new Error(
                              "Choose a JSON file smaller than 1 MB.",
                            );
                          const questions = parseQuestions(await file.text());
                          if (
                            editor.questions.some((q) => q.prompt.trim()) &&
                            !window.confirm(
                              `Replace the current questions with ${questions.length} imported questions?`,
                            )
                          )
                            return;
                          update({ questions });
                          setNotice(
                            `Imported ${questions.length} questions. Review them before publishing.`,
                          );
                        } catch (error) {
                          setErrors([
                            error instanceof Error
                              ? error.message
                              : "Could not import this file.",
                          ]);
                        } finally {
                          e.target.value = "";
                        }
                      }}
                    />
                  </div>
                  {editor.questions.map((q, i) => (
                    <QuestionEditor
                      key={q.id}
                      question={q}
                      index={i}
                      update={(question) =>
                        update({
                          questions: editor.questions.map((item) =>
                            item.id === q.id ? question : item,
                          ),
                        })
                      }
                      remove={() => {
                        if (
                          (!q.prompt.trim() &&
                            q.answers.every((a) => !a.trim())) ||
                          window.confirm(`Remove question ${i + 1}?`)
                        )
                          update({
                            questions: editor.questions.filter(
                              (item) => item.id !== q.id,
                            ),
                          });
                      }}
                    />
                  ))}
                  <button
                    className="add-question"
                    onClick={() =>
                      update({
                        questions: [...editor.questions, blankQuestion()],
                      })
                    }
                  >
                    + Add a question
                  </button>
                </div>
                <aside className="publish-panel">
                  <h2>Publication</h2>
                  <span className={`status ${editor.status}`}>
                    {editor.status}
                  </span>
                  <p>
                    Review every answer and Bible reference before marking a
                    quiz ready.
                  </p>
                  <label>
                    Schedule <span className="muted">Your local time</span>
                    <input
                      type="datetime-local"
                      value={editor.scheduledAt}
                      onChange={(e) => update({ scheduledAt: e.target.value })}
                    />
                  </label>
                  <button
                    className="secondary full-width"
                    onClick={() => save("scheduled")}
                    disabled={busy}
                  >
                    {connected ? "Schedule quiz" : "Save schedule locally"}
                  </button>
                  <button
                    className="primary full-width"
                    onClick={() => save("published")}
                    disabled={busy}
                  >
                    {connected ? "Publish quiz" : "Mark published locally"}
                  </button>
                  <p className="small-note">
                    {connected
                      ? "Published quizzes appear in the player catalog. Scheduled quizzes appear at the selected time."
                      : "Local statuses only. These actions do not make content available to players."}
                  </p>
                  <hr />
                  <button
                    className="text-button"
                    onClick={() =>
                      download(`${editor.title || "bivia-quiz"}.json`, editor)
                    }
                  >
                    Export this quiz
                  </button>
                  <details>
                    <summary>Question JSON format</summary>
                    <pre>
                      {JSON.stringify(
                        [
                          {
                            prompt: "Your question",
                            answers: ["A", "B", "C", "D"],
                            correctIndex: 0,
                            hint: "Your Bible clue",
                            reference: "Book 1:1",
                          },
                        ],
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </aside>
              </div>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <h1>Make room for curiosity.</h1>
                  <p>Create the questions. Spark the connection.</p>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    setEditor({
                      ...blankQuiz(),
                      categoryId: categories[0]?.id ?? "",
                    });
                    setDirty(false);
                    setErrors([]);
                  }}
                >
                  + Create quiz
                </button>
              </div>
              <section className="library-panel">
                <div className="library-heading">
                  <h2>
                    Your quizzes <span className="count">{quizzes.length}</span>
                  </h2>
                  <label className="search-label">
                    <span className="sr-only">Search quizzes</span>
                    <input
                      type="search"
                      placeholder="Search quizzes…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                <div className="tabs" aria-label="Filter quizzes">
                  {["all", "draft", "scheduled", "published"].map((status) => (
                    <button
                      key={status}
                      aria-pressed={filter === status}
                      className={filter === status ? "selected" : ""}
                      onClick={() => setFilter(status)}
                    >
                      {status === "all"
                        ? "All quizzes"
                        : status.charAt(0).toUpperCase() + status.slice(1)}{" "}
                      <span>
                        {status === "all"
                          ? quizzes.length
                          : quizzes.filter((q) => q.status === status).length}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="quiz-table">
                  <div className="table-header">
                    <span>Quiz</span>
                    <span>Questions</span>
                    <span>Status</span>
                    <span />
                  </div>
                  {visible.map((q) => (
                    <button
                      className="quiz-row"
                      key={q.id}
                      onClick={() => {
                        setEditor(structuredClone(q));
                        setDirty(false);
                        setErrors([]);
                      }}
                    >
                      <span className="quiz-title-cell">
                        <span className="category-square" aria-hidden="true">
                          {categories
                            .find((c) => c.id === q.categoryId)
                            ?.name.charAt(0) ?? "B"}
                        </span>
                        <span>
                          <strong>{q.title}</strong>
                          <small>
                            {
                              categories.find((c) => c.id === q.categoryId)
                                ?.name
                            }{" "}
                            ·{" "}
                            {q.mode === "category"
                              ? "Category trivia"
                              : q.mode === "timed"
                                ? "Timed trivia"
                                : "Challenger"}
                          </small>
                        </span>
                      </span>
                      <span className="question-count">
                        {q.questions.length}
                      </span>
                      <span>
                        <span className={`status ${q.status}`}>{q.status}</span>
                        {q.status === "scheduled" && (
                          <small>
                            {new Date(q.scheduledAt).toLocaleString()}
                          </small>
                        )}
                      </span>
                      <span className="row-arrow" aria-hidden="true">
                        ↗
                      </span>
                    </button>
                  ))}
                  {!visible.length && (
                    <div className="empty-state">
                      <h3>No quizzes here yet</h3>
                      <p>
                        {search
                          ? "Try another search or filter."
                          : "Create a quiz to start building your collection."}
                      </p>
                    </div>
                  )}
                </div>
              </section>
              <p className="library-note">
                {connected
                  ? "Content is loaded from your backend. Only administrators can access this editorial workspace."
                  : "Sample quizzes are included as drafts. All edits stay in this browser until you export them."}
              </p>
            </>
          )}
        </main>
        <footer>A little knowledge. A little faith. A lot of fun.</footer>
      </div>
      {preview && editor && (
        <Preview quiz={editor} close={() => setPreview(false)} />
      )}
    </div>
  );
}
