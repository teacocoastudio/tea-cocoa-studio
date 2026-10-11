(() => {
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

  // Formspree verifies the Turnstile response server-side using its securely stored Secret Key.
  const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xgaoypka';
  // Public Turnstile Site Key only; the Secret Key must stay in Formspree settings.
  const TURNSTILE_SITE_KEY = '0x4AAAAAAFTcEYhbR70u678o';
  const inquiryForm = document.querySelector('#inquiry-form');

  if (inquiryForm) {
    const steps = Array.from(inquiryForm.querySelectorAll('.inquiry-step'));
    const markers = Array.from(document.querySelectorAll('[data-step-marker]'));
    const progressBar = document.querySelector('#inquiry-progress-bar');
    const message = document.querySelector('#inquiry-message');
    const submitButton = document.querySelector('#inquiry-submit');
    const submitLabel = submitButton ? submitButton.querySelector('.submit-label') : null;
    const setupNote = document.querySelector('#form-setup-note');
    const formShell = document.querySelector('#inquiry-form-shell');
    const successPanel = document.querySelector('#inquiry-success');
    const turnstileBox = document.querySelector('#turnstile-box');
    const turnstileContainer = document.querySelector('#turnstile-container');
    const turnstileStatus = document.querySelector('#turnstile-status');
    const turnstileRetry = document.querySelector('#turnstile-retry');
    const endpointIsConfigured = (() => {
      try {
        const endpoint = new URL(FORMSPREE_ENDPOINT);
        return endpoint.protocol === 'https:' && endpoint.hostname === 'formspree.io' && /^\/f\/[A-Za-z0-9]+$/.test(endpoint.pathname);
      } catch {
        return false;
      }
    })();
    const siteKeyIsConfigured = Boolean(TURNSTILE_SITE_KEY.trim()) && !TURNSTILE_SITE_KEY.includes('YOUR_SITE_KEY');
    const securityIsConfigured = endpointIsConfigured && siteKeyIsConfigured;
    let turnstileToken = '';
    let turnstileWidgetId = null;
    let turnstileScriptLoading = false;
    let currentStep = 0;
    let submitting = false;

    const updateSubmitState = () => {
      if (submitButton) {
        const formIsValid = inquiryForm.checkValidity();
        submitButton.disabled = !securityIsConfigured || !formIsValid || !turnstileToken || submitting;
      }
    };
    updateSubmitState();
    if (setupNote) setupNote.hidden = securityIsConfigured;
    if (turnstileBox) turnstileBox.hidden = !securityIsConfigured;

    const setMessage = (text = '') => {
      if (!message) return;
      message.textContent = text;
      message.hidden = !text;
    };

    const setTurnstileStatus = (text, failed = false) => {
      if (turnstileStatus) turnstileStatus.textContent = text;
      if (turnstileRetry) turnstileRetry.hidden = !failed;
    };

    const renderTurnstile = () => {
      if (!window.turnstile || !turnstileContainer || !siteKeyIsConfigured) return;
      try {
        turnstileWidgetId = window.turnstile.render('#turnstile-container', {
          sitekey: TURNSTILE_SITE_KEY.trim(),
          theme: 'dark',
          size: window.matchMedia('(max-width: 420px)').matches ? 'compact' : 'flexible',
          execution: 'render',
          appearance: 'always',
          callback: (token) => {
            turnstileToken = token;
            setTurnstileStatus('Verification complete.');
            updateSubmitState();
          },
          'error-callback': () => {
            turnstileToken = '';
            setTurnstileStatus('Verification is temporarily unavailable. Check your connection and try again.', true);
            updateSubmitState();
          },
          'expired-callback': () => {
            turnstileToken = '';
            setTurnstileStatus('Your verification expired. Please complete the check again.', true);
            updateSubmitState();
          }
        });
        setTurnstileStatus('Complete the security check to send your inquiry.');
      } catch {
        setTurnstileStatus('Verification could not be loaded. Please try again.', true);
        updateSubmitState();
      }
    };

    const loadTurnstile = () => {
      if (!securityIsConfigured || !turnstileBox || turnstileWidgetId !== null) return;
      turnstileBox.hidden = false;
      if (window.turnstile) {
        renderTurnstile();
        return;
      }
      if (turnstileScriptLoading) return;
      turnstileScriptLoading = true;
      setTurnstileStatus('Loading the security check…');
      let apiScript = document.querySelector('script[data-tcs-turnstile]');
      if (!apiScript) {
        apiScript = document.createElement('script');
        apiScript.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        apiScript.async = true;
        apiScript.defer = true;
        apiScript.dataset.tcsTurnstile = 'true';
      }
      apiScript.addEventListener('load', () => {
        turnstileScriptLoading = false;
        if (window.turnstile) renderTurnstile();
        else setTurnstileStatus('Verification is temporarily unavailable. Please try again.', true);
      }, { once: true });
      apiScript.addEventListener('error', () => {
        turnstileScriptLoading = false;
        apiScript.remove();
        setTurnstileStatus('Verification could not be loaded. Check your connection and try again.', true);
      }, { once: true });
      if (!apiScript.isConnected) document.head.appendChild(apiScript);
    };

    if (turnstileRetry) {
      turnstileRetry.addEventListener('click', () => {
        if (window.turnstile && turnstileWidgetId !== null) {
          turnstileToken = '';
          setTurnstileStatus('Refreshing the security check…');
          updateSubmitState();
          window.turnstile.reset(turnstileWidgetId);
        } else {
          turnstileScriptLoading = false;
          loadTurnstile();
        }
      });
    }

    const validateStep = (step) => {
      if (step === 0 && !inquiryForm.querySelector('input[name="service"]:checked')) {
        setMessage('Choose a service to continue.');
        const firstOption = inquiryForm.querySelector('input[name="service"]');
        if (firstOption) firstOption.focus();
        return false;
      }
      const invalidControl = steps[step].querySelector('input:invalid, select:invalid, textarea:invalid');
      if (invalidControl) {
        invalidControl.reportValidity();
        return false;
      }
      return true;
    };

    const showStep = (nextStep) => {
      currentStep = Math.max(0, Math.min(steps.length - 1, nextStep));
      steps.forEach((step, index) => {
        step.hidden = index !== currentStep;
        step.classList.toggle('is-entering', index === currentStep);
      });
      markers.forEach((marker, index) => {
        marker.classList.toggle('is-current', index === currentStep);
        marker.classList.toggle('is-complete', index < currentStep);
        if (index === currentStep) marker.setAttribute('aria-current', 'step');
        else marker.removeAttribute('aria-current');
      });
      if (progressBar) progressBar.style.transform = 'scaleX(' + ((currentStep + 1) / steps.length) + ')';
      setMessage();
      const heading = steps[currentStep].querySelector('h3');
      if (heading) heading.focus();
      if (currentStep === 2) loadTurnstile();
    };

    const summarize = () => {
      const selectedService = inquiryForm.querySelector('input[name="service"]:checked');
      const description = inquiryForm.elements.project_description.value.trim();
      const budget = inquiryForm.elements.budget.value;
      const deadline = inquiryForm.elements.preferred_deadline.value;
      const name = inquiryForm.elements.name.value.trim();
      const email = inquiryForm.elements.email.value.trim();
      const values = {
        service: selectedService ? selectedService.value : 'Not selected',
        description: description || 'Not added',
        budget: budget || 'Not selected',
        deadline: deadline || 'Not set',
        contact: [name, email].filter(Boolean).join(' · ') || 'Not added'
      };
      Object.entries(values).forEach(([key, value]) => {
        const target = document.querySelector('[data-summary="' + key + '"]');
        if (target) target.textContent = value;
      });
    };

    inquiryForm.querySelectorAll('[data-next]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!validateStep(currentStep)) return;
        if (currentStep === 1) summarize();
        showStep(currentStep + 1);
      });
    });
    inquiryForm.querySelectorAll('[data-back]').forEach((button) => {
      button.addEventListener('click', () => showStep(currentStep - 1));
    });
    inquiryForm.addEventListener('input', () => {
      summarize();
      updateSubmitState();
    });
    inquiryForm.addEventListener('change', () => {
      summarize();
      updateSubmitState();
    });

    inquiryForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submitting) return;
      if (!securityIsConfigured) {
        setMessage('Form delivery and spam protection are not configured yet. Please use the email link below.');
        return;
      }
      if (!validateStep(currentStep)) return;
      if (!window.turnstile || turnstileWidgetId === null) {
        setMessage('The security check is not ready yet. Please wait a moment and try again.');
        return;
      }
      turnstileToken = window.turnstile.getResponse(turnstileWidgetId) || turnstileToken;
      if (!turnstileToken) {
        setMessage('Please complete the security check before sending your inquiry.');
        return;
      }

      submitting = true;
      submitButton.disabled = true;
      submitButton.classList.add('is-loading');
      if (submitLabel) submitLabel.textContent = 'Sending…';
      setMessage();
      const payload = new FormData(inquiryForm);
      payload.set('cf-turnstile-response', turnstileToken);
      payload.set('_subject', 'New Tea Cocoa Studio inquiry — ' + inquiryForm.elements.name.value.trim());
      // Formspree uses the email field as the notification Reply-To address.
      try {
        const response = await fetch(FORMSPREE_ENDPOINT, {
          method: 'POST',
          body: payload,
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
          if (response.status === 429) throw new Error('We have received several inquiries in a short time. Please wait a moment and try again.');
          if (response.status >= 500) throw new Error('The form service is temporarily unavailable. Please try again shortly.');
          throw new Error('We could not send your inquiry. Please check your details and try again.');
        }
        formShell.hidden = true;
        successPanel.hidden = false;
        successPanel.focus();
      } catch (error) {
        setMessage(error instanceof TypeError ? 'We could not reach the form service. Check your connection and try again.' : error.message);
        if (submitLabel) submitLabel.textContent = 'Try again';
        turnstileToken = '';
        if (window.turnstile && turnstileWidgetId !== null) {
          setTurnstileStatus('Please complete the check again before retrying.');
          window.turnstile.reset(turnstileWidgetId);
        }
      } finally {
        submitting = false;
        submitButton.classList.remove('is-loading');
        updateSubmitState();
      }
    });
  }
  })();
