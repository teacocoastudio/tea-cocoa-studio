(() => {
  const themeToggle = document.querySelector('#theme-toggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const root = document.documentElement;

  const applyTheme = (theme, saveChoice = false) => {
    const isDark = theme === 'dark';
    root.dataset.theme = isDark ? 'dark' : 'light';

    if (themeToggle) {
      const nextTheme = isDark ? 'light' : 'dark';
      const label = 'Switch to ' + nextTheme + ' theme';
      themeToggle.setAttribute('aria-label', label);
      themeToggle.setAttribute('aria-pressed', String(isDark));
      themeToggle.setAttribute('title', label);
    }

    if (themeMeta) themeMeta.setAttribute('content', isDark ? '#182832' : '#f5f0e7');

    if (saveChoice) {
      try {
        localStorage.setItem('tcs-theme', isDark ? 'dark' : 'light');
      } catch {
        // The theme still works if storage is unavailable.
      }
    }
  };

  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
    });
  }
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#primary-navigation');

  if (menuButton && navigation) {
    const closeMenu = () => {
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open menu');
      navigation.classList.remove('is-open');
    };

    menuButton.addEventListener('click', () => {
      const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!isOpen));
      menuButton.setAttribute('aria-label', isOpen ? 'Open menu' : 'Close menu');
      navigation.classList.toggle('is-open', !isOpen);
    });

    navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });
    document.addEventListener('click', (event) => {
      if (!navigation.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
    });
  }

  const year = document.querySelector('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  const revealTargets = document.querySelectorAll('.project-card, .service-row, .about-mark, .about-copy, .contact-left');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealTargets.forEach((target, index) => {
      target.style.setProperty('--reveal-delay', `${(index % 5) * 45}ms`);
      target.classList.add('reveal');
      observer.observe(target);
    });
  }

  const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (hasFinePointer && !prefersReducedMotion) {
    const bindPointerDepth = (element, mode, trackingElement = element) => {
      if (!element) return;

      let frame = 0;
      let latestEvent = null;
      element.classList.add('has-pointer');

      const reset = () => {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        latestEvent = null;
        if (mode === 'hero') {
          element.style.setProperty('--light-x', '0px');
          element.style.setProperty('--light-y', '0px');
          ['--front-shift-x', '--front-shift-y', '--back-shift-x', '--back-shift-y'].forEach((property) => element.style.setProperty(property, '0px'));
          ['--front-tilt-x', '--front-tilt-y', '--back-tilt-x', '--back-tilt-y'].forEach((property) => element.style.setProperty(property, '0deg'));
        } else {
          element.style.setProperty('--card-tilt-x', '0deg');
          element.style.setProperty('--card-tilt-y', '0deg');
        }
      };

      const move = (event) => {
        latestEvent = event;
        if (frame) return;

        frame = requestAnimationFrame(() => {
          frame = 0;
          if (!latestEvent) return;
          const bounds = element.getBoundingClientRect();
          if (!bounds.width || !bounds.height) return;
          const x = Math.max(-1, Math.min(1, ((latestEvent.clientX - bounds.left) / bounds.width) * 2 - 1));
          const y = Math.max(-1, Math.min(1, ((latestEvent.clientY - bounds.top) / bounds.height) * 2 - 1));

          if (mode === 'hero') {
            element.style.setProperty('--light-x', `${x * 86}px`);
            element.style.setProperty('--light-y', `${y * 68}px`);
            element.style.setProperty('--front-shift-x', `${x * 7}px`);
            element.style.setProperty('--front-shift-y', `${y * 6}px`);
            element.style.setProperty('--front-tilt-x', `${y * -3}deg`);
            element.style.setProperty('--front-tilt-y', `${x * 4}deg`);
            element.style.setProperty('--back-shift-x', `${x * -4}px`);
            element.style.setProperty('--back-shift-y', `${y * -3}px`);
            element.style.setProperty('--back-tilt-x', `${y * 2}deg`);
            element.style.setProperty('--back-tilt-y', `${x * -2.5}deg`);
          } else {
            element.style.setProperty('--card-tilt-x', `${y * -2.4}deg`);
            element.style.setProperty('--card-tilt-y', `${x * 2.4}deg`);
          }
        });
      };

      trackingElement.addEventListener('pointerenter', move);
      trackingElement.addEventListener('pointermove', move);
      trackingElement.addEventListener('pointerleave', reset);
      trackingElement.addEventListener('pointercancel', reset);
    };

    bindPointerDepth(document.querySelector('.hero-art'), 'hero');
    document.querySelectorAll('.project-visual').forEach((card) => bindPointerDepth(card, 'card', card.closest('.project-card') || card));
  }
})();
