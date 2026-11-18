/**
 * Constantes de jugabilidad. Todas las distancias están en "unidades de mundo".
 *
 * La relación clave es:  distancia de decisión = velocidad × tiempo de decisión
 * (16 u/s × 5 s = 80 u). El coche recorre esas 80 unidades EXACTAMENTE en los
 * cinco segundos que tiene el niño para elegir, sea cual sea el FPS.
 */
export const CFG = {
  /** Velocidad constante del coche (unidades por segundo). */
  speed: 16,
  /** Segundos exactos para elegir (no se muestra ningún cronómetro). */
  decisionTime: 5,
  /** Los carteles aparecen 0,4 s antes de empezar a contar, para estar completos al empezar. */
  signLead: 0.4,
  /** Recta inicial antes de la primera pregunta. */
  startStraight: 40,
  /** Pequeño recorrido tras unirse la carretera antes de la siguiente pregunta. */
  preludeAfterMerge: 14,
  questionsPerLevel: 10,

  /** Semiancho del tronco = ancho de cada rama de la Y. */
  halfRoad: 8,
  bankWidth: 10,
  slabDepth: 14,
  /** Longitud de la bifurcación (del vértice de la Y hasta que se vuelven a unir). */
  branchLength: 124,
  /** Separación máxima de cada rama respecto al eje. */
  branchSpread: 18,
  widenLength: 16,
  /** Distancia desde el vértice a la que acaba la rama equivocada (oculta por la niebla). */
  cutU: 96,
  /** Distancia (tras el vértice) a la que cuelgan los carteles de resultado. */
  answerSignU: 28,
  /** Distancia (antes del vértice) de las vallas laterales con la multiplicación. */
  questionSignBefore: 55,
  finishExtra: 40,

  /** El coche que va a caer corre un poco más para no hacer esperar al niño. */
  doomedSpeedFactor: 1.25,
  fallDuration: 2.4,
  /** Rapidez del giro lateral del coche (1/s). */
  steerRate: 6,
  /** Tope del paso de simulación: evita saltos tras un parón y derrotas injustas. */
  maxDt: 0.05,

  fogNear: 35,
  fogFar: 105,
} as const;

export const DECISION_DISTANCE = CFG.speed * CFG.decisionTime;
