
  // Wait for all critical resources to fully load
  window.addEventListener('load', () => {
    // Yield the main thread so the browser can paint the screen smoothly
    setTimeout(() => {
      if (typeof THREE === 'undefined') return;
      const motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');

      /* =========================================================================
         GLOBAL SETUP, MEMORY CACHING & UTILS
         ========================================================================= */
      const sceneUpdates = [];
      const resizeHandlers = [];

      // Global Debounced Resize Listener
      let resizeTimeout;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          resizeHandlers.forEach((handler) => handler());
          // Refresh ScrollTrigger when layout changes on resize
          if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
        }, 150);
      });

      // Texture 1: 100% Opacity Solid Dots
      const canvas1 = document.createElement('canvas');
      canvas1.width = 64;
      canvas1.height = 64;
      const ctx1 = canvas1.getContext('2d');
      const grad1 = ctx1.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad1.addColorStop(0, 'rgba(255,255,255,1)');
      grad1.addColorStop(0.5, 'rgba(255,255,255,1)');
      grad1.addColorStop(1, 'rgba(255,255,255,0)');
      ctx1.fillStyle = grad1;
      ctx1.fillRect(0, 0, 64, 64);
      const solidDotTex = new THREE.CanvasTexture(canvas1);

      // Texture 2: 80% Opacity Soft Glow
      const canvas2 = document.createElement('canvas');
      canvas2.width = 64;
      canvas2.height = 64;
      const ctx2 = canvas2.getContext('2d');
      const grad2 = ctx2.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad2.addColorStop(0, 'rgba(255,255,255,1)');
      grad2.addColorStop(0.4, 'rgba(255,255,255,0.8)');
      grad2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx2.fillStyle = grad2;
      ctx2.fillRect(0, 0, 64, 64);
      const softBeamTex = new THREE.CanvasTexture(canvas2);

      // Shared Materials
      const starSharedMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.15,
        opacity: 0.4,
        transparent: true,
      });

      /* =========================================================================
         INTERSECTION OBSERVER SETUP
         ========================================================================= */
      const viewportObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            entry.target.isIntersecting = entry.isIntersecting;
          });
        },
        { rootMargin: '150px' },
      );

      /* =========================================================================
         SCRIPT 1: PERSPECTIVE STAR FIELD BACKGROUNDS
         ========================================================================= */
      const createParticleBG = (settings) => {
        const container = document.getElementById(settings.id);
        if (!container) return;

        container.isIntersecting = false;
        let w = container.offsetWidth;
        let h = container.offsetHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(settings.fov, w / h, 0.1, 1000);
        camera.position.set(0, 12, 20);
        camera.rotation.x = -0.6;

        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(w, h);
        container.appendChild(renderer.domElement);
        renderer.domElement.dataset.scene = container.id;
        renderer.domElement.setAttribute('aria-hidden','true');

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(settings.count * 3);

        for (let i = 0; i < settings.count; i++) {
          positions[i * 3] = (Math.random() - 0.5) * 200;
          positions[i * 3 + 1] = Math.random() * 2;
          positions[i * 3 + 2] = -Math.random() * 200;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particles = new THREE.Points(geometry, starSharedMaterial);
        scene.add(particles);

        const pos = particles.geometry.attributes.position.array;

        sceneUpdates.push(() => {
          if (!container.isIntersecting) return;
          for (let i = 0; i < pos.length; i += 3) {
            pos[i + 2] += settings.speed;
            if (pos[i + 2] > 20) pos[i + 2] = settings.resetZ;
          }
          particles.geometry.attributes.position.needsUpdate = true;
          renderer.render(scene, camera);
          renderer.domElement.dataset.renderFrame=String(renderer.info.render.frame);
        });

        resizeHandlers.push(() => {
          w = container.offsetWidth;
          h = container.offsetHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        });

        viewportObserver.observe(container);
      };

      /* =========================================================================
         SCRIPT 2: FALLING SVG DOT POOL (100% Opacity)
         ========================================================================= */
      const rawLayerData = [0xd9d9d9, 0xd9d9d9, 0xd9d9d9, 0xd9d9d9, 0xd9d9d9, 0x8099eb, 0xd9d9d9, 0xd9d9d9, 0xd9d9d9, 0x90a4e8, 0x90a4e8, 0xd9d9d9, 0xd9d9d9, 0xd9d9d9, 0x80d6eb, 0x8099eb, 0xd9d9d9, 0xd9d9d9, 0x80d6eb, 0x90a4e8, 0x90a4e8, 0xd9d9d9, 0x8099eb, 0xd9d9d9, 0xd9d9d9, 0xd9d9d9, 0xd9d9d9];
      const cachedLayerColors = rawLayerData.map((hex) => new THREE.Color(hex));

      const initParticles = (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.isIntersecting = false;
        let w = container.offsetWidth;
        let h = container.offsetHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 500);
        camera.position.set(0, 0, 30);

        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(w, h);
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        container.appendChild(renderer.domElement);
        renderer.domElement.dataset.scene = container.id;
        renderer.domElement.setAttribute('aria-hidden','true');

        const COUNT = 250,
          SPREAD_X = 35,
          SPREAD_Z = 60,
          SPEED = 0.04,
          BOTTOM = -20,
          TOP = 20,
          SIZE_MIN = 5,
          SIZE_MAX = 15;

        const positions = new Float32Array(COUNT * 3);
        const colors = new Float32Array(COUNT * 3);
        const sizes = new Float32Array(COUNT);

        for (let i = 0; i < COUNT; i++) {
          const idx = Math.floor(Math.random() * cachedLayerColors.length);
          positions[i * 3] = (Math.random() - 0.5) * SPREAD_X;
          positions[i * 3 + 1] = Math.random() * (TOP - BOTTOM) + BOTTOM;
          positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD_Z;

          const c = cachedLayerColors[idx];
          colors[i * 3] = c.r;
          colors[i * 3 + 1] = c.g;
          colors[i * 3 + 2] = c.b;
          sizes[i] = SIZE_MIN + Math.random() * (SIZE_MAX - SIZE_MIN);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const mat = new THREE.ShaderMaterial({
          uniforms: { map: { value: solidDotTex } },
          vertexShader: `attribute float size; attribute vec3 color; varying vec3 vColor; void main() { vColor = color; gl_PointSize = size; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: `uniform sampler2D map; varying vec3 vColor; void main() { vec4 tex = texture2D(map, gl_PointCoord); if (tex.a < 0.05) discard; gl_FragColor = vec4(vColor, 1) * tex; }`,
          transparent: true,
          depthWrite: false,
        });

        scene.add(new THREE.Points(geo, mat));

        sceneUpdates.push(() => {
          if (!container.isIntersecting) return;
          const pos = geo.attributes.position.array;
          const col = geo.attributes.color.array;
          let colorChanged = false;

          for (let i = 0; i < COUNT; i++) {
            pos[i * 3 + 1] += SPEED;
            if (pos[i * 3 + 1] > TOP) {
              pos[i * 3] = (Math.random() - 0.5) * SPREAD_X;
              pos[i * 3 + 1] = BOTTOM;
              pos[i * 3 + 2] = (Math.random() - 0.5) * SPREAD_Z;

              const idx = Math.floor(Math.random() * cachedLayerColors.length);
              const c = cachedLayerColors[idx];
              col[i * 3] = c.r;
              col[i * 3 + 1] = c.g;
              col[i * 3 + 2] = c.b;
              colorChanged = true;
            }
          }
          geo.attributes.position.needsUpdate = true;
          if (colorChanged) geo.attributes.color.needsUpdate = true;
          renderer.render(scene, camera);
          renderer.domElement.dataset.renderFrame=String(renderer.info.render.frame);
        });

        resizeHandlers.push(() => {
          w = container.offsetWidth;
          h = container.offsetHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        });

        viewportObserver.observe(container);
      };

      /* =========================================================================
         SCRIPT 3: SVG EXTRACTED VECTOR BEAM PARTICLES (Soft Glow)
         ========================================================================= */
      const cachedBeamColors = [new THREE.Color(0xffffff), new THREE.Color(0x8fb8fc), new THREE.Color(0x5e94fa), new THREE.Color(0x4e9cdb)];

      const initBeamParticles = (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.isIntersecting = false;
        const SVG_W = 524, SVG_H = 213;
        const beams = [
          { x1: 328.087, y1: 24.577, x2: 3.9, y2: 140.983 },
          { x1: 431.731, y1: 2.678, x2: 18.224, y2: 150.659 },
          { x1: 467.268, y1: 5.045, x2: 49.84, y2: 159.474 },
          { x1: 499.381, y1: 16.694, x2: 95.744, y2: 177.019 },
          { x1: 507.447, y1: 24.034, x2: 78.124, y2: 193.701 },
          { x1: 518.702, y1: 41.078, x2: 167.659, y2: 181.762 },
          { x1: 452.627, y1: 64.335, x2: 96.676, y2: 206.722 },
          { x1: 424.975, y1: 24.079, x2: 69.024, y2: 166.466 },
          { x1: 488.977, y1: 13.54, x2: 95.5, y2: 169.118 },
        ];

        let W = container.offsetWidth;
        let H = container.offsetHeight;
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(0, W, 0, H, -1, 1);

        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(W, H);
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        container.appendChild(renderer.domElement);
        renderer.domElement.dataset.scene = container.id;
        renderer.domElement.setAttribute('aria-hidden','true');

        const svgToCanvas = (sx, sy) => ({ x: (sx / SVG_W) * W, y: (sy / SVG_H) * H });

        const COUNT = 18, SPEED = 0.4, SIZE_MIN = 2.5, SIZE_MAX = 13;
        const totalCount = COUNT * beams.length;
        const positions = new Float32Array(totalCount * 3), colors = new Float32Array(totalCount * 3);
        const alphas = new Float32Array(totalCount), sizes = new Float32Array(totalCount);
        const state = [];

        const resetParticle = (beamIdx, particleIdx, randomProgress) => {
          const b = beams[beamIdx];
          const p1 = svgToCanvas(b.x1, b.y1);
          const p2 = svgToCanvas(b.x2, b.y2);
          const dx = p2.x - p1.x, dy = p2.y - p1.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const nx = dx / len, ny = dy / len;
          const scatter = (Math.random() - 0.5) * 3;
          const t = randomProgress !== undefined ? randomProgress : Math.random();

          return {
            beamIdx,
            x: p1.x + dx * t + -ny * scatter,
            y: p1.y + dy * t + nx * scatter,
            vx: nx * SPEED * (0.7 + Math.random() * 0.6),
            vy: ny * SPEED * (0.7 + Math.random() * 0.6),
            originX: p1.x,
            originY: p1.y,
            len,
            t,
            size: SIZE_MIN + Math.random() * (SIZE_MAX - SIZE_MIN),
          };
        };

        for (let b = 0; b < beams.length; b++) {
          for (let p = 0; p < COUNT; p++) {
            state.push(resetParticle(b, p, Math.random()));
          }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const mat = new THREE.ShaderMaterial({
          uniforms: { map: { value: softBeamTex } },
          vertexShader: `attribute float size; attribute vec3 color; attribute float alpha; varying vec3 vColor; varying float vAlpha; void main() { vColor = color; vAlpha = alpha; gl_PointSize = size; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: `uniform sampler2D map; varying vec3 vColor; varying float vAlpha; void main() { vec4 tex = texture2D(map, gl_PointCoord); if (tex.a < 0.04) discard; gl_FragColor = vec4(vColor, vAlpha) * tex; }`,
          transparent: true,
          depthWrite: false,
        });

        scene.add(new THREE.Points(geo, mat));

        sceneUpdates.push(() => {
          if (!container.isIntersecting) return;
          for (let i = 0; i < state.length; i++) {
            let s = state[i];
            s.x += s.vx;
            s.y += s.vy;
            s.t = Math.sqrt((s.x - s.originX) * (s.x - s.originX) + (s.y - s.originY) * (s.y - s.originY)) / s.len;

            if (s.t >= 1.0 || s.x < -10 || s.y > H + 10) {
              state[i] = resetParticle(s.beamIdx, i, 0.0);
              s = state[i];
            }

            positions[i * 3] = s.x;
            positions[i * 3 + 1] = s.y;
            positions[i * 3 + 2] = 0;

            const t = Math.min(1, Math.max(0, s.t));
            const colIdx = t < 0.09 ? 3 : t < 0.3 ? 2 : t < 0.75 ? 1 : 0;
            const c = cachedBeamColors[colIdx];
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;

            alphas[i] = Math.min(1.0, t / 0.08) * Math.min(1.0, (1.0 - t) / 0.15) * 0.92;
            sizes[i] = s.size * (0.4 + t * 0.6);
          }

          geo.attributes.position.needsUpdate = true;
          geo.attributes.color.needsUpdate = true;
          geo.attributes.alpha.needsUpdate = true;
          geo.attributes.size.needsUpdate = true;
          renderer.render(scene, camera);
          renderer.domElement.dataset.renderFrame=String(renderer.info.render.frame);
        });

        resizeHandlers.push(() => {
          W = container.offsetWidth;
          H = container.offsetHeight;
          camera.right = W;
          camera.bottom = H;
          camera.updateProjectionMatrix();
          renderer.setSize(W, H);
          for (let i = 0; i < state.length; i++) state[i] = resetParticle(state[i].beamIdx, i, Math.random());
        });

        viewportObserver.observe(container);
      };

      /* =========================================================================
         EXECUTION TRIGGERS
         ========================================================================= */
      try { createParticleBG({ id: 'three-bg', fov: 70, count: 1000, speed: 0.012, resetZ: -200 }); } catch (error) { console.warn('Visual scene unavailable:', error.message); }
      try { createParticleBG({ id: 'three-bg-2', fov: 60, count: 1200, speed: 0.012, resetZ: -100 }); } catch (error) { console.warn('Visual scene unavailable:', error.message); }
      try { createParticleBG({ id: 'three-bg-3', fov: 50, count: 3500, speed: 0.012, resetZ: -100 }); } catch (error) { console.warn('Visual scene unavailable:', error.message); }
      try { initParticles('svg-particle-bg-1'); } catch (error) { console.warn('Visual scene unavailable:', error.message); }
      try { initParticles('svg-particle-bg-2'); } catch (error) { console.warn('Visual scene unavailable:', error.message); }
      try { initBeamParticles('svg-particle-bg-right'); } catch (error) { console.warn('Visual scene unavailable:', error.message); }
      try { initBeamParticles('svg-particle-bg-left'); } catch (error) { console.warn('Visual scene unavailable:', error.message); }

      const masterAnimationEngine = () => {
        requestAnimationFrame(masterAnimationEngine);
        if (!document.hidden && !motionQuery.matches) sceneUpdates.forEach((update) => update());
      };

      if (sceneUpdates.length > 0) {
        masterAnimationEngine();
      }

      // CRITICAL FORCED-REFLOW FIX: Tell ScrollTrigger that the layouts have altered due to injected 3D elements
      if (typeof ScrollTrigger !== 'undefined') {
        ScrollTrigger.refresh();
      }
      
    }, 500); 
  });
