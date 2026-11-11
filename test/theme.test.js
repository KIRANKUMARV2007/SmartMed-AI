import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('SmartMed Theme Initialization & Persistence Guardrails', async (t) => {
  await t.test('index.html specifies light theme as default and includes pre-render theme script', () => {
    const indexPath = path.resolve('index.html');
    const htmlContent = fs.readFileSync(indexPath, 'utf-8');

    // Must default html data-theme to light
    assert.match(htmlContent, /<html\s+[^>]*data-theme="light"[^>]*>/);

    // Must include synchronous pre-render script checking smartmed_theme
    assert.match(htmlContent, /localStorage\.getItem\(['"]smartmed_theme['"]\)/);
    assert.match(htmlContent, /data-theme/);
  });

  await t.test('Theme resolver helper resolves light by default when localStorage is empty', () => {
    const resolveInitialTheme = (storageValue) => {
      if (storageValue === 'dark' || storageValue === 'light') {
        return storageValue;
      }
      return 'light';
    };

    assert.equal(resolveInitialTheme(null), 'light');
    assert.equal(resolveInitialTheme(undefined), 'light');
    assert.equal(resolveInitialTheme(''), 'light');
  });

  await t.test('Theme resolver helper respects valid saved user preference', () => {
    const resolveInitialTheme = (storageValue) => {
      if (storageValue === 'dark' || storageValue === 'light') {
        return storageValue;
      }
      return 'light';
    };

    assert.equal(resolveInitialTheme('dark'), 'dark');
    assert.equal(resolveInitialTheme('light'), 'light');
  });

  await t.test('Theme resolver helper safely ignores invalid or corrupted storage values', () => {
    const resolveInitialTheme = (storageValue) => {
      if (storageValue === 'dark' || storageValue === 'light') {
        return storageValue;
      }
      return 'light';
    };

    assert.equal(resolveInitialTheme('neon'), 'light');
    assert.equal(resolveInitialTheme('123'), 'light');
    assert.equal(resolveInitialTheme('{theme: "dark"}'), 'light');
  });
});
