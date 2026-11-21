import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUS_ORDER,
  createDefaultBuses,
  updatePluginInBuses,
  applyVocalRecommendationsToBuses,
} from './pluginCatalog';
import {
  detectPitchAutocorrelation,
  freqToNoteName,
  analyzePcmVocalBuffer,
  classifyVoiceFromMetrics,
} from './pitchDetection';

function makeSineWave(freqHz: number, sampleRate = 44100, length = 4096): Float32Array {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buf[i] = 0.5 * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return buf;
}

test('all requested buses and exact plugin chains exist in order', () => {
  const buses = createDefaultBuses();
  assert.equal(BUS_ORDER.length, 8);

  const sectionExpected = [
    'FabFilter Pro-Q 3',
    'FabFilter Saturn 2',
    'Rule Tec EQ1A',
    'Rule Tec EQ5M',
    'bx_opto',
  ];
  for (const id of ['soprano', 'alto', 'tenor', 'bass'] as const) {
    assert.deepEqual(
      buses[id].plugins.map((p) => p.name),
      sectionExpected
    );
    assert.equal(buses[id].routesTo, 'choir-bus');
  }

  assert.deepEqual(
    buses['soloist-stem'].plugins.map((p) => p.name),
    ['FabFilter Pro-Q 3', 'MC77']
  );
  assert.equal(buses['soloist-stem'].routesTo, 'soloist-bus');

  assert.deepEqual(
    buses['soloist-bus'].plugins.map((p) => p.name),
    [
      'Black Box Analog Design HG-2',
      'Rule Tec EQ1A',
      'Rule Tec EQ5M',
      'bx_opto',
      'ValhallaVintageVerb',
    ]
  );
  assert.equal(buses['soloist-bus'].routesTo, 'master-bus');

  assert.deepEqual(
    buses['choir-bus'].plugins.map((p) => p.name),
    [
      'FabFilter Pro-Q 3',
      'SSL Native Bus Compressor 2',
      'Rule Tec EQ1A',
      'ValhallaVintageVerb',
    ]
  );
  assert.equal(buses['choir-bus'].routesTo, 'master-bus');

  assert.deepEqual(
    buses['master-bus'].plugins.map((p) => p.name),
    [
      'FabFilter Pro-Q 3',
      'SSL Native Bus Compressor 2',
      'FabFilter Pro-MB',
      'iZotope Ozone 12 Vintage Tape',
      'A1StereoControl',
      'FabFilter Pro-L 2',
    ]
  );
  assert.equal(buses['master-bus'].routesTo, 'output');
});

test('plugin parameter updates clamp safely and preserve immutability', () => {
  const buses = createDefaultBuses();
  const hg2 = buses['soloist-bus'].plugins[0];
  const updated = updatePluginInBuses(buses, 'soloist-bus', hg2.id, {
    bypassed: true,
    params: { air: 250, pentode: -50 },
  });

  assert.equal(updated['soloist-bus'].plugins[0].bypassed, true);
  assert.equal(updated['soloist-bus'].plugins[0].params.air, 100);
  assert.equal(updated['soloist-bus'].plugins[0].params.pentode, 0);
  // Original remains unchanged
  assert.equal(buses['soloist-bus'].plugins[0].bypassed, false);
});

test('autocorrelation pitch detection accurately tracks vocal fundamentals', () => {
  const a4 = detectPitchAutocorrelation(makeSineWave(440), 44100);
  assert.ok(a4 !== null && Math.abs(a4 - 440) < 2, `Expected ~440 Hz, got ${a4}`);
  assert.equal(freqToNoteName(440), 'A4');

  const c3 = detectPitchAutocorrelation(makeSineWave(130.81), 44100);
  assert.ok(c3 !== null && Math.abs(c3 - 130.81) < 2, `Expected ~130.81 Hz, got ${c3}`);
  assert.equal(freqToNoteName(130.81), 'C3');

  const silence = detectPitchAutocorrelation(new Float32Array(2048), 44100);
  assert.equal(silence, null);
});

test('voice analyzer classifies Soprano and Bass accurately and applies DAW presets', () => {
  const sopranoBuf = makeSineWave(587.33, 44100, 44100); // D5
  const sopMetrics = analyzePcmVocalBuffer(sopranoBuf, 44100);
  const sopReport = classifyVoiceFromMetrics(sopMetrics);
  assert.equal(sopReport.voiceType, 'Soprano');
  assert.equal(sopReport.targetBus, 'soprano');
  assert.ok(sopReport.recommendedGenres.length >= 3);

  const bassBuf = makeSineWave(98.0, 44100, 44100); // G2
  const bassMetrics = analyzePcmVocalBuffer(bassBuf, 44100);
  const bassReport = classifyVoiceFromMetrics(bassMetrics);
  assert.equal(bassReport.voiceType, 'Bass');
  assert.equal(bassReport.targetBus, 'bass');

  const buses = createDefaultBuses();
  const applied = applyVocalRecommendationsToBuses(buses, bassReport.pluginRecommendations);
  const soloistProQ = applied['soloist-stem'].plugins[0];
  assert.equal(soloistProQ.params.hpfFreq, 55);
});
