'use client';
import { useChat } from '@ai-sdk/react';
import { knowledgeBase, parseCitations } from '@portfolios/content';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';

const SUGGESTIONS = [
  'What does Ahmad do now?',
  'What did he build at ProSpace?',
  'Which tech stack is he strongest in?',
  'How did he get into software?',
];

function MessageText({ message }: { message: UIMessage }) {
  const docs = useMemo(() => knowledgeBase(), []);
  const text = message.parts
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join('');
  if (message.role === 'user') return <>{text}</>;
  return (
    <>
      {parseCitations(text, docs).map((s, i) =>
        s.type === 'text' ? (
          <span key={i} className="whitespace-pre-wrap">
            {s.text}
          </span>
        ) : (
          <a
            key={i}
            href={s.doc.href}
            className="mx-0.5 inline-block translate-y-[-1px] rounded-full border border-hot/40 bg-hot/10 px-1.5 py-px align-middle font-mono text-[10px] text-hot transition hover:bg-hot/25"
            title={s.doc.title}
          >
            {s.doc.title}
          </a>
        ),
      )}
    </>
  );
}

/** Floating chat that answers questions about Ahmad from his profile, with citations. */
export function AskAhmad() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        fetch: async (url, init) => {
          const res = await fetch(url, init);
          if (!res.ok) {
            const msg = (await res.json().catch(() => null))?.error;
            throw new Error(msg ?? `Request failed (${res.status})`);
          }
          return res;
        },
      }),
    [],
  );
  const { messages, sendMessage, status, stop } = useChat({
    transport,
    onError: (e) => setErrorText(e.message),
  });
  const busy = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, status]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setErrorText(null);
    setInput('');
    void sendMessage({ text: t });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="ask-ahmad"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-line bg-ink-2/80 px-4 py-3 font-display text-xs font-bold tracking-wider shadow-[0_10px_40px_-10px_#ff3d6e88] backdrop-blur-md transition hover:-translate-y-0.5 md:right-16"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-hot opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-hot" />
        </span>
        {open ? 'Close' : 'Ask Ahmad'}
      </button>

      <section
        id="ask-ahmad"
        aria-label="Ask Ahmad chat"
        hidden={!open}
        className="fixed inset-x-3 bottom-20 z-40 flex max-h-[min(640px,calc(100dvh-7rem))] flex-col overflow-hidden rounded-2xl border border-line bg-ink/90 shadow-2xl backdrop-blur-xl md:inset-x-auto md:right-16 md:w-[400px]"
      >
        <header className="border-b border-line px-5 py-4">
          <p className="font-display text-sm font-bold">Ask Ahmad</p>
          <p className="mt-0.5 text-xs text-muted">
            An AI answering from my profile. Sources are linked.
          </p>
        </header>

        <div
          ref={scroller}
          className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm leading-relaxed"
          aria-live="polite"
        >
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-muted">Try one of these:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-line px-3 py-1.5 text-left text-xs transition hover:border-hot/60 hover:text-fg"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={m.role === 'user' ? 'flex justify-end' : ''}
            >
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-br from-hot to-violet px-3.5 py-2 text-white'
                    : 'max-w-[95%] text-fg/90'
                }
              >
                <MessageText message={m} />
              </div>
            </div>
          ))}
          {status === 'submitted' && (
            <p className="font-mono text-xs text-muted" aria-label="Thinking">
              <span className="inline-block animate-pulse">thinking…</span>
            </p>
          )}
          {errorText && (
            <p className="rounded-lg border border-hot/30 bg-hot/10 px-3 py-2 text-xs text-hot">
              {errorText}
            </p>
          )}
        </div>

        <form
          className="flex gap-2 border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            placeholder="Ask about experience, skills, projects…"
            aria-label="Your question"
            className="min-w-0 flex-1 rounded-xl border border-line bg-ink-2 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-hot/60"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => stop()}
              className="rounded-xl border border-line px-3 text-xs"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-xl bg-fg px-4 text-xs font-bold text-ink transition disabled:opacity-40"
            >
              Send
            </button>
          )}
        </form>
      </section>
    </>
  );
}
