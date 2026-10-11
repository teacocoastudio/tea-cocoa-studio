// A transparent raymarched fluid layer overlays the existing site background.
// Three.js is loaded lazily from a pinned CDN version; the CSS artwork remains the fallback.
const hero = document.body;
const canvas = hero?.querySelector(':scope > .fluid-canvas');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const FLUID_TUNING = Object.freeze({
  motionSpeed: 0.72,
  interactionStrength: 1.0,
  hoverPressure: 0.82,
  pressPressure: 1.22,
  interactionRadius: 0.44,
  indentation: 1.15,
  vortexStrength: 0.58,
  rippleStrength: 0.16,
  springRecovery: 4.2,
  mobileFrameRate: 24,
  desktopFrameRate: 30,
  mobilePixelRatio: 0.82,
  desktopPixelRatio: 0.95,
  mobileRaySteps: 16,
  desktopRaySteps: 24
});

if (hero && canvas && !reducedMotion.matches && 'IntersectionObserver' in window) {
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js';
  let startRequested = false;
  let disposed = false;
  let resources = null;
  let loadObserver;

  const startScene = async () => {
    if (startRequested || disposed || reducedMotion.matches) return;
    startRequested = true;
    try {
      const THREE = await import(THREE_URL);
      if (disposed || reducedMotion.matches) return;
      resources = createFluidScene(THREE, hero, canvas);
    } catch {
      // Keep the existing CSS artwork if the CDN, WebGL2, or shader is unavailable.
      canvas.remove();
    }
  };

  loadObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      loadObserver.disconnect();
      startScene();
    }
  }, { rootMargin: '120px 0px' });
  loadObserver.observe(canvas);

  const onMotionChange = (event) => {
    if (event.matches) resources?.cleanup();
  };
  reducedMotion.addEventListener?.('change', onMotionChange);

  window.addEventListener('pagehide', () => {
    disposed = true;
    loadObserver?.disconnect();
    reducedMotion.removeEventListener?.('change', onMotionChange);
    resources?.cleanup();
  }, { once: true });
}

