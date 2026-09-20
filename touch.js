// Eight equal sectors, with a neutral centre. Contacts match joystick.js.
/** @param {number} x @param {number} y @returns {number} */
export function directionContacts(x, y) {
    if (Math.hypot(x, y) < 0.22) {
        return 0xFF;
    }
    const sectors = [0xF7, 0xF5, 0xFD, 0xF9, 0xFB, 0xFA, 0xFE, 0xF6];
    const sector = (Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8;
    return sectors[sector];
}

/** @param {HTMLElement} slot @param {HTMLCanvasElement} screen */
export function createTouchJoystick(slot, screen) {
    const view = document.createElement("div");
    view.className = "screen-view";
    screen.before(view);
    view.append(screen);
    const pad = document.createElement("div");
    pad.className = "touch-pad";
    pad.setAttribute("role", "group");
    pad.setAttribute("aria-label", "Player 1: drag for eight directions");
    const knob = document.createElement("span");
    knob.className = "touch-knob";
    pad.append(knob);
    const fire = document.createElement("button");
    fire.className = "touch-fire";
    fire.textContent = "FIRE";
    fire.setAttribute("aria-label", "Player 1 fire");
    const exit = document.createElement("button");
    exit.className = "touch-exit";
    exit.hidden = true;
    exit.textContent = "Exit fullscreen";
    slot.append(pad, fire, exit);
    let enabled = false;
    let direction = 0xFF;
    /** @type {number | null} */
    let padPointer = null;
    /** @type {number | null} */
    let firePointer = null;
    let keyFire = false;

    /** @param {PointerEvent} e */
    function move(e) {
        const box = pad.getBoundingClientRect();
        const radius = box.width / 2;
        const x = (e.clientX - box.left - radius) / radius;
        const y = (e.clientY - box.top - radius) / radius;
        direction = directionContacts(x, y);
        const length = Math.max(1, Math.hypot(x, y));
        knob.style.transform = `translate(${x / length * radius * 0.48}px, ${y / length * radius * 0.48}px)`;
    }
    /** @param {HTMLElement} el @param {number | null} id */
    function uncapture(el, id) {
        if (id !== null && el.hasPointerCapture(id)) {
            el.releasePointerCapture(id);
        }
    }
    function releasePad() {
        const id = padPointer;
        padPointer = null;
        direction = 0xFF;
        knob.style.transform = "";
        uncapture(pad, id);
    }
    function paintFire() {
        fire.classList.toggle("pressed", firePointer !== null || keyFire);
    }
    function releaseFire() {
        const id = firePointer;
        firePointer = null;
        keyFire = false;
        paintFire();
        uncapture(fire, id);
    }
    function release() {
        releasePad();
        releaseFire();
    }
    pad.onpointerdown = function (e) {
        if (!enabled || e.button !== 0 || padPointer !== null) return;
        e.preventDefault();
        padPointer = e.pointerId;
        pad.setPointerCapture(e.pointerId);
        move(e);
    };
    pad.onpointermove = function (e) {
        if (e.pointerId === padPointer) move(e);
    };
    pad.onpointerup = pad.onpointercancel = pad.onlostpointercapture = function (e) {
        if (e.pointerId === padPointer) releasePad();
    };
    fire.onpointerdown = function (e) {
        if (!enabled || e.button !== 0 || firePointer !== null) return;
        e.preventDefault();
        firePointer = e.pointerId;
        fire.setPointerCapture(e.pointerId);
        paintFire();
    };
    fire.onpointerup = fire.onpointercancel = fire.onlostpointercapture = function (e) {
        if (e.pointerId === firePointer) releaseFire();
    };
    fire.onkeydown = fire.onkeyup = function (e) {
        if (e.code !== "Space" && e.code !== "Enter") return;
        e.preventDefault();
        e.stopPropagation();
        keyFire = enabled && e.type === "keydown";
        paintFire();
    };
    fire.onblur = releaseFire;
    pad.oncontextmenu = fire.oncontextmenu = function (e) { e.preventDefault(); };
    window.addEventListener("blur", release);
    window.addEventListener("pagehide", release);
    window.addEventListener("resize", release);
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) release();
    });
    // The canvas now fits this cell, including when controls change its size.
    return {
        exit,
        view,
        release,
        contacts: function () {
            return enabled ? direction & (firePointer !== null || keyFire ? 0x7F : 0xFF) : 0xFF;
        },
        /** @param {boolean} on */
        setEnabled: function (on) {
            release();
            enabled = on;
            slot.classList.toggle("touch-enabled", on);
            pad.hidden = fire.hidden = !on;
        },
        /** @param {boolean} on */
        setFullscreen: function (on) {
            exit.hidden = !on;
        },
    };
}
