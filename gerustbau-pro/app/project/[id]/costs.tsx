import { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import {
  Text, Card, Button, TextInput, Divider,
  ActivityIndicator, Snackbar, Chip,
} from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { useProjektStore } from '../../../src/store/projectStore';
import { useCostsStore } from '../../../src/store/costsStore';
import { berechneMaterialien } from '../../../src/algorithms/materialCalculator';
import { getSystem } from '../../../src/data/systems';
import type { KomponentenKategorie } from '../../../src/data/systems';
import type { MaterialPosition } from '../../../src/models/Project';

const KATEGORIE_LABELS: Record<KomponentenKategorie, string> = {
  rahmen: 'Rahmen',
  riegel: 'Riegel',
  diagonale: 'Diagonalen',
  belag: 'Beläge',
  gelaender: 'Geländer',
  bordbrett: 'Bordbretter',
  fussplatte: 'Fußplatten',
  spindel: 'Spindeln',
  anker: 'Verankerung',
  treppe: 'Treppen',
  rohr: 'Rohre',
  kupplung: 'Kupplungen',
  sonstiges: 'Sonstiges',
};

function formatiereEUR(wert: number): string {
  return wert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

interface KostenZeile {
  pos: MaterialPosition;
  komponenteId: string;
  name: string;
  artikelNummer?: string;
  kategorie: KomponentenKategorie;
  menge: number;
  einheit: string;
  preisProEinheit: number;
  gesamt: number;
}

export default function KostenScreen() {
  const { id: projektId } = useLocalSearchParams<{ id: string }>();
  const projekt = useProjektStore(s => s.projekte.find(p => p.id === projektId));
  const aktiverPlan = useProjektStore(s => s.aktiverPlan);
  const aktiveMaterialien = useProjektStore(s => s.aktiveMaterialien);

  const { preise, setzePreis, ladePreise, speicherePreise } = useCostsStore();

  const [materialien, setMaterialien] = useState<MaterialPosition[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [gespeichert, setGespeichert] = useState(false);
  // local edits: komponenteId → string (raw input)
  const [preisEingaben, setPreisEingaben] = useState<Record<string, string>>({});

  useEffect(() => {
    ladePreise();
  }, []);

  useEffect(() => {
    if (!projekt) return;
    setLaedt(true);
    try {
      let mat = aktiveMaterialien;
      if (!mat || mat.length === 0) {
        const ergebnis = berechneMaterialien({
          seiten: projekt.seiten,
          systemId: projekt.systemId,
          arbeitshoehe: projekt.arbeitshoehe,
        });
        mat = ergebnis.materialien;
      }
      setMaterialien(mat);
    } finally {
      setLaedt(false);
    }
  }, [projekt, aktiveMaterialien]);

  // Sync local edit inputs with store whenever preise or materialien change
  useEffect(() => {
    if (materialien.length === 0) return;
    const inputs: Record<string, string> = {};
    for (const pos of materialien) {
      const p = preise[pos.komponenteId];
      inputs[pos.komponenteId] = p !== undefined ? String(p).replace('.', ',') : '';
    }
    setPreisEingaben(inputs);
  }, [materialien, preise]);

  function onPreisChange(komponenteId: string, text: string) {
    setPreisEingaben(prev => ({ ...prev, [komponenteId]: text }));
  }

  function onPreisBlur(komponenteId: string) {
    const raw = preisEingaben[komponenteId] ?? '';
    const num = parseFloat(raw.replace(',', '.'));
    if (!isNaN(num) && num >= 0) {
      setzePreis(komponenteId, num);
    } else if (raw === '' || raw === '0') {
      setzePreis(komponenteId, 0);
    }
  }

  async function allesSpeichern() {
    // Flush all inputs first
    for (const [kid, raw] of Object.entries(preisEingaben)) {
      const num = parseFloat(raw.replace(',', '.'));
      if (!isNaN(num) && num >= 0) setzePreis(kid, num);
    }
    await speicherePreise();
    setGespeichert(true);
  }

  if (!projekt) return null;

  if (laedt) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
        <Text variant="bodyMedium" style={styles.loaderText}>Materialien werden berechnet…</Text>
      </View>
    );
  }

  const system = getSystem(projekt.systemId);

  // Build zeilen with cost calculation
  const zeilen: KostenZeile[] = materialien.map(pos => {
    const komp = system.komponenten.find(k => k.id === pos.komponenteId);
    const menge = pos.mengeManuell ?? pos.menge;
    const preis = preise[pos.komponenteId] ?? 0;
    return {
      pos,
      komponenteId: pos.komponenteId,
      name: komp?.name ?? pos.komponenteId,
      artikelNummer: komp?.artikelNummer,
      kategorie: (komp?.kategorie ?? 'sonstiges') as KomponentenKategorie,
      menge,
      einheit: pos.einheit,
      preisProEinheit: preis,
      gesamt: preis * menge,
    };
  });

  // Group by category
  const gruppen: Record<string, KostenZeile[]> = {};
  for (const z of zeilen) {
    if (!gruppen[z.kategorie]) gruppen[z.kategorie] = [];
    gruppen[z.kategorie].push(z);
  }

  const gesamtkosten = zeilen.reduce((s, z) => s + z.gesamt, 0);
  const positionenMitPreis = zeilen.filter(z => z.preisProEinheit > 0).length;
  const vollstaendig = positionenMitPreis === zeilen.length;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.inhalt}>

        {/* Summary card */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.summaryLabel}>Kostenübersicht</Text>
            <Text variant="displaySmall" style={styles.gesamtPreis}>
              {formatiereEUR(gesamtkosten)}
            </Text>
            <View style={styles.summaryRow}>
              <Chip compact icon={vollstaendig ? 'check-circle' : 'alert-circle'}
                style={{ backgroundColor: vollstaendig ? '#E8F5E9' : '#FFF8E1' }}
                textStyle={{ fontSize: 12 }}>
                {positionenMitPreis} / {zeilen.length} Positionen bepreist
              </Chip>
              <Text variant="bodySmall" style={styles.hinweis}>zzgl. MwSt.</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Hint */}
        <Text variant="bodySmall" style={styles.tipp}>
          Tragen Sie Ihre Einkaufs- oder Mietpreise pro Einheit ein. Die Preise werden gespeichert
          und für alle künftigen Projekte mit demselben System vorgeschlagen.
        </Text>

        {/* Per-category tables */}
        {Object.entries(gruppen).map(([kat, gruppenZeilen]) => {
          const gruppenSumme = gruppenZeilen.reduce((s, z) => s + z.gesamt, 0);
          return (
            <View key={kat}>
              <View style={styles.kategorieKopf}>
                <Text variant="titleSmall" style={styles.kategorieLabel}>
                  {KATEGORIE_LABELS[kat as KomponentenKategorie] ?? kat}
                </Text>
                <Text variant="titleSmall" style={styles.kategorieSum}>
                  {formatiereEUR(gruppenSumme)}
                </Text>
              </View>
              {gruppenZeilen.map(z => (
                <Card key={z.komponenteId} style={styles.posCard}>
                  <Card.Content style={styles.posRow}>
                    <View style={styles.posInfo}>
                      <Text variant="bodyMedium" style={styles.posName} numberOfLines={2}>
                        {z.name}
                      </Text>
                      {z.artikelNummer && (
                        <Text variant="bodySmall" style={styles.posArt}>Art-Nr: {z.artikelNummer}</Text>
                      )}
                      <Text variant="bodySmall" style={styles.posMenge}>
                        {z.menge % 1 === 0 ? z.menge.toString() : z.menge.toFixed(1)} {z.einheit}
                      </Text>
                    </View>
                    <View style={styles.posPreise}>
                      <TextInput
                        label="€/Einh."
                        value={preisEingaben[z.komponenteId] ?? ''}
                        onChangeText={t => onPreisChange(z.komponenteId, t)}
                        onBlur={() => onPreisBlur(z.komponenteId)}
                        mode="outlined"
                        keyboardType="decimal-pad"
                        style={styles.preisInput}
                        dense
                        placeholder="0,00"
                        right={<TextInput.Affix text="€" />}
                      />
                      {z.gesamt > 0 && (
                        <Text variant="bodySmall" style={styles.posGesamt}>
                          = {formatiereEUR(z.gesamt)}
                        </Text>
                      )}
                    </View>
                  </Card.Content>
                </Card>
              ))}
              <Divider style={styles.divider} />
            </View>
          );
        })}

        {/* Totals summary */}
        <Card style={styles.totalCard}>
          <Card.Content>
            <View style={styles.totalRow}>
              <Text variant="bodyLarge">Netto-Gesamtkosten</Text>
              <Text variant="bodyLarge" style={styles.totalWert}>{formatiereEUR(gesamtkosten)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text variant="bodyMedium" style={styles.grau}>MwSt. 19 %</Text>
              <Text variant="bodyMedium" style={styles.grau}>{formatiereEUR(gesamtkosten * 0.19)}</Text>
            </View>
            <Divider style={{ marginVertical: 6 }} />
            <View style={styles.totalRow}>
              <Text variant="titleMedium" style={styles.brutto}>Brutto-Gesamtkosten</Text>
              <Text variant="titleMedium" style={styles.brutto}>{formatiereEUR(gesamtkosten * 1.19)}</Text>
            </View>
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          icon="content-save"
          onPress={allesSpeichern}
          style={styles.saveButton}
          contentStyle={styles.saveButtonInhalt}
        >
          Preise speichern
        </Button>

        <Text variant="bodySmall" style={[styles.hinweis, { textAlign: 'center', marginBottom: 32 }]}>
          Alle Angaben sind unverbindliche Schätzwerte. Preise werden lokal auf diesem Gerät gespeichert.
        </Text>
      </ScrollView>

      <Snackbar visible={gespeichert} onDismiss={() => setGespeichert(false)} duration={2000}>
        Preise gespeichert ✓
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  inhalt: { padding: 14, paddingBottom: 40 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText: { color: '#666' },

  summaryCard: { marginBottom: 14, elevation: 3, backgroundColor: '#1565C0' },
  summaryLabel: { color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  gesamtPreis: { color: 'white', fontWeight: 'bold', marginBottom: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  tipp: { color: '#888', marginBottom: 16, lineHeight: 18 },

  kategorieKopf: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, paddingHorizontal: 4, marginTop: 8,
  },
  kategorieLabel: { fontWeight: 'bold', color: '#1565C0' },
  kategorieSum: { color: '#1565C0', fontWeight: 'bold' },

  posCard: { marginBottom: 6, elevation: 1 },
  posRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4 },
  posInfo: { flex: 1, paddingRight: 8 },
  posName: { fontWeight: '500', fontSize: 13 },
  posArt: { color: '#999', fontSize: 11 },
  posMenge: { color: '#666', fontSize: 12, marginTop: 2 },
  posPreise: { alignItems: 'flex-end', minWidth: 110 },
  preisInput: { width: 110, backgroundColor: 'white', fontSize: 13 },
  posGesamt: { color: '#2E7D32', fontWeight: 'bold', marginTop: 4 },

  divider: { marginVertical: 8 },

  totalCard: { marginTop: 8, marginBottom: 16, elevation: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalWert: { fontWeight: '500' },
  grau: { color: '#888' },
  brutto: { fontWeight: 'bold', color: '#1565C0' },

  saveButton: { backgroundColor: '#2E7D32', marginBottom: 12 },
  saveButtonInhalt: { height: 52 },

  hinweis: { color: '#888', fontSize: 11 },
});
