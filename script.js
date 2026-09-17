(() => {
  const cards = [...document.querySelectorAll('.memory-card')];
  const status = document.querySelector('#memory-status');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const supportsAnimation = typeof Element.prototype.animate === 'function';
  const duration = 820;
  const controllers = [];
  const couponDialog = document.querySelector('#secret-coupon-dialog');
  const couponTriggers = [...document.querySelectorAll('.coupon-trigger')];
  const couponTriggerResetters = [];
  let announcementToken = 0;

  function announce(message) {
    if (!status) return;

    const token = ++announcementToken;
    status.textContent = '';
    requestAnimationFrame(() => {
      if (token === announcementToken) status.textContent = message;
    });
  }

  function createAnimation(element, keyframes) {
    if (!supportsAnimation) return null;

    const animation = element.animate(keyframes, {
      duration,
      easing: 'linear',
      fill: 'both'
    });

    animation.pause();
    animation.currentTime = 0;
    return animation;
  }

  function createController(card) {
    const lift = card.querySelector('.card-lift');
    const rotor = card.querySelector('.card-rotor');
    const front = card.querySelector('.card-front');
    const back = card.querySelector('.card-back');
    const ribbon = card.querySelector('.ribbon__body');
    const ribbonCopy = card.querySelector('.ribbon__copy');

    const controller = {
      card,
      lift,
      rotor,
      front,
      back,
      ribbon,
      ribbonCopy,
      title: card.dataset.title || 'Memory',
      message: card.dataset.message || '',
      closedRibbonText: ribbonCopy?.textContent || 'OPEN',
      wantsOpen: false,
      liftAnimation: null,
      rotorAnimation: null,
      ribbonAnimation: null
    };

    controller.liftAnimation = createAnimation(lift, [
      {
        transform: 'translate3d(0, 0, 0) scale(1)',
        offset: 0,
        easing: 'cubic-bezier(.18,.82,.24,1)'
      },
      {
        transform: 'translate3d(0, -20px, 0) scale(1.018)',
        offset: 0.26
      },
      {
        transform: 'translate3d(0, -20px, 0) scale(1.018)',
        offset: 1
      }
    ]);

    controller.rotorAnimation = createAnimation(rotor, [
      {
        transform: 'rotateY(0deg)',
        offset: 0
      },
      {
        transform: 'rotateY(0deg)',
        offset: 0.2,
        easing: 'cubic-bezier(.48,.08,.2,1)'
      },
      {
        transform: 'rotateY(180deg)',
        offset: 1
      }
    ]);

    if (supportsAnimation && ribbon) {
      controller.ribbonAnimation = ribbon.animate([
        { transform: 'translate3d(0, 0, 0) rotate(0deg)', offset: 0, easing: 'cubic-bezier(.2,.9,.3,1)' },
        { transform: 'translate3d(0, -17px, 0) rotate(4deg)', offset: 0.24, easing: 'cubic-bezier(.3,.7,.3,1)' },
        { transform: 'translate3d(0, 2px, 0) rotate(-2.5deg)', offset: 0.52, easing: 'ease-out' },
        { transform: 'translate3d(0, -6px, 0) rotate(1.5deg)', offset: 0.72, easing: 'ease-in' },
        { transform: 'translate3d(0, 0, 0) rotate(0deg)', offset: 1 }
      ], {
        duration: 620,
        easing: 'linear'
      });
      controller.ribbonAnimation.cancel();
    }

    if (controller.rotorAnimation) {
      controller.rotorAnimation.onfinish = () => {
        if (controller.rotorAnimation.playState !== 'finished') return;

        const currentTime = Number(controller.rotorAnimation.currentTime);
        const reachedOpen = currentTime >= duration - 0.5;
        const reachedClosed = currentTime <= 0.5;

        if (!reachedOpen && !reachedClosed) return;

        if (reachedOpen !== controller.wantsOpen) {
          drive(controller);
          return;
        }

        settle(
          controller,
          reachedOpen,
          reachedOpen && controller.announceWhenFinished
        );
      };
    }

    card.dataset.state = 'closed';
    card.addEventListener('click', () => {
      const shouldOpen = !controller.wantsOpen;

      if (shouldOpen) {
        controllers.forEach((other) => {
          if (other !== controller && other.wantsOpen) requestState(other, false, false);
        });
      }

      jumpRibbon(controller);
      requestState(controller, shouldOpen, true);
    });

    return controller;
  }

  function syncIntent(controller, open) {
    controller.card.dataset.state = open ? 'opening' : 'closing';
    controller.card.setAttribute('aria-pressed', String(open));
    controller.card.setAttribute('aria-busy', 'true');
    controller.card.setAttribute(
      'aria-label',
      `${open ? 'Hide' : 'Reveal'} memory: ${controller.title}`
    );
    if (controller.ribbonCopy) {
      controller.ribbonCopy.textContent = open ? 'CLOSE' : controller.closedRibbonText;
    }
  }

  function requestState(controller, open, announceWhenFinished) {
    controller.wantsOpen = open;
    controller.announceWhenFinished = announceWhenFinished;
    syncIntent(controller, open);

    if (reducedMotion.matches || !supportsAnimation) {
      snap(controller, open, announceWhenFinished && open);
      return;
    }

    drive(controller);
  }

  function drive(controller) {
    const animations = [controller.liftAnimation, controller.rotorAnimation].filter(Boolean);
    const rate = controller.wantsOpen ? 1 : -1;

    animations.forEach((animation) => {
      if (animation.currentTime == null) {
        animation.currentTime = controller.wantsOpen ? 0 : duration;
      }

      if (typeof animation.updatePlaybackRate === 'function') {
        animation.updatePlaybackRate(rate);
      } else {
        animation.playbackRate = rate;
      }
      animation.play();
    });
  }

  function settle(controller, open, shouldAnnounce) {
    controller.wantsOpen = open;
    [controller.liftAnimation, controller.rotorAnimation].filter(Boolean).forEach((animation) => {
      animation.pause();
      animation.currentTime = open ? duration : 0;
    });

    if (!supportsAnimation) {
      controller.lift.style.transform = open
        ? 'translate3d(0, -20px, 0) scale(1.018)'
        : 'translate3d(0, 0, 0) scale(1)';
      controller.rotor.style.transform = open ? 'rotateY(180deg)' : 'rotateY(0deg)';
    }

    controller.card.dataset.state = open ? 'open' : 'closed';
    controller.card.setAttribute('aria-pressed', String(open));
    controller.card.removeAttribute('aria-busy');
    controller.card.setAttribute(
      'aria-label',
      `${open ? 'Hide' : 'Reveal'} memory: ${controller.title}`
    );
    controller.front.setAttribute('aria-hidden', String(open));
    controller.back.setAttribute('aria-hidden', String(!open));

    if (controller.ribbonCopy) {
      controller.ribbonCopy.textContent = open ? 'CLOSE' : controller.closedRibbonText;
    }

    if (open && shouldAnnounce && controller.message) {
      announce(`${controller.title}. ${controller.message}`);
    }
  }

  function snap(controller, open, shouldAnnounce) {
    settle(controller, open, shouldAnnounce);
  }

  function jumpRibbon(controller) {
    if (!controller.ribbonAnimation || reducedMotion.matches) return;
    controller.ribbonAnimation.cancel();
    controller.ribbonAnimation.play();
  }

  function closeCoupon() {
    if (!couponDialog) return;

    if (typeof couponDialog.close === 'function') {
      couponDialog.close();
    } else {
      couponDialog.removeAttribute('open');
      resetCouponTriggers();
    }
  }

  function openCoupon() {
    if (!couponDialog || couponDialog.open) return;

    if (typeof couponDialog.showModal === 'function') {
      couponDialog.showModal();
    } else {
      couponDialog.setAttribute('open', '');
    }
  }

  function resetCouponTriggers() {
    couponTriggerResetters.forEach((reset) => reset());
  }

  cards.forEach((card) => controllers.push(createController(card)));

  couponTriggers.forEach((trigger) => {
    const requiredClicks = Math.max(1, Number(trigger.dataset.requiredClicks) || 1);
    const originalLabel = trigger.getAttribute('aria-label') || 'Open secret coupon';
    let tapCount = 0;
    let resetTimer = 0;

    const resetTrigger = () => {
      window.clearTimeout(resetTimer);
      tapCount = 0;
      trigger.dataset.taps = '0';
      trigger.classList.remove('is-tapped');
      trigger.setAttribute('aria-label', originalLabel);
    };

    couponTriggerResetters.push(resetTrigger);

    trigger.addEventListener('click', () => {
      if (!couponDialog || couponDialog.open) return;

      tapCount = Math.min(tapCount + 1, requiredClicks);
      trigger.dataset.taps = String(tapCount);
      trigger.classList.remove('is-tapped');
      void trigger.offsetWidth;
      trigger.classList.add('is-tapped');

      const remaining = requiredClicks - tapCount;
      window.clearTimeout(resetTimer);

      if (remaining > 0) {
        const tapWord = remaining === 1 ? 'tap' : 'taps';
        trigger.setAttribute('aria-label', `${remaining} more ${tapWord} to unlock the secret`);
        announce(`${remaining} more ${tapWord} to unlock the secret.`);
        resetTimer = window.setTimeout(resetTrigger, 2500);
        return;
      }

      announce('Secret anniversary coupon unlocked.');
      openCoupon();
    });

    trigger.addEventListener('animationend', (event) => {
      if (event.animationName === 'book-tap') trigger.classList.remove('is-tapped');
    });
  });

  couponDialog?.addEventListener('close', resetCouponTriggers);

  couponDialog?.addEventListener('click', (event) => {
    if (event.target !== couponDialog) return;

    const bounds = couponDialog.getBoundingClientRect();
    const outside = event.clientX < bounds.left
      || event.clientX > bounds.right
      || event.clientY < bounds.top
      || event.clientY > bounds.bottom;

    if (outside) closeCoupon();
  });

  couponDialog?.querySelectorAll('form[method="dialog"]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      if (typeof couponDialog.close === 'function') return;

      event.preventDefault();
      closeCoupon();
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (couponDialog?.open) return;

    const openCards = controllers.filter((controller) => controller.wantsOpen);
    if (!openCards.length) return;

    event.preventDefault();
    openCards.forEach((controller) => requestState(controller, false, false));
  });

  const handleMotionChange = () => {
    if (!reducedMotion.matches) return;

    controllers.forEach((controller) => {
      controller.ribbonAnimation?.cancel();
      snap(controller, controller.wantsOpen, false);
    });
  };

  if (typeof reducedMotion.addEventListener === 'function') {
    reducedMotion.addEventListener('change', handleMotionChange);
  } else {
    reducedMotion.addListener(handleMotionChange);
  }
})();
