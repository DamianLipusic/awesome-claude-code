import type { HeatLevel } from '../../../shared/src/types/entities';
export interface DetectionContext {
    risk_level: number;
    security_reduction: number;
    informant_active: boolean;
    bribe_applied: boolean;
}
/**
 * Detection check implementing:
 *   probability = base(0.02) * heat_multiplier * risk_multiplier
 *                 * (1 - security_reduction)
 *                 * (1 + informant_bonus)
 *                 - bribe_discount
 * clamped to [0.001, 0.95]
 */
export declare function calcDetectionProbability(heatScore: number, ctx: DetectionContext): number;
/**
 * Performs a random detection roll.
 * Returns { detected: boolean, roll: number, probability: number }
 */
export declare function detection_check(heatScore: number, ctx: DetectionContext): {
    detected: boolean;
    roll: number;
    probability: number;
};
export declare function getHeatLevel(score: number): HeatLevel;
/**
 * Fetch security reduction for a given player in a given season
 * by looking up their businesses' security layers.
 */
export declare function getPlayerSecurityReduction(playerId: string): Promise<number>;
//# sourceMappingURL=detection.d.ts.map