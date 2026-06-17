import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export function generiereId(): string {
  return uuidv4();
}

export function formatiereMetric(meter: number, einheit: 'mm' | 'cm' | 'm' = 'm'): string {
  switch (einheit) {
    case 'mm': return `${Math.round(meter * 1000)} mm`;
    case 'cm': return `${(meter * 100).toFixed(1)} cm`;
    case 'm': return `${meter.toFixed(2)} m`;
  }
}

export function konvertiereZuMetern(wert: number, einheit: 'mm' | 'cm' | 'm'): number {
  switch (einheit) {
    case 'mm': return wert / 1000;
    case 'cm': return wert / 100;
    case 'm': return wert;
  }
}

export function formatiereGewicht(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  return `${Math.round(kg)} kg`;
}

export function formatiereZahl(n: number, nachkommastellen = 0): string {
  return n.toFixed(nachkommastellen).replace('.', ',');
}

export function formatiereDatum(datum: string | Date): string {
  const d = typeof datum === 'string' ? new Date(datum) : datum;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
