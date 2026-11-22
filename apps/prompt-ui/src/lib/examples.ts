export interface Example {
  id: string;
  title: string;
  prompt: string;
  code: string;
}

export const examples: Example[] = [
  {
    id: 'pricing',
    title: 'Pricing tiers',
    prompt:
      'A pricing section with three tiers, a monthly/yearly toggle that updates prices, and a highlighted popular plan.',
    code: `import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';

const tiers = [
  { name: 'Starter', monthly: 0, desc: 'For side projects and tinkering.', features: ['1 project', 'Community support', 'Basic analytics'] },
  { name: 'Pro', monthly: 19, desc: 'For freelancers shipping client work.', features: ['Unlimited projects', 'Priority support', 'Advanced analytics', 'Custom domains'], popular: true },
  { name: 'Team', monthly: 49, desc: 'For small teams that move fast.', features: ['Everything in Pro', '5 seats included', 'SSO & audit log', 'Shared workspaces'] },
];

export default function App() {
  const [yearly, setYearly] = useState(false);
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-5xl text-center">
        <h1 className="text-4xl font-bold tracking-tight">Simple pricing</h1>
        <p className="mt-3 text-slate-400">Start free. Upgrade when it clicks.</p>
        <div role="group" aria-label="Billing period" className="mt-8 inline-flex rounded-full bg-slate-900 p-1 ring-1 ring-white/10">
          {['Monthly', 'Yearly'].map((label, i) => (
            <button key={label} onClick={() => setYearly(i === 1)} aria-pressed={yearly === (i === 1)}
              className={\`rounded-full px-5 py-2 text-sm font-medium transition \${yearly === (i === 1) ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'}\`}>
              {label}{i === 1 && <span className="ml-2 text-xs text-emerald-500">-20%</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
        {tiers.map((t) => {
          const price = yearly ? Math.round(t.monthly * 12 * 0.8) : t.monthly;
          return (
            <section key={t.name} className={\`relative flex flex-col rounded-3xl p-8 ring-1 transition hover:-translate-y-1 \${t.popular ? 'bg-gradient-to-b from-indigo-500/20 to-slate-900 ring-indigo-400/60 shadow-2xl shadow-indigo-500/20' : 'bg-slate-900 ring-white/10'}\`}>
              {t.popular && (
                <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold">
                  <Sparkles className="h-3 w-3" /> Most popular
                </span>
              )}
              <h2 className="text-lg font-semibold">{t.name}</h2>
              <p className="mt-1 text-sm text-slate-400">{t.desc}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold">\${price}</span>
                <span className="text-sm text-slate-400">/{yearly ? 'year' : 'month'}</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" />{f}</li>
                ))}
              </ul>
              <button className={\`mt-8 rounded-xl px-4 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 \${t.popular ? 'bg-indigo-500 hover:bg-indigo-400' : 'bg-white/10 hover:bg-white/20'}\`}>
                {t.monthly === 0 ? 'Start for free' : \`Choose \${t.name}\`}
              </button>
            </section>
          );
        })}
      </div>
    </main>
  );
}
`,
  },
  {
    id: 'player',
    title: 'Music player',
    prompt:
      'A glassy now-playing music card with album art made from a gradient, a scrubbable progress bar, and play/pause, skip and like controls.',
    code: `import { useEffect, useState } from 'react';
import { Heart, Pause, Play, SkipBack, SkipForward } from 'lucide-react';

const tracks = [
  { title: 'Monsoon Static', artist: 'Kai Ardana', length: 214, from: 'from-fuchsia-500', to: 'to-orange-400' },
  { title: 'Night Market', artist: 'Lumi & The Tides', length: 187, from: 'from-sky-500', to: 'to-indigo-600' },
  { title: 'Bandung, 5AM', artist: 'Raka Pratama', length: 242, from: 'from-emerald-400', to: 'to-teal-700' },
];
const fmt = (s: number) => \`\${Math.floor(s / 60)}:\${String(Math.floor(s % 60)).padStart(2, '0')}\`;

export default function App() {
  const [i, setI] = useState(0);
  const [t, setT] = useState(32);
  const [playing, setPlaying] = useState(true);
  const [liked, setLiked] = useState<Record<number, boolean>>({});
  const track = tracks[i];

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setT((x) => (x + 1 >= track.length ? 0 : x + 1)), 1000);
    return () => clearInterval(id);
  }, [playing, track.length]);

  const go = (d: number) => { setI((i + d + tracks.length) % tracks.length); setT(0); };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 p-6">
      <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-violet-700/50 blur-3xl" aria-hidden />
      <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-cyan-600/40 blur-3xl" aria-hidden />
      <section className="relative w-full max-w-sm rounded-[2rem] bg-white/10 p-6 text-white shadow-2xl ring-1 ring-white/20 backdrop-blur-xl">
        <div className={\`aspect-square w-full rounded-3xl bg-gradient-to-br \${track.from} \${track.to} shadow-xl transition-all duration-700 \${playing ? 'scale-100' : 'scale-95 opacity-80'}\`} aria-hidden />
        <div className="mt-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">{track.title}</h1>
            <p className="text-sm text-white/60">{track.artist}</p>
          </div>
          <button aria-label={liked[i] ? 'Unlike' : 'Like'} onClick={() => setLiked({ ...liked, [i]: !liked[i] })}
            className="rounded-full p-2 transition hover:bg-white/10">
            <Heart className={\`h-5 w-5 transition \${liked[i] ? 'fill-rose-500 text-rose-500 scale-110' : ''}\`} />
          </button>
        </div>
        <label className="mt-6 block">
          <span className="sr-only">Seek</span>
          <input type="range" min={0} max={track.length} value={t} onChange={(e) => setT(Number(e.target.value))}
            className="w-full accent-white" />
        </label>
        <div className="flex justify-between text-xs text-white/50"><span>{fmt(t)}</span><span>{fmt(track.length)}</span></div>
        <div className="mt-4 flex items-center justify-center gap-6">
          <button aria-label="Previous" onClick={() => go(-1)} className="rounded-full p-3 hover:bg-white/10"><SkipBack className="h-6 w-6" /></button>
          <button aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)}
            className="grid h-16 w-16 place-items-center rounded-full bg-white text-slate-900 shadow-lg transition hover:scale-105 active:scale-95">
            {playing ? <Pause className="h-7 w-7" /> : <Play className="ml-1 h-7 w-7" />}
          </button>
          <button aria-label="Next" onClick={() => go(1)} className="rounded-full p-3 hover:bg-white/10"><SkipForward className="h-6 w-6" /></button>
        </div>
      </section>
    </main>
  );
}
`,
  },
  {
    id: 'habits',
    title: 'Habit tracker',
    prompt:
      'A weekly habit tracker: habits as rows, days as tappable cells, streak counts, and a progress ring for today.',
    code: `import { useState } from 'react';
import { Flame, Plus } from 'lucide-react';

const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const today = 3;
type Habit = { name: string; emoji: string; done: boolean[] };

export default function App() {
  const [habits, setHabits] = useState<Habit[]>([
    { name: 'Read 20 pages', emoji: '📚', done: [true, true, false, true, false, false, false] },
    { name: 'Morning run', emoji: '🏃', done: [true, false, true, false, false, false, false] },
    { name: 'No phone after 10pm', emoji: '🌙', done: [true, true, true, true, false, false, false] },
  ]);
  const [draft, setDraft] = useState('');
  const toggle = (h: number, d: number) =>
    setHabits(habits.map((x, i) => (i === h ? { ...x, done: x.done.map((v, j) => (j === d ? !v : v)) } : x)));
  const streak = (done: boolean[]) => { let s = 0; for (let d = today; d >= 0 && done[d]; d--) s++; return s; };
  const pct = Math.round((habits.filter((h) => h.done[today]).length / Math.max(1, habits.length)) * 100);

  return (
    <main className="min-h-screen bg-amber-50 p-6 text-stone-800">
      <div className="mx-auto max-w-xl">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm text-stone-500">This week</p>
            <h1 className="text-3xl font-bold">Habits</h1>
          </div>
          <div className="relative h-20 w-20" role="img" aria-label={\`\${pct}% of today's habits done\`}>
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-amber-200" strokeWidth="3.5" />
              <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-orange-500 transition-all duration-500" strokeWidth="3.5"
                strokeLinecap="round" strokeDasharray={\`\${pct} 100\`} />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-sm font-bold">{pct}%</span>
          </div>
        </header>
        <div className="mt-8 space-y-3">
          {habits.map((h, hi) => (
            <section key={h.name} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-amber-100">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold"><span className="mr-2">{h.emoji}</span>{h.name}</h2>
                <span className="inline-flex items-center gap-1 text-sm text-orange-600"><Flame className="h-4 w-4" />{streak(h.done)}</span>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-2">
                {days.map((d, di) => (
                  <button key={di} onClick={() => toggle(hi, di)} aria-pressed={h.done[di]} aria-label={\`\${h.name}, day \${di + 1}\`}
                    className={\`aspect-square rounded-xl text-xs font-semibold transition hover:scale-105 \${h.done[di] ? 'bg-orange-500 text-white shadow' : 'bg-amber-100 text-stone-500'} \${di === today ? 'ring-2 ring-orange-300 ring-offset-2' : ''}\`}>
                    {d}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { setHabits([...habits, { name: draft.trim(), emoji: '✨', done: Array(7).fill(false) }]); setDraft(''); } }}>
          <label className="sr-only" htmlFor="new">New habit</label>
          <input id="new" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a habit…"
            className="flex-1 rounded-xl border border-amber-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-orange-300" />
          <button className="inline-flex items-center gap-1 rounded-xl bg-stone-900 px-4 font-semibold text-white hover:bg-stone-700"><Plus className="h-4 w-4" />Add</button>
        </form>
      </div>
    </main>
  );
}
`,
  },
  {
    id: 'signup',
    title: 'Signup form',
    prompt:
      'A split-screen signup page: brand panel with a testimonial on the left, form with live validation and a password strength meter on the right.',
    code: `import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Quote } from 'lucide-react';

const strength = (p: string) => [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
const labels = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong'];

export default function App() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [sent, setSent] = useState(false);
  const s = strength(pw);
  const emailOk = /^\\S+@\\S+\\.\\S+$/.test(email);

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-violet-700 via-indigo-700 to-sky-600 p-12 text-white md:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <p className="text-xl font-bold tracking-tight">northwind</p>
        <figure className="relative">
          <Quote className="h-8 w-8 text-white/40" />
          <blockquote className="mt-4 text-2xl font-medium leading-snug">We replaced three tools with Northwind and shipped our redesign two weeks early.</blockquote>
          <figcaption className="mt-6 text-sm text-white/70">Dewi Lestari · Head of Product, Kopiloka</figcaption>
        </figure>
      </aside>
      <section className="flex items-center justify-center bg-white p-8">
        {sent ? (
          <div className="text-center">
            <p className="text-5xl">📬</p>
            <h1 className="mt-4 text-2xl font-bold text-slate-900">Check your inbox</h1>
            <p className="mt-2 text-slate-500">We sent a confirmation link to {email}.</p>
          </div>
        ) : (
          <form className="w-full max-w-sm" onSubmit={(e) => { e.preventDefault(); if (emailOk && s >= 3) setSent(true); }} noValidate>
            <h1 className="text-3xl font-bold text-slate-900">Create your account</h1>
            <p className="mt-2 text-slate-500">Free for 14 days. No card required.</p>
            <label className="mt-8 block text-sm font-medium text-slate-700" htmlFor="email">Work email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!email && !emailOk}
              className={\`mt-1 w-full rounded-xl border px-4 py-3 outline-none transition focus:ring-4 \${email && !emailOk ? 'border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'}\`} placeholder="you@company.com" />
            {email && !emailOk && <p className="mt-1 text-xs text-rose-500">Enter a valid email address.</p>}
            <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="pw">Password</label>
            <div className="relative mt-1">
              <input id="pw" type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <div className="mt-2 flex gap-1" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={\`h-1.5 flex-1 rounded-full transition \${i < s ? ['bg-rose-400', 'bg-amber-400', 'bg-lime-500', 'bg-emerald-500'][s - 1] : 'bg-slate-100'}\`} />
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500" aria-live="polite">{pw ? labels[s] : 'Use 8+ characters with a number and a symbol.'}</p>
            <button disabled={!emailOk || s < 3} className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40">
              Get started <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
`,
  },
];
