import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
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
  ZeitEintrag,
  PruefPunkt,
} from '../models/Project';
import { erstelleStandardPruefpunkte } from '../data/checklistData';
import { generiereId } from '../utils/formatters';
import { scheduleTerminNotifications, cancelTerminNotifications } from '../utils/notifications';

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
  loescheFoto: (projektId: string, seitenId: string, fotoId: string) => void;

  fuegeMessungHinzu: (projektId: string, seitenId: string, messung: Omit<Messung, 'id' | 'seitenId'>) => void;
  aktualisiereMessung: (projektId: string, seitenId: string, messung: Messung) => void;

  fuegeOeffnungHinzu: (projektId: string, seitenId: string, oeffnung: Omit<Oeffnung, 'id'>) => void;
  loescheOeffnung: (projektId: string, seitenId: string, oeffnungId: string) => void;

  setzePlan: (plan: GeruestPlan, materialien: MaterialPosition[]) => void;
  aktualisiereMaterieMenge: (positionId: string, mengeManuell: number | undefined) => void;
  dupliziereProjekt: (id: string) => string;

  fuegeZeitEintragHinzu: (projektId: string, eintrag: Omit<ZeitEintrag, 'id'>) => void;
  loescheZeitEintrag: (projektId: string, eintragId: string) => void;

  initialisierePruefpunkte: (projektId: string) => void;
  aktualisierePruefpunkt: (projektId: string, punktId: string, erledigt: boolean, bemerkung?: string) => void;

  exportiereAlsJson: () => string;
  importiereAusJson: (json: string) => { erfolg: boolean; anzahl: number; fehler?: string };
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
    // Reschedule deadline notifications when termin changes
    if ('termin' in aenderungen) {
      const aktualisiert = neueProjekte.find(p => p.id === id);
      if (aktualisiert) {
        scheduleTerminNotifications(id, aktualisiert.name, aenderungen.termin ?? null).catch(console.error);
      }
    }
  },

  loescheProjekt: (id) => {
    const projekt = get().projekte.find(p => p.id === id);
    if (projekt) {
      for (const seite of projekt.seiten) {
        for (const foto of seite.fotos) {
          if (foto.localUri) {
            FileSystem.deleteAsync(foto.localUri, { idempotent: true }).catch(console.error);
          }
        }
      }
      cancelTerminNotifications(id).catch(console.error);
    }
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
      // Transition entwurf → aufnahme when first side is added
      const neuerStatus = p.status === 'entwurf' ? 'aufnahme' : p.status;
      return { ...p, seiten: [...p.seiten, neueSeite], status: neuerStatus, aktualisiertAm: new Date().toISOString() };
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

    let neueProjekte = aktualisiereSeiteInProjekt(get().projekte, projektId, seitenId, s => ({ ...s, messungStatus: status }));

    // Transition aufnahme → berechnung when all sides are complete
    neueProjekte = neueProjekte.map(p => {
      if (p.id !== projektId) return p;
      if (p.status !== 'aufnahme') return p;
      const alleVollstaendig = p.seiten.length > 0 && p.seiten.every(s => s.messungStatus === 'vollstaendig');
      return alleVollstaendig ? { ...p, status: 'berechnung' } : p;
    });

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

  loescheFoto: (projektId, seitenId, fotoId) => {
    const projekt = get().projekte.find(p => p.id === projektId);
    const seite = projekt?.seiten.find(s => s.id === seitenId);
    const foto = seite?.fotos.find(f => f.id === fotoId);
    if (foto?.localUri) {
      FileSystem.deleteAsync(foto.localUri, { idempotent: true }).catch(console.error);
    }
    const neueProjekte = aktualisiereSeiteInProjekt(get().projekte, projektId, seitenId, seite => ({
      ...seite,
      fotos: seite.fotos.filter(f => f.id !== fotoId),
    }));
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
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

  loescheOeffnung: (projektId, seitenId, oeffnungId) => {
    const neueProjekte = aktualisiereSeiteInProjekt(get().projekte, projektId, seitenId, seite => ({
      ...seite,
      oeffnungen: seite.oeffnungen.filter(o => o.id !== oeffnungId),
    }));
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
  },

  setzePlan: (plan, materialien) => {
    set({ aktiverPlan: plan, aktiveMaterialien: materialien });
    // Transition berechnung → fertig when plan is set
    const neueProjekte = get().projekte.map(p => {
      if (p.id !== plan.projektId) return p;
      if (p.status !== 'berechnung') return p;
      return { ...p, status: 'fertig' as const, aktualisiertAm: new Date().toISOString() };
    });
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
  },

  aktualisiereMaterieMenge: (positionId, mengeManuell) => {
    set(state => ({
      aktiveMaterialien: state.aktiveMaterialien.map(pos =>
        pos.id === positionId ? { ...pos, mengeManuell } : pos,
      ),
    }));
  },

  fuegeZeitEintragHinzu: (projektId, eintragDaten) => {
    const id = generiereId();
    const neuerEintrag: ZeitEintrag = { id, ...eintragDaten };
    const neueProjekte = get().projekte.map(p => {
      if (p.id !== projektId) return p;
      return {
        ...p,
        zeiteintraege: [...(p.zeiteintraege ?? []), neuerEintrag],
        aktualisiertAm: new Date().toISOString(),
      };
    });
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
  },

  loescheZeitEintrag: (projektId, eintragId) => {
    const neueProjekte = get().projekte.map(p => {
      if (p.id !== projektId) return p;
      return {
        ...p,
        zeiteintraege: (p.zeiteintraege ?? []).filter(e => e.id !== eintragId),
        aktualisiertAm: new Date().toISOString(),
      };
    });
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
  },

  initialisierePruefpunkte: (projektId) => {
    const projekt = get().projekte.find(p => p.id === projektId);
    if (!projekt) return;
    // Only initialise if not yet present
    if (projekt.pruefpunkte && projekt.pruefpunkte.length > 0) return;
    const neueProjekte = get().projekte.map(p => {
      if (p.id !== projektId) return p;
      return { ...p, pruefpunkte: erstelleStandardPruefpunkte(), aktualisiertAm: new Date().toISOString() };
    });
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
  },

  aktualisierePruefpunkt: (projektId, punktId, erledigt, bemerkung) => {
    const jetzt = new Date().toISOString();
    const neueProjekte = get().projekte.map(p => {
      if (p.id !== projektId) return p;
      return {
        ...p,
        pruefpunkte: (p.pruefpunkte ?? []).map(pp =>
          pp.id === punktId
            ? { ...pp, erledigt, erledigtAm: erledigt ? jetzt.slice(0, 10) : undefined, bemerkung: bemerkung ?? pp.bemerkung }
            : pp,
        ),
        aktualisiertAm: jetzt,
      };
    });
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
  },

  exportiereAlsJson: () => {
    return JSON.stringify({ version: 1, exportiertAm: new Date().toISOString(), projekte: get().projekte }, null, 2);
  },

  importiereAusJson: (json) => {
    try {
      const daten = JSON.parse(json);
      if (!daten.projekte || !Array.isArray(daten.projekte)) {
        return { erfolg: false, anzahl: 0, fehler: 'Ungültiges Format: "projekte" Array fehlt.' };
      }
      const vorhandeneIds = new Set(get().projekte.map(p => p.id));
      const neueProjekte: Project[] = daten.projekte.filter((p: Project) => {
        return p.id && p.name && p.systemId && p.status;
      });
      const wirklichNeu = neueProjekte.filter(p => !vorhandeneIds.has(p.id));
      const alleKombiniert = [...get().projekte, ...wirklichNeu];
      set({ projekte: alleKombiniert });
      speichereProjekte(alleKombiniert);
      return { erfolg: true, anzahl: wirklichNeu.length };
    } catch (e) {
      return { erfolg: false, anzahl: 0, fehler: 'JSON konnte nicht gelesen werden.' };
    }
  },

  dupliziereProjekt: (id) => {
    const vorlage = get().projekte.find(p => p.id === id);
    if (!vorlage) return '';
    const neueId = generiereId();
    const jetzt = new Date().toISOString();
    const kopie: Project = {
      ...vorlage,
      id: neueId,
      name: vorlage.name + ' – Kopie',
      status: 'entwurf',
      seiten: [],
      erstelltAm: jetzt,
      aktualisiertAm: jetzt,
      // Do not carry over work logs, checklist state, or deadline
      zeiteintraege: [],
      pruefpunkte: undefined,
      termin: undefined,
    };
    const neueProjekte = [...get().projekte, kopie];
    set({ projekte: neueProjekte });
    speichereProjekte(neueProjekte);
    return neueId;
  },
}));
