"use client";

import { useEffect, useRef } from "react";

/**
 * Neural-net constellation WebGL background.
 * – Nodes drift slowly in 3-D space
 * – Edges drawn between nearby nodes via line geometry updated each frame
 * – Mouse attracts nodes toward the cursor
 * – Additive blending so it sits perfectly behind frosted-glass UI
 */

const VERT_POINTS = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPos.z);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

const FRAG_POINTS = /* glsl */`
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = vAlpha * smoothstep(0.5, 0.1, d);
    gl_FragColor = vec4(0.4 + vAlpha * 0.4, 0.88, 1.0, a);
  }
`;

const VERT_LINES = /* glsl */`
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG_LINES = /* glsl */`
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(0.32, 0.74, 1.0, vAlpha * 0.35);
  }
`;

interface Node3D {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
}

const NODE_COUNT  = 120;
const EDGE_DIST   = 2.2;
const SPEED       = 0.0012;

export default function WebGLCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId: number;
    let disposed = false;

    (async () => {
      const THREE = await import("three");

      /* ── Renderer ── */
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      renderer.setClearColor(0x000000, 0);

      /* ── Scene / camera ── */
      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
      camera.position.set(0, 0, 8);

      /* ── Nodes ── */
      const nodes: Node3D[] = Array.from({ length: NODE_COUNT }, () => {
        const r = 2 + Math.random() * 4;
        const t = Math.random() * Math.PI * 2;
        const p = Math.acos(2 * Math.random() - 1);
        return {
          x:  r * Math.sin(p) * Math.cos(t),
          y:  r * Math.sin(p) * Math.sin(t),
          z:  r * Math.cos(p) - 2,
          vx: (Math.random() - 0.5) * SPEED,
          vy: (Math.random() - 0.5) * SPEED,
          vz: (Math.random() - 0.5) * SPEED * 0.3,
        };
      });

      /* ── Point geometry ── */
      const ptGeo   = new THREE.BufferGeometry();
      const ptPos   = new Float32Array(NODE_COUNT * 3);
      const ptSizes = new Float32Array(NODE_COUNT);
      const ptAlpha = new Float32Array(NODE_COUNT);

      nodes.forEach((n, i) => {
        ptPos[i * 3]     = n.x;
        ptPos[i * 3 + 1] = n.y;
        ptPos[i * 3 + 2] = n.z;
        ptSizes[i] = 1.2 + Math.random() * 2;
        ptAlpha[i] = 0.4 + Math.random() * 0.5;
      });

      ptGeo.setAttribute("position", new THREE.BufferAttribute(ptPos, 3));
      ptGeo.setAttribute("aSize",    new THREE.BufferAttribute(ptSizes, 1));
      ptGeo.setAttribute("aAlpha",   new THREE.BufferAttribute(ptAlpha, 1));

      const ptMat = new THREE.ShaderMaterial({
        vertexShader: VERT_POINTS, fragmentShader: FRAG_POINTS,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      scene.add(new THREE.Points(ptGeo, ptMat));

      /* ── Edge geometry (pre-allocated to max possible edges) ── */
      const maxEdges  = NODE_COUNT * (NODE_COUNT - 1) / 2;
      const linePos   = new Float32Array(maxEdges * 6); // 2 verts * xyz
      const lineAlpha = new Float32Array(maxEdges * 2);

      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3).setUsage(THREE.DynamicDrawUsage));
      lineGeo.setAttribute("aAlpha",   new THREE.BufferAttribute(lineAlpha, 1).setUsage(THREE.DynamicDrawUsage));

      const lineMat = new THREE.ShaderMaterial({
        vertexShader: VERT_LINES, fragmentShader: FRAG_LINES,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const lineMesh = new THREE.LineSegments(lineGeo, lineMat);
      scene.add(lineMesh);

      /* ── Mouse repulsion / attraction ── */
      let mouseNDC = new THREE.Vector2(0, 0);
      const onMouse = (e: MouseEvent) => {
        mouseNDC.x =  (e.clientX / window.innerWidth)  * 2 - 1;
        mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
      };
      window.addEventListener("mousemove", onMouse);

      /* ── Resize ── */
      const onResize = () => {
        if (disposed) return;
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      window.addEventListener("resize", onResize);
      onResize();

      /* ── Animation loop ── */
      const tmp = new THREE.Vector3();
      const clock = new THREE.Clock();

      const tick = () => {
        if (disposed) return;
        rafId = requestAnimationFrame(tick);
        const t = clock.getElapsedTime();

        /* Drift nodes + mouse influence */
        const mx = mouseNDC.x * 3;
        const my = mouseNDC.y * 2;

        nodes.forEach((n, i) => {
          /* Gentle mouse attraction */
          const dx = mx - n.x, dy = my - n.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
          n.vx += (dx / dist) * 0.000012;
          n.vy += (dy / dist) * 0.000012;

          /* Slow drift */
          n.vx += (Math.random() - 0.5) * 0.000006;
          n.vy += (Math.random() - 0.5) * 0.000006;

          /* Dampen */
          n.vx *= 0.98; n.vy *= 0.98; n.vz *= 0.98;

          n.x += n.vx; n.y += n.vy; n.z += n.vz;

          /* Contain in sphere */
          const r = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
          if (r > 5.5) { n.x *= 0.995; n.y *= 0.995; n.z *= 0.995; }

          ptPos[i * 3]     = n.x;
          ptPos[i * 3 + 1] = n.y;
          ptPos[i * 3 + 2] = n.z;
        });
        (ptGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;

        /* Rebuild edges */
        let ei = 0;
        for (let a = 0; a < NODE_COUNT - 1; a++) {
          for (let b = a + 1; b < NODE_COUNT; b++) {
            const na = nodes[a], nb = nodes[b];
            const ddx = na.x - nb.x, ddy = na.y - nb.y, ddz = na.z - nb.z;
            const d2  = ddx * ddx + ddy * ddy + ddz * ddz;
            if (d2 < EDGE_DIST * EDGE_DIST) {
              const alpha = (1 - Math.sqrt(d2) / EDGE_DIST);
              linePos[ei * 6]     = na.x; linePos[ei * 6 + 1] = na.y; linePos[ei * 6 + 2] = na.z;
              linePos[ei * 6 + 3] = nb.x; linePos[ei * 6 + 4] = nb.y; linePos[ei * 6 + 5] = nb.z;
              lineAlpha[ei * 2] = lineAlpha[ei * 2 + 1] = alpha;
              ei++;
            }
          }
        }
        lineGeo.setDrawRange(0, ei * 2);
        (lineGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        (lineGeo.attributes.aAlpha   as THREE.BufferAttribute).needsUpdate = true;

        /* Slowly rotate world */
        scene.rotation.y = t * 0.025 + mouseNDC.x * 0.25;
        scene.rotation.x = mouseNDC.y * -0.12;

        renderer.render(scene, camera);
      };
      tick();

      /* ── Cleanup ── */
      return () => {
        disposed = true;
        cancelAnimationFrame(rafId);
        window.removeEventListener("mousemove", onMouse);
        window.removeEventListener("resize", onResize);
        renderer.dispose();
        ptGeo.dispose(); ptMat.dispose();
        lineGeo.dispose(); lineMat.dispose();
      };
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
