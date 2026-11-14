export function createInputRouter(mouse) {
    const actions = new Map();
    const drags = [];
    let mode = 'feed', drag = null;
    return {
        move(x, y) { mouse.x = x; mouse.y = y; mouse.active = true; },
        leave() { mouse.active = false; },
        register(name, action) {
            if (actions.has(name)) throw new Error('Duplicate input mode: ' + name);
            actions.set(name, action);
            return () => actions.delete(name);
        },
        setMode(name) {
            if (!actions.has(name)) throw new Error('Unknown input mode: ' + name);
            mode = name;
        },
        activate(x, y) { actions.get(mode)?.(x, y); },
        registerDrag(handler) {
            drags.push(handler);
            return () => {
                const i = drags.indexOf(handler);
                if (i >= 0) drags.splice(i, 1);
            };
        },
        beginDrag(x, y) {
            for (let i = drags.length - 1; i >= 0; i--) {
                const handler = drags[i];
                if (!handler.hit?.(x, y)) continue;
                drag = handler;
                handler.start?.(x, y);
                return true;
            }
            return false;
        },
        dragTo(x, y) {
            if (!drag) return false;
            drag.move?.(x, y);
            return true;
        },
        endDrag() {
            if (!drag) return false;
            const handler = drag;
            drag = null;
            handler.end?.();
            return true;
        },
        dragging: () => !!drag,
        dispose() { actions.clear(); drags.length = 0; drag = null; mouse.active = false; }
    };
}
