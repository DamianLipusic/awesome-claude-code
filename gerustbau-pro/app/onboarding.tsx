import { useRef, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  type ViewToken,
  type ListRenderItem,
} from 'react-native';
import { Text, Button } from 'react-native-paper';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export const ONBOARDING_KEY = 'gerustbau_onboarding_v1';

const { width } = Dimensions.get('window');

interface Slide {
  id: string;
  icon: string;
  iconFarbe: string;
  hintergrund: string;
  titel: string;
  text: string;
}

const SLIDES: Slide[] = [
  {
    id: 'willkommen',
    icon: 'crane',
    iconFarbe: '#FFFFFF',
    hintergrund: '#1565C0',
    titel: 'Willkommen bei\nGerüstbau Pro',
    text: 'Die professionelle App für Gerüstbauer. Fotos aufnehmen, Maße erfassen, Materialien berechnen — alles in einem.',
  },
  {
    id: 'aufnahme',
    icon: 'camera-plus',
    iconFarbe: '#1565C0',
    hintergrund: '#E3F2FD',
    titel: 'Gebäude schnell\naufnehmen',
    text: 'Fotografieren Sie jede Gebäudeseite und zeichnen Sie Maße direkt ins Bild. Öffnungen wie Fenster und Türen werden automatisch abgezogen.',
  },
  {
    id: 'berechnung',
    icon: 'calculator-variant',
    iconFarbe: '#E65100',
    hintergrund: '#FFF3E0',
    titel: 'Automatische\nMaterialberechnung',
    text: 'Die App berechnet sofort Rahmen, Riegel, Beläge und alle Zubehörteile für Layher Allround, Layher Blitz und Tobler — nach gewählter Lastklasse.',
  },
  {
    id: 'export',
    icon: 'file-pdf-box',
    iconFarbe: '#1B5E20',
    hintergrund: '#E8F5E9',
    titel: 'Professionelle\nDokumente',
    text: 'Erstellen Sie auf Knopfdruck Gerüstpläne, Materiallisten, Zeitprotokolle und Angebote als PDF — mit Ihrem Firmenlogo im Briefkopf.',
  },
];

export default function OnboardingScreen() {
  const [aktiverIndex, setAktiverIndex] = useState(0);
  const ref = useRef<FlatList<Slide>>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setAktiverIndex(viewableItems[0].index);
      }
    },
  ).current;

  async function abschliessen() {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    router.replace('/(tabs)');
  }

  function naechste() {
    if (aktiverIndex < SLIDES.length - 1) {
      ref.current?.scrollToIndex({ index: aktiverIndex + 1, animated: true });
    } else {
      abschliessen();
    }
  }

  const renderItem: ListRenderItem<Slide> = ({ item }) => (
    <View style={[styles.slide, { backgroundColor: item.hintergrund, width }]}>
      <View style={styles.slideInhalt}>
        <View style={[styles.iconContainer, { backgroundColor: item.hintergrund === '#1565C0' ? 'rgba(255,255,255,0.15)' : 'white' }]}>
          <MaterialCommunityIcons
            name={item.icon as any}
            size={72}
            color={item.iconFarbe}
          />
        </View>
        <Text
          variant="headlineMedium"
          style={[styles.titel, { color: item.hintergrund === '#1565C0' ? 'white' : '#1A237E' }]}
        >
          {item.titel}
        </Text>
        <Text
          variant="bodyLarge"
          style={[styles.text, { color: item.hintergrund === '#1565C0' ? 'rgba(255,255,255,0.9)' : '#444' }]}
        >
          {item.text}
        </Text>
      </View>
    </View>
  );

  const istLetzteSlide = aktiverIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <FlatList
        ref={ref}
        data={SLIDES}
        renderItem={renderItem}
        keyExtractor={s => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === aktiverIndex ? styles.dotAktiv : styles.dotInaktiv,
            ]}
          />
        ))}
      </View>

      {/* Navigation */}
      <View style={styles.navigation}>
        <Button
          mode="text"
          onPress={abschliessen}
          textColor="#999"
          style={styles.ueberspringen}
        >
          {istLetzteSlide ? '' : 'Überspringen'}
        </Button>

        <Button
          mode="contained"
          onPress={naechste}
          style={styles.weiterButton}
          contentStyle={styles.weiterButtonInhalt}
          labelStyle={styles.weiterButtonLabel}
          icon={istLetzteSlide ? 'rocket-launch' : 'arrow-right'}
        >
          {istLetzteSlide ? 'Loslegen' : 'Weiter'}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1565C0' },

  slide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  slideInhalt: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48 },

  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    elevation: 4,
  },

  titel: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 36,
  },
  text: {
    textAlign: 'center',
    lineHeight: 26,
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: 'white',
    gap: 8,
  },
  dot: { height: 8, borderRadius: 4 },
  dotAktiv: { width: 24, backgroundColor: '#1565C0' },
  dotInaktiv: { width: 8, backgroundColor: '#C5CAE9' },

  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
    backgroundColor: 'white',
  },
  ueberspringen: { minWidth: 100 },
  weiterButton: { borderRadius: 10, backgroundColor: '#1565C0' },
  weiterButtonInhalt: { height: 52, paddingHorizontal: 8 },
  weiterButtonLabel: { fontSize: 16, fontWeight: 'bold' },
});
