import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

// V3 player type (inline, no shared package)
interface PlayerV3 {
  id: string;
  username: string;
  cash: number;
  bank_balance: number;
  xp: number;
  level: number;
  season_id: string | null;
  created_at: string;
}

export const PLAYER_QUERY_KEY = ['player', 'me'];

export function usePlayer() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setPlayer = useAuthStore((s) => s.setPlayer);

  const query = useQuery<PlayerV3>({
    queryKey: PLAYER_QUERY_KEY,
    queryFn: async () => {
      const player = await api.get<PlayerV3>('/auth/me');
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
