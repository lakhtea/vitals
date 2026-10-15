"use client";

// The in-place editor for one proposed file: CodeMirror 6 with line numbers,
// undo and redo, and syntax highlighting, and nothing else. Loaded lazily by
// FixReview, so its code is a separate chunk fetched only when someone edits.
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, bracketMatching, defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { useEffect, useRef, type ReactElement } from "react";
import type { EditorLanguage } from "../fix-review";
import styles from "./CodeEditor.module.css";

export interface CodeEditorProps {
  value: string;
  onChange: (next: string) => void;
  language: EditorLanguage;
  /** The editor's accessible name, e.g. "Edit src/demo/slow-upstream.ts". */
  label: string;
  /** id of the element that describes the editor */
  describedBy?: string;
}

const languageSupport = (language: EditorLanguage): Extension => {
  switch (language) {
    case "typescript":
      return javascript({ typescript: true });
    case "javascript":
      return javascript({ jsx: true });
    case "css":
      return css();
    case "json":
      return json();
    case "markdown":
      return markdown();
    case "text":
      return [];
  }
};

// CodeMirror's default token colours are chosen for a white page and fall below 4.5:1 on the dark one.
// Each keeps its light value and gains a lighter twin through CSS light-dark(), which follows the
// page's color-scheme (globals.css sets it to dark under prefers-color-scheme), so no script is needed.
const DARK_TOKEN_COLORS: Record<string, string> = {
  "#404740": "#b5c2b5",
  "#708": "#d8b4fe",
  "#219": "#93c5fd",
  "#164": "#86efac",
  "#a11": "#fca5a5",
  "#e40": "#fdba74",
  "#00f": "#a5b4fc",
  "#30a": "#c4b5fd",
  "#085": "#5eead4",
  "#167": "#67e8f9",
  "#256": "#7dd3fc",
  "#00c": "#a5b4fc",
  "#940": "#e5c07b",
  "#f00": "#f87171",
};

const dashboardHighlightStyle = HighlightStyle.define(
  defaultHighlightStyle.specs.map((spec) => {
    const dark = typeof spec.color === "string" ? DARK_TOKEN_COLORS[spec.color] : undefined;
    return dark === undefined ? spec : { ...spec, color: `light-dark(${spec.color}, ${dark})` };
  }),
);

// Colours come from the dashboard's CSS variables, so dark mode follows the page with no second theme.
const dashboardTheme = EditorView.theme({
  "&": {
    color: "var(--foreground)",
    backgroundColor: "var(--background)",
    fontSize: "0.8125rem",
  },
  "&.cm-focused": {
    outline: "2px solid var(--foreground)",
    outlineOffset: "2px",
  },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    lineHeight: "1.25rem",
  },
  // The editor's outline above already shows focus; a second ring on the content would double it.
  ".cm-content:focus-visible": {
    outline: "none",
  },
  ".cm-content": {
    caretColor: "var(--foreground)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--foreground)",
  },
  ".cm-gutters": {
    color: "var(--muted)",
    backgroundColor: "var(--surface)",
    borderRight: "1px solid var(--border)",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    {
      backgroundColor: "color-mix(in srgb, var(--foreground) 20%, transparent)",
    },
  "&.cm-focused .cm-matchingBracket": {
    backgroundColor: "color-mix(in srgb, var(--rating-good) 25%, transparent)",
  },
});

export const CodeEditor = ({ value, onChange, language, label, describedBy }: CodeEditorProps): ReactElement => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // The latest props the long-lived editor reads, without being rebuilt on every keystroke.
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;

    const contentAttributes: Record<string, string> = { "aria-label": label };
    if (describedBy !== undefined) contentAttributes["aria-describedby"] = describedBy;

    // No indentWithTab: Tab keeps moving focus, so a keyboard user can always leave the editor.
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: valueRef.current,
        extensions: [
          lineNumbers(),
          history(),
          bracketMatching(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          languageSupport(language),
          syntaxHighlighting(dashboardHighlightStyle),
          dashboardTheme,
          // Long lines wrap and the editor grows with its file, so nothing scrolls inside it: a scrolling
          // box would need its own tab stop (axe's scrollable-region-focusable), and wrapping also reflows.
          EditorView.lineWrapping,
          EditorView.contentAttributes.of(contentAttributes),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [language, label, describedBy]);

  // A new value from outside (a reset, a newer revision) replaces the document.
  useEffect(() => {
    const view = viewRef.current;
    if (view === null) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return <div ref={hostRef} className={styles.editor} />;
};
