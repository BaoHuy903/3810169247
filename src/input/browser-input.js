export function attachBrowserInput(router, canvas) {
    let dragging = false, swallow = false;
    const move = e => {
        if (dragging) { router.dragTo(e.clientX, e.clientY); return; }
        router.move(e.clientX, e.clientY);
    };
    const leave = () => {
        if (dragging) { dragging = false; router.endDrag(); }
        router.leave();
    };
    const down = e => {
        if (e.button === 0 && router.beginDrag(e.clientX, e.clientY)) {
            dragging = true;
            swallow = true;
            e.preventDefault();
        }
    };
    const up = () => {
        if (dragging) { dragging = false; router.endDrag(); }
    };
    const click = e => {
        if (swallow) { swallow = false; e.preventDefault(); return; }
        if (!e.defaultPrevented && e.target === canvas) router.activate(e.clientX, e.clientY);
    };
    window.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('mouseout', leave);
    window.addEventListener('click', click);
    return () => {
        window.removeEventListener('mousedown', down);
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        window.removeEventListener('mouseout', leave);
        window.removeEventListener('click', click);
    };
}
