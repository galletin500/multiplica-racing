import './ui/style.css';
import { Game } from './game/game';

declare global {
  interface Window {
    __multiplicaRacing?: { game: Game };
  }
}

const game = new Game();
window.__multiplicaRacing = { game };
