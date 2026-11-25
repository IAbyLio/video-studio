import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripLayers } from '../stage-render.mjs';

const html = `<div>
  <video src="persona.mp4" muted></video>
  <audio src="vo.m4a" data-start="0"></audio>
  <audio src="assets/whoosh-up.wav" data-start="3.6" data-volume="0.2" data-track-index="40" data-capa="sfx"></audio>
  <audio src="assets/music-bed.wav" data-volume="0.15" data-layer="music"></audio>
</div>`;

test('visual saca sfx y música, deja VO y video', () => {
  const out = stripLayers(html, 'visual');
  assert.ok(!out.includes('data-layer="sfx"'));
  assert.ok(!out.includes('data-layer="music"'));
  assert.ok(out.includes('vo.m4a'));
  assert.ok(out.includes('persona.mp4'));
});

test('sfx deja sfx, saca música', () => {
  const out = stripLayers(html, 'sfx');
  assert.ok(out.includes('whoosh-up.wav'));
  assert.ok(!out.includes('data-layer="music"'));
});

test('full no saca nada', () => {
  const out = stripLayers(html, 'full');
  assert.ok(out.includes('whoosh-up.wav'));
  assert.ok(out.includes('music-bed.wav'));
});

test('etapa inválida tira error', () => {
  assert.throws(() => stripLayers(html, 'nope'), /etapa inválida/);
});

test('self-closing audio también se saca', () => {
  const sc = `<audio src="x.wav" data-layer="sfx"/>`;
  assert.equal(stripLayers(sc, 'visual').trim(), '');
});

test('data-layer (antiguo) también se reconoce', () => {
  assert.equal(stripLayers('<audio src="x.wav" data-layer="music"></audio>', 'sfx').trim(), '');
});
