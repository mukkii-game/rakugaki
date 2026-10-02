import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';

// ---- サンプル模様（上の行が編み図の上。数字=色番号、小文字にすると裏目）----
const PRESETS = {
  '雪の結晶': { place: 'allover', colors: ['#2f3e5c', '#f4efe6'], rows: [
    '000000000000',
    '000001000000',
    '000101010000',
    '000011100000',
    '010001000100',
    '001101011000',
    '111110111110',
    '001101011000',
    '010001000100',
    '000011100000',
    '000101010000',
    '000001000000'] },
  'フェアアイル（ヨーク）': { place: 'yoke', colors: ['#efe6d4', '#8c3b2e', '#3f5a4a', '#d9a441'], rows: [
    '00000000',
    '11111111',
    '00000000',
    '00300030',
    '03330333',
    '33333333',
    '03330333',
    '00300030',
    '00000000',
    '22222222',
    '02000200',
    '22202220',
    '02000200',
    '22222222',
    '00000000',
    '11111111'] },
  'ハート': { place: 'chest', colors: ['#f2e2d8', '#c2414b'], rows: [
    '0000000000',
    '0011011000',
    '0111111100',
    '0111111100',
    '0011111000',
    '0001110000',
    '0000100000',
    '0000000000'] },
  '市松（表目と裏目）': { place: 'allover', colors: ['#b9a58a'], rows: [
    '0000aaaa',
    '0000aaaa',
    '0000aaaa',
    '0000aaaa',
    'aaaa0000',
    'aaaa0000',
    'aaaa0000',
    'aaaa0000'] },
  'ボーダー': { place: 'allover', colors: ['#f4efe6', '#264d73'], rows: [
    '1', '1', '0', '0', '0', '0'] },
};

// ---- 状態 ----
const state = { colors: [], w: 0, h: 0, cells: [], cur: 1, tool: 'pen', sym: 'K' };
// cells[r][c] = { c: 色番号, p: 裏目なら true }  r=0 が一番下の段

function loadPreset(name) {
  const p = PRESETS[name];
  state.colors = [...p.colors];
  state.h = p.rows.length; state.w = p.rows[0].length;
  // 小文字 a〜j → 色0〜9の裏目
  state.cells = p.rows.slice().reverse().map((row) => [...row].map((ch) =>
    (ch >= 'a' && ch <= 'j') ? { c: ch.charCodeAt(0) - 97, p: true } : { c: +ch, p: false }));
  state.cur = Math.min(1, state.colors.length - 1);
  $('place').value = p.place;
}

const $ = (id) => document.getElementById(id);

// ---- 編み図エディタ ----
const chartCv = $('chart');
const ctx = chartCv.getContext('2d');
let cell = 20;

