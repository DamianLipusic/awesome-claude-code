import { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Button, ActivityIndicator, Divider } from 'react-native-paper';
import { router } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useIapStore } from '../src/store/iapStore';

const FEATURES = [
  { icon: 'folder-multiple', text: 'Unbegrenzte Projekte' },
  { icon: 'file-pdf-box', text: 'PDF-Export (Plan, Materialliste, Zeitprotokoll, Angebot)' },
  { icon: 'calculator-variant', text: 'Automatische Materialberechnung für alle Systeme' },
  { icon: 'camera', text: 'Foto-Annotation mit Maßeingabe' },
  { icon: 'clipboard-check', text: 'Abnahme-Checkliste (DGUV R 100-001)' },
  { icon: 'clock-outline', text: 'Zeiterfassung pro Projekt' },
  { icon: 'currency-eur', text: 'Kostenschätzung & Angebotserstellung' },
  { icon: 'cloud-off', text: '100 % offline — keine Cloud benötigt' },
];

type Tarif = 'monatlich' | 'jaehrlich';

const PAKET_IDS: Record<Tarif, string> = {
  monatlich: '$rc_monthly',
  jaehrlich: '$rc_annual',
};

export default function PaywallScreen() {
  const [gewaehlterTarif, setGewaehlterTarif] = useState<Tarif>('jaehrlich');
  const [kaufLaeuft, setKaufLaeuft] = useState(false);
  const [wiederherstellungLaeuft, setWiederherstellungLaeuft] = useState(false);

  const { angebote, kaufen, kaeufeWiederherstellen } = useIapStore();

  const angebotMonatlich = angebote?.current?.availablePackages.find(
    p => p.identifier === PAKET_IDS.monatlich,
  );
  const angebotJaehrlich = angebote?.current?.availablePackages.find(
    p => p.identifier === PAKET_IDS.jaehrlich,
  );

  const preisMonatlich = angebotMonatlich?.product.priceString ?? '€9,99';
  const preisJaehrlich = angebotJaehrlich?.product.priceString ?? '€79,99';

  async function onKaufen() {
    setKaufLaeuft(true);
    const paketId = PAKET_IDS[gewaehlterTarif];
    const { erfolg, fehler } = await kaufen(paketId);
    setKaufLaeuft(false);

    if (erfolg) {
      Alert.alert(
        'Willkommen bei Gerüstbau Pro!',
        'Ihr Abonnement ist aktiv. Alle Funktionen sind jetzt freigeschaltet.',
        [{ text: 'Loslegen', onPress: () => router.back() }],
      );
    } else if (fehler) {
      Alert.alert('Kauf fehlgeschlagen', fehler);
    }
  }

  async function onWiederherstellen() {
    setWiederherstellungLaeuft(true);
    const { erfolg, fehler } = await kaeufeWiederherstellen();
    setWiederherstellungLaeuft(false);

    if (erfolg) {
      Alert.alert(
        'Käufe wiederhergestellt',
        'Ihr vorheriger Kauf wurde erfolgreich wiederhergestellt.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } else {
      Alert.alert(
        'Kein Kauf gefunden',
        fehler ?? 'Es wurde kein aktives Abonnement für dieses Konto gefunden.',
      );
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inhalt}>
      {/* Header */}
      <View style={styles.kopf}>
        <MaterialCommunityIcons name="shield-star" size={56} color="#F57F17" />
        <Text variant="headlineMedium" style={styles.titel}>Gerüstbau Pro</Text>
        <Text variant="bodyLarge" style={styles.untertitel}>
          Die vollständige Gerüstplaner-App für Profis
        </Text>
      </View>

      {/* Feature list */}
      <View style={styles.featureListe}>
        {FEATURES.map(f => (
          <View key={f.icon} style={styles.featureZeile}>
            <MaterialCommunityIcons name={f.icon as any} size={22} color="#1565C0" style={styles.featureIcon} />
            <Text variant="bodyMedium" style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      <Divider style={styles.divider} />

      {/* Tariff toggle */}
      <Text variant="titleMedium" style={styles.tarifTitel}>Abonnement wählen</Text>

      <View style={styles.tarifContainer}>
        {/* Annual */}
        <TarifKarte
          tarif="jaehrlich"
          aktiv={gewaehlterTarif === 'jaehrlich'}
          preis={preisJaehrlich}
          zeitraum="/ Jahr"
          badge="Beliebt – 33% günstiger"
          proMonat="~€6,67/Monat"
          onPress={() => setGewaehlterTarif('jaehrlich')}
        />

        {/* Monthly */}
        <TarifKarte
          tarif="monatlich"
          aktiv={gewaehlterTarif === 'monatlich'}
          preis={preisMonatlich}
          zeitraum="/ Monat"
          onPress={() => setGewaehlterTarif('monatlich')}
        />
      </View>

      {/* Purchase button */}
      <Button
        mode="contained"
        onPress={onKaufen}
        disabled={kaufLaeuft || wiederherstellungLaeuft}
        style={styles.kaufButton}
        contentStyle={styles.kaufButtonInhalt}
        labelStyle={styles.kaufButtonLabel}
        icon={kaufLaeuft ? undefined : 'star-circle'}
      >
        {kaufLaeuft
          ? <ActivityIndicator color="white" size={20} />
          : `Jetzt freischalten – ${gewaehlterTarif === 'jaehrlich' ? preisJaehrlich + '/Jahr' : preisMonatlich + '/Monat'}`
        }
      </Button>

      {/* Legal */}
      <Text variant="bodySmall" style={styles.rechtstext}>
        Das Abonnement verlängert sich automatisch zum angegebenen Preis, sofern es nicht
        mindestens 24 Stunden vor Ende der Laufzeit gekündigt wird. Die Zahlung erfolgt über
        Ihr App-Store-Konto. Kündigung jederzeit in den App-Store-Einstellungen möglich.
      </Text>

      {/* Restore */}
      <Button
        mode="text"
        onPress={onWiederherstellen}
        disabled={kaufLaeuft || wiederherstellungLaeuft}
        style={styles.wiederherstellenButton}
        loading={wiederherstellungLaeuft}
        textColor="#666"
      >
        Käufe wiederherstellen
      </Button>

      {/* Close */}
      <Button
        mode="text"
        onPress={() => router.back()}
        textColor="#999"
      >
        Vielleicht später
      </Button>
    </ScrollView>
  );
}

function TarifKarte({
  aktiv,
  preis,
  zeitraum,
  badge,
  proMonat,
  onPress,
}: {
  tarif: Tarif;
  aktiv: boolean;
  preis: string;
  zeitraum: string;
  badge?: string;
  proMonat?: string;
  onPress: () => void;
}) {
  return (
    <View style={[styles.tarifKarte, aktiv && styles.tarifKarteAktiv]}>
      {badge && (
        <View style={styles.badge}>
          <Text variant="labelSmall" style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <Button
        mode="text"
        onPress={onPress}
        style={styles.tarifButton}
        contentStyle={styles.tarifButtonInhalt}
      >
        <View style={styles.tarifInhalt}>
          {aktiv && (
            <MaterialCommunityIcons name="check-circle" size={20} color="#1565C0" style={styles.tarifHaken} />
          )}
          <View>
            <Text variant="headlineSmall" style={[styles.tarifPreis, aktiv && styles.tarifPreisAktiv]}>
              {preis}
            </Text>
            <Text variant="bodySmall" style={styles.tarifZeitraum}>{zeitraum}</Text>
            {proMonat && (
              <Text variant="bodySmall" style={styles.tarifProMonat}>{proMonat}</Text>
            )}
          </View>
        </View>
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  inhalt: { padding: 20, paddingBottom: 48, alignItems: 'center' },

  kopf: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  titel: { fontWeight: 'bold', color: '#1565C0', marginTop: 12, textAlign: 'center' },
  untertitel: { color: '#555', textAlign: 'center', marginTop: 6, lineHeight: 22 },

  featureListe: { width: '100%', marginBottom: 8 },
  featureZeile: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  featureIcon: { marginRight: 12, width: 24 },
  featureText: { flex: 1, color: '#333', lineHeight: 20 },

  divider: { width: '100%', marginVertical: 20 },

  tarifTitel: { fontWeight: 'bold', color: '#1565C0', marginBottom: 16, alignSelf: 'flex-start' },

  tarifContainer: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 20 },

  tarifKarte: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: 'white',
    overflow: 'hidden',
    elevation: 1,
  },
  tarifKarteAktiv: { borderColor: '#1565C0', elevation: 3 },

  badge: {
    backgroundColor: '#F57F17',
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
  },
  badgeText: { color: 'white', fontWeight: 'bold', fontSize: 10 },

  tarifButton: { margin: 0 },
  tarifButtonInhalt: { paddingVertical: 12 },
  tarifInhalt: { alignItems: 'center', gap: 4 },
  tarifHaken: { marginBottom: 4 },
  tarifPreis: { fontWeight: 'bold', color: '#333', textAlign: 'center' },
  tarifPreisAktiv: { color: '#1565C0' },
  tarifZeitraum: { color: '#666', textAlign: 'center' },
  tarifProMonat: { color: '#2E7D32', textAlign: 'center', fontWeight: 'bold', marginTop: 2 },

  kaufButton: {
    width: '100%',
    borderRadius: 10,
    backgroundColor: '#1565C0',
    marginBottom: 16,
  },
  kaufButtonInhalt: { height: 56 },
  kaufButtonLabel: { fontSize: 16, fontWeight: 'bold' },

  rechtstext: {
    color: '#888',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
    paddingHorizontal: 4,
  },

  wiederherstellenButton: { marginBottom: 4 },
});
