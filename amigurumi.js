import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';

// ---- 記号の定義 ----
// consumes: 前段の目をいくつ使うか / produces: この段に何目できるか / height: 細編みを1とした高さ
const SYMBOLS = {
  '×': { consumes: 1, produces: 1, height: 1 },
  'T': { consumes: 1, produces: 1, height: 1.6 },
  'F': { consumes: 1, produces: 1, height: 2.2 },
  'V': { consumes: 1, produces: 2, height: 1 },
  'W': { consumes: 1, produces: 3, height: 1 },
  'Λ': { consumes: 2, produces: 1, height: 1 },
};
const ALIASES = { x: '×', X: '×', '✕': '×', '＋': '×', '+': '×', t: 'T', f: 'F', v: 'V', w: 'W', A: 'Λ', a: 'Λ', '^': 'Λ', '∧': 'Λ', 'Ʌ': 'Λ' };

const PRESETS = {
  'ボール（あみぐるみ）': `// 輪の中に細編み6目から
1段: ×6
2段: V*6
3段: (× V)*6
4段: (×2 V)*6
5段: (×3 V)*6
6段: ×30
7段: ×30
8段: ×30 #f2e2c4
9段: ×30 #f2e2c4
10段: ×30
11段: (×3 Λ)*6
12段: (×2 Λ)*6
13段: (× Λ)*6
14段: Λ*6`,
  'ニット帽': `1段: ×8
2段: V*8
3段: (× V)*8
4段: (×2 V)*8
5段: (×3 V)*8
6段: (×4 V)*8
7段: (×5 V)*8
8段: (×6 V)*8
9段: F*64
10段: F*64
11段: F*64
12段: F*64 #8a6fb0
13段: F*64
14段: F*64
15段: ×64 #8a6fb0
16段: ×64 #8a6fb0`,
  'コップ型（底＋側面）': `1段: ×6
2段: V*6
3段: (× V)*6
4段: (×2 V)*6
5段: (×3 V)*6
6段: ×30
7段: ×30
8段: T*30
9段: T*30
10段: T*30
11段: (×4 V)*6
12段: ×36`,
  'しずく形': `1段: ×4
2段: (× V)*2
3段: (× V)*3
4段: (×2 V)*3
5段: (×3 V)*3
6段: (×4 V)*3
7段: (×5 V)*3
8段: ×24
9段: ×24
10段: (×4 V)*4
11段: ×30
12段: (×3 Λ)*6
13段: (×2 Λ)*6
14段: (× Λ)*6
15段: Λ*6`,
  '台形（往復編み）': `1段: ×30
2段: Λ ×26 Λ
3段: ×28
4段: Λ ×24 Λ
5段: ×26
6段: Λ ×22 Λ
7段: ×24 #f2e2c4
8段: Λ ×20 Λ #f2e2c4
9段: ×22
10段: Λ ×18 Λ`,
};

// ---- パーサ ----
function normalize(s) {
  return s.replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/[＊]/g, '*')
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
}

function parseLine(raw, lineNo) {
  let line = raw.replace(/\/\/.*$/, '');
  let color = null;
  line = line.replace(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/, (_, c) => { color = '#' + c; return ''; });
  line = line.replace(/^\s*(第)?\s*\d*\s*(段目?|row|round|R)?\s*\d*\s*[:：]/i, '');
  line = normalize(line).trim();
  if (!line) return null;

  let i = 0;
  const err = (msg) => { throw new Error(`${lineNo}行目: ${msg}`); };
  const readNum = () => { const m = /^\d+/.exec(line.slice(i)); if (!m) return null; i += m[0].length; return +m[0]; };
  const skipWs = () => { while (i < line.length && /[\s,、]/.test(line[i])) i++; };

  function parseSeq(endChar) {
    const out = [];
    for (;;) {
      skipWs();
      if (i >= line.length) { if (endChar) err('「)」が足りません'); return out; }
      const ch = line[i];
      if (ch === endChar) { i++; return out; }
      let items;
      if (ch === '(') { i++; items = parseSeq(')'); }
      else {
        const sym = SYMBOLS[ch] ? ch : ALIASES[ch];
        if (!sym) err(`「${ch}」は分からない記号です`);
        i++; items = [sym];
      }
      skipWs();
      // 「(...)×6」のように かっこの後の × は回数指定として扱う
      if (line[i] === '*' || (ch === '(' && /[x×X]/.test(line[i] || '') && /\d/.test(line[i + 1] || ''))) i++;
      const n = readNum();
      const times = n == null ? 1 : n;
      for (let k = 0; k < times; k++) out.push(...items);
    }
  }
  const stitches = parseSeq(null);
  if (!stitches.length) return null;
  return { stitches, color };
}

