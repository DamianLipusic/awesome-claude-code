import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface Props {
  icon: string;
  titel: string;
  beschreibung: string;
  schaltflaeche?: string;
  farbe: string;
  onPress?: () => void;
}

export default function NaechsterSchrittBanner({ icon, titel, beschreibung, schaltflaeche, farbe, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[styles.container, { borderLeftColor: farbe, backgroundColor: farbe + '18' }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.ikonContainer, { backgroundColor: farbe }]}>
        <MaterialCommunityIcons name={icon as any} size={28} color="white" />
      </View>
      <View style={styles.textContainer}>
        <Text variant="titleSmall" style={[styles.titel, { color: farbe }]}>{titel}</Text>
        <Text variant="bodyMedium" style={styles.beschreibung}>{beschreibung}</Text>
        {schaltflaeche && (
          <View style={[styles.aktionsChip, { backgroundColor: farbe }]}>
            <Text style={styles.aktionsText}>{schaltflaeche} →</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 12,
    borderLeftWidth: 5,
    marginVertical: 12,
    overflow: 'hidden',
    elevation: 1,
  },
  ikonContainer: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  textContainer: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  titel: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  beschreibung: {
    color: '#444',
    lineHeight: 20,
  },
  aktionsChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  aktionsText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
