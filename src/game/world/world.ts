import * as THREE from 'three';
import { CFG } from '../config';
import { mulberry32 } from '../rng';
import type { Pose } from '../sim';
import { buildTrackLayout, type TrackLayout } from '../track';
import type { Question, Side } from '../types';
import { Car } from './car';
import { disposeObject } from './materials';
import { RoadBuilder } from './road';
import { Scenery } from './scenery';
import { ForkSigns, buildFinishGantry } from './signs';
import { Sky } from './sky';
import type { Stage } from './stage';

/** Todo lo que se ve en 3D: cielo, carretera, decorado, carteles y coche. */
export class World {
  readonly car = new Car();
  private readonly sky = new Sky();
  private level: THREE.Group | null = null;
  private signs: ForkSigns[] = [];
  layout: TrackLayout | null = null;

  constructor(private readonly stage: Stage) {
    stage.scene.add(this.sky.group, this.car.root);
  }

  /** Carretera de la pantalla de inicio (sin carteles). */
  buildMenu(): void {
    const sides: Side[] = [1, -1, 1];
    this.build(buildTrackLayout(3, sides), sides, undefined, 4242);
  }

  buildLevel(layout: TrackLayout, questions: Question[], seed: number): void {
    this.build(layout, questions.map((q) => q.correctSide), questions, seed);
  }

  private build(layout: TrackLayout, correctSides: readonly Side[], questions: Question[] | undefined, seed: number): void {
    this.clear();
    this.layout = layout;
    const root = new THREE.Group();

    const road = new RoadBuilder(layout, correctSides);
    root.add(road.build());
    root.add(road.finishLine());
    const keepClear = questions ? layout.forks.map((f) => f.apexS - CFG.questionSignBefore) : [];
    root.add(new Scenery(layout, road.banks, mulberry32(seed), keepClear).build());
    root.add(buildFinishGantry(layout));

    if (questions) {
      layout.forks.forEach((f, i) => {
        const s = new ForkSigns(layout, f, questions[i]);
        this.signs.push(s);
        root.add(s.group);
      });
    }
    this.level = root;
    this.stage.scene.add(root);
  }

  private clear(): void {
    if (this.level) {
      this.stage.scene.remove(this.level);
      disposeObject(this.level);
      this.level = null;
    }
    this.signs = [];
    this.layout = null;
  }

  showSigns(i: number): void {
    this.signs[i]?.show();
  }

  hideSigns(i: number): void {
    this.signs[i]?.hide();
  }

  update(pose: Pose, dt: number, idle = false): void {
    this.car.setPose(pose, dt, idle);
    const cam = this.stage.camera.position;
    for (const s of this.signs) s.update(cam, dt);
    this.sky.update(cam, dt);
  }
}
