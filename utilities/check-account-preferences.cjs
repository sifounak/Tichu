// Browser regression check. Run against a disposable local server: this creates a test account.
// Set PLAYWRIGHT_MODULE to an installed Playwright module if it is not available on NODE_PATH.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const outputDirectory = process.env.PREFERENCES_SCREENSHOT_DIR || 'results/Milestone3/account-preferences';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM });
  try {
    const context = await browser.newContext({ viewport: { width: 1100, height: 950 } });
    const unique = Date.now();
    const username = `Prefs${unique}`;
    const registration = await context.request.post('http://localhost:3001/api/auth/register', {
      data: { userId: `preferences-${unique}`, username, email: `prefs${unique}@test.local`, password: 'preferences-test-password' },
    });
    assert.equal(registration.status(), 200);
    const account = await registration.json();
    await context.addInitScript(({ token, userId, username }) => {
      localStorage.setItem('tichu_token', token);
      localStorage.setItem('tichu_user_id', userId);
      localStorage.setItem('tichu_user_profile', JSON.stringify({ userId, username, isGuest: false }));
    }, { ...account, username });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://localhost:3000/lobby');
    const open = async () => {
      await page.getByRole('button', { name: 'User menu' }).click();
      await page.getByRole('button', { name: 'Preferences', exact: true }).click();
      await page.getByRole('radio', { name: 'High to low' }).waitFor();
    };
    await open();
    assert.equal(await page.getByRole('dialog').locator('[role="img"]').count(), 1, 'Preferences should show only one example hand');
    fs.mkdirSync(outputDirectory, { recursive: true });
    assert.ok(await page.getByRole('dialog').evaluate((dialog) => /^rgb\(/.test(getComputedStyle(dialog).backgroundColor)), 'Preferences panel must be opaque');
    for (const width of [1100, 360]) {
      await page.setViewportSize({ width, height: 950 });
      for (const order of ['Low to high', 'High to low']) {
        for (const overlap of ['Left cards on top', 'Right cards on top']) {
          await page.getByRole('radio', { name: order }).check();
          await page.getByRole('radio', { name: overlap }).check();
          const result = await page.getByRole('img', { name: 'Example hand', exact: true }).evaluate((group) => {
            const cards = [...group.querySelectorAll('[data-card-id]')];
            // Temporarily enable hit testing to detect actual occlusion; previews are non-interactive.
            cards.forEach((card) => { card.style.pointerEvents = 'auto'; });
            const visibility = cards.map((card) => [...card.querySelectorAll('[data-card-rank], [data-card-suit]')].every((identifier) => {
              const rect = identifier.getBoundingClientRect();
              return [rect.left + 1, rect.left + rect.width / 2, rect.right - 1].every((x) => card.contains(document.elementFromPoint(x, rect.y + rect.height / 2)));
            }));
            const centered = cards.every((card) => {
              const corner = card.querySelector('[data-card-corner]').getBoundingClientRect();
              return [...card.querySelectorAll('[data-card-rank], [data-card-suit]')].every((identifier) => {
                const rect = identifier.getBoundingClientRect();
                return Math.abs(rect.left + rect.width / 2 - corner.left - corner.width / 2) < 0.1;
              });
            });
            cards.forEach((card) => { card.style.pointerEvents = ''; });
            const bounds = group.firstElementChild.getBoundingClientRect();
            const parent = group.parentElement.getBoundingClientRect();
            return { ids: cards.map((card) => card.dataset.cardId), visibility, centered,
              widths: cards.map((card) => card.querySelector('[data-card-rank]').getBoundingClientRect().width),
              cardWidth: cards[0].getBoundingClientRect().width,
              fits: bounds.left >= parent.left - 1 && bounds.right <= parent.right + 1 };
          });
          assert.equal(result.ids[0], order === 'Low to high' ? '100' : '108');
          assert.ok(result.fits, JSON.stringify(result));
          if (!result.visibility.every(Boolean)) await page.screenshot({ path: `${outputDirectory}/visibility-failure.png` });
          assert.ok(result.visibility.every(Boolean), JSON.stringify({ width, order, overlap, result }));
          assert.ok(result.centered, 'Rank and suit must share the center of the corner block');
          if (width === 1100) {
            const layouts = await page.getByRole('img', { name: 'Example hand', exact: true }).evaluate((group) => {
              return [[42, 60, 11], [64, 92, 16], [70, 100, 16], [105, 150, 24], [131.25, 187.5, 30]].map(([width, height, font]) => {
                const clone = group.cloneNode(true);
                Object.assign(clone.style, { position: 'fixed', top: '100px', left: '20px', width: '1000px', zIndex: '2000' });
                clone.style.setProperty('--card-width', `${width}px`);
                clone.style.setProperty('--card-height', `${height}px`);
                clone.style.setProperty('--card-font-size', `${font}px`);
                clone.firstElementChild.style.transform = 'none';
                document.body.append(clone);
                try {
                  const cards = [...clone.querySelectorAll('[data-card-id]')];
                  cards.forEach((card) => { card.style.pointerEvents = 'auto'; });
                  const symmetric = cards.every((card) => {
                    const bounds = card.getBoundingClientRect();
                    const corner = card.querySelector('[data-card-corner]').getBoundingClientRect();
                    const inset = card.dataset.identifierSide === 'left' ? corner.left - bounds.left : bounds.right - corner.right;
                    return Math.abs(inset - width * 0.045) < 0.1 && Math.abs(corner.width - font * 1.5) < 0.1;
                  });
                  const visible = cards.every((card) => [...card.querySelectorAll('[data-card-rank], [data-card-suit]')].every((identifier) => {
                    const rect = identifier.getBoundingClientRect();
                    return [rect.left + 1, rect.left + rect.width / 2, rect.right - 1].every((x) => card.contains(document.elementFromPoint(x, rect.top + rect.height / 2)));
                  }));
                  return { width, symmetric, visible };
                } finally { clone.remove(); }
              });
            });
            assert.ok(layouts.every((layout) => layout.symmetric && layout.visible), JSON.stringify({ order, overlap, layouts }));
          }
        }
      }
    }
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    const endpoint = 'http://localhost:3001/api/users/me/preferences';
    const headers = { Authorization: `Bearer ${account.token}` };
    assert.equal((await (await context.request.get(endpoint, { headers })).json()).preferences.cardOrder, 'descending');
    await open();
    await page.getByRole('radio', { name: 'Low to high' }).check();
    await page.getByRole('radio', { name: 'Left cards on top' }).check();
    await page.getByRole('switch', { name: 'Chat', exact: true }).uncheck();
    await page.setViewportSize({ width: 1100, height: 950 });
    await page.getByRole('dialog').evaluate((dialog) => { dialog.querySelector('[class*="content"]').scrollTop = 0; });
    await page.screenshot({ path: `${outputDirectory}/desktop.png` });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    const saved = (await (await context.request.get(endpoint, { headers })).json()).preferences;
    assert.equal(saved.cardOrder, 'ascending');
    assert.equal(saved.cardOverlap, 'leftOnTop');
    assert.equal(saved.chatSound, false);
    await page.reload();
    await open();
    assert.ok(await page.getByRole('radio', { name: 'Low to high' }).isChecked());
    assert.ok(await page.getByRole('radio', { name: 'Left cards on top' }).isChecked());
    assert.equal(await page.getByRole('switch', { name: 'Chat', exact: true }).isChecked(), false);
    await page.setViewportSize({ width: 360, height: 780 });
    await page.screenshot({ path: `${outputDirectory}/mobile.png` });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.setViewportSize({ width: 1100, height: 950 });
    await page.getByRole('textbox', { name: 'Room name' }).fill(`Preferences ${unique}`);
    await page.getByRole('button', { name: 'Create Game', exact: true }).click();
    await page.getByRole('dialog', { name: 'Create Game Settings' }).getByRole('button', { name: 'Create Game', exact: true }).click();
    await page.waitForURL(/\/game\//);
    await page.getByRole('button', { name: 'Game Menu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Preferences', exact: true }).click();
    await page.getByRole('radio', { name: 'Low to high' }).waitFor();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    for (let index = 0; index < 3; index++) {
      await page.getByRole('button', { name: 'Add Bot', exact: true }).first().click();
      await page.waitForFunction((expected) => [...document.querySelectorAll('button')].filter((button) => button.textContent.replace(/\s/g, '') === 'AddBot').length === expected, 2 - index);
    }
    await page.getByRole('button', { name: 'Start Game', exact: true }).click();
    await page.getByRole('group', { name: 'Your hand' }).waitFor();
    await page.getByRole('button', { name: 'Pass', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="Your hand"]')?.querySelectorAll('[data-card-id]').length === 14);
    for (const width of [1100, 360]) {
      await page.setViewportSize({ width, height: 950 });
      await page.waitForTimeout(1000); // Allow responsive measurements and the existing deal animation to settle.
      const identifiersVisible = await page.getByRole('group', { name: 'Your hand' }).evaluate((group) =>
        [...group.querySelectorAll('[data-card-id]')].every((card) => {
          return [...card.querySelectorAll('[data-card-rank], [data-card-suit]')].every((identifier) => {
            const rect = identifier.getBoundingClientRect();
            return [rect.left + 1, rect.left + rect.width / 2, rect.right - 1].every((x) => card.contains(document.elementFromPoint(x, rect.top + rect.height / 2)));
          });
        }));
      assert.ok(identifiersVisible, `14-card hand identifiers clipped at width ${width}`);
    }
    assert.deepEqual(errors, []);
    console.log('Browser checks passed: one preview, desktop/mobile, four sort/overlap combinations, centered corners at five card sizes, visible rank/suit identifiers, Cancel, Save, reload, Escape, pre-game menu, 14-card game hand.');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