function createFluidScene(THREE, hero, canvas) {
  const mobile = window.matchMedia('(max-width: 640px)').matches || window.matchMedia('(pointer: coarse)').matches;
  const center = new THREE.Vector2(0.5, 0.5);
  const fps = mobile ? FLUID_TUNING.mobileFrameRate : FLUID_TUNING.desktopFrameRate;
  const pixelRatioCap = mobile ? FLUID_TUNING.mobilePixelRatio : FLUID_TUNING.desktopPixelRatio;
  const raySteps = mobile ? FLUID_TUNING.mobileRaySteps : FLUID_TUNING.desktopRaySteps;
  const interactionFalloff = (1 / FLUID_TUNING.interactionRadius ** 2).toFixed(2);
  const frameInterval = 1000 / fps;
  let inView = false;
  let pageVisible = !document.hidden;
  let contextAvailable = true;
  let cleanedUp = false;
  let lastFrame = 0;
  let elapsed = 0;
  let pointerDown = false;
  let pointerOnMass = false;
  let targetPressure = 0;
  let pressure = 0;
  let waveEnergy = 0;
  const darkMode = 1;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5);
  camera.position.set(0, 0, 1);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
      depth: false,
      stencil: false,
      premultipliedAlpha: true
    });
  } catch (error) {
    canvas.remove();
    throw error;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const uniforms = {
    uTime: { value: 0 },
    uScrollY: { value: 0 },
    uAspect: { value: 1 },
    uCenter: { value: center },
    uPointer: { value: center.clone() },
    uPointerVelocity: { value: new THREE.Vector2() },
    uPressure: { value: 0 },
    uWave: { value: 0 },
    uDark: { value: darkMode },
    uSteps: { value: raySteps }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uScrollY;
      uniform float uAspect;
      uniform vec2 uCenter;
      uniform vec2 uPointer;
      uniform vec2 uPointerVelocity;
      uniform float uPressure;
      uniform float uWave;
      uniform float uDark;
      uniform int uSteps;
      varying vec2 vUv;

      vec4 blob(vec3 p, vec3 center, vec3 radius) {
        vec3 d = (p - center) / radius;
        float density = exp(-dot(d, d) * 1.72);
        vec3 gradient = -3.44 * density * d / radius;
        return vec4(density, gradient);
      }

      vec4 fluidField(vec3 p, float time) {
        float warpX = sin(p.y * 3.1 + time * 0.22) * sin(p.z * 2.8 - time * 0.17);
        float warpY = sin(p.x * 2.8 - p.z * 2.5 + time * 0.18);
        float currentA = sin(p.x * 3.7 + p.z * 3.0 + sin(p.y * 3.2 + time * 0.31) * 0.9 + time * 0.24);
        float currentB = cos(p.y * 4.1 - p.z * 3.5 + sin(p.x * 3.6 - time * 0.27) * 0.8 - time * 0.2);
        p.x += warpX * 0.11 + currentA * 0.045;
        p.y += warpY * 0.1 + currentB * 0.04;

        vec3 c1 = vec3(-0.24 + sin(time * 0.21) * 0.13, 0.12 + cos(time * 0.16) * 0.1, sin(time * 0.13) * 0.12);
        vec3 c2 = vec3(0.27 + cos(time * 0.17) * 0.13, 0.12 + sin(time * 0.2) * 0.08, 0.1 + cos(time * 0.13) * 0.1);
        vec3 c3 = vec3(-0.04 + sin(time * 0.15 + 1.2) * 0.18, -0.34 + cos(time * 0.18) * 0.1, -0.08 + sin(time * 0.19) * 0.12);
        vec3 c4 = vec3(0.02 + cos(time * 0.12 + 1.0) * 0.14, 0.42 + sin(time * 0.17) * 0.08, -0.12 + cos(time * 0.15) * 0.1);
        vec3 c5 = vec3(-0.48 + cos(time * 0.16) * 0.1, -0.02 + sin(time * 0.13) * 0.13, 0.12 * sin(time * 0.2));

        vec4 total = blob(p, c1, vec3(0.62, 0.6, 0.72));
        total += blob(p, c2, vec3(0.58, 0.62, 0.68));
        total += blob(p, c3, vec3(0.58, 0.5, 0.63));
        total += blob(p, c4, vec3(0.45, 0.43, 0.53));
        total += blob(p, c5, vec3(0.43, 0.52, 0.6));
        return total;
      }

      void main() {
        vec2 planeSize = vec2(max(1.18 * uAspect, 2.2), 2.25);
        vec2 screenPoint = (vUv - uCenter) * planeSize;
        vec2 pointerPoint = (uPointer - uCenter) * planeSize;
        const float scrollPeriod = 1.75;
        screenPoint.y = mod(screenPoint.y + uScrollY + scrollPeriod * 0.5, scrollPeriod) - scrollPeriod * 0.5;
        pointerPoint.y = mod(pointerPoint.y + uScrollY + scrollPeriod * 0.5, scrollPeriod) - scrollPeriod * 0.5;
        vec3 rayOrigin = vec3(screenPoint, 1.38);
        float stepLength = 2.76 / float(uSteps);
        float transmittance = 1.0;
        float outAlpha = 0.0;
        vec3 outColor = vec3(0.0);
        vec2 delta = screenPoint - pointerPoint;
        float touchDistance = length(delta);
        vec3 keyLight = normalize(vec3(0.45 + sin(uTime * 0.16) * 0.15, 0.62, 0.92));
        vec3 viewDirection = vec3(0.0, 0.0, 1.0);

        for (int i = 0; i < ${FLUID_TUNING.desktopRaySteps}; i++) {
          if (i >= uSteps) break;
          vec3 p = rayOrigin - vec3(0.0, 0.0, float(i) * stepLength);
          float depthFalloff = exp(-p.z * p.z * 1.2);
          float frontSurface = exp(-pow(p.z - 0.38, 2.0) * 5.5);
          float touch = exp(-touchDistance * touchDistance * ${interactionFalloff}) * frontSurface * uPressure;
          vec2 vortex = vec2(-delta.y, delta.x);
          vec2 radial = delta / max(touchDistance, 0.001);
          p.xy += radial * touch * 0.16;
          p.xy -= vortex * touch * ${FLUID_TUNING.vortexStrength.toFixed(3)};
          p.z += touch * ${FLUID_TUNING.indentation.toFixed(3)} * 0.34;
          p.xy -= uPointerVelocity * touch * 0.28;

          vec4 field = fluidField(p, uTime);
          float flowA = sin(p.x * 4.1 + p.z * 3.0 + sin(p.y * 3.0 + uTime * 0.32) * 0.85 + uTime * 0.25);
          float flowB = cos(p.y * 4.8 - p.z * 3.4 + sin(p.x * 3.5 - uTime * 0.26) * 0.82 - uTime * 0.2);
          float turbulence = flowA * flowB;
          float flowMap = 0.5 + 0.5 * sin(p.x * 3.1 - p.y * 2.6 + flowA * 1.6 + uTime * 0.17);
          float bluePhase = p.y * 3.2 - p.z * 2.7 + sin(p.x * 2.8 + uTime * 0.23) * 1.05
                          + sin(p.z * 2.4 - uTime * 0.17) * 0.4 - uTime * 0.22 + flowA * 0.58;
          float blueVeil = exp(-abs(sin(bluePhase)) * 18.0) * smoothstep(0.08, 0.32, field.x);
          float colorFlow = smoothstep(0.04, 0.96, flowMap + turbulence * 0.25 + p.x * 0.12 - p.z * 0.1);
          float ribbon = pow(max(0.0, sin(p.x * 3.2 + p.y * 2.1 + flowB * 1.9 - p.z * 2.2 + uTime * 0.28)), 5.0);
          float surfaceRipples = sin(touchDistance * 33.0 - uTime * 7.0) * exp(-touchDistance * 4.8) * uWave * depthFalloff * ${FLUID_TUNING.rippleStrength.toFixed(3)};
          float lip = exp(-pow(touchDistance - 0.34, 2.0) * 48.0) * frontSurface * uPressure * 0.38;
          float fluidDensity = field.x * (0.42 + flowMap * 0.76) + ribbon * 0.2 + turbulence * 0.12;
          float density = fluidDensity * (1.0 - touch * ${FLUID_TUNING.indentation.toFixed(3)}) + lip + surfaceRipples;
          density = max(0.0, density);

          float body = smoothstep(0.27, 0.88, density);
          float shell = exp(-abs(density - 0.38) * 7.0) * smoothstep(0.08, 0.26, density);
          float wisps = smoothstep(0.25, 0.9, flowMap + ribbon * 0.3) * smoothstep(0.08, 0.34, field.x);
          float extinction = body * 0.17 + shell * 0.13 + wisps * 0.28 + blueVeil * 0.62;
          float sampleAlpha = 1.0 - exp(-extinction * stepLength);
          float greenFlow = smoothstep(0.24, 0.88, colorFlow) * (1.0 - blueVeil);
          sampleAlpha *= mix(1.0, 0.5, greenFlow);

          vec3 normal = normalize(-field.yzw + vec3(0.0001, 0.0001, 0.0001));
          float diffuse = 0.38 + max(dot(normal, keyLight), 0.0) * 0.62;
          float fresnel = pow(1.0 - abs(dot(normal, viewDirection)), 2.25);
          float specular = pow(max(dot(reflect(-keyLight, normal), viewDirection), 0.0), 24.0);
          float iridescence = 0.5 + 0.5 * sin(atan(normal.y, normal.x) * 2.4 + p.z * 3.0 + uTime * 0.11 + turbulence);

          vec3 deepBlue = vec3(29.0, 105.0, 138.0) / 255.0;
          vec3 leafGreen = vec3(87.0, 199.0, 133.0) / 255.0;
          vec3 softGold = vec3(237.0, 221.0, 83.0) / 255.0;
          vec3 color = mix(deepBlue, leafGreen, colorFlow);
          vec3 brightBlue = mix(deepBlue, vec3(0.1, 0.57, 0.76), iridescence * 0.22);
          color = mix(color, brightBlue, blueVeil * 0.96);
          color += brightBlue * blueVeil * 0.35;
          float goldVeil = smoothstep(0.72, 0.98, ribbon + flowMap * 0.4 + sin(p.y * 3.1 + uTime * 0.1) * 0.1);
          color = mix(color, softGold, goldVeil * 0.34);
          color = mix(color, mix(leafGreen, deepBlue, iridescence), fresnel * 0.46);
          color *= diffuse * 1.3;
          color += vec3(0.72, 0.92, 0.84) * specular * (0.55 + shell * 0.42);
          color += mix(leafGreen, softGold, iridescence) * fresnel * 0.32;
          color += mix(leafGreen, deepBlue, flowMap) * wisps * 0.3;
          color *= mix(1.0, 0.98, uDark);

          vec3 contribution = color * sampleAlpha * transmittance;
          outColor += contribution;
          outAlpha += sampleAlpha * transmittance;
          transmittance *= 1.0 - sampleAlpha;
          if (transmittance < 0.025) break;
        }

        float edgeGlow = exp(-max(0.0, length(screenPoint / vec2(1.05, 0.98)) - 0.72) * 14.0) * outAlpha * 0.045;
        outColor += vec3(0.15, 0.42, 0.4) * edgeGlow;
        gl_FragColor = vec4(outColor, min(outAlpha * 0.66, 0.72));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: true
  });

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(plane);

  const pointerNdc = new THREE.Vector2();
  const pointerUv = uniforms.uPointer.value;
  const pointerVelocity = uniforms.uPointerVelocity.value;
  const raycaster = new THREE.Raycaster();
  const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const intersection = new THREE.Vector3();
  let previousPointer = new THREE.Vector2(0.5, 0.5);
  let pointerMoved = false;

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
    renderer.setSize(width, height, false);
    uniforms.uAspect.value = width / height;
  };
  window.addEventListener('resize', resize, { passive: true });
  const updateScrollPosition = () => {
    uniforms.uScrollY.value = -(window.scrollY / Math.max(window.innerHeight, 1)) * 1.75;
  };
  window.addEventListener('scroll', updateScrollPosition, { passive: true });
  updateScrollPosition();
  resize();

  const updatePointer = (event) => {
    if (!window.innerWidth || !window.innerHeight) return false;
    pointerNdc.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    if (!raycaster.ray.intersectPlane(interactionPlane, intersection)) return false;
    const u = (intersection.x + 1) * 0.5;
    const v = (intersection.y + 1) * 0.5;
    const planeWidth = Math.max(1.18 * uniforms.uAspect.value, 2.2);
    const planeHeight = 2.25;
    const planeX = (u - center.x) * planeWidth;
    const planeY = (v - center.y) * planeHeight;
    pointerOnMass = (planeX * planeX) / 1.2 + (planeY * planeY) / 1.02 < 1.45;
    if (pointerOnMass) {
      pointerVelocity.set((u - previousPointer.x) * planeWidth, (v - previousPointer.y) * planeHeight);
      pointerVelocity.clampLength(0, 1.25);
      previousPointer.set(u, v);
      pointerUv.set(u, v);
      targetPressure = pointerDown ? FLUID_TUNING.pressPressure : FLUID_TUNING.hoverPressure;
      waveEnergy = Math.max(waveEnergy, pointerDown ? 1 : 0.58);
      pointerMoved = true;
    } else if (!pointerDown) {
      targetPressure = 0;
    }
    return pointerOnMass;
  };

  const onPointerMove = (event) => updatePointer(event);
  const onPointerEnter = (event) => updatePointer(event);
  const onPointerLeave = () => {
    if (!pointerDown) {
      pointerOnMass = false;
      targetPressure = 0;
    }
  };
  const onPointerDown = (event) => {
    if (!updatePointer(event)) return;
    pointerDown = true;
    targetPressure = FLUID_TUNING.pressPressure;
    waveEnergy = 1;
  };
  const onPointerUp = () => {
    pointerDown = false;
    targetPressure = pointerOnMass ? FLUID_TUNING.hoverPressure * 0.72 : 0;
  };
  const onPointerCancel = () => {
    pointerDown = false;
    pointerOnMass = false;
    targetPressure = 0;
  };
  const onWindowPointerMove = (event) => {
    if (pointerDown && !hero.contains(event.target)) updatePointer(event);
  };
  hero.addEventListener('pointermove', onPointerMove, { passive: true });
  hero.addEventListener('pointerenter', onPointerEnter, { passive: true });
  hero.addEventListener('pointerleave', onPointerLeave, { passive: true });
  hero.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointermove', onWindowPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerCancel, { passive: true });

  const intersectionObserver = new IntersectionObserver((entries) => {
    inView = entries.some((entry) => entry.isIntersecting);
    if (!inView) lastFrame = 0;
    syncLoop();
  }, { threshold: 0.01 });
  intersectionObserver.observe(canvas);

  const onVisibilityChange = () => {
    pageVisible = !document.hidden;
    if (!pageVisible) lastFrame = 0;
    syncLoop();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);


  const onContextLost = (event) => {
    event.preventDefault();
    contextAvailable = false;
    hero.classList.remove('is-fluid-ready');
    canvas.classList.remove('is-fluid-ready');
    syncLoop();
  };
  const onContextRestored = () => {
    contextAvailable = true;
    lastFrame = 0;
    hero.classList.add('is-fluid-ready');
    canvas.classList.add('is-fluid-ready');
    syncLoop();
  };
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);

  const syncLoop = () => {
    if (inView && pageVisible && contextAvailable) renderer.setAnimationLoop(renderFrame);
    else renderer.setAnimationLoop(null);
  };

  const renderFrame = () => {
    const now = performance.now();
    if (lastFrame && now - lastFrame < frameInterval) return;
    const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.06) : 1 / 60;
    lastFrame = now;
    elapsed += delta * FLUID_TUNING.motionSpeed;
    pressure += (targetPressure - pressure) * Math.min(1, delta * FLUID_TUNING.springRecovery);
    waveEnergy *= Math.exp(-delta * 1.25);
    if (!pointerMoved) pointerVelocity.multiplyScalar(Math.exp(-delta * 8.5));
    else { pointerVelocity.multiplyScalar(0.58); pointerMoved = false; }
    uniforms.uTime.value = elapsed;
    uniforms.uPressure.value = pressure * FLUID_TUNING.interactionStrength;
    uniforms.uWave.value = waveEnergy;
    uniforms.uDark.value = darkMode;
    renderer.render(scene, camera);
    if (!canvas.classList.contains('is-fluid-ready')) {
      canvas.classList.add('is-fluid-ready');
      hero.classList.add('is-fluid-ready');
    }
  };

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    renderer.setAnimationLoop(null);
    intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('resize', resize);
    window.removeEventListener('scroll', updateScrollPosition);
    hero.removeEventListener('pointermove', onPointerMove);
    hero.removeEventListener('pointerenter', onPointerEnter);
    hero.removeEventListener('pointerleave', onPointerLeave);
    hero.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onWindowPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    plane.geometry.dispose();
    material.dispose();
    renderer.dispose();
    canvas.remove();
    hero.classList.remove('is-fluid-ready');
    canvas.classList.remove('is-fluid-ready');
  };

  return { cleanup };
}
