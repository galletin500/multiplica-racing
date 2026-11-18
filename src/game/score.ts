/** Puntuación de una partida: aciertos sobre el total de bifurcaciones. */
export class Score {
  correct = 0;
  constructor(public readonly total: number) {}

  addCorrect(): void {
    this.correct++;
  }

  get complete(): boolean {
    return this.correct >= this.total;
  }
}
