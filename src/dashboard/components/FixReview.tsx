"use client";

// The "Proposed change" panel: the fix under review as one read-only diff per
// file, an Edit action that opens a file's proposed contents in CodeMirror, and
// the revision history. The page runs the mutation and reports busy and error
// back; this component only owns which file is open and the unsaved draft.
import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { formatDateTime } from "../dates";
import {
  editorLanguageFor,
  fileActionLabel,
  fixAuthorLabel,
  type FileActionName,
  type FixAuthorName,
} from "../fix-review";
import { isoTimestamp } from "../incidents";
import { DiffView } from "./DiffView";
import styles from "./FixReview.module.css";

// CodeMirror is a separate chunk, fetched only when someone clicks Edit; ssr is off because it needs the DOM.
const CodeEditor = dynamic(() => import("./CodeEditor").then((module) => module.CodeEditor), {
  ssr: false,
  loading: () => <p className={styles.loading}>Loading the editor...</p>,
});

export interface FixFileData {
  path: string;
  action: FileActionName;
  /** This file's unified diff against the base commit, as the server computes it. */
  diff: string;
  /** The file's proposed contents; null when the file is deleted. */
  afterContent: string | null;
}

export interface FixRevisionData {
  id: string;
  number: number;
  author: FixAuthorName;
  createdAt: string | number;
  summary: string;
  targetRepo: string;
  baseSha: string;
  /** True once a REVIEW step covers this revision. */
  reviewed: boolean;
  files: FixFileData[];
}

export interface FixRevisionSummary {
  number: number;
  author: FixAuthorName;
  createdAt: string | number;
  summary: string;
}

export interface FixEdit {
  revisionId: string;
  files: Array<{ path: string; afterContent: string }>;
  note: string;
}

export interface FixReviewProps {
  /** The latest revision. */
  revision: FixRevisionData;
  /** Every revision, oldest first. */
  history: FixRevisionSummary[];
  /** False once the incident is approved or closed. */
  editable: boolean;
  /** Saves the edit as a new revision; rejects when the save failed (the page reports why through `error`). */
  onSave: (edit: FixEdit) => Promise<void>;
  /** True while the page is saving; the buttons wait. */
  busy: boolean;
  /** The page's message when a save failed; announced, and cleared by the page on retry. */
  error: string | null;
}

interface Draft {
  path: string;
  original: string;
  content: string;
  note: string;
}

const SHORT_SHA_LENGTH = 7;
const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/;

/** A real commit SHA reads better shortened, as git shows it; anything else (a demo label) is shown whole. */
const displaySha = (sha: string): string => (FULL_COMMIT_SHA.test(sha) ? sha.slice(0, SHORT_SHA_LENGTH) : sha);
const NOTE_ROWS = 2;

const Timestamp = ({ value }: { value: string | number }): ReactElement => (
  <time dateTime={isoTimestamp(value)}>{formatDateTime(value)}</time>
);

const isEditableAction = (action: FileActionName): boolean => action === "add" || action === "modify";

