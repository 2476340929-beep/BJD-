/* Eye socket segmentation. Pure pixel operations shared by automatic and click selection.
 * No ellipse is substituted for the image contour. Coordinates are in source pixels. */
(function (root) {
  'use strict';
  const VERSION = 2;
  const median = values => values.sort((a, b) => a - b)[values.length >> 1];
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / Math.sqrt(3);
  const color = (p, k) => [p[k * 4], p[k * 4 + 1], p[k * 4 + 2]];

  function component(W, H, sx, sy, accepts, bounds) {
    const { x0, y0, x1, y1 } = bounds;
    const rw = x1 - x0 + 1, rh = y1 - y0 + 1;
    const seen = new Uint8Array(rw * rh), queue = new Int32Array(rw * rh);
    let end = 0, start = 0, touches = false;
    const visit = (x, y) => {
      if (x < x0 || y < y0 || x > x1 || y > y1) return;
      const local = (y - y0) * rw + x - x0;
      if (seen[local]) return;
      seen[local] = 1;
      if (accepts(y * W + x)) queue[end++] = y * W + x;
    };
    visit(sx, sy);
    let bx0 = W, bx1 = -1, by0 = H, by1 = -1;
    while (start < end) {
      const k = queue[start++], x = k % W, y = (k / W) | 0;
      bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x);
      by0 = Math.min(by0, y); by1 = Math.max(by1, y);
      if (x === x0 || x === x1 || y === y0 || y === y1) touches = true;
      visit(x - 1, y); visit(x + 1, y); visit(x, y - 1); visit(x, y + 1);
    }
    return { pixels: queue.slice(0, end), n: end, x0: bx0, x1: bx1, y0: by0, y1: by1, touches };
  }

  function segment(p, W, H, sx, sy) {
    sx = Math.round(sx); sy = Math.round(sy);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H || p[(sy * W + sx) * 4 + 3] < 128)
      return { ok: false, why: '请点在眼孔内部' };
    const samples = [[], [], []];
    for (let y = Math.max(0, sy - 1); y <= Math.min(H - 1, sy + 1); y++)
      for (let x = Math.max(0, sx - 1); x <= Math.min(W - 1, sx + 1); x++)
        if (p[(y * W + x) * 4 + 3] >= 128)
          color(p, y * W + x).forEach((v, i) => samples[i].push(v));
    const key = samples.map(median);
    // A bounded search rejects leakage; reaching the bound is failure, never a clipped hole.
    const rw = Math.max(12, Math.round(W * .18)), rh = Math.max(12, Math.round(H * .13));
    const bounds = { x0: Math.max(0, sx - rw), x1: Math.min(W - 1, sx + rw),
      y0: Math.max(0, sy - rh), y1: Math.min(H - 1, sy + rh) };
    const minArea = Math.max(16, W * H * .00035), maxArea = W * H * .055;
    let stable = null, previous = null;
    // Look for the region BEFORE the first large area jump, not the first nonempty patch.
    for (const tolerance of [8, 12, 18, 26, 36, 48, 62, 78, 96, 116]) {
      const c = component(W, H, sx, sy, k => p[k * 4 + 3] >= 128 && distance(color(p, k), key) <= tolerance, bounds);
      if (c.touches || c.n > maxArea) break;
      if (previous && previous.n >= minArea && c.n > previous.n * 1.65) {
        if (stable) break;
      }
      if (previous && previous.n >= minArea && c.n / previous.n < 1.22) stable = c;
      previous = c;
    }
    const seedRegion = stable || previous;
    if (!seedRegion || seedRegion.n < minArea) return { ok: false, why: '眼孔轮廓不清楚，请点得更靠孔中心' };
    const bw = seedRegion.x1 - seedRegion.x0 + 1, bh = seedRegion.y1 - seedRegion.y0 + 1;
    if (bw / bh < .55 || bw / bh > 6 || seedRegion.n / (bw * bh) < .35)
      return { ok: false, why: '这里不像完整的眼孔，请重新点选' };

    // Learn the surrounding skin separately from the interior. Its colors need not
    // resemble the clicked pixel; the decision follows the foreground/skin boundary.
    const pad = Math.max(6, Math.round(Math.max(bw, bh) * .3));
    const box = { x0: Math.max(0, seedRegion.x0 - pad), x1: Math.min(W - 1, seedRegion.x1 + pad),
      y0: Math.max(0, seedRegion.y0 - pad), y1: Math.min(H - 1, seedRegion.y1 + pad) };
    const ring = [[], [], []], inside = [[], [], []];
    const sample = (bucket, x, y) => {
      const k = y * W + x;
      if (p[k * 4 + 3] >= 128) color(p, k).forEach((v, i) => bucket[i].push(v));
    };
    for (let x = box.x0; x <= box.x1; x++) { sample(ring, x, box.y0); sample(ring, x, box.y1); }
    for (let y = box.y0 + 1; y < box.y1; y++) { sample(ring, box.x0, y); sample(ring, box.x1, y); }
    for (const k of seedRegion.pixels) color(p, k).forEach((v, i) => inside[i].push(v));
    const foreground = inside.map(median), skin = ring[0].length ? ring.map(median) : foreground;
    const separation = distance(foreground, skin);
    if (separation < 9) return { ok: false, why: '眼孔与皮肤对比不足，请换一个点' };
    const region = component(W, H, sx, sy, k => {
      if (p[k * 4 + 3] < 128) return false;
      const rgb = color(p, k);
      const df = distance(rgb, foreground);
      return df < distance(rgb, skin) && (separation >= 40 || df < Math.max(8, separation * .45));
    }, box);
    if (region.touches || region.n < minArea || region.n > maxArea)
      return { ok: false, why: '眼孔边界不完整，请换一个点' };

    const mw = box.x1 - box.x0 + 1, mh = box.y1 - box.y0 + 1;
    const binary = new Uint8Array(mw * mh);
    for (const k of region.pixels) binary[(((k / W) | 0) - box.y0) * mw + k % W - box.x0] = 1;
    // Fill enclosed islands only. The exterior flood preserves real concavities and corners.
    const exterior = component(mw, mh, 0, 0, k => !binary[k], {x0:0, y0:0, x1:mw - 1, y1:mh - 1});
    const outside = new Uint8Array(mw * mh);
    for (const k of exterior.pixels) outside[k] = 1;
    for (let k = 0; k < binary.length; k++) if (!outside[k]) binary[k] = 1;
    // One 3x3 majority pass removes isolated JPEG teeth without imposing a geometric shape.
    const smooth = binary.slice();
    for (let y = 1; y < mh - 1; y++) for (let x = 1; x < mw - 1; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += binary[(y + dy) * mw + x + dx];
      smooth[y * mw + x] = n >= 5 ? 1 : 0;
    }
    const alpha = new Uint8ClampedArray(mw * mh);
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 1; y < mh - 1; y++) for (let x = 1; x < mw - 1; x++) {
      const k = y * mw + x;
      if (smooth[k]) {
        alpha[k] = 255;
        x0 = Math.min(x0, x + box.x0); x1 = Math.max(x1, x + box.x0);
        y0 = Math.min(y0, y + box.y0); y1 = Math.max(y1, y + box.y0);
      } else if (smooth[k - 1] || smooth[k + 1] || smooth[k - mw] || smooth[k + mw]) {
        // Coverage of mixed boundary pixels from the learned foreground/skin colors.
        const rgb = color(p, (y + box.y0) * W + x + box.x0);
        const delta = foreground.map((v, i) => v - skin[i]);
        const projection = delta.reduce((sum, d, i) => sum + (rgb[i] - skin[i]) * d, 0) / delta.reduce((sum, d) => sum + d * d, 0);
        alpha[k] = Math.round(255 * Math.max(0, Math.min(1, projection)));
      }
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { ok: true, version: VERSION, box, width: mw, height: mh, alpha,
      hole: {cx, cy, rx:(x1-x0+1)/2, ry:(y1-y0+1)/2, hw:(x1-x0+1)/2, hh:(y1-y0+1)/2},
      separation, seed: [sx, sy] };
  }

  function detect(p, W, H) {
    // Proposal masks: dark cavities, chromatic cavities, and enclosed background-colored holes.
    const corners = [0, W - 1, (H - 1) * W, W * H - 1];
    if (corners.some(k => p[k * 4 + 3] < 128)) return []; // line art: require explicit clicks
    const background = [0,1,2].map(i => median(corners.map(k => p[k * 4 + i])));
    const skinSamples = [[],[],[]];
    for(let y=Math.round(H*.25);y<H*.7;y+=3) for(let x=Math.round(W*.25);x<W*.75;x+=3) {
      const k=y*W+x;
      if(p[k*4+3]>=128 && distance(color(p,k),background)>18)
        color(p,k).forEach((v,i)=>skinSamples[i].push(v));
    }
    const skin=skinSamples[0].length?skinSamples.map(median):background;
    const masks = [k => {
      const [r,g,b] = color(p,k); return .299*r+.587*g+.114*b < 115;
    }, k => {
      const [r,g,b] = color(p,k);
      return Math.hypot((r-g)-(skin[0]-skin[1]),(b-g)-(skin[2]-skin[1])) > 38;
    }, k => distance(color(p,k), background) < 14];
    const proposals = [];
    for (const pred of masks) {
      const seen = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const k = y * W + x;
        if (seen[k] || p[k*4+3] < 128 || !pred(k)) continue;
        const c = component(W,H,x,y,i => p[i*4+3]>=128 && pred(i), {x0:0,y0:0,x1:W-1,y1:H-1});
        for (const i of c.pixels) seen[i] = 1;
        if (c.touches || c.n < W*H*.0008 || c.n > W*H*.055) continue;
        const bw = c.x1-c.x0+1, bh=c.y1-c.y0+1, cx=(c.x0+c.x1)/2, cy=(c.y0+c.y1)/2;
        if (bw/bh < .65 || bw/bh > 6 || c.n/(bw*bh)<.4 || cy<H*.18 || cy>H*.85 || cx<W*.12 || cx>W*.88) continue;
        // Seed on actual component, nearest the center (never on an internal island).
        let seed=c.pixels[0], best=Infinity;
        for (const i of c.pixels) { const d=(i%W-cx)**2+(((i/W)|0)-cy)**2; if(d<best){best=d;seed=i;} }
        if (!proposals.some(a=>Math.hypot(a.cx-cx,a.cy-cy)<Math.min(bw,bh)*.5)) proposals.push({...c,cx,cy,bw,bh,seed:[seed%W,(seed/W)|0]});
      }
    }
    let best=Infinity, pair=[];
    for(const a of proposals) for(const b of proposals) {
      if(a.cx>=b.cx || b.cx-a.cx<W*.16 || b.cx-a.cx>W*.65 || Math.abs(a.cy-b.cy)>Math.max(a.bh,b.bh)*.45) continue;
      if(Math.max(a.n,b.n)/Math.min(a.n,b.n)>2.5) continue;
      const score=Math.abs(a.cy-b.cy)/H*20+Math.abs(Math.log(a.n/b.n))+Math.abs((a.cx+b.cx)/2-W/2)/W*2;
      if(score<best){best=score;pair=[a.seed,b.seed];}
    }
    return pair;
  }
  const api = { VERSION, segment, detect };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EyeMask = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
