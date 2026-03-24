import { COLORS } from './theme';
import { ProjectStatus } from '../types';

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  planning:  COLORS.warning,
  synthesis: COLORS.primary,
  done:      COLORS.success,
};

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning:  'Planning',
  synthesis: 'In Synthesis',
  done:      'Done',
};
