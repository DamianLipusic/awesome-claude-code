import React from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';

interface DataPoint { position: number; aa: string; value: number }

interface Props {
  data: DataPoint[];
  dark?: boolean;
}

const W = Dimensions.get('window').width - 48;
const H = 200;
const PAD = { top: 20, right: 16, bottom: 36, left: 44 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

export default function HydrophobicityChart({ data, dark }: Props) {
  if (!data.length) return null;

  const maxVal = Math.max(4.5, Math.max(...data.map(d => Math.abs(d.value))));
  const yMax   =  maxVal * 1.1;
  const yMin   = -maxVal * 1.1;

  const toX = (pos: number) => ((pos - 1) / Math.max(data.length - 1, 1)) * CW;
  const toY = (v: number)   => ((yMax - v) / (yMax - yMin)) * CH;
  const y0  = toY(0);

  const posPath = data.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${toX(d.position).toFixed(1)} ${Math.min(toY(d.value), y0).toFixed(1)}`
  ).join(' ') + ` L ${toX(data[data.length - 1].position).toFixed(1)} ${y0.toFixed(1)} L ${toX(1).toFixed(1)} ${y0.toFixed(1)} Z`;

  const negPath = data.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${toX(d.position).toFixed(1)} ${Math.max(toY(d.value), y0).toFixed(1)}`
  ).join(' ') + ` L ${toX(data[data.length - 1].position).toFixed(1)} ${y0.toFixed(1)} L ${toX(1).toFixed(1)} ${y0.toFixed(1)} Z`;

  const linePath = data.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${toX(d.position).toFixed(1)} ${toY(d.value).toFixed(1)}`
  ).join(' ');

  const bg     = dark ? COLORS.cardDark   : COLORS.cardLight;
  const border = dark ? COLORS.borderDark : COLORS.borderLight;
  const muted  = dark ? COLORS.mutedDark  : COLORS.mutedLight;
  const grid   = dark ? '#334155' : '#E2E8F0';

  const yTicks = [-4, -2, 0, 2, 4].filter(v => v >= yMin && v <= yMax);
  const xTicks = data.length <= 20
    ? data.map(d => d.position)
    : [1, ...Array.from({ length: 4 }, (_, i) => Math.round((data.length / 5) * (i + 1))), data.length];

  return (
    <View style={[styles.container, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.title, { color: dark ? COLORS.textDark : COLORS.textLight }]}>
        Hydrophobicity Profile
      </Text>
      <Text style={[styles.sub, { color: muted }]}>Kyte-Doolittle · window = 5</Text>

      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="hpPosGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={COLORS.accent} stopOpacity="0.4" />
            <Stop offset="1" stopColor={COLORS.accent} stopOpacity="0.02" />
          </LinearGradient>
          <LinearGradient id="hpNegGrad" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor="#F97316" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#F97316" stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {/* Plot area */}
        <G x={PAD.left} y={PAD.top}>
          {/* Grid lines */}
          {yTicks.map(v => (
            <Line key={`gy${v}`} x1={0} y1={toY(v)} x2={CW} y2={toY(v)} stroke={grid} strokeWidth={0.8} />
          ))}

          {/* Fill areas */}
          <Path d={posPath} fill="url(#hpPosGrad)" />
          <Path d={negPath} fill="url(#hpNegGrad)" />

          {/* Zero line */}
          <Line x1={0} y1={y0} x2={CW} y2={y0} stroke={grid} strokeWidth={1.5} strokeDasharray="4,3" />

          {/* Main hydrophobicity curve */}
          <Path d={linePath} fill="none" stroke={COLORS.accent} strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" />
        </G>

        {/* X-axis tick labels */}
        {xTicks.map(t => (
          <SvgText key={`lx${t}`} x={PAD.left + toX(t)} y={H - 4}
            textAnchor="middle" fontSize={9} fill={muted}>{t}</SvgText>
        ))}

        {/* Y-axis tick labels */}
        {yTicks.map(v => (
          <SvgText key={`ly${v}`} x={PAD.left - 6} y={PAD.top + toY(v) + 4}
            textAnchor="end" fontSize={9} fill={muted}>{v}</SvgText>
        ))}

        <SvgText x={W / 2} y={H - 2} textAnchor="middle" fontSize={9} fill={muted}>Residue</SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    marginVertical: SPACING.sm,
  },
  title: { fontSize: FONT_SIZE.md, fontWeight: '700', marginBottom: 2 },
  sub: { fontSize: FONT_SIZE.xs, marginBottom: SPACING.sm },
});
