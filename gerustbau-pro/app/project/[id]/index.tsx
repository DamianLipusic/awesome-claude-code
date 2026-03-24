import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Card, Button, Chip, ProgressBar, TextInput, IconButton, Divider } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { useProjektStore } from '../../../src/store/projectStore';
import { useIapStore, FREE_PROJEKT_LIMIT } from '../../../src/store/iapStore';
import NaechsterSchrittBanner from '../../../src/components/NaechsterSchrittBanner';
import type { BausteinSeite } from '../../../src/models/Project';

const SEITEN_LABELS = ['Nord', 'Süd', 'Ost', 'West', 'Seite A', 'Seite B', 'Seite C', 'Seite D'];
const SEITEN_WERTE = ['nord', 'sued', 'ost', 'west', 'seite-a', 'seite-b', 'seite-c', 'seite-d'] as const;

const STATUS_FARBE: Record<BausteinSeite['messungStatus'], string> = {
  fehlend: '#D32F2F',
  unvollstaendig: '#F57F17',
  vollstaendig: '#2E7D32',
};
const STATUS_TEXT: Record<BausteinSeite['messungStatus'], string> = {
  fehlend: 'Noch ausstehend',
  unvollstaendig: 'Unvollständig',
  vollstaendig: 'Vollständig ✓',
};

function SchrittZeile({
  nummer,
  label,
  hinweis,
  erledigt,
  onPress,
}: {
  nummer: number;
  label: string;
  hinweis: string;
  erledigt: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      mode={erledigt ? 'outlined' : 'contained'}
      onPress={onPress}
      style={[styles.schrittButton, erledigt && styles.schrittButtonErledigt]}
      contentStyle={styles.schrittButtonInhalt}
      labelStyle={styles.schrittButtonLabel}
      icon={erledigt ? 'check-circle' : 'circle-outline'}
    >
      {`${nummer}. ${label}`}
    </Button>
  );
}

function SeitenKarte({ seite, projektId }: { seite: BausteinSeite; projektId: string }) {
  const hatFotos = seite.fotos.length > 0;
  const hatMasse = seite.messungen.length > 0;
  const vollstaendig = seite.messungStatus === 'vollstaendig';

  return (
    <Card style={styles.seitenKarte}>
      <Card.Content>
        {/* Header row */}
        <View style={styles.seitenKopf}>
          <Text variant="titleMedium" style={styles.seitenName}>{seite.anzeigename}</Text>
          <Chip
            compact
            style={{ backgroundColor: STATUS_FARBE[seite.messungStatus] }}
            textStyle={{ color: 'white', fontSize: 12 }}
          >
            {STATUS_TEXT[seite.messungStatus]}
          </Chip>
        </View>

        {/* Step-by-step buttons */}
        <View style={styles.schritteListe}>
          <SchrittZeile
            nummer={1}
            label={hatFotos ? `Fotos (${seite.fotos.length})` : 'Fotos aufnehmen'}
            hinweis="Fotografieren Sie die Gebäudeseite"
            erledigt={hatFotos}
            onPress={() => router.push({ pathname: '/project/[id]/photos', params: { id: projektId, seitenId: seite.id } })}
          />
          <SchrittZeile
            nummer={2}
            label={hatMasse ? `Maße prüfen (${seite.messungen.length})` : 'Maße prüfen / eingeben'}
            hinweis="Länge, Höhe und Wandabstand erfassen"
            erledigt={hatMasse}
            onPress={() => router.push({ pathname: '/project/[id]/measurements', params: { id: projektId, seitenId: seite.id } })}
          />
          <SchrittZeile
            nummer={3}
            label={seite.oeffnungen.length > 0 ? `Öffnungen (${seite.oeffnungen.length})` : 'Öffnungen erfassen'}
            hinweis="Türen, Fenster und Tore eintragen"
            erledigt={seite.oeffnungen.length > 0}
            onPress={() => router.push({ pathname: '/project/[id]/openings', params: { id: projektId, seitenId: seite.id } })}
          />
        </View>
      </Card.Content>
    </Card>
  );
}

