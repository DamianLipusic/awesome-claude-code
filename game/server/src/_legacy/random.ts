import crypto from 'crypto';

/** Cryptographically secure random float in [0, 1) */
export function secureRandom(): number {
  return crypto.randomInt(0, 2_147_483_647) / 2_147_483_647;
}

/** Cryptographically secure random integer in [min, max) */
export function secureRandomInt(min: number, max: number): number {
  return crypto.randomInt(min, max);
}
