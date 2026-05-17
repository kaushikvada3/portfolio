document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('.fluid-nav');
    if (!nav) return;
    const pill = document.querySelector('.active-pill');
    const items = document.querySelectorAll('.nav-item');

    let activeIndex = 0; // Start at 0
    let isPointerDown = false;
    let isDragging = false;
    let dragOccurred = false; // to prevent click after drag
    let isAutoScrolling = false; // Prevents scroll triggers from hijacking during a programmatic click jump
    let startX = 0;
    let downTarget = null;
    let lastPointerClientX = 0;

    // Physics & Lerp variables
    let startPillTx = 0;
    let dragTargetX = 0;
    let dragCurrentX = 0;
    let dragRaf = 0;

    function updatePill(index, animate = true, isClick = true) {
        if (!items[index]) return;
        const item = items[index];
        const itemLeft = item.offsetLeft;
        const itemWidth = item.offsetWidth;

        if (animate) {
            const duration = isClick ? '0.48s' : '0.24s';
            const easing = isClick
                ? 'cubic-bezier(0.22, 1, 0.36, 1)'
                : 'cubic-bezier(0.2, 0.9, 0.2, 1)';
            pill.style.transition = `transform ${duration} ${easing}, width ${duration} ${easing}`;
        } else {
            pill.style.transition = 'none';
        }

        pill.style.transform = `translateX(${itemLeft}px) scale(1, 1)`;
        pill.style.width = `${itemWidth}px`;

        // Update active text states
        items.forEach((navItem, i) => {
            navItem.classList.toggle('active', i === index);
        });
    }

    // Initialize position after fonts and layout settle
    setTimeout(() => { updatePill(activeIndex, false); }, 100);

    // Physics Loop for dragging
    function dragLoop() {
        if (!isPointerDown) {
            dragRaf = 0;
            return;
        }

        // Keep drag responsive while preserving a slight elastic feel.
        dragCurrentX += (dragTargetX - dragCurrentX) * 0.28;

        // Calculate squash and stretch based on velocity
        const velocity = dragTargetX - dragCurrentX;
        const absVelocity = Math.abs(velocity);

        let stretchX = 1 + (absVelocity * 0.014);
        stretchX = Math.min(stretchX, 1.28);
        let squashY = 1 / Math.sqrt(stretchX); // Maintain volume

        pill.style.transform = `translateX(${dragCurrentX}px) scale(${stretchX}, ${squashY})`;

        dragRaf = requestAnimationFrame(dragLoop);
    }

    function cancelDragLoop() {
        if (!dragRaf) return;
        cancelAnimationFrame(dragRaf);
        dragRaf = 0;
    }

    function getDropIndexFromClientX(clientX) {
        const navItems = Array.from(items);
        if (!navItems.length) return activeIndex;

        const rects = navItems.map((item) => item.getBoundingClientRect());
        if (Number.isFinite(clientX)) {
            const exactHitIndex = rects.findIndex((rect) => clientX >= rect.left && clientX <= rect.right);
            if (exactHitIndex !== -1) return exactHitIndex;

            let closestIndex = 0;
            let minDistance = Infinity;
            rects.forEach((rect, index) => {
                const center = rect.left + (rect.width / 2);
                const distance = Math.abs(clientX - center);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestIndex = index;
                }
            });
            return closestIndex;
        }

        const pillRect = pill.getBoundingClientRect();
        const fallbackCenterX = pillRect.left + (pillRect.width / 2);

        let closestIndex = 0;
        let minDistance = Infinity;
        rects.forEach((rect, index) => {
            const center = rect.left + (rect.width / 2);
            const distance = Math.abs(fallbackCenterX - center);
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = index;
            }
        });
        return closestIndex;
    }

    // Intercept clicks strictly to prevent native jumping
    nav.addEventListener('click', (e) => {
        const anchor = e.target.closest('a');
        if (anchor && anchor.getAttribute('href').startsWith('#')) {
            e.preventDefault();
        }
        if (dragOccurred) {
            e.preventDefault();
            dragOccurred = false;
        }
    });

    // Handle all interactions directly on the nav container
    nav.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return; // Only trigger on left-click/touch

        isPointerDown = true;
        isDragging = false;
        dragOccurred = false;
        startX = e.clientX;
        lastPointerClientX = e.clientX;
        downTarget = e.target.closest('.nav-item'); // Remember what was clicked

        const matrix = new DOMMatrix(window.getComputedStyle(pill).transform);
        startPillTx = matrix.m41;
        dragTargetX = startPillTx;
        dragCurrentX = startPillTx;

        nav.setPointerCapture(e.pointerId);
        pill.style.transition = 'none';
        pill.getAnimations().forEach(anim => anim.cancel());
    });

    nav.addEventListener('pointermove', (e) => {
        if (!isPointerDown) return;
        lastPointerClientX = e.clientX;

        const deltaX = e.clientX - startX;

        // Drag threshold
        if (!isDragging && Math.abs(deltaX) > 3) {
            isDragging = true;
            dragOccurred = true;
            dragLoop(); // Start physics engine
        }

        if (isDragging) {
            let newX = startPillTx + deltaX;

            const minX = items[0].offsetLeft;
            const lastItem = items[items.length - 1];
            const maxX = lastItem.offsetLeft + lastItem.offsetWidth - pill.offsetWidth;

            // Add subtle rubber-banding resistance at the edges
            if (newX < minX) newX = minX - Math.pow(minX - newX, 0.55);
            else if (newX > maxX) newX = maxX + Math.pow(newX - maxX, 0.55);

            dragTargetX = newX;
        }
    });

    nav.addEventListener('pointerup', (e) => {
        if (!isPointerDown) return;
        isPointerDown = false;
        nav.releasePointerCapture(e.pointerId);
        const didDrag = isDragging;
        isDragging = false;

        const triggerScroll = (index) => {
            const targetHref = items[index].getAttribute('href');
            if (!targetHref || !targetHref.startsWith('#')) return;

            isAutoScrolling = true;

            if (targetHref === '#') {
                if (window.lenis) {
                    window.lenis.scrollTo(0, { onComplete: () => { isAutoScrolling = false; } });
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    setTimeout(() => { isAutoScrolling = false; }, 1000);
                }
            } else {
                if (window.lenis && document.querySelector(targetHref)) {
                    window.lenis.scrollTo(targetHref, {
                        offset: -60,
                        onComplete: () => { isAutoScrolling = false; }
                    });
                } else {
                    const targetE = document.querySelector(targetHref);
                    if (targetE) targetE.scrollIntoView({ behavior: 'smooth' });
                    setTimeout(() => { isAutoScrolling = false; }, 1000);
                }
            }
        };

        if (didDrag) {
            cancelDragLoop();
            const releaseX = Number.isFinite(e.clientX) ? e.clientX : lastPointerClientX;
            activeIndex = getDropIndexFromClientX(releaseX);
            updatePill(activeIndex, true, false); // Snap, but no extra click-stretch
            triggerScroll(activeIndex);

        } else {
            // Clean tap/click
            if (downTarget) {
                activeIndex = Array.from(items).indexOf(downTarget);
            }
            updatePill(activeIndex, true, true); // Snap WITH dynamic click-stretch effort
            triggerScroll(activeIndex);
        }
    });

    nav.addEventListener('pointercancel', () => {
        if (!isPointerDown) return;
        isPointerDown = false;
        isDragging = false;
        dragOccurred = false;
        cancelDragLoop();
        updatePill(activeIndex, true, false);
    });

    // Recalculate positions on window resize
    window.addEventListener('resize', () => {
        updatePill(activeIndex, false);
    });

    // Update based on scroll
    if (window.ScrollTrigger) {
        const sections = ['#projects', '#experience', '#education', '#skills', '#contact'];
        sections.forEach((sec) => {
            window.ScrollTrigger.create({
                trigger: sec,
                start: 'top center',
                end: 'bottom center',
                onEnter: () => setActiveFromHash(sec),
                onEnterBack: () => setActiveFromHash(sec)
            });
        });

        window.ScrollTrigger.create({
            trigger: '.hero',
            start: 'top baseline',
            end: 'bottom center',
            onEnter: () => setActiveFromHash('#'),
            onEnterBack: () => setActiveFromHash('#')
        });

        function setActiveFromHash(hash) {
            if (isPointerDown || isDragging || isAutoScrolling) return;
            const map = {
                '#': 0,
                '#projects': 1,
                '#experience': 2,
                '#education': 3,
                '#skills': 4,
                '#contact': 5
            };
            const nextIndex = map[hash];
            if (nextIndex === undefined || nextIndex === activeIndex) return;
            activeIndex = nextIndex;
            updatePill(activeIndex, true, false);
        }
    }
});