function berechneNaechstenSchritt(seiten: BausteinSeite[]) {
  if (seiten.length === 0) {
    return {
      icon: 'plus-circle',
      titel: 'Schritt 1 – Gebäudeseiten anlegen',
      beschreibung: 'Tippen Sie weiter unten auf „+ Seite hinzufügen" um die erste Gebäudeseite anzulegen (z.B. Nordseite).',
      schaltflaeche: 'Seite hinzufügen',
      farbe: '#1565C0',
      aktion: 'seite',
    };
  }
  const ohneFotos = seiten.filter(s => s.fotos.length === 0);
  if (ohneFotos.length > 0) {
    return {
      icon: 'camera',
      titel: 'Schritt 2 – Fotos aufnehmen',
      beschreibung: `${ohneFotos.length} Seite(n) haben noch keine Fotos. Tippen Sie auf Schritt 1 bei der Seite und nehmen Sie ein Foto auf.`,
      schaltflaeche: undefined,
      farbe: '#1565C0',
      aktion: null,
    };
  }
  const unvollstaendig = seiten.filter(s => s.messungStatus !== 'vollstaendig');
  if (unvollstaendig.length > 0) {
    return {
      icon: 'ruler',
      titel: 'Schritt 3 – Maße eintragen',
      beschreibung: `${unvollstaendig.length} Seite(n) haben noch keine vollständigen Maße. Tippen Sie auf „Maße prüfen" bei der jeweiligen Seite.`,
      schaltflaeche: undefined,
      farbe: '#F57F17',
      aktion: null,
    };
  }
  return {
    icon: 'check-circle',
    titel: 'Alle Maße erfasst – jetzt berechnen!',
    beschreibung: 'Alle Seiten sind vollständig. Tippen Sie auf „Materialliste berechnen" um die Teilliste zu erstellen.',
    schaltflaeche: 'Materialliste berechnen',
    farbe: '#2E7D32',
    aktion: 'materialien',
  };
}

