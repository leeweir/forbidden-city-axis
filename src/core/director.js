import * as THREE from 'three';

const V = THREE.Vector3;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const norm = (v) => v.normalize();
const VIEW_DIR = norm(new V(0.58, 0.35, 1.0));

export class Director {
  constructor(camera, controls, options = {}) {
    this.camera = camera;
    this.controls = controls;
    this.reducedMotion = options.reducedMotion ?? false;
    this.mode = 'idle';
    this.tween = null;
    this.tour = null;
    this.onStop = null;
    this.onTourEnd = null;
    this.onTourCancel = null;
    this.markerTarget = null;
    this._tmpBox = new THREE.Box3();
    this._tmpSphere = new THREE.Sphere();
    this.home = this.getHomePose();
  }

  getHomePose() {
    const aspect = this.camera.aspect || 1.7;
    if (aspect < 0.8) {
      return {
        pos: new V(0, 560, 1180),
        target: new V(0, 55, 240),
      };
    }
    if (aspect < 1.2) {
      return {
        pos: new V(0, 470, 1000),
        target: new V(0, 45, 200),
      };
    }
    return {
      pos: new V(290, 172, 610),
      target: new V(-6, 30, -40),
    };
  }

  setPose(pose, instant = true) {
    if (instant) {
      this.camera.position.copy(pose.pos);
      this.controls.target.copy(pose.target);
      this.camera.lookAt(pose.target);
      this.controls.update();
    }
  }

  tweenTo(pose, { duration = 1700, onDone = null } = {}) {
    const dur = this.reducedMotion ? 0.001 : duration / 1000;
    this.tween = {
      t: 0,
      dur,
      fromPos: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      toPos: pose.pos.clone(),
      toTarget: pose.target.clone(),
      onDone,
    };
    this.controls.autoRotate = false;
    this.controls.enabled = false;
    this.mode = 'tween';
  }

  updateTween(dt) {
    if (!this.tween) return false;
    const tw = this.tween;
    tw.t = Math.min(1, tw.t + dt / tw.dur);
    const k = easeInOutCubic(tw.t);
    this.camera.position.lerpVectors(tw.fromPos, tw.toPos, k);
    this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, k);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
    if (tw.t >= 1) {
      this.tween = null;
      this.mode = 'idle';
      this.controls.enabled = true;
      tw.onDone?.();
    }
    return true;
  }

  getFocusPose(object) {
    const box = this._tmpBox.setFromObject(object);
    const sphere = box.getBoundingSphere(this._tmpSphere);
    const center = sphere.center;
    const portrait = this.camera.aspect < 0.8;
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(0.45, this.camera.aspect));
    const fitFov = Math.min(vFov, hFov);
    const dist = THREE.MathUtils.clamp(
      (sphere.radius / Math.sin(fitFov / 2)) * (portrait ? 1.18 : 1.02),
      58,
      460,
    );
    const target = center.clone();
    target.y = box.min.y + (box.max.y - box.min.y) * 0.42;
    const pos = target.clone().addScaledVector(VIEW_DIR, dist);
    pos.y = Math.max(pos.y, target.y + dist * 0.24);
    if (portrait) target.y -= sphere.radius * 0.4;
    return { pos, target, radius: sphere.radius };
  }

  flyToObject(object, { duration = 1650, onDone = null } = {}) {
    this.stopTour(false);
    const pose = this.getFocusPose(object);
    this.tweenTo(pose, {
      duration,
      onDone: () => {
        this.controls.minDistance = Math.max(18, pose.radius * 0.32);
        onDone?.();
      },
    });
    return pose;
  }

  resetView({ instant = false } = {}) {
    this.stopTour(false);
    this.home = this.getHomePose();
    if (instant) {
      this.setPose(this.home);
      this.controls.enabled = true;
      this.mode = 'idle';
    } else {
      this.tweenTo(this.home, { duration: 1900 });
    }
  }

  playIntro(onDone) {
    this.home = this.getHomePose();
    if (this.reducedMotion) {
      this.setPose(this.home);
      this.mode = 'idle';
      this.controls.enabled = true;
      onDone?.();
      return;
    }
    this.controls.enabled = false;
    const portrait = this.camera.aspect < 0.8;
    const start = portrait
      ? { pos: new V(0, 820, 1540), target: new V(0, 80, 220) }
      : { pos: new V(0, 560, 1180), target: new V(0, 80, 240) };
    this.setPose(start);
    const mid = portrait
      ? { pos: new V(0, 660, 1320), target: new V(0, 60, 230) }
      : { pos: new V(150, 430, 1030), target: new V(0, 30, 100) };
    this.tweenTo(mid, {
      duration: 2600,
      onDone: () => {
        this.tweenTo(this.home, {
          duration: 3800,
          onDone: () => {
            this.mode = 'idle';
            onDone?.();
          },
        });
      },
    });
  }

  startTour(stops) {
    this.stopTour(false);
    this.tour = {
      stops,
      index: -1,
      phase: 'delay',
      timer: 0.7,
      hold: 4.0,
    };
    this.controls.enabled = false;
    this.mode = 'tour';
    this.nextTourStop();
  }

  nextTourStop() {
    if (!this.tour) return;
    const tour = this.tour;
    tour.index += 1;
    if (tour.index >= tour.stops.length) {
      this.tour = null;
      this.mode = 'idle';
      this.home = this.getHomePose();
      this.tweenTo(this.home, {
        duration: 2600,
        onDone: () => {
          this.controls.autoRotate = false;
          this.controls.enabled = true;
          this.onTourEnd?.();
        },
      });
      return;
    }
    const stop = tour.stops[tour.index];
    const pose = this.getFocusPose(stop.object);
    tour.phase = 'move';
    this.controls.autoRotate = false;
    this.tweenTo(pose, {
      duration: tour.index === 0 ? 2200 : 1900,
      onDone: () => {
        if (!this.tour) return;
        this.tour.phase = 'hold';
        this.tour.timer = this.tour.hold;
        this.controls.autoRotate = !this.reducedMotion;
        this.controls.autoRotateSpeed = 0.38;
      },
    });
    this.onStop?.(stop.id, stop.object, tour.index);
  }

  stopTour(recentre = false) {
    if (!this.tour) return false;
    this.tour = null;
    this.controls.autoRotate = false;
    this.controls.enabled = true;
    this.onTourCancel?.();
    if (recentre) this.resetView();
    return true;
  }

  userTakeover() {
    if (this.tween && this.mode === 'tween') {
      this.tween = null;
      this.mode = 'idle';
      this.controls.enabled = true;
    }
    if (this.tour) this.stopTour(false);
  }

  update(dt) {
    if (this.updateTween(dt)) return;
    if (this.tour) {
      const tour = this.tour;
      if (tour.phase === 'delay') {
        tour.timer -= dt;
        if (tour.timer <= 0) this.nextTourStop();
      } else if (tour.phase === 'hold') {
        tour.timer -= dt;
        if (tour.timer <= 0) this.nextTourStop();
      }
    }
  }
}
