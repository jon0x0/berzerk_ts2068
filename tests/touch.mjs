// Run with Playwright installed: node tests/touch.mjs (serve TSRun on port 8000).
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const browser = await chromium.launch({headless: true, channel: process.env.BROWSER_CHANNEL || undefined});
try {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const entry of ['index.html', 'archive.html']) {
        await page.goto(`http://127.0.0.1:8000/${entry}?touch=1`);
        await page.waitForFunction(() => document.querySelector('#screen').style.width !== '');
        assert(await page.locator('#touch-toggle').isChecked());
        assert(await page.locator('.touch-pad').isVisible());
        await page.waitForTimeout(200);
        const bounds = await page.locator('#screen').boundingBox();
        assert(bounds.x >= 0 && bounds.x + bounds.width <= 390, `${entry}: screen fits portrait`);
    }
    await page.goto('http://127.0.0.1:8000/?touch=1&crt=0');
    await page.waitForTimeout(300);
    // Exercise the actual controller in isolation so contacts are observable.
    await page.evaluate(async () => {
        const {createTouchJoystick, directionContacts} = await import('/touch.js');
        const {pollJoysticks} = await import('/joystick.js');
        const expected = [0xF7,0xF5,0xFD,0xF9,0xFB,0xFA,0xFE,0xF6];
        for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4;
            if (directionContacts(Math.cos(angle), Math.sin(angle)) !== expected[i]) throw Error('sector ' + i);
        }
        if (directionContacts(0.1,0.1) !== 255) throw Error('deadzone');
        const slot = document.createElement('div');
        slot.id = 'fixture';
        slot.style.cssText = 'position:fixed;inset:0;background:#111;z-index:5;display:flex';
        const canvas = document.createElement('canvas');
        slot.append(canvas);
        document.body.append(slot);
        window.testTouch = createTouchJoystick(slot,canvas);
        window.testTouch.setEnabled(true);
        slot.querySelector('.touch-pad').style.cssText = 'position:absolute;left:10px;top:400px;width:120px;height:120px';
        slot.querySelector('.touch-fire').style.cssText = 'position:absolute;right:10px;top:400px;width:120px;height:120px';
        const bytes = new Uint8Array(2);
        pollJoysticks(bytes);
        if (bytes[0] !== 255 || bytes[1] !== 255) throw Error('idle gamepad');
    });
    const cdp = await context.newCDPSession(page);
    const touch = async (type, points) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: points.map(([id,x,y]) => ({id,x,y}))});
    const contacts = () => page.evaluate(() => window.testTouch.contacts());
    await touch('touchStart', [[1,110,420],[2,320,460]]);
    assert.equal(await contacts(), 0x76, 'up-right and fire simultaneously');
    await touch('touchMove', [[1,30,500],[2,320,460]]);
    assert.equal(await contacts(), 0x79, 'drag to down-left while firing');
    await touch('touchEnd', [[2,320,460]]);
    assert.equal(await contacts(), 0xF9, 'release fire independently');
    await touch('touchCancel', []);
    assert.equal(await contacts(), 255, 'cancel releases pad');
    await touch('touchStart', [[1,110,420],[2,320,460]]);
    await page.evaluate(() => window.testTouch.setEnabled(false));
    assert.equal(await contacts(), 255, 'disable releases all contacts');
    await touch('touchEnd', []);
    await page.evaluate(() => window.testTouch.setEnabled(true));
    await touch('touchStart', [[1,110,420],[2,320,460]]);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal(await contacts(), 255, 'blur releases all contacts');
    await touch('touchEnd', []);
    await page.evaluate(() => document.querySelector('#fixture').remove());
    for (const size of [{width:390,height:844},{width:844,height:390}]) {
        await page.setViewportSize(size);
        await page.locator('#fullscreen-toggle').click();
        await page.waitForTimeout(300);
        assert(await page.locator('.touch-exit').isVisible());
        for (const selector of ['#screen','.touch-pad','.touch-fire']) {
            const b = await page.locator(selector).boundingBox();
            assert(b.width > 0 && b.height > 0 && b.x >= 0 && b.y >= 0 && b.x+b.width <= size.width+1 && b.y+b.height <= size.height+1, `${selector} fits ${size.width}x${size.height}: ${JSON.stringify(b)}`);
        }
        if (process.env.SCREENSHOT_DIR) {
            await page.screenshot({path:`${process.env.SCREENSHOT_DIR}/touch-${size.width}.png`});
        }
        await page.locator('.touch-exit').click();
    }
    await page.evaluate(() => {
        document.querySelector('#screen-slot').requestFullscreen = undefined;
    });
    await page.locator('#fullscreen-toggle').click();
    assert(await page.locator('.touch-exit').isVisible(), 'fallback has touch exit');
    await page.locator('.touch-exit').click();
    assert(await page.locator('#fullscreen-toggle').isVisible(), 'fallback restores toolbar');
    await page.locator('label').filter({has: page.locator('#touch-toggle')}).click();
    assert(!await page.locator('.touch-pad').isVisible());
    await page.goto('http://127.0.0.1:8000/?touch=invalid');
    assert(!await page.locator('#touch-toggle').isChecked());
    assert(!await page.locator('.touch-pad').isVisible());
    assert.deepEqual(errors, []);
    console.log('PASS: eight directions, deadzone, multitouch, cancellation, disable, URL defaults, both pages, portrait/landscape fullscreen, CRT-off fitting.');
} finally {
    await browser.close();
}