function parseChart(text) {
  const rows = [];
  text.split('\n').forEach((l, idx) => { const r = parseLine(l, idx + 1); if (r) rows.push(r); });
  if (!rows.length) throw new Error('編み図が空です');
  const warnings = [];
  rows.forEach((r, k) => {
    r.consumes = r.stitches.reduce((a, s) => a + SYMBOLS[s].consumes, 0);
    r.count = r.stitches.reduce((a, s) => a + SYMBOLS[s].produces, 0);
    r.height = r.stitches.reduce((a, s) => a + SYMBOLS[s].height, 0) / r.stitches.length;
    if (k > 0 && r.consumes !== rows[k - 1].count)
      warnings.push(`${k + 1}段目: 前段は${rows[k - 1].count}目ですが、${r.consumes}目分を使っています`);
  });
  return { rows, warnings };
}

// ---- 3D ----
const view = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
view.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x887766, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(5, 10, 7);
scene.add(sun);

let group = null;
const loopGeo = new THREE.SphereGeometry(1, 14, 10);

function build(chart, opts) {
  if (group) { scene.remove(group); group.traverse((o) => { if (o.material) o.material.dispose(); if (o.geometry && o.geometry !== loopGeo) o.geometry.dispose(); }); }
  group = new THREE.Group();
  const yarn = opts.yarn;
  const sw = 0.6 * yarn;      // 1目の幅
  const sh = 0.55 * yarn;     // 細編み1段の高さ
  const base = new THREE.Color(opts.color);

  // 各段の中心半径(輪) / 位置
  const rings = [];
  if (opts.mode === 'round') {
    let prevR = 0, prevY = 0;
    chart.rows.forEach((r, k) => {
      const h = sh * r.height;
      const R = Math.max(r.count * sw / (2 * Math.PI), sw * 0.5);
      const dr = R - prevR;
      const dy = k === 0 ? 0 : Math.sqrt(Math.max(h * h - dr * dr, (h * 0.15) ** 2));
      const y = prevY + dy;
      rings.push({ R, y, prevR, prevY, h });
      prevR = R; prevY = y;
    });
  } else {
    let y = 0;
    chart.rows.forEach((r) => { const h = sh * r.height; rings.push({ y: y + h / 2, h }); y += h; });
  }

  const total = chart.rows.reduce((a, r) => a + r.count, 0) * 2;
  const mesh = new THREE.InstancedMesh(loopGeo, new THREE.MeshStandardMaterial({ roughness: 0.85 }), total);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const col = new THREE.Color();
  let idx = 0;

  chart.rows.forEach((r, k) => {
    const ring = rings[k];
    const rowColor = r.color ? new THREE.Color(r.color) : base;
    for (let j = 0; j < r.count; j++) {
      let pos, tangent, up, normal;
      if (opts.mode === 'round') {
        // 螺旋状に少しずらして、段ごとの目の位置をずらす
        const a = ((j + 0.5 * (k % 2)) / r.count) * Math.PI * 2;
        const cos = Math.cos(a), sin = Math.sin(a);
        const midR = k === 0 ? ring.R * 0.6 : (ring.R + ring.prevR) / 2;
        const midY = k === 0 ? 0 : (ring.y + ring.prevY) / 2;
        pos = new THREE.Vector3(midR * cos, midY, midR * sin);
        tangent = new THREE.Vector3(-sin, 0, cos);
        const dR = k === 0 ? ring.R : ring.R - ring.prevR;
        const dY = k === 0 ? 0 : ring.y - ring.prevY;
        up = new THREE.Vector3(dR * cos, dY, dR * sin).normalize();
        normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
      } else {
        const x = (j - (r.count - 1) / 2) * sw;
        pos = new THREE.Vector3(x, ring.y, 0);
        tangent = new THREE.Vector3(1, 0, 0); up = new THREE.Vector3(0, 1, 0); normal = new THREE.Vector3(0, 0, 1);
      }
      const len = (k === 0 && opts.mode === 'round') ? ring.R * 0.8 : ring.h;
      // 1目＝V字の2本のループ
      for (const side of [-1, 1]) {
        const tilt = side * 0.38;
        const dir = up.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(tangent, Math.sin(tilt) * -1).normalize();
        const tan2 = new THREE.Vector3().crossVectors(dir, normal).normalize();
        const basis = new THREE.Matrix4().makeBasis(tan2, dir, normal);
        q.setFromRotationMatrix(basis);
        p.copy(pos).addScaledVector(tangent, side * sw * 0.22);
        s.set(sw * 0.24, len * 0.55, sw * 0.2);
        m.compose(p, q, s);
        mesh.setMatrixAt(idx, m);
        col.copy(rowColor).offsetHSL(0, 0, ((j * 7 + k * 3) % 5 - 2) * 0.012);
        mesh.setColorAt(idx, col);
        idx++;
      }
    }
  });
  mesh.count = idx;
  group.add(mesh);

  // 内側の芯（すき間から向こうが透けないように）
  const inner = new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(0.55), roughness: 1, side: THREE.DoubleSide });
  if (opts.mode === 'round') {
    const pts = [new THREE.Vector2(0, rings[0].y)];
    rings.forEach((g) => pts.push(new THREE.Vector2(Math.max(g.R - sw * 0.12, 0.001), g.y)));
    group.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 48), inner));
  } else {
    const shape = new THREE.Shape();
    const half = (k) => (chart.rows[k].count * sw) / 2;
    const bottom = rings[0].y - rings[0].h / 2;
    shape.moveTo(-half(0), bottom);
    rings.forEach((g, k) => { shape.lineTo(-half(k), g.y + g.h / 2); });
    for (let k = rings.length - 1; k >= 0; k--) shape.lineTo(half(k), rings[k].y + (k === rings.length - 1 ? rings[k].h / 2 : rings[k].h / 2));
    shape.lineTo(half(0), bottom);
    const plane = new THREE.Mesh(new THREE.ShapeGeometry(shape), inner);
    plane.position.z = -sw * 0.1;
    group.add(plane);
  }

  // 中心に合わせる
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  group.position.sub(center);
  scene.add(group);
  return box.getSize(new THREE.Vector3());
}

