#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '../docs/css/tokens.css'), 'utf8');
const tokens = new Map([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]));
const rgb = name => {
  const hex = tokens.get(name);
  assert.match(hex || '', /^#[\da-f]{6}$/i, `${name} must be a solid RGB color`);
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
};
const luminance = name => rgb(name)
  .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const contrast = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};

// All normal text, including status colors, must remain readable on every panel.
const surfaces = ['--color-bg', '--color-surface', '--color-surface-elevated', '--color-surface-subtle'];
const textColors = ['--color-text-primary', '--color-text-secondary', '--color-text-muted',
  '--color-accent', '--color-warning', '--color-danger', '--zone-z1', '--zone-z2', '--zone-z3', '--zone-z4', '--zone-z5'];
for (const foreground of textColors) {
  for (const background of surfaces) {
    const ratio = contrast(foreground, background);
    assert.ok(ratio >= 4.5, `${foreground} on ${background}: ${ratio.toFixed(2)} must be >= 4.5`);
  }
}
// Filled action buttons use dark text on accent/danger backgrounds.
for (const background of ['--color-accent', '--color-danger']) {
  assert.ok(contrast('--color-bg', background) >= 4.5, `Button text on ${background}`);
}

const fontSize = name => {
  const value = tokens.get(name);
  assert.match(value || '', /^[\d.]+rem$/, `${name} must scale with the root font size`);
  return parseFloat(value) * 16;
};
const scale = ['--font-size-caption', '--font-size-small', '--font-size-text', '--font-size-body', '--font-size-control'].map(fontSize);
assert.ok(scale.every(size => size >= 12), 'Shared font sizes must be at least 12px');
assert.ok(fontSize('--font-size-body') >= 14, 'Body text must be at least 14px');
assert.ok(fontSize('--font-size-control') >= 16, 'Editable controls must be at least 16px');
assert.ok(scale.every((size, index) => index === 0 || size >= scale[index - 1]), 'Type scale must remain ordered');

console.log('Readability checks OK');
