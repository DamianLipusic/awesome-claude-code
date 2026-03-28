import type { FastifyRequest, FastifyReply } from 'fastify';
export interface JwtPayload {
    sub: string;
    username: string;
    type: 'access' | 'refresh';
    iat: number;
    exp: number;
}
declare module 'fastify' {
    interface FastifyRequest {
        player: {
            id: string;
            username: string;
            season_id: string | null;
        };
    }
}
/**
 * requireAuth — Fastify preHandler hook that verifies the JWT access token
 * and attaches the authenticated player to request.player.
 */
export declare function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void>;
//# sourceMappingURL=auth.d.ts.map