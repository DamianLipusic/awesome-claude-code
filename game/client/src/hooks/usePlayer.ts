import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import type { Player } from '@economy-game/shared';

export const PLAYER_QUERY_KEY = ['player', 'me'];

export function usePlayer() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setPlayer = useAuthStore((s) => s.setPlayer);

  const query = useQuery<Player>({
    queryKey: PLAYER_QUERY_KEY,
    queryFn: async () => {
      const player = await api.get<Player>('/players/me');
      setPlayer(player);
      return player;
    },
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  return query;
}

export function useInvalidatePlayer() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: PLAYER_QUERY_KEY });
}
