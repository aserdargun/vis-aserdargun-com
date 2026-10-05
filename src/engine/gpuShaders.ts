/**
 * WGSL compute kernels for the GPU path.
 *
 * Every kernel reads a single-channel f32 raster and writes one. The CPU path
 * accumulates in JS doubles, so the parity suite compares with a tolerance
 * rather than expecting bit equality.
 */

export const SHADER_CONVOLVE = /* wgsl */ `
struct Dims { w: u32, h: u32, kw: u32, kh: u32, padX: u32, padY: u32, _p0: u32, _p1: u32 };

@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read> kernel: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;
@group(0) @binding(3) var<uniform> dims: Dims;

fn atClamped(x: i32, y: i32) -> f32 {
  let cx = clamp(x, 0, i32(dims.w) - 1);
  let cy = clamp(y, 0, i32(dims.h) - 1);
  return src[u32(cy) * dims.w + u32(cx)];
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= dims.w || gid.y >= dims.h) { return; }
  let x = i32(gid.x);
  let y = i32(gid.y);
  let padX = i32(dims.padX);
  let padY = i32(dims.padY);
  var acc = 0.0;
  for (var ky: u32 = 0u; ky < dims.kh; ky = ky + 1u) {
    for (var kx: u32 = 0u; kx < dims.kw; kx = kx + 1u) {
      acc = acc + atClamped(x + i32(kx) - padX, y + i32(ky) - padY) * kernel[ky * dims.kw + kx];
    }
  }
  dst[u32(y) * dims.w + u32(x)] = acc;
}
`;

export const SHADER_THRESHOLD = /* wgsl */ `
struct Dims { w: u32, h: u32, level: u32, _p0: u32, _p1: u32, _p2: u32, _p3: u32, _p4: u32 };

@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read_write> dst: array<f32>;
@group(0) @binding(2) var<uniform> dims: Dims;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= dims.w || gid.y >= dims.h) { return; }
  let i = gid.y * dims.w + gid.x;
  dst[i] = select(0.0, 1.0, src[i] >= f32(dims.level) / 1000.0);
}
`;

export const SHADER_SOBEL_MAGNITUDE = /* wgsl */ `
struct Dims { w: u32, h: u32, _p0: u32, _p1: u32, _p2: u32, _p3: u32, _p4: u32, _p5: u32 };

@group(0) @binding(0) var<storage, read> gx: array<f32>;
@group(0) @binding(1) var<storage, read> gy: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;
@group(0) @binding(3) var<uniform> dims: Dims;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= dims.w || gid.y >= dims.h) { return; }
  let i = gid.y * dims.w + gid.x;
  dst[i] = min(1.0, length(vec2<f32>(gx[i], gy[i])) / 4.0);
}
`;

/**
 * Rank filter for morphological dilation and erosion. A binary mask
 * accumulates with `max` for dilation and `min` for erosion, which is why the
 * same kernel body serves both: the initial accumulator value differs.
 */
export const SHADER_MORPHOLOGY = /* wgsl */ `
struct Dims { w: u32, h: u32, kw: u32, kh: u32, padX: u32, padY: u32, _p0: u32, _p1: u32 };

@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read> kernel: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;
@group(0) @binding(3) var<uniform> dims: Dims;

fn atClamped(x: i32, y: i32) -> f32 {
  let cx = clamp(x, 0, i32(dims.w) - 1);
  let cy = clamp(y, 0, i32(dims.h) - 1);
  return src[u32(cy) * dims.w + u32(cx)];
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= dims.w || gid.y >= dims.h) { return; }
  let x = i32(gid.x);
  let y = i32(gid.y);
  let padX = i32(dims.padX);
  let padY = i32(dims.padY);
  // The seed comes from the kernel's own corner value, which the host sets to 0
  // for dilation and 1 for erosion.
  var acc = kernel[0];
  for (var ky: u32 = 0u; ky < dims.kh; ky = ky + 1u) {
    for (var kx: u32 = 0u; kx < dims.kw; kx = kx + 1u) {
      let v = atClamped(x + i32(kx) - padX, y + i32(ky) - padY);
      acc = max(acc, v);
    }
  }
  dst[gid.y * dims.w + gid.x] = acc;
}

@compute @workgroup_size(8, 8)
fn erodeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= dims.w || gid.y >= dims.h) { return; }
  let x = i32(gid.x);
  let y = i32(gid.y);
  let padX = i32(dims.padX);
  let padY = i32(dims.padY);
  var acc = kernel[0];
  for (var ky: u32 = 0u; ky < dims.kh; ky = ky + 1u) {
    for (var kx: u32 = 0u; kx < dims.kw; kx = kx + 1u) {
      let v = atClamped(x + i32(kx) - padX, y + i32(ky) - padY);
      acc = min(acc, v);
    }
  }
  dst[gid.y * dims.w + gid.x] = acc;
}
`;
