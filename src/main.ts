import './ui/style.css';
import { Game } from './game/game';
import { iniciarGuiaInstalar } from './ui/instalar';

declare global {
  interface Window {
    __multiplicaRacing?: { game: Game };
  }
}

const game = new Game();
window.__multiplicaRacing = { game };
iniciarGuiaInstalar();
