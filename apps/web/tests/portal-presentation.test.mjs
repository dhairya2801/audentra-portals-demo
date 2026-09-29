import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import postcss from 'postcss';

const theme = new URL('../public/portal-theme/', import.meta.url);
const refresh = new URL('../app/audentra-design-styles/refresh/', import.meta.url);
const parse = async url => postcss.parse(await readFile(url, 'utf8'), { from: url.pathname });

// The assistant uses the original inherited tokens. A new root-level font or
// legacy-token assignment would silently change it even with scoped selectors.
test('portal presentation cannot replace inherited assistant foundations', async () => {
  for (const directory of [theme, refresh]) {
    for (const name of await readdir(directory)) {
      if (!name.endsWith('.css')) continue;
      const css = await parse(new URL(name, directory));
      css.walkDecls(decl => {
        if (decl.prop.startsWith('--')) {
          assert.ok(decl.prop.startsWith('--portal-'), `${name}: overrides shared ${decl.prop}`);
        }
      });
      css.walkRules(rule => {
        assert.ok(!rule.selector.includes(':root'), `${name}: uncontained root rule`);
        if (['.portal-refresh', '.app-shell:scope', '.staff-shell--workspace:scope', 'body:scope'].includes(rule.selector)) {
          for (const decl of rule.nodes.filter(node => node.type === 'decl')) {
            assert.ok(!/^(font($|-)|color$|line-height$|letter-spacing$|text-transform$)/.test(decl.prop), `${name}: ${decl.prop} would inherit into Edward`);
          }
        }
      });
      if (!['board.css', 'tokens.css', 'index.css'].includes(name)) {
        css.walkRules(rule => {
          let owner = rule.parent;
          while (owner && !(owner.type === 'atrule' && owner.name === 'scope')) owner = owner.parent;
          assert.ok(owner, `${name}: ${rule.selector} is outside the assistant exclusion boundary`);
          assert.ok(!rule.selector.includes('.portal-refresh'), `${name}: use :scope to match the scope root`);
          assert.ok(owner.params.includes('[class*="edward"]'), `${name}: missing assistant boundary`);
          assert.ok(owner.params.includes('[data-edward-preserve]'), `${name}: missing contextual control boundary`);
        });
      }
    }
  }
});

function luminance(hex) {
  const channels = hex.replace('#', '').match(/../g).map(x => parseInt(x, 16) / 255)
    .map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);

test('default portal text and status pairs meet 4.5:1 contrast', async () => {
  const tokens = new Map();
  (await parse(new URL('tokens.css', theme))).walkDecls(d => {
    let hex = d.value.match(/#(?:[a-f\d]{6}|[a-f\d]{3})\b/i)?.[0];
    if (hex?.length === 4) hex = "#" + [...hex.slice(1)].map(c => c + c).join("");
    if (hex) tokens.set(d.prop.replace('--portal-', ''), hex);
  });
  for (const [foreground, background] of [
    ['ink', 'surface'], ['secondary', 'surface'], ['muted', 'surface'],
    ['muted', 'canvas'], ['primary-ink', 'primary-soft'],
    ['surface', 'primary'], ['surface', 'primary-hover'],
    ['success', 'success-soft'], ['info-ink', 'info-soft'],
    ['warning', 'warning-soft'], ['danger', 'danger-soft'],
  ]) {
    const ratio = contrast(tokens.get(foreground), tokens.get(background));
    assert.ok(ratio >= 4.5, `${foreground}/${background}: ${ratio.toFixed(2)}:1`);
  }
});
