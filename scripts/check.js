// Tarayıcı olmadan fizik testi: her araç her haritada belirli süre kendi kendine
// sürülür; ilerleme, takılma ve ters dönme ölçülür.  Kullanım: npm run check
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.planck = require('planck');

const { Terrain } = await import('../public/js/terrain.js');
const { Vehicle, VEHICLES } = await import('../public/js/vehicles.js');
const { MAPS } = await import('../public/js/maps.js');

const SECONDS = Number(process.env.SIM_SECONDS || 40);
const ASSIST = process.env.ASSIST !== '0'; // oyundaki "Havada denge yardımı" (varsayılan açık)
const SPEED = 8;
let failed = 0;

for (const mapId of Object.keys(MAPS)) {
  for (const [vid, def] of Object.entries(VEHICLES)) {
    const world = new planck.World({ gravity: planck.Vec2(0, MAPS[mapId].gravity) });
    const terrain = new Terrain(world, { map: mapId, seed: 1234, target: 1000 });
    terrain.ensure(0);
    const v = new Vehicle(world, def, 2, 0, 1);
    v.setTransform(2, terrain.heightAt(2) + v.clearance + 0.3, 0);
    let flipped = 0, stuck = 0, maxX = 0;
    for (let i = 0; i < SECONDS * 60; i++) {
      v.drive(SPEED * (def.speed || 1), 1);
      v.updateGrounded(terrain);
      if (ASSIST) v.stabilize(terrain);
      world.step(1 / 60, 8, 3);
      const p = v.pos;
      terrain.update(p.x - 40, p.x + 70);
      if (Math.cos(v.angle) < -0.15) flipped++;
      if (Math.abs(v.vel.x) < 0.3) stuck++;
      maxX = Math.max(maxX, p.x);
    }
    const ok = maxX > SECONDS * 2 && flipped < 60 * 3;
    if (!ok) failed++;
    console.log(`${ok ? '✓' : '✗'} ${mapId.padEnd(8)} ${vid.padEnd(8)} ${maxX.toFixed(0).padStart(5)} m  ters:${(flipped / 60).toFixed(1)}s  durgun:${(stuck / 60).toFixed(1)}s`);
  }
}
console.log(failed ? `\n${failed} senaryo başarısız` : '\nTüm senaryolar geçti');
process.exit(failed ? 1 : 0);
