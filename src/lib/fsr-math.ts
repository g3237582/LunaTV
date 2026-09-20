/**
 * AMD FidelityFX FSR 1.0 constant setup (MIT).
 * Official FsrEasuCon / FsrRcasCon math, kept in JS so WebGPU uniforms stay testable.
 */

export function computeFsrEasuConstants(
  inputWidth: number,
  inputHeight: number,
  outputWidth: number,
  outputHeight: number
): Float32Array {
  const con = new Float32Array(16);
  con[0] = inputWidth / outputWidth;
  con[1] = inputHeight / outputHeight;
  con[2] = 0.5 * con[0] - 0.5;
  con[3] = 0.5 * con[1] - 0.5;
  con[4] = 1 / inputWidth;
  con[5] = 1 / inputHeight;
  con[6] = 1 / inputWidth;
  con[7] = -1 / inputHeight;
  con[8] = -1 / inputWidth;
  con[9] = 2 / inputHeight;
  con[10] = 1 / inputWidth;
  con[11] = 2 / inputHeight;
  con[12] = 0 / inputWidth;
  con[13] = 4 / inputHeight;
  con[14] = con[4];
  con[15] = -con[5];
  return con;
}

/** AMD FsrRcasCon: linear gain = 2^(-sharpness). 0 = strongest, larger = milder. */
export function computeFsrRcasLinear(sharpness: number): number {
  return 2 ** -sharpness;
}
