/** AMD FidelityFX FSR 1.0 EASU + RCAS, ported to WGSL (MIT). */

export const fullscreenTexturedQuadWGSL = `
struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) fragUV : vec2<f32>,
}

@vertex
fn vert_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
  const pos = array(
    vec2( 1.0,  1.0),
    vec2( 1.0, -1.0),
    vec2(-1.0, -1.0),
    vec2( 1.0,  1.0),
    vec2(-1.0, -1.0),
    vec2(-1.0,  1.0),
  );
  const uv = array(
    vec2(1.0, 0.0),
    vec2(1.0, 1.0),
    vec2(0.0, 1.0),
    vec2(1.0, 0.0),
    vec2(0.0, 1.0),
    vec2(0.0, 0.0),
  );
  var output : VertexOutput;
  output.Position = vec4(pos[VertexIndex], 0.0, 1.0);
  output.fragUV = uv[VertexIndex];
  return output;
}
`;

export const fsrEasuWGSL = `
struct EasuParams {
  con0: vec4<f32>,
  con1: vec4<f32>,
  con2: vec4<f32>,
  con3: vec4<f32>,
}

struct DirLen {
  dir: vec2<f32>,
  len: f32,
}

struct Acc {
  color: vec3<f32>,
  weight: f32,
}

@group(0) @binding(0) var<uniform> params: EasuParams;
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var srcSampler: sampler;

fn fsrLuma(c: vec3<f32>) -> f32 {
  return c.g * 0.5 + c.r * 0.5 + c.b;
}

fn tap(p: vec2<f32>) -> vec3<f32> {
  return textureSampleLevel(src, srcSampler, p, 0.0).rgb;
}

fn easuTap(acc: Acc, off: vec2<f32>, dir: vec2<f32>, len: vec2<f32>, lob: f32, clp: f32, c: vec3<f32>) -> Acc {
  let v = len * vec2<f32>(dot(off, dir), dot(off, vec2<f32>(-dir.y, dir.x)));
  let d2 = min(dot(v, v), clp);
  var wB = 0.4 * d2 - 1.0;
  var wA = lob * d2 - 1.0;
  wB = wB * wB;
  wA = wA * wA;
  wB = 1.5625 * wB - 0.5625;
  let w = wB * wA;
  return Acc(acc.color + c * w, acc.weight + w);
}

fn easuSet(state: DirLen, w: f32, lA: f32, lB: f32, lC: f32, lD: f32, lE: f32) -> DirLen {
  var lenX = max(abs(lD - lC), abs(lC - lB));
  let dirX = lD - lB;
  lenX = clamp(abs(dirX) / max(lenX, 0.00001), 0.0, 1.0);
  return DirLen(state.dir + w * vec2<f32>(dirX, lE - lA), state.len + w * lenX * lenX);
}

@fragment
fn fs_easu(@builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  var pp = pos.xy * params.con0.xy + params.con0.zw;
  let fp = floor(pp);
  pp = pp - fp;
  let p0 = fp * params.con1.xy + params.con1.zw;
  let p1 = p0 + params.con2.xy;
  let p2 = p0 + params.con2.zw;
  let p3 = p0 + params.con3.xy;
  let _uv = uv;

  let b = tap(p0);
  let c = tap(p0 + vec2<f32>(params.con1.x, 0.0));
  let e = tap(p0 + vec2<f32>(0.0, params.con1.y));
  let f = tap(p1);
  let g = tap(p1 + vec2<f32>(params.con1.x, 0.0));
  let i = tap(p2);
  let j = tap(p2 + vec2<f32>(params.con1.x, 0.0));
  let k = tap(p3);
  let h = tap(p2 + vec2<f32>(-params.con1.x, 0.0));
  let l = tap(p3 + vec2<f32>(params.con1.x, 0.0));
  let n = tap(p2 + vec2<f32>(0.0, params.con1.y));
  let o = tap(p3 + vec2<f32>(0.0, params.con1.y));

  let bL = fsrLuma(b);
  let cL = fsrLuma(c);
  let iL = fsrLuma(i);
  let jL = fsrLuma(j);
  let fL = fsrLuma(f);
  let eL = fsrLuma(e);
  let kL = fsrLuma(k);
  let lL = fsrLuma(l);
  let hL = fsrLuma(h);
  let gL = fsrLuma(g);
  let oL = fsrLuma(o);
  let nL = fsrLuma(n);

  var state = DirLen(vec2<f32>(0.0, 0.0), 0.0);
  state = easuSet(state, 1.0, bL, eL, fL, gL, jL);
  state = easuSet(state, 1.0, fL, iL, jL, kL, nL);
  state = easuSet(state, 1.0, eL, hL, iL, jL, lL);
  state = easuSet(state, 1.0, cL, fL, gL, jL, kL);

  var dir = state.dir;
  var len = state.len;
  let dir2 = dir * dir;
  var dirR = dir2.x + dir2.y;
  var stretch = 0.0;
  if (dirR < 0.00001) {
    dir = vec2<f32>(1.0, 0.0);
  } else {
    dirR = inverseSqrt(dirR);
    dir = dir * dirR;
    stretch = abs(dir.x * dir.y) * inverseSqrt(max(dir2.x, dir2.y) / max(min(dir2.x, dir2.y), 0.00001));
  }
  len = len * 0.5;
  len = len * len;
  let len2 = vec2<f32>(1.0 + (stretch - 1.0) * len, 1.0 - 0.5 * len);
  let lob = 0.5 - 0.29 * len;
  let clp = 1.0 / lob;

  let min4 = min(min(e, f), min(j, i));
  let max4 = max(max(e, f), max(j, i));
  var acc = Acc(vec3<f32>(0.0, 0.0, 0.0), 0.0);
  acc = easuTap(acc, vec2<f32>(0.0, -1.0) - pp, dir, len2, lob, clp, b);
  acc = easuTap(acc, vec2<f32>(1.0, -1.0) - pp, dir, len2, lob, clp, c);
  acc = easuTap(acc, vec2<f32>(-1.0, 1.0) - pp, dir, len2, lob, clp, h);
  acc = easuTap(acc, vec2<f32>(0.0, 1.0) - pp, dir, len2, lob, clp, i);
  acc = easuTap(acc, vec2<f32>(0.0, 0.0) - pp, dir, len2, lob, clp, e);
  acc = easuTap(acc, vec2<f32>(-1.0, 0.0) - pp, dir, len2, lob, clp, f);
  acc = easuTap(acc, vec2<f32>(1.0, 1.0) - pp, dir, len2, lob, clp, j);
  acc = easuTap(acc, vec2<f32>(2.0, 1.0) - pp, dir, len2, lob, clp, k);
  acc = easuTap(acc, vec2<f32>(2.0, 0.0) - pp, dir, len2, lob, clp, g);
  acc = easuTap(acc, vec2<f32>(1.0, 0.0) - pp, dir, len2, lob, clp, l);
  acc = easuTap(acc, vec2<f32>(1.0, 2.0) - pp, dir, len2, lob, clp, o);
  acc = easuTap(acc, vec2<f32>(0.0, 2.0) - pp, dir, len2, lob, clp, n);
  let _keepUv = _uv.x * 0.0;
  return vec4<f32>(min(max4, max(min4, acc.color / max(acc.weight, 0.00001))), 1.0 + _keepUv);
}
`;

