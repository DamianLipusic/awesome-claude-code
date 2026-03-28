import type { AlertType } from '../../../shared/src/types/entities';
export declare function createAlert(playerId: string, seasonId: string, type: AlertType, message: string, data?: Record<string, unknown>): Promise<void>;
export declare function getPlayerAlerts(playerId: string, limit?: number): Promise<unknown[]>;
//# sourceMappingURL=alerts.d.ts.map