export const FixReview = ({ revision, history, editable, onSave, busy, error }: FixReviewProps): ReactElement => {
  const id = useId();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [nothingChanged, setNothingChanged] = useState(false);
  const editButtons = useRef(new Map<string, HTMLButtonElement>());
  // The Edit button to focus once the editor has closed and the button is back in the page.
  const focusAfterClose = useRef<string | null>(null);

  useEffect(() => {
    const path = focusAfterClose.current;
    if (path === null || draft !== null) return;
    focusAfterClose.current = null;
    editButtons.current.get(path)?.focus();
  }, [draft]);

  const openEditor = (file: FixFileData): void => {
    const content = file.afterContent ?? "";
    setNothingChanged(false);
    setDraft({ path: file.path, original: content, content, note: "" });
  };

  const closeEditor = (path: string): void => {
    focusAfterClose.current = path;
    setNothingChanged(false);
    setDraft(null);
  };

  const save = async (current: Draft): Promise<void> => {
    if (current.content === current.original) {
      setNothingChanged(true);
      return;
    }
    setNothingChanged(false);
    try {
      await onSave({
        revisionId: revision.id,
        files: [{ path: current.path, afterContent: current.content }],
        note: current.note.trim(),
      });
    } catch {
      // The page shows why through `error`; the draft stays open so nothing typed is lost.
      return;
    }
    closeEditor(current.path);
  };

  const editedSinceReview = !revision.reviewed && revision.author === "human";
  const hintId = `${id}-editor-hint`;
  const noteId = `${id}-note`;

  return (
    <section className={styles.panel} aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 id={`${id}-title`} className={styles.title}>
            Proposed change
          </h2>
          {editedSinceReview && (
            <span className={styles.pill} data-tone="needs-improvement">
              Edited since last review
            </span>
          )}
        </div>
        <p className={styles.meta}>
          Revision {revision.number} by {fixAuthorLabel(revision.author)}, <Timestamp value={revision.createdAt} />,
          against <code className={styles.code}>{revision.targetRepo}</code> at{" "}
          <code className={styles.code}>{displaySha(revision.baseSha)}</code>
        </p>
        <p className={styles.summary}>{revision.summary}</p>
      </header>

      {revision.files.length === 0 ? (
        <p className={styles.empty}>This revision changes no files.</p>
      ) : (
        <ul className={styles.files} aria-label="Changed files">
          {revision.files.map((file) => {
            const isOpen = draft?.path === file.path;
            const canEdit = editable && isEditableAction(file.action);

            return (
              <li key={file.path} className={styles.file}>
                <div className={styles.fileHeader}>
                  <h3 className={styles.fileTitle}>
                    <code className={styles.path}>{file.path}</code>{" "}
                    <span className={styles.pill} data-tone={file.action === "delete" ? "poor" : "none"}>
                      {fileActionLabel(file.action)}
                    </span>
                  </h3>
                  {canEdit && !isOpen && (
                    <button
                      type="button"
                      className={styles.secondary}
                      disabled={busy || draft !== null}
                      ref={(node) => {
                        if (node === null) return;
                        editButtons.current.set(file.path, node);
                        return () => {
                          editButtons.current.delete(file.path);
                        };
                      }}
                      onClick={() => openEditor(file)}
                    >
                      Edit<span className={styles.visuallyHidden}> {file.path}</span>
                    </button>
                  )}
                </div>

                {isOpen && draft !== null ? (
                  <form
                    className={styles.form}
                    aria-busy={busy}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void save(draft);
                    }}
                  >
                    <p id={hintId} className={styles.hint}>
                      Saving keeps this revision and adds a new one with your change. Tab leaves the editor.
                    </p>
                    <CodeEditor
                      value={draft.content}
                      onChange={(content) => {
                        setNothingChanged(false);
                        setDraft((previous) => (previous === null ? previous : { ...previous, content }));
                      }}
                      language={editorLanguageFor(file.path)}
                      label={`Edit ${file.path}`}
                      describedBy={hintId}
                    />
                    <div className={styles.field}>
                      <label htmlFor={noteId} className={styles.label}>
                        Why you changed it (optional)
                      </label>
                      <textarea
                        id={noteId}
                        className={styles.note}
                        rows={NOTE_ROWS}
                        value={draft.note}
                        onChange={(event) => {
                          const note = event.target.value;
                          setDraft((previous) => (previous === null ? previous : { ...previous, note }));
                        }}
                      />
                    </div>
                    {error !== null && (
                      <p role="alert" className={styles.error}>
                        {error}
                      </p>
                    )}
                    <div className={styles.buttons}>
                      <button type="submit" className={styles.primary} disabled={busy}>
                        Save as new revision
                      </button>
                      <button
                        type="button"
                        className={styles.secondary}
                        disabled={busy}
                        onClick={() => closeEditor(file.path)}
                      >
                        Cancel
                      </button>
                      <p role="status" className={styles.status}>
                        {busy ? "Saving..." : nothingChanged ? "Nothing changed." : ""}
                      </p>
                    </div>
                  </form>
                ) : (
                  <DiffView path={file.path} diff={file.diff} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.history}>
        <h3 id={`${id}-history`} className={styles.historyTitle}>
          Revision history
        </h3>
        <ol className={styles.revisions} aria-labelledby={`${id}-history`}>
          {history.map((entry) => (
            <li key={entry.number} className={styles.revision}>
              <span className={styles.revisionHeading}>
                Revision {entry.number} by {fixAuthorLabel(entry.author)},{" "}
                <span className={styles.revisionTime}>
                  <Timestamp value={entry.createdAt} />
                </span>
              </span>
              <span className={styles.revisionSummary}>{entry.summary}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