export const fsrRcasWGSL = `
struct RcasParams {
  sharpness: vec4<f32>,
}

@group(0) @binding(0) var<uniform> params: RcasParams;
@group(0) @binding(1) var src: texture_2d<f32>;

fn rcasLuma(c: vec3<f32>) -> f32 {
  return c.g * 0.5 + c.r * 0.5 + c.b;
}

@fragment
fn fs_rcas(@builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let dims = vec2<i32>(textureDimensions(src));
  let ip = clamp(vec2<i32>(pos.xy), vec2<i32>(0, 0), dims - vec2<i32>(1, 1));
  let b = textureLoad(src, clamp(ip + vec2<i32>(0, -1), vec2<i32>(0, 0), dims - vec2<i32>(1, 1)), 0).rgb;
  let d = textureLoad(src, clamp(ip + vec2<i32>(-1, 0), vec2<i32>(0, 0), dims - vec2<i32>(1, 1)), 0).rgb;
  let e = textureLoad(src, ip, 0).rgb;
  let f = textureLoad(src, clamp(ip + vec2<i32>(1, 0), vec2<i32>(0, 0), dims - vec2<i32>(1, 1)), 0).rgb;
  let h = textureLoad(src, clamp(ip + vec2<i32>(0, 1), vec2<i32>(0, 0), dims - vec2<i32>(1, 1)), 0).rgb;
  let _uv = uv;

  let bL = rcasLuma(b);
  let dL = rcasLuma(d);
  let eL = rcasLuma(e);
  let fL = rcasLuma(f);
  let hL = rcasLuma(h);

  let nz = 0.25 * (bL + dL + fL + hL) - eL;
  let range = max(max(abs(bL - eL), abs(dL - eL)), max(abs(fL - eL), abs(hL - eL)));
  let nz2 = 1.0 - clamp(abs(nz) / max(range, 1.0e-4), 0.0, 1.0);
  let nz3 = nz2 * nz2;

  let mn4R = min(min(b.r, d.r), min(f.r, h.r));
  let mn4G = min(min(b.g, d.g), min(f.g, h.g));
  let mn4B = min(min(b.b, d.b), min(f.b, h.b));
  let mx4R = max(max(b.r, d.r), max(f.r, h.r));
  let mx4G = max(max(b.g, d.g), max(f.g, h.g));
  let mx4B = max(max(b.b, d.b), max(f.b, h.b));

  let hitMinR = min(mn4R, e.r) / (4.0 * mx4R + 1.0e-5);
  let hitMinG = min(mn4G, e.g) / (4.0 * mx4G + 1.0e-5);
  let hitMinB = min(mn4B, e.b) / (4.0 * mx4B + 1.0e-5);
  let hitMaxR = (1.0 - max(mx4R, e.r)) / (4.0 * mn4R - 4.0 + 1.0e-5);
  let hitMaxG = (1.0 - max(mx4G, e.g)) / (4.0 * mn4G - 4.0 + 1.0e-5);
  let hitMaxB = (1.0 - max(mx4B, e.b)) / (4.0 * mn4B - 4.0 + 1.0e-5);
  let lobe0 = max(-0.1875, min(0.0, min(hitMinR, min(hitMinG, hitMinB))));
  let lobe1 = max(-0.1875, min(0.0, min(hitMaxR, min(hitMaxG, hitMaxB))));
  let lobe = max(lobe0, lobe1) * nz3 * params.sharpness.x;

  let pix = (vec3<f32>(lobe, lobe, lobe) * (b + d + h + f) + e) / (4.0 * lobe + 1.0);
  return vec4<f32>(clamp(pix, vec3<f32>(0.0, 0.0, 0.0), vec3<f32>(1.0, 1.0, 1.0)), 1.0 + _uv.x * 0.0);
}
`;
