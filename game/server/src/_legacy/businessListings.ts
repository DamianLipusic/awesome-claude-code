import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, withTransaction } from '../db/client';
import { requireAuth } from '../middleware/auth';
import { recalculateNetWorth } from '../lib/networth';
import { BUSINESS_DAILY_COSTS, MAX_EMPLOYEES_PER_TIER } from '../lib/constants';

export default async function businessListingRoutes(app: FastifyInstance): Promise<void> {

  // GET / — list available businesses in a city
  app.get('/', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { city } = request.query as { city?: string };
    if (!city) {
      return reply.status(400).send({ error: 'city query parameter is required' });
    }

    const result = await query(
      `SELECT bl.*, d.name as district_name, d.tier as district_tier
       FROM business_listings bl
       LEFT JOIN districts d ON bl.district_id = d.id
       WHERE bl.city = $1 AND bl.status = 'AVAILABLE'
         AND (bl.expires_at IS NULL OR bl.expires_at > NOW())
       ORDER BY bl.asking_price ASC`,
      [city],
    );

    return reply.send({ data: result.rows });
  });

  // POST /:id/buy — purchase a listed business
  app.post('/:id/buy', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: listingId } = request.params as { id: string };
    const playerId = request.player.id;
    const seasonId = request.player.season_id;

    try {
      const result = await withTransaction(async (client) => {
        // Lock and fetch the listing
        const listingRow = await client.query<{
          id: string; city: string; district_id: string | null; type: string; name: string;
          asking_price: string; daily_operating_cost: string; foot_traffic: string;
          location_quality: string; size_sqm: number; status: string;
        }>(
          `SELECT * FROM business_listings WHERE id = $1 AND status = 'AVAILABLE' FOR UPDATE`,
          [listingId],
        );
        if (!listingRow.rows.length) {
          throw Object.assign(new Error('Listing not found or already sold'), { statusCode: 404 });
        }
        const listing = listingRow.rows[0];
        const askingPrice = Number(listing.asking_price);

        // Check player cash and business slots
        const playerRow = await client.query<{ cash: string; business_slots: number }>(
          `SELECT cash, business_slots FROM players WHERE id = $1 FOR UPDATE`,
          [playerId],
        );
        if (!playerRow.rows.length) {
          throw Object.assign(new Error('Player not found'), { statusCode: 404 });
        }
        const player = playerRow.rows[0];

        if (Number(player.cash) < askingPrice) {
          throw Object.assign(new Error(`Insufficient funds: need $${askingPrice}`), { statusCode: 400 });
        }

        const countRes = await client.query<{ cnt: string }>(
          `SELECT COUNT(*) AS cnt FROM businesses WHERE owner_id = $1 AND status != 'BANKRUPT'`,
          [playerId],
        );
        if (Number(countRes.rows[0].cnt) >= player.business_slots) {
          throw Object.assign(new Error('Business slot limit reached'), { statusCode: 400 });
        }

        // Create the business
        const isFront = listing.type === 'FRONT_COMPANY';
        const dailyCost = Number(listing.daily_operating_cost) || (BUSINESS_DAILY_COSTS[listing.type] ?? 800);
        const maxEmps = MAX_EMPLOYEES_PER_TIER[1] ?? 10;

        const bizRes = await client.query<{ id: string }>(
          `INSERT INTO businesses
             (owner_id, season_id, name, type, tier, city, status, capacity,
              efficiency, inventory, storage_cap, daily_operating_cost,
              is_front, front_capacity, max_employees, district_id,
              foot_traffic, location_quality, size_sqm)
           VALUES ($1,$2,$3,$4,1,$5,'ACTIVE',200,1.0,'{}',1000,$6,$7,$8,$9,$10,$11,$12,$13)
           RETURNING id`,
          [
            playerId, seasonId, listing.name, listing.type, listing.city,
            dailyCost, isFront, isFront ? 50000 : 0, maxEmps,
            listing.district_id, Number(listing.foot_traffic),
            Number(listing.location_quality), listing.size_sqm,
          ],
        );
        const businessId = bizRes.rows[0].id;

        // Deduct cash
        await client.query(
          `UPDATE players SET cash = cash - $1 WHERE id = $2`,
          [askingPrice, playerId],
        );

        // Mark listing as sold
        await client.query(
          `UPDATE business_listings SET status = 'SOLD' WHERE id = $1`,
          [listingId],
        );

        return { business_id: businessId, cost: askingPrice, name: listing.name, type: listing.type };
      });

      await recalculateNetWorth(playerId);
      return reply.status(201).send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });
}
