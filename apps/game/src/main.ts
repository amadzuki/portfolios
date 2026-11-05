import { createGame, type Phase } from './game/game';
import type { ScoreState } from './game/logic';
import './style.css';

const $ = <T extends HTMLElement>(sel: string) =>
  document.querySelector<T>(sel)!;
const canvas = $<HTMLCanvasElement>('#scene');
const ui = $('#ui');
const scoreEl = $('#score');
const multEl = $('#mult');
const finalEl = $('#final');
const bestEl = $('#best');
const muteBtn = $<HTMLButtonElement>('#mute');

function showScore(s: ScoreState) {
  scoreEl.textContent = s.score.toLocaleString();
  multEl.textContent = `×${s.multiplier}`;
  multEl.classList.toggle('hot', s.multiplier > 1);
  multEl.classList.remove('pop');
  void multEl.offsetWidth;
  multEl.classList.add('pop');
}

function showPhase(phase: Phase, s: ScoreState, best: number) {
  ui.dataset.phase = phase;
  if (phase === 'over') {
    finalEl.textContent = s.score.toLocaleString();
    bestEl.textContent =
      s.score >= best && s.score > 0
        ? 'new best'
        : `best ${best.toLocaleString()}`;
  }
}

let game: ReturnType<typeof createGame>;
try {
  game = createGame(canvas, { onPhase: showPhase, onScore: showScore });
} catch (err) {
  ui.dataset.phase = 'unsupported';
  throw err;
}

const begin = () => {
  if (game.phase !== 'playing') game.start();
};
document.querySelectorAll<HTMLButtonElement>('[data-start]').forEach((b) =>
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    begin();
  }),
);
canvas.addEventListener('pointerdown', () => {
  if (game.phase === 'title') begin();
});
window.addEventListener('keydown', (e) => {
  if ((e.key === ' ' || e.key === 'Enter') && game.phase !== 'playing') begin();
  if (e.key.toLowerCase() === 'm') muteBtn.click();
});

const renderMute = () => {
  muteBtn.setAttribute('aria-pressed', String(game.muted));
  muteBtn.textContent = game.muted ? 'sound off' : 'sound on';
};
muteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  game.toggleMute();
  renderMute();
});
renderMute();
