export interface AminoAcidData {
  name: string;
  fullName: string;
  mwMono: number;
  mwAvg: number;
  pKaSC: number | null; // side-chain pKa, null if not ionizable
  hydro: number; // Kyte-Doolittle
  group: 'acidic' | 'basic' | 'polar' | 'hydrophobic' | 'special';
  isAromatic: boolean;
}

export interface Modifications {
  nAcetyl: boolean;
  cAmide: boolean;
  disulfide: number;
}

export interface PeptideResults {
  sequence: string;
  length: number;
  mwMono: number;
  mwAvg: number;
  pI: number;
  netCharge: number; // at pH 7.4
  extinctionCoeff: number;
  gravy: number;
  instabilityIndex: number;
  aliphaticIndex: number;
  halfLife: string;
  retentionTime: number;
  solubilityScore: number;
  composition: Record<string, number>;
  chargeVsPH: { ph: number; charge: number }[];
  hydrophobicityProfile: { position: number; aa: string; value: number }[];
}

export interface SynthesisStep {
  position: number;
  aa: string;
  done: boolean;
  completedAt: string | null;
}

export type ProjectStatus = 'planning' | 'synthesis' | 'done';

export interface Project {
  id: string;
  name: string;
  sequence: string;
  modifications: Modifications;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  synthesisSteps: SynthesisStep[];
  notes: string;
}

export interface CompareEntry {
  id: string;
  sequence: string;
  name: string;
  results: PeptideResults | null;
}
