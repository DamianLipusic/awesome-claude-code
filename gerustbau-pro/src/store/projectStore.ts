import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Project,
  BausteinSeite,
  Foto,
  Annotation,
  Messung,
  Oeffnung,
  ScaffoldSystemId,
  ScaffoldPurpose,
  SeitenLabel,
  MessungsTyp,
  GeruestPlan,
  MaterialPosition,
} from '../models/Project';
import { generiereId } from '../utils/formatters';

const STORAGE_KEY = 'gerustbau_projekte';

interface ProjectState {
  projekte: Project[];
  aktiverPlan: GeruestPlan | null;
  aktiveMaterialien: MaterialPosition[];

  // Actions
  ladeProjekte: () => Promise<void>;
  erstelleProjekt: (daten: {
    name: string;
    adresse?: string;
    auftraggeber?: string;
    systemId: ScaffoldSystemId;
    zweck: ScaffoldPurpose;
    gesamthoehe: number;
    etagen: number;
    arbeitshoehe: number;
  }) => string;
  aktualisierteProjekt: (id: string, aenderungen: Partial<Project>) => void;
  loescheProjekt: (id: string) => void;

  fuegeSeiteHinzu: (projektId: string, label: SeitenLabel, anzeigename: string) => string;
  aktualisiereMeSungsStatus: (projektId: string, seitenId: string) => void;

  fuegeAnnotationHinzu: (projektId: string, seitenId: string, fotoId: string, annotation: Annotation) => void;
  aktualisiereAnnotation: (projektId: string, seitenId: string, fotoId: string, annotation: Annotation) => void;
  loescheAnnotation: (projektId: string, seitenId: string, fotoId: string, annotationId: string) => void;

  fuegeFotoHinzu: (projektId: string, seitenId: string, foto: Omit<Foto, 'id' | 'seitenId' | 'annotationen'>) => string;

  fuegeMessungHinzu: (projektId: string, seitenId: string, messung: Omit<Messung, 'id' | 'seitenId'>) => void;
  aktualisiereMessung: (projektId: string, seitenId: string, messung: Messung) => void;

  fuegeOeffnungHinzu: (projektId: string, seitenId: string, oeffnung: Omit<Oeffnung, 'id'>) => void;

  setzePlan: (plan: GeruestPlan, materialien: MaterialPosition[]) => void;
}

function speichereProjekte(projekte: Project[]): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(projekte)).catch(console.error);
}

function aktualisiereSeiteInProjekt(
  projekte: Project[],
  projektId: string,
  seitenId: string,
  update: (seite: BausteinSeite) => BausteinSeite,
): Project[] {
  return projekte.map(p => {
    if (p.id !== projektId) return p;
    return {
      ...p,
      seiten: p.seiten.map(s => (s.id === seitenId ? update(s) : s)),
      aktualisiertAm: new Date().toISOString(),
    };
  });
}

