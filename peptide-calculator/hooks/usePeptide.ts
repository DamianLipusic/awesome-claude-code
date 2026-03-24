import { useReducer, useEffect, useRef } from 'react';
import { Modifications, PeptideResults, CompareEntry, Project } from '../types';
import { validateSequence, calculateAll } from '../lib/calculations';
import { loadProjects, saveProjects } from '../lib/storage';

// ── State ─────────────────────────────────────────────────────────────────────

interface State {
  sequence: string;
  modifications: Modifications;
  results: PeptideResults | null;
  errors: string[];
  comparing: CompareEntry[];
  projects: Project[];
  dark: boolean;
}

const INIT: State = {
  sequence: '',
  modifications: { nAcetyl: false, cAmide: false, disulfide: 0 },
  results: null,
  errors: [],
  comparing: [],
  projects: [],
  dark: false,
};

// ── Actions ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_SEQ'; payload: string }
  | { type: 'SET_MOD'; payload: Partial<Modifications> }
  | { type: 'SET_RESULTS'; payload: { results: PeptideResults | null; errors: string[] } }
  | { type: 'ADD_COMPARE'; payload: CompareEntry }
  | { type: 'REMOVE_COMPARE'; payload: string }
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'UPSERT_PROJECT'; payload: Project }
  | { type: 'DELETE_PROJECT'; payload: string }
  | { type: 'TOGGLE_DARK' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_SEQ':
      return { ...state, sequence: action.payload };
    case 'SET_MOD':
      return { ...state, modifications: { ...state.modifications, ...action.payload } };
    case 'SET_RESULTS':
      return { ...state, results: action.payload.results, errors: action.payload.errors };
    case 'ADD_COMPARE':
      if (state.comparing.length >= 5) return state;
      return { ...state, comparing: [...state.comparing, action.payload] };
    case 'REMOVE_COMPARE':
      return { ...state, comparing: state.comparing.filter(e => e.id !== action.payload) };
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };
    case 'UPSERT_PROJECT': {
      const exists = state.projects.some(p => p.id === action.payload.id);
      const updated = exists
        ? state.projects.map(p => p.id === action.payload.id ? action.payload : p)
        : [...state.projects, action.payload];
      return { ...state, projects: updated };
    }
    case 'DELETE_PROJECT':
      return { ...state, projects: state.projects.filter(p => p.id !== action.payload) };
    case 'TOGGLE_DARK':
      return { ...state, dark: !state.dark };
    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePeptide() {
  const [state, dispatch] = useReducer(reducer, INIT);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoaded   = useRef(false);

  // Load projects on mount
  useEffect(() => {
    loadProjects().then(projects => {
      dispatch({ type: 'SET_PROJECTS', payload: projects });
      isLoaded.current = true;
    });
  }, []);

  // Debounced recalculate when sequence or mods change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!state.sequence) {
        dispatch({ type: 'SET_RESULTS', payload: { results: null, errors: [] } });
        return;
      }
      const { valid, sequence, errors } = validateSequence(state.sequence);
      if (!valid) {
        dispatch({ type: 'SET_RESULTS', payload: { results: null, errors } });
        return;
      }
      const results = calculateAll(sequence, state.modifications);
      dispatch({ type: 'SET_RESULTS', payload: { results, errors: [] } });
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [state.sequence, state.modifications]);

  // Debounced project persistence — skip the initial load
  useEffect(() => {
    if (!isLoaded.current) return;
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => saveProjects(state.projects), 500);
    return () => { if (saveRef.current) clearTimeout(saveRef.current); };
  }, [state.projects]);

  const actions = {
    setSequence: (s: string) => dispatch({ type: 'SET_SEQ', payload: s }),
    setMod: (m: Partial<Modifications>) => dispatch({ type: 'SET_MOD', payload: m }),
    toggleDark: () => dispatch({ type: 'TOGGLE_DARK' }),
    addCompare: (entry: CompareEntry) => dispatch({ type: 'ADD_COMPARE', payload: entry }),
    removeCompare: (id: string) => dispatch({ type: 'REMOVE_COMPARE', payload: id }),
    upsertProject: (p: Project) => dispatch({ type: 'UPSERT_PROJECT', payload: p }),
    deleteProject: (id: string) => dispatch({ type: 'DELETE_PROJECT', payload: id }),
  };

  return { state, actions };
}
