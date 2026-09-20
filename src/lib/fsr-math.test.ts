import { computeFsrEasuConstants, computeFsrRcasLinear } from './fsr-math';

describe('computeFsrEasuConstants', () => {
  it('maps a 720x576 frame onto a 3x output using official FSR1 viewport math', () => {
    const con = computeFsrEasuConstants(720, 576, 2160, 1728);
    expect(con[0]).toBeCloseTo(720 / 2160);
    expect(con[1]).toBeCloseTo(576 / 1728);
    expect(con[2]).toBeCloseTo(0.5 * (720 / 2160) - 0.5);
    expect(con[3]).toBeCloseTo(0.5 * (576 / 1728) - 0.5);
    expect(con[4]).toBeCloseTo(1 / 720);
    expect(con[5]).toBeCloseTo(1 / 576);
  });
});

describe('computeFsrRcasLinear', () => {
  it('converts AMD sharpness into the RCAS linear gain', () => {
    expect(computeFsrRcasLinear(0.2)).toBeCloseTo(2 ** -0.2);
    expect(computeFsrRcasLinear(0)).toBe(1);
  });
});
