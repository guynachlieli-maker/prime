// Pose tracks (character-local: +Z forward, +X = character's left). Contact at a = 3.0
import * as THREE from 'three';
import { kf } from '/build/lib.js';
const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
function kfv(track, t) {
  if (t <= track[0][0]) return track[0][1].clone();
  for (let i = 1; i < track.length; i++) if (t <= track[i][0]) {
    const [t0, v0] = track[i - 1], [t1, v1] = track[i]; const u = (t - t0) / (t1 - t0), e = u * u * (3 - 2 * u);
    return v0.clone().lerp(v1, e).normalize();
  }
  return track[track.length - 1][1].clone();
}
export const SM = {
  rU: [[0, V(-.35, -.75, .55)], [1.5, V(-.9, -.1, .25)], [2.4, V(-.96, .12, -.1)], [2.75, V(-.5, .8, -.05)], [3.0, V(-.16, .98, .08)], [3.35, V(-.2, -.35, .9)], [4.4, V(-.3, -.8, .4)]],
  rF: [[0, V(.1, .3, 1)], [1.5, V(-.2, .9, .1)], [2.4, V(-.1, 1, -.35)], [2.75, V(-.2, .95, .15)], [3.0, V(-.1, .99, .12)], [3.35, V(.05, -.55, .85)], [4.4, V(.1, -.5, .5)]],
  rR: [[0, V(0, 1, .5)], [1.5, V(0, .8, -.5)], [2.4, V(0, .1, -1)], [2.75, V(0, .7, .75)], [3.0, V(0, .93, .36)], [3.35, V(.1, -.5, .85)], [4.4, V(.1, -.7, .5)]],
  lU: [[0, V(.4, -.75, .45)], [1.5, V(.6, .6, .35)], [2.5, V(.45, .88, .45)], [3.0, V(.55, .3, .6)], [3.5, V(.5, -.75, .3)]],
  twist: [[0, 0], [1.5, -.4], [2.45, -.8], [3.0, .45], [3.5, .5], [4.5, .1]],
  lean: [[0, .05], [2.45, -.28], [3.0, .1], [3.6, .3], [4.5, .1]],
  crouch: [[0, .35], [1.3, .5], [2.0, .9], [2.38, 1.0], [2.5, .3], [3.0, .1], [3.55, .15], [3.8, .85], [4.7, .35]],
  jump: [[0, 0], [2.42, 0], [2.55, .08], [3.0, .5], [3.45, .2], [3.7, 0], [9, 0]],
  headX: [[0, 0], [1.8, -.1], [2.9, -.45], [3.4, .1]],
};
export function smashSpec(a) {
  const lu = kfv(SM.lU, a);
  return { rU: kfv(SM.rU, a), rF: kfv(SM.rF, a), rR: kfv(SM.rR, a), lU: lu, lF: lu.clone().add(V(0, 0, .15)).normalize(), twist: kf(SM.twist, a), lean: kf(SM.lean, a), headX: kf(SM.headX, a), c: kf(SM.crouch, a), j: kf(SM.jump, a) };
}
// relaxed ready stance (rally)
export function readySpec(t = 0) {
  const b = Math.sin(t * 2.2) * .03;
  return { rU: V(-.4, -.7, .5), rF: V(.05, .35 + b, 1), rR: V(0, 1, .55), lU: V(.45, -.7, .45), lF: V(.1, .1, 1), twist: -.1, lean: .12, headX: 0, c: .42 + b, j: 0, spread: .17 };
}