export default function ProjektUebersicht() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projekt = useProjektStore(s => s.projekte.find(p => p.id === id));
  const projektAnzahl = useProjektStore(s => s.projekte.length);
  const fuegeSeiteHinzu = useProjektStore(s => s.fuegeSeiteHinzu);
  const loescheProjekt = useProjektStore(s => s.loescheProjekt);
  const aktualisierteProjekt = useProjektStore(s => s.aktualisierteProjekt);
  const dupliziereProjekt = useProjektStore(s => s.dupliziereProjekt);
  const istPremium = useIapStore(s => s.istPremium);
  const [notizen, setNotizen] = useState(projekt?.notizen ?? '');

  if (!projekt) {
    return (
      <View style={styles.fehler}>
        <Text>Projekt nicht gefunden.</Text>
      </View>
    );
  }

  const vollstaendig = projekt.seiten.filter(s => s.messungStatus === 'vollstaendig').length;
  const fortschritt = projekt.seiten.length > 0 ? vollstaendig / projekt.seiten.length : 0;
  const naechsterSchritt = berechneNaechstenSchritt(projekt.seiten);

  function projektLoeschen() {
    Alert.alert(
      'Projekt löschen',
      `„${projekt!.name}" wirklich löschen? Alle Fotos und Messungen gehen verloren.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => {
            loescheProjekt(id);
            router.replace('/');
          },
        },
      ],
    );
  }

  function neueSeite() {
    const naechsteIndex = projekt!.seiten.length;
    if (naechsteIndex >= SEITEN_WERTE.length) {
      Alert.alert('Maximale Anzahl', 'Es können maximal 8 Seiten erfasst werden.');
      return;
    }
    fuegeSeiteHinzu(id, SEITEN_WERTE[naechsteIndex], SEITEN_LABELS[naechsteIndex]);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.inhalt}>
        {/* Project header card */}
        <Card style={styles.kopfKarte}>
          <Card.Content>
            <View style={styles.kopfZeile}>
              <Text variant="titleLarge" style={styles.projektName}>{projekt.name}</Text>
              <IconButton
                icon="pencil"
                size={22}
                onPress={() => router.push(`/project/${id}/edit`)}
                style={styles.editButton}
              />
            </View>
            {projekt.adresse && <Text variant="bodyMedium" style={styles.adresse}>{projekt.adresse}</Text>}
            {projekt.auftraggeber && <Text variant="bodySmall" style={styles.auftraggeber}>Auftraggeber: {projekt.auftraggeber}</Text>}
            {projekt.termin && (() => {
              const heute = new Date(); heute.setHours(0,0,0,0);
              const t = new Date(projekt.termin + 'T00:00:00');
              const tage = Math.round((t.getTime() - heute.getTime()) / 86400000);
              const farbe = tage < 0 ? '#B71C1C' : tage <= 3 ? '#E65100' : tage <= 7 ? '#F57F17' : '#2E7D32';
              const terminLabel = tage < 0 ? `${Math.abs(tage)} Tage überfällig` : tage === 0 ? 'Termin heute!' : `Termin in ${tage} Tagen`;
              return (
                <View style={[styles.terminBanner, { backgroundColor: farbe }]}>
                  <Text style={styles.terminBannerText}>
                    📅 {t.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} – {terminLabel}
                  </Text>
                </View>
              );
            })()}
            <View style={styles.infoChips}>
              <Chip compact icon="cog" style={styles.infoChip}>{projekt.systemId.replace('-', ' ')}</Chip>
              <Chip compact icon="arrow-expand-up" style={styles.infoChip}>{projekt.gesamthoehe} m</Chip>
              <Chip compact icon="layers" style={styles.infoChip}>{projekt.etagen} Etagen</Chip>
            </View>
            {projekt.seiten.length > 0 && (
              <>
                <View style={styles.fortschrittRow}>
                  <Text variant="bodyMedium">{vollstaendig} von {projekt.seiten.length} Seiten vollständig</Text>
                  <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>{Math.round(fortschritt * 100)} %</Text>
                </View>
                <ProgressBar progress={fortschritt} color="#2E7D32" style={styles.fortschritt} />
              </>
            )}
          </Card.Content>
        </Card>

        {/* Guided next step */}
        <NaechsterSchrittBanner
          icon={naechsterSchritt.icon}
          titel={naechsterSchritt.titel}
          beschreibung={naechsterSchritt.beschreibung}
          schaltflaeche={naechsterSchritt.schaltflaeche}
          farbe={naechsterSchritt.farbe}
          onPress={naechsterSchritt.aktion === 'seite' ? neueSeite
            : naechsterSchritt.aktion === 'materialien' ? () => router.push(`/project/${id}/materials`)
            : undefined}
        />

        {/* Building sides */}
        <Text variant="titleMedium" style={styles.abschnittTitel}>Gebäudeseiten</Text>
        {projekt.seiten.map(seite => (
          <SeitenKarte key={seite.id} seite={seite} projektId={id} />
        ))}

        <Button
          mode="outlined"
          icon="plus"
          onPress={neueSeite}
          style={styles.seiteHinzufuegenButton}
          contentStyle={styles.seiteHinzufuegenInhalt}
          labelStyle={{ fontSize: 15 }}
          disabled={projekt.seiten.length >= SEITEN_WERTE.length}
        >
          + Seite hinzufügen
        </Button>

        {/* Notes */}
        <Text variant="titleMedium" style={styles.abschnittTitel}>Notizen</Text>
        <TextInput
          value={notizen}
          onChangeText={setNotizen}
          onBlur={() => aktualisierteProjekt(id, { notizen: notizen.trim() || undefined })}
          mode="outlined"
          multiline
          numberOfLines={3}
          style={styles.notizenFeld}
          placeholder="Besonderheiten, Auflagen, Hinweise..."
        />

        {/* Checklist */}
        <Text variant="titleMedium" style={styles.abschnittTitel}>Abnahme & Sicherheit</Text>
        {(() => {
          const punkte = projekt.pruefpunkte ?? [];
          const erledigt = punkte.filter(p => p.erledigt).length;
          const alleOk = punkte.length > 0 && erledigt === punkte.length;
          return (
            <Button
              mode={alleOk ? 'outlined' : 'contained-tonal'}
              icon={alleOk ? 'checkbox-marked-circle' : 'clipboard-check-outline'}
              onPress={() => router.push(`/project/${id}/checklist`)}
              style={[styles.auswertungButton, alleOk && { borderColor: '#2E7D32' }]}
              contentStyle={styles.auswertungButtonInhalt}
              labelStyle={{ fontSize: 16 }}
            >
              {punkte.length > 0
                ? `Abnahme-Checkliste (${erledigt}/${punkte.length} ✓)`
                : 'Abnahme-Checkliste öffnen'}
            </Button>
          );
        })()}

        {/* Time tracking — always visible */}
        <Text variant="titleMedium" style={styles.abschnittTitel}>Zeiterfassung</Text>
        {(() => {
          const stunden = (projekt.zeiteintraege ?? []).reduce((s, e) => s + e.stunden, 0);
          const eintraege = (projekt.zeiteintraege ?? []).length;
          return (
            <Button
              mode="contained-tonal"
              icon="clock-outline"
              onPress={() => router.push(`/project/${id}/time`)}
              style={styles.auswertungButton}
              contentStyle={styles.auswertungButtonInhalt}
              labelStyle={{ fontSize: 16 }}
            >
              {eintraege > 0
                ? `Arbeitsstunden (${stunden % 1 === 0 ? stunden : stunden.toFixed(1)} Std., ${eintraege} Einträge)`
                : 'Arbeitsstunden erfassen'}
            </Button>
          );
        })()}

        {/* Evaluation buttons — only when sides exist */}
        {projekt.seiten.length > 0 && (
          <>
            <Text variant="titleMedium" style={styles.abschnittTitel}>Auswertung</Text>
            <Button
              mode="contained"
              icon="calculator"
              onPress={() => router.push(`/project/${id}/materials`)}
              style={styles.auswertungButton}
              contentStyle={styles.auswertungButtonInhalt}
              labelStyle={{ fontSize: 16 }}
            >
              Materialliste berechnen
            </Button>
            <Button
              mode="contained-tonal"
              icon="floor-plan"
              onPress={() => router.push(`/project/${id}/plan`)}
              style={styles.auswertungButton}
              contentStyle={styles.auswertungButtonInhalt}
              labelStyle={{ fontSize: 16 }}
            >
              Gerüstplan ansehen
            </Button>
            <Button
              mode="contained-tonal"
              icon="currency-eur"
              onPress={() => router.push(`/project/${id}/costs`)}
              style={styles.auswertungButton}
              contentStyle={styles.auswertungButtonInhalt}
              labelStyle={{ fontSize: 16 }}
            >
              Kostenschätzung
            </Button>
            <Button
              mode="contained-tonal"
              icon="file-sign"
              onPress={() => router.push(`/project/${id}/quote`)}
              style={styles.auswertungButton}
              contentStyle={styles.auswertungButtonInhalt}
              labelStyle={{ fontSize: 16 }}
            >
              Angebot erstellen
            </Button>
            <Button
              mode="contained-tonal"
              icon="file-pdf-box"
              onPress={() => router.push(`/project/${id}/export`)}
              style={styles.auswertungButton}
              contentStyle={styles.auswertungButtonInhalt}
              labelStyle={{ fontSize: 16 }}
            >
              PDF exportieren
            </Button>
          </>
        )}

        <Divider style={styles.divider} />

        <Button
          mode="outlined"
          icon="content-copy"
          onPress={() => {
            if (!istPremium && projektAnzahl >= FREE_PROJEKT_LIMIT) {
              router.push('/paywall');
              return;
            }
            const neueId = dupliziereProjekt(id);
            if (neueId) router.replace(`/project/${neueId}`);
          }}
          style={styles.verwaltungsButton}
          contentStyle={styles.verwaltungsButtonInhalt}
        >
          Projekt duplizieren
        </Button>

        <Button
          mode="outlined"
          icon="delete"
          onPress={projektLoeschen}
          style={[styles.verwaltungsButton, styles.loeschenButton]}
          contentStyle={styles.verwaltungsButtonInhalt}
          textColor="#D32F2F"
        >
          Projekt löschen
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  inhalt: { padding: 16, paddingBottom: 60 },
  fehler: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  kopfKarte: { marginBottom: 4, elevation: 2 },
  kopfZeile: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  projektName: { fontWeight: 'bold', flex: 1, fontSize: 18 },
  editButton: { margin: 0, marginLeft: 'auto' },
  adresse: { color: '#555', marginBottom: 2 },
  auftraggeber: { color: '#888', marginBottom: 6 },
  terminBanner: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8 },
  terminBannerText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  infoChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  infoChip: { backgroundColor: '#E3F2FD' },
  fortschrittRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  fortschritt: { height: 10, borderRadius: 5 },

  abschnittTitel: { fontWeight: 'bold', marginTop: 4, marginBottom: 8, color: '#1565C0', fontSize: 16 },

  seitenKarte: { marginBottom: 12, elevation: 2 },
  seitenKopf: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seitenName: { fontWeight: 'bold', fontSize: 16 },
  schritteListe: { gap: 8 },
  schrittButton: { borderRadius: 8 },
  schrittButtonErledigt: { borderColor: '#2E7D32' },
  schrittButtonInhalt: { height: 48, justifyContent: 'flex-start', paddingLeft: 4 },
  schrittButtonLabel: { fontSize: 14, textAlign: 'left' },

  seiteHinzufuegenButton: { marginTop: 4, marginBottom: 8, borderStyle: 'dashed', borderColor: '#1565C0' },
  seiteHinzufuegenInhalt: { height: 52 },

  notizenFeld: { marginBottom: 8, backgroundColor: 'white' },

  auswertungButton: { marginBottom: 10 },
  auswertungButtonInhalt: { height: 52 },

  divider: { marginVertical: 20 },
  verwaltungsButton: { marginBottom: 10 },
  verwaltungsButtonInhalt: { height: 48 },
  loeschenButton: { borderColor: '#D32F2F' },
});