function drawChart() {
  cell = Math.max(8, Math.min(26, Math.floor(330 / Math.max(state.w, state.h * 0.8))));
  const dpr = window.devicePixelRatio || 1;
  const W = state.w * cell + 24, H = state.h * cell + 18;
  chartCv.width = W * dpr; chartCv.height = H * dpr;
  chartCv.style.width = W + 'px'; chartCv.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.font = '9px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let r = 0; r < state.h; r++) {
    for (let c = 0; c < state.w; c++) {
      const { x, y } = cellXY(r, c);
      const d = state.cells[r][c];
      ctx.fillStyle = state.colors[d.c] || '#fff';
      ctx.fillRect(x, y, cell, cell);
      ctx.strokeStyle = contrast(state.colors[d.c]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (d.p) { ctx.moveTo(x + cell * 0.25, y + cell / 2); ctx.lineTo(x + cell * 0.75, y + cell / 2); }
      else if (cell >= 12) { ctx.globalAlpha = 0.35; ctx.moveTo(x + cell / 2, y + cell * 0.28); ctx.lineTo(x + cell / 2, y + cell * 0.72); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    const { y } = cellXY(r, 0);
    ctx.fillStyle = '#998'; ctx.fillText(r + 1, state.w * cell + 12, y + cell / 2);
  }
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
  for (let c = 0; c <= state.w; c++) { ctx.beginPath(); ctx.moveTo(c * cell + .5, 0); ctx.lineTo(c * cell + .5, state.h * cell); ctx.stroke(); }
  for (let r = 0; r <= state.h; r++) { ctx.beginPath(); ctx.moveTo(0, r * cell + .5); ctx.lineTo(state.w * cell, r * cell + .5); ctx.stroke(); }
  for (let c = 0; c < state.w; c++) { ctx.fillStyle = '#998'; ctx.fillText(state.w - c, c * cell + cell / 2, state.h * cell + 9); }
}
const cellXY = (r, c) => ({ x: c * cell, y: (state.h - 1 - r) * cell });
function contrast(hex) {
  const n = parseInt((hex || '#ffffff').slice(1), 16);
  const l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return l > 140 ? '#333' : '#fff';
}

function drawPalette() {
  const pal = $('palette');
  pal.innerHTML = '';
  state.colors.forEach((col, i) => {
    const d = document.createElement('div');
    d.className = 'sw' + (i === state.cur ? ' on' : '');
    d.style.background = col;
    d.title = `色${i + 1}`;
    d.innerHTML = `<input type="color" value="${col}"><span class="dot">✎</span>`;
    d.addEventListener('click', (e) => { if (e.target.tagName !== 'INPUT') { state.cur = i; drawPalette(); } });
    d.querySelector('input').addEventListener('input', (e) => { state.colors[i] = e.target.value; d.style.background = e.target.value; drawChart(); recolor(); });
    pal.append(d);
  });
  if (state.colors.length < 8) {
    const add = document.createElement('button');
    add.textContent = '＋色';
    add.addEventListener('click', () => { state.colors.push('#888888'); state.cur = state.colors.length - 1; drawPalette(); });
    pal.append(add);
  }
}

function hit(e) {
  const rect = chartCv.getBoundingClientRect();
  const c = Math.floor((e.clientX - rect.left) / cell);
  const r = state.h - 1 - Math.floor((e.clientY - rect.top) / cell);
  return (c >= 0 && c < state.w && r >= 0 && r < state.h) ? { r, c } : null;
}
function apply(pos, shift) {
  const d = state.cells[pos.r][pos.c];
  const target = { c: shift ? d.c : state.cur, p: state.sym === 'P' };
  if (state.tool === 'fill' && !shift) {
    const from = { ...d };
    if (from.c === target.c && from.p === target.p) return;
    const stack = [pos];
    while (stack.length) {
      const { r, c } = stack.pop();
      const x = state.cells[r]?.[c];
      if (!x || x.c !== from.c || x.p !== from.p) continue;
      state.cells[r][c] = { ...target };
      stack.push({ r: r + 1, c }, { r: r - 1, c }, { r, c: c + 1 }, { r, c: c - 1 });
    }
  } else {
    if (d.c === target.c && d.p === target.p) return;
    state.cells[pos.r][pos.c] = target;
  }
  drawChart(); recolor();
}
let painting = false;
chartCv.addEventListener('pointerdown', (e) => { const p = hit(e); if (!p) return; painting = state.tool === 'pen'; chartCv.setPointerCapture(e.pointerId); apply(p, e.shiftKey); });
chartCv.addEventListener('pointermove', (e) => { if (!painting) return; const p = hit(e); if (p) apply(p, e.shiftKey); });
chartCv.addEventListener('pointerup', () => { painting = false; });

function setOn(ids, on) { ids.forEach((id) => $(id).classList.toggle('on', id === on)); }
$('toolPen').onclick = () => { state.tool = 'pen'; setOn(['toolPen', 'toolFill'], 'toolPen'); };
$('toolFill').onclick = () => { state.tool = 'fill'; setOn(['toolPen', 'toolFill'], 'toolFill'); };
$('symK').onclick = () => { state.sym = 'K'; setOn(['symK', 'symP'], 'symK'); };
$('symP').onclick = () => { state.sym = 'P'; setOn(['symK', 'symP'], 'symP'); };
$('flipH').onclick = () => { state.cells.forEach((row) => row.reverse()); drawChart(); recolor(); };
$('clear').onclick = () => { state.cells = state.cells.map((row) => row.map(() => ({ c: 0, p: false }))); drawChart(); recolor(); };

function resizeChart() {
  const w = Math.max(1, Math.min(60, +$('cw').value || 1)), h = Math.max(1, Math.min(60, +$('ch').value || 1));
  state.cells = Array.from({ length: h }, (_, r) => Array.from({ length: w }, (_, c) => state.cells[r]?.[c] || { c: 0, p: false }));
  state.w = w; state.h = h;
  drawChart(); recolor();
}
$('cw').addEventListener('change', resizeChart);
$('ch').addEventListener('change', resizeChart);

// ---- 3D セーター ----
const view = $('view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
view.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#ece6dc');
const camera = new THREE.PerspectiveCamera(35, 1, 1, 2000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7d70, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(40, 80, 90); scene.add(sun);
const back = new THREE.DirectionalLight(0xffffff, 0.5); back.position.set(-60, 30, -80); scene.add(back);

let group = null, mesh = null, stitches = [];
const loopGeo = new THREE.SphereGeometry(1, 7, 5);

// 部位を「段 r・目 j → 位置」の関数で表し、目を並べる
function build() {
  if (group) { scene.remove(group); group.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); }
  group = new THREE.Group();
  const [gs, gr] = $('yarn').value.split(',').map(Number);
  const sw = 10 / gs, rh = 10 / gr;                // 1目の幅・1段の高さ(cm)
  const bust = +$('size').value;
  const bodyLen = 38, yokeDepth = 22, sleeveLen = 44;
  const neck = 50, armCirc = bust * 0.36, cuff = 20;
  const ribRows = Math.round(5 / rh);

  const parts = [];
  // 身頃：楕円の筒
  const Nb = Math.round(bust / sw / 2) * 2, Rb = bust / (2 * Math.PI), Rows_b = Math.round(bodyLen / rh);
  const ell = (a, R) => [Math.sin(a) * R * 1.18, Math.cos(a) * R * 0.8];
  parts.push({ name: 'body', rows: Rows_b, count: () => Nb, rib: (r) => r < ribRows,
    f: (r, j) => { const a = (j / Nb) * Math.PI * 2; const [x, z] = ell(a, Rb); return new THREE.Vector3(x, r * rh, z); } });

  // ヨーク：身頃＋袖の目数から首回りまで減らしていく
  const yTop = Rows_b * rh;
  const N0 = Nb + 2 * Math.round(armCirc / sw * 0.7), Nn = Math.round(neck / sw);
  const R0 = (N0 * sw) / (2 * Math.PI), Rn = neck / (2 * Math.PI);
  const Rows_y = Math.round(yokeDepth / rh);
  const yokeCount = (r) => Math.round(N0 + (Nn - N0) * Math.pow(Math.max(0, r) / Rows_y, 1.15));
  const yokeR = (t) => R0 + (Rn - R0) * Math.pow(Math.max(0, t), 1.15);
  const yokeY = (t) => yTop + 6 * Math.sin(t * Math.PI / 2) + 4 * t; // 肩の丸み
  parts.push({ name: 'yoke', rows: Rows_y, count: yokeCount, rib: (r) => r >= Rows_y - ribRows, rowOffset: Rows_b,
    f: (r, j, n) => { const t = r / Rows_y; const a = (j / n) * Math.PI * 2; const R = yokeR(t);
      const sq = 1 - 0.32 * (1 - t); // 下ほど横に広い楕円
      return new THREE.Vector3(Math.sin(a) * R * (0.6 + 0.4 / sq) * 0.95, yokeY(t), Math.cos(a) * R * sq * 0.92); } });

  // 袖：肩から斜め下へ伸びる先細りの筒
  const Ns0 = Math.round(armCirc / sw), Nsc = Math.round(cuff / sw), Rows_s = Math.round(sleeveLen / rh);
  for (const side of [-1, 1]) {
    const ang = THREE.MathUtils.degToRad(52);
    const dir = new THREE.Vector3(side * Math.sin(ang), -Math.cos(ang), 0);
    const shoulder = new THREE.Vector3(side * (R0 * 0.98), yTop + 0.5, 0);
    const u = new THREE.Vector3(0, 0, 1), v = new THREE.Vector3().crossVectors(dir, u).normalize();
    parts.push({ name: 'sleeve', rows: Rows_s, rib: (r) => r < ribRows,
      count: (r) => Math.round(Nsc + (Ns0 - Nsc) * Math.min(1, (r / Rows_s) * 1.25)),
      f: (r, j, n) => {
        const t = 1 - r / Rows_s; // r=0 が袖口
        const R = (n * sw) / (2 * Math.PI);
        const a = (j / n) * Math.PI * 2 * side;
        return shoulder.clone().addScaledVector(dir, t * sleeveLen)
          .addScaledVector(u, Math.cos(a) * R).addScaledVector(v, Math.sin(a) * R);
      } });
  }

  // 目を配置
  stitches = [];
  const mats = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  for (const part of parts) {
    for (let r = 0; r < part.rows; r++) {
      const n = part.count(r);
      for (let j = 0; j < n; j++) {
        const at = (rr, jj) => part.f(rr, jj, part.count(Math.max(0, Math.min(part.rows - 1, Math.round(rr)))));
        const pos = at(r, j);
        const tangent = at(r, j + 0.5).sub(at(r, j - 0.5)).normalize();
        const up = part.f(r + 0.5, j * part.count(r + 1) / n, part.count(Math.min(part.rows - 1, r + 1))).sub(part.f(r - 0.5, j * part.count(Math.max(0, r - 1)) / n, part.count(Math.max(0, r - 1)))).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
        const center = pos.clone().sub(group.position);
        // 外向きにそろえる
        const outward = part.name === 'sleeve' ? null : new THREE.Vector3(pos.x, 0, pos.z);
        if (outward && normal.dot(outward) < 0) normal.negate();
        stitches.push({ part: part.name, r: r + (part.rowOffset || 0), lr: r, j, n, rib: part.rib(r), pos: center, tangent, up, normal, rows: part.rows });
      }
    }
  }

  mesh = new THREE.InstancedMesh(loopGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), stitches.length * 2);
  stitches.forEach((st, i) => { st.i = i; });
  mesh.userData.sw = sw; mesh.userData.rh = rh;
  group.add(mesh);

  // 芯（すき間を埋める）
  const coreMat = new THREE.MeshStandardMaterial({ color: '#555', roughness: 1, side: THREE.DoubleSide });
  for (const part of parts) {
    const segs = 48, geo = new THREE.BufferGeometry(), verts = [], idx = [];
    for (let r = 0; r <= part.rows - 1; r++) {
      const n = part.count(r);
      for (let k = 0; k <= segs; k++) {
        const p = part.f(r, (k / segs) * n, n);
        const c = part.name === 'sleeve' ? null : new THREE.Vector3(p.x, p.y, p.z).multiply(new THREE.Vector3(0.985, 1, 0.985));
        verts.push(...(c ? c.toArray() : p.toArray()));
      }
    }
    for (let r = 0; r < part.rows - 1; r++) for (let k = 0; k < segs; k++) {
      const a = r * (segs + 1) + k, b = a + segs + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const core = new THREE.Mesh(geo, coreMat);
    if (part.name === 'sleeve') core.scale.setScalar(1); // 袖は内側寄せなし
    group.add(core);
  }
  group.userData.coreMat = coreMat;
  placeLoops();
  recolor();

  const box = new THREE.Box3().setFromObject(group);
  const c = box.getCenter(new THREE.Vector3());
  group.position.sub(c);
  scene.add(group);
  const size = box.getSize(new THREE.Vector3()).length();
  camera.position.set(size * 0.35, size * 0.25, size * 1.1);
  controls.target.set(0, 0, 0);
  camera.near = size / 50; camera.far = size * 10; camera.updateProjectionMatrix();

  $('stats').textContent = `ゲージ ${gs}目×${gr}段 / 身頃 ${Nb}目×${Rows_b}段、ヨーク ${N0}→${Nn}目×${Rows_y}段、袖 ${Nsc}→${Ns0}目×${Rows_s}段（約${stitches.length.toLocaleString()}目）`;
}

// 表目＝V字の2本のループ、裏目＝横向きのこぶ
function placeLoops() {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), basis = new THREE.Matrix4();
  const sw = mesh.userData.sw, rh = mesh.userData.rh;
  stitches.forEach((st) => {
    const purl = cellFor(st).p;
    for (const side of [0, 1]) {
      const k = st.i * 2 + side;
      if (purl) {
        // こぶ：横長の1つ＋目立たない小さいもの
        basis.makeBasis(st.tangent, st.up, st.normal);
        q.setFromRotationMatrix(basis);
        p.copy(st.pos).addScaledVector(st.up, side ? rh * 0.25 : -rh * 0.15).addScaledVector(st.normal, side ? 0.05 : 0.1);
        s.set(sw * (side ? 0.4 : 0.55), rh * (side ? 0.22 : 0.3), sw * 0.28);
      } else {
        const sg = side ? 1 : -1, tilt = sg * 0.42;
        const dir = st.up.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(st.tangent, -Math.sin(tilt)).normalize();
        const t2 = new THREE.Vector3().crossVectors(dir, st.normal).normalize();
        basis.makeBasis(t2, dir, st.normal);
        q.setFromRotationMatrix(basis);
        p.copy(st.pos).addScaledVector(st.tangent, sg * sw * 0.22).addScaledVector(st.normal, 0.08);
        s.set(sw * 0.25, rh * 0.75, sw * 0.22);
      }
      m.compose(p, q, s);
      mesh.setMatrixAt(k, m);
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
}

// その目に模様が入るかどうか → 編み図のマス
function cellFor(st) {
  const place = $('place').value;
  const none = { c: 0, p: false };
  if (st.rib) return { c: 0, p: st.j % 2 === 1 }; // ゴム編み（1目ゴム）
  const col = ((st.j % state.w) + state.w) % state.w;
  const rowIn = (start) => { const rr = st.lr - start; return rr >= 0 && rr < state.h ? rr : -1; };
  let r = -1;
  if (place === 'allover') r = (st.part === 'sleeve' ? st.lr : st.r) % state.h;
  else if (place === 'yoke' || place === 'bands') {
    if (st.part === 'yoke') { const start = Math.max(0, Math.round((st.rows - state.h) * 0.25)); r = rowIn(start); }
    if (place === 'bands' && st.part !== 'yoke') r = rowIn(Math.round(5 / mesh.userData.rh) + 2);
  } else if (place === 'chest') {
    if (st.part === 'body') r = rowIn(Math.round(st.rows * 0.62));
    if (st.part === 'sleeve') r = rowIn(Math.round(st.rows * 0.55));
  }
  if (r < 0) return none;
  return state.cells[r][col];
}

let pendingLoops = false;
function recolor() {
  if (!mesh) return;
  const col = new THREE.Color();
  let purlChanged = false;
  stitches.forEach((st) => {
    const cc = cellFor(st);
    if (st.purl !== cc.p) { st.purl = cc.p; purlChanged = true; }
    col.set(state.colors[cc.c] || state.colors[0]);
    const v = ((st.j * 13 + st.r * 7) % 7 - 3) * 0.01;
    col.offsetHSL(0, 0, v);
    mesh.setColorAt(st.i * 2, col); mesh.setColorAt(st.i * 2 + 1, col);
  });
  mesh.instanceColor.needsUpdate = true;
  if (purlChanged) placeLoops();
  group.userData.coreMat.color.set(state.colors[0]).multiplyScalar(0.5);
}

function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);

// ---- 初期化 ----
$('preset').innerHTML = Object.keys(PRESETS).map((k) => `<option>${k}</option>`).join('');
function usePreset() {
  loadPreset($('preset').value);
  $('cw').value = state.w; $('ch').value = state.h;
  drawPalette(); drawChart(); recolor();
}
$('preset').addEventListener('change', usePreset);
$('place').addEventListener('change', recolor);
['yarn', 'size'].forEach((id) => $(id).addEventListener('change', build));

loadPreset($('preset').value);
$('cw').value = state.w; $('ch').value = state.h;
drawPalette(); drawChart();
resize();
build();
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
