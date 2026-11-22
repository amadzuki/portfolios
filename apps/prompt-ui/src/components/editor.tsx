import { javascript } from '@codemirror/lang-javascript';
import { Compartment, EditorState, Prec } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { useEffect, useRef } from 'react';

const theme = EditorView.theme(
  {
    '&': { height: '100%', fontSize: '12.5px', backgroundColor: '#0c0b12' },
    '.cm-scroller': {
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      lineHeight: '1.6',
      fontVariantLigatures: 'none',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      border: 'none',
      color: '#5b5870',
    },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: '#ffffff08' },
    '&.cm-focused': { outline: 'none' },
  },
  { dark: true },
);

/** CodeMirror 6 TSX editor. Controlled-ish: external `value` changes replace the doc. */
export function CodeEditor({
  value,
  onChange,
  readOnly,
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const ro = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          javascript({ jsx: true, typescript: true }),
          oneDark,
          Prec.highest(theme),
          EditorView.lineWrapping,
          ro.current.of(EditorState.readOnly.of(readOnly)),
          EditorView.updateListener.of((u) => {
            if (
              u.docChanged &&
              u.transactions.some(
                (t) =>
                  t.isUserEvent('input') ||
                  t.isUserEvent('delete') ||
                  t.isUserEvent('undo') ||
                  t.isUserEvent('redo') ||
                  t.isUserEvent('move'),
              )
            ) {
              onChangeRef.current(u.state.doc.toString());
            }
          }),
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
    // create once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current !== value) {
      v.dispatch({ changes: { from: 0, to: current.length, insert: value } });
      if (readOnly)
        v.dispatch({ effects: EditorView.scrollIntoView(v.state.doc.length) });
    }
  }, [value, readOnly]);

  useEffect(() => {
    view.current?.dispatch({
      effects: ro.current.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  return (
    <div
      ref={host}
      className="h-full min-h-0 overflow-hidden"
      aria-label="Component source code"
    />
  );
}