export const useProjektStore = create<ProjectState>((set, get) => ({
  projekte: [],
  aktiverPlan: null,
  aktiveMaterialien: [],

  ladeProjekte: async () => {
    try {
      const gespeichert = await AsyncStorage.getItem(STORAGE_KEY);
      if (gespeichert) {
        set({ projekte: JSON.parse(gespeichert) });
      }
    } catch (e) {
      console.error('Fehler beim Laden der Projekte:', e);
    }
  },

  erstelleProjekt: (daten) => {
    const id = generiereId();
    const jetzt = new Date().toISOString();
    const neueProjekt: Project = {
      id,
      ...daten,
      status: 'entwurf',
      seiten: [],
      erstelltAm: jetzt,
      aktualisiertAm: jetzt,
    };
    const neueProjekte = [...get().projekte, neueProjekt];
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
    return id;
  },

  aktualisierteProjekt: (id, aenderungen) => {
    const neueProjekte = get().projekte.map(p =>
      p.id === id
        ? { ...p, ...aenderungen, aktualisiertAm: new Date().toISOString() }
        : p,
    );
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
  },

  loescheProjekt: (id) => {
    const neueProjekte = get().projekte.filter(p => p.id !== id);
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
  },

  fuegeSeiteHinzu: (projektId, label, anzeigename) => {
    const id = generiereId();
    const neueSeite: BausteinSeite = {
      id,
      projektId,
      label,
      anzeigename,
      fotos: [],
      messungen: [],
      messungStatus: 'fehlend',
      oeffnungen: [],
    };
    const neueProjekte = get().projekte.map(p => {
      if (p.id !== projektId) return p;
      return { ...p, seiten: [...p.seiten, neueSeite], aktualisiertAm: new Date().toISOString() };
    });
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
    return id;
  },

  aktualisiereMeSungsStatus: (projektId, seitenId) => {
    const projekt = get().projekte.find(p => p.id === projektId);
    if (!projekt) return;
    const seite = projekt.seiten.find(s => s.id === seitenId);
    if (!seite) return;

    const hatBreite = seite.messungen.some(m => m.typ === 'breite');
    const hatHoehe = seite.messungen.some(m => m.typ === 'hoehe');
    const hatAbstand = seite.messungen.some(m => m.typ === 'wandabstand');

    let status: BausteinSeite['messungStatus'] = 'fehlend';
    if (hatBreite && hatHoehe && hatAbstand) {
      status = 'vollstaendig';
    } else if (hatBreite || hatHoehe) {
      status = 'unvollstaendig';
    }

    const neueProjekte = aktualisiereSeiteInProjekt(get().projekte, projektId, seitenId, s => ({ ...s, messungStatus: status }));
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
  },

  fuegeAnnotationHinzu: (projektId, seitenId, fotoId, annotation) => {
    const neueProjekte = aktualisiereSeiteInProjekt(get().projekte, projektId, seitenId, seite => ({
      ...seite,
      fotos: seite.fotos.map(f => {
        if (f.id !== fotoId) return f;
        return { ...f, annotationen: [...f.annotationen, annotation] };
      }),
    }));
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
  },

  aktualisiereAnnotation: (projektId, seitenId, fotoId, annotation) => {
    const neueProjekte = aktualisiereSeiteInProjekt(get().projekte, projektId, seitenId, seite => ({
      ...seite,
      fotos: seite.fotos.map(f => {
        if (f.id !== fotoId) return f;
        return { ...f, annotationen: f.annotationen.map(a => a.id === annotation.id ? annotation : a) };
      }),
    }));
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
  },

  loescheAnnotation: (projektId, seitenId, fotoId, annotationId) => {
    const neueProjekte = aktualisiereSeiteInProjekt(get().projekte, projektId, seitenId, seite => ({
      ...seite,
      fotos: seite.fotos.map(f => {
        if (f.id !== fotoId) return f;
        return { ...f, annotationen: f.annotationen.filter(a => a.id !== annotationId) };
      }),
    }));
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
  },

  fuegeFotoHinzu: (projektId, seitenId, fotoDaten) => {
    const id = generiereId();
    const neuesFoto: Foto = {
      id,
      seitenId,
      annotationen: [],
      ...fotoDaten,
    };
    const neueProjekte = aktualisiereSeiteInProjekt(get().projekte, projektId, seitenId, seite => ({
      ...seite,
      fotos: [...seite.fotos, neuesFoto],
    }));
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
    return id;
  },

  fuegeMessungHinzu: (projektId, seitenId, messungDaten) => {
    const id = generiereId();
    const neueMessung: Messung = { id, seitenId, ...messungDaten };
    const neueProjekte = aktualisiereSeiteInProjekt(get().projekte, projektId, seitenId, seite => ({
      ...seite,
      messungen: [...seite.messungen.filter(m => m.typ !== messungDaten.typ), neueMessung],
    }));
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
    get().aktualisiereMeSungsStatus(projektId, seitenId);
  },

  aktualisiereMessung: (projektId, seitenId, messung) => {
    const neueProjekte = aktualisiereSeiteInProjekt(get().projekte, projektId, seitenId, seite => ({
      ...seite,
      messungen: seite.messungen.map(m => m.id === messung.id ? messung : m),
    }));
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
  },

  fuegeOeffnungHinzu: (projektId, seitenId, oeffnungDaten) => {
    const id = generiereId();
    const neueOeffnung: Oeffnung = { id, ...oeffnungDaten };
    const neueProjekte = aktualisiereSeiteInProjekt(get().projekte, projektId, seitenId, seite => ({
      ...seite,
      oeffnungen: [...seite.oeffnungen, neueOeffnung],
    }));
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
  },

  setzePlan: (plan, materialien) => {
    set({ aktiverPlan: plan, aktiveMaterialien: materialien });
  },
}));
