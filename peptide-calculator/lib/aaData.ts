import { AminoAcidData } from '../types';

// mwAvg = residue mass (full amino acid mass − 18.015 water), source: ExPASy / Sigma-Aldrich
export const AA_DATA: Record<string, AminoAcidData> = {
  A: { name: 'A', fullName: 'Alanine',       mwMono: 71.03711,  mwAvg:  71.079, pKaSC: null,  hydro:  1.8,  group: 'hydrophobic', isAromatic: false },
  R: { name: 'R', fullName: 'Arginine',      mwMono: 156.10111, mwAvg: 156.188, pKaSC: 12.48, hydro: -4.5,  group: 'basic',      isAromatic: false },
  N: { name: 'N', fullName: 'Asparagine',    mwMono: 114.04293, mwAvg: 114.104, pKaSC: null,  hydro: -3.5,  group: 'polar',      isAromatic: false },
  D: { name: 'D', fullName: 'Aspartate',     mwMono: 115.02694, mwAvg: 115.089, pKaSC: 3.86,  hydro: -3.5,  group: 'acidic',     isAromatic: false },
  C: { name: 'C', fullName: 'Cysteine',      mwMono: 103.00919, mwAvg: 103.144, pKaSC: 8.14,  hydro:  2.5,  group: 'special',    isAromatic: false },
  E: { name: 'E', fullName: 'Glutamate',     mwMono: 129.04259, mwAvg: 129.115, pKaSC: 4.07,  hydro: -3.5,  group: 'acidic',     isAromatic: false },
  Q: { name: 'Q', fullName: 'Glutamine',     mwMono: 128.05858, mwAvg: 128.131, pKaSC: null,  hydro: -3.5,  group: 'polar',      isAromatic: false },
  G: { name: 'G', fullName: 'Glycine',       mwMono: 57.02146,  mwAvg:  57.052, pKaSC: null,  hydro: -0.4,  group: 'special',    isAromatic: false },
  H: { name: 'H', fullName: 'Histidine',     mwMono: 137.05891, mwAvg: 137.141, pKaSC: 6.04,  hydro: -3.2,  group: 'basic',      isAromatic: true  },
  I: { name: 'I', fullName: 'Isoleucine',    mwMono: 113.08406, mwAvg: 113.160, pKaSC: null,  hydro:  4.5,  group: 'hydrophobic', isAromatic: false },
  L: { name: 'L', fullName: 'Leucine',       mwMono: 113.08406, mwAvg: 113.160, pKaSC: null,  hydro:  3.8,  group: 'hydrophobic', isAromatic: false },
  K: { name: 'K', fullName: 'Lysine',        mwMono: 128.09496, mwAvg: 128.174, pKaSC: 10.54, hydro: -3.9,  group: 'basic',      isAromatic: false },
  M: { name: 'M', fullName: 'Methionine',    mwMono: 131.04049, mwAvg: 131.197, pKaSC: null,  hydro:  1.9,  group: 'special',    isAromatic: false },
  F: { name: 'F', fullName: 'Phenylalanine', mwMono: 147.06841, mwAvg: 147.177, pKaSC: null,  hydro:  2.8,  group: 'hydrophobic', isAromatic: true  },
  P: { name: 'P', fullName: 'Proline',       mwMono: 97.05276,  mwAvg:  97.117, pKaSC: null,  hydro: -1.6,  group: 'special',    isAromatic: false },
  S: { name: 'S', fullName: 'Serine',        mwMono: 87.03203,  mwAvg:  87.078, pKaSC: null,  hydro: -0.8,  group: 'polar',      isAromatic: false },
  T: { name: 'T', fullName: 'Threonine',     mwMono: 101.04768, mwAvg: 101.104, pKaSC: null,  hydro: -0.7,  group: 'polar',      isAromatic: false },
  W: { name: 'W', fullName: 'Tryptophan',    mwMono: 186.07931, mwAvg: 186.213, pKaSC: null,  hydro: -0.9,  group: 'hydrophobic', isAromatic: true  },
  Y: { name: 'Y', fullName: 'Tyrosine',      mwMono: 163.06333, mwAvg: 163.176, pKaSC: 10.46, hydro: -1.3,  group: 'hydrophobic', isAromatic: true  },
  V: { name: 'V', fullName: 'Valine',        mwMono: 99.06841,  mwAvg:  99.133, pKaSC: null,  hydro:  4.2,  group: 'hydrophobic', isAromatic: false },
};

// pKa for termini
export const PKA_NTERM = 9.60;
export const PKA_CTERM = 2.34;

// Half-life N-end rule (mammalian, simplified)
export const HALF_LIFE: Record<string, string> = {
  A: '>20h', C: '>20h', G: '>20h', M: '>20h', S: '>20h', T: '>20h', V: '>20h',
  D: '1.1h', E: '1h', F: '1.1h', H: '3.5h', I: '20h', K: '1.3h',
  L: '5.5h', N: '1.4h', Q: '0.8h', R: '1h', W: '2.8h', Y: '2.8h',
  P: '?',
};

// HPLC retention coefficients (SSRCalc simplified)
export const HPLC_RC: Record<string, number> = {
  A:  1.1,  R: -3.5,  N: -0.7,  D: -2.8,  C:  -2.2,
  E: -2.5,  Q: -0.3,  G:  0.0,  H: -3.5,  I:   9.3,
  L:  9.6,  K: -3.2,  M:  5.8,  F: 13.2,  P:  -0.2,
  S: -1.1,  T:  0.2,  W: 14.9,  Y:  8.0,  V:   5.0,
};