function fitCamera(size, keep, flat) {
  const r = Math.max(size.x, size.y, size.z) * 0.5 || 1;
  const dist = r / Math.sin((camera.fov * Math.PI) / 360) * 1.15;
  if (!keep) { if (flat) camera.position.set(0, dist * 0.15, dist); else camera.position.set(dist * 0.6, dist * 0.45, dist * 0.65); controls.target.set(0, 0, 0); }
  camera.near = dist / 100; camera.far = dist * 20; camera.updateProjectionMatrix();
}

function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);

// ---- UI ----
const $ = (id) => document.getElementById(id);
const presetSel = $('preset');
presetSel.innerHTML = Object.keys(PRESETS).map((k) => `<option>${k}</option>`).join('');
$('chart').value = PRESETS[presetSel.value];

let lastKey = '';
function update(forceFit) {
  const status = $('status');
  try {
    const chart = parseChart($('chart').value);
    const opts = { mode: $('mode').value, yarn: +$('yarn').value, color: $('color').value };
    const size = build(chart, opts);
    const key = opts.mode + presetSel.value;
    fitCamera(size, !forceFit && key === lastKey, opts.mode === 'flat');
    lastKey = key;
    const counts = chart.rows.map((r, k) => `${k + 1}段:${r.count}目`).join('  ');
    status.className = chart.warnings.length ? 'err' : '';
    status.textContent = (chart.warnings.length ? '⚠ ' + chart.warnings.join('\n⚠ ') + '\n\n' : '') + `全${chart.rows.length}段 / ${counts}`;
  } catch (e) {
    status.className = 'err';
    status.textContent = e.message;
  }
}

presetSel.addEventListener('change', () => {
  $('chart').value = PRESETS[presetSel.value];
  $('mode').value = presetSel.value.includes('往復') ? 'flat' : 'round';
  update(true);
});
$('chart').addEventListener('input', () => update(false));
['mode', 'yarn'].forEach((id) => $(id).addEventListener('change', () => update(true)));
$('color').addEventListener('input', () => update(false));
$('bg').addEventListener('input', () => { scene.background = new THREE.Color($('bg').value); });
scene.background = new THREE.Color($('bg').value);

resize();
update(true);
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
