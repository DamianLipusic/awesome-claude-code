import React from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';

interface Props {
  data: { ph: number; charge: number }[];
  pI: number;
  dark?: boolean;
}

const W = Dimensions.get('window').width - 48;
const H = 200;
const PAD = { top: 20, right: 20, bottom: 36, left: 44 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

export default function ChargePHChart({ data, pI, dark }: Props) {
  if (!data.length) return null;

  const maxCharge = Math.max(...data.map(d => Math.abs(d.charge)));
  const yMax = Math.ceil(maxCharge + 1);
  const yMin = -yMax;

  const toX = (ph: number) => (ph / 14) * CW;
  const toY = (c: number) => ((yMax - c) / (yMax - yMin)) * CH;

  // Build SVG path
  const positives = data.filter(d => d.charge >= 0);
  const negatives = data.filter(d => d.charge <= 0);

  let posPath = '';
  let negPath = '';
  const y0 = toY(0);

  // Full line
  const linePath = data.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${toX(d.ph).toFixed(1)} ${toY(d.charge).toFixed(1)}`
  ).join(' ');

  // Positive fill area
  const posArea = data.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${toX(d.ph).toFixed(1)} ${Math.min(toY(d.charge), y0).toFixed(1)}`
  ).join(' ') + ` L ${toX(14).toFixed(1)} ${y0.toFixed(1)} L ${toX(0).toFixed(1)} ${y0.toFixed(1)} Z`;

  const negArea = data.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${toX(d.ph).toFixed(1)} ${Math.max(toY(d.charge), y0).toFixed(1)}`
  ).join(' ') + ` L ${toX(14).toFixed(1)} ${y0.toFixed(1)} L ${toX(0).toFixed(1)} ${y0.toFixed(1)} Z`;

  const bg     = dark ? COLORS.cardDark   : COLORS.cardLight;
  const border = dark ? COLORS.borderDark : COLORS.borderLight;
  const muted  = dark ? COLORS.mutedDark  : COLORS.mutedLight;
  const gridColor = dark ? '#334155' : '#E2E8F0';

  const pIx = toX(pI);
  const ticks = [0, 2, 4, 6, 7, 8, 10, 12, 14];
  const yTicks = [-yMax, -Math.round(yMax/2), 0, Math.round(yMax/2), yMax];

  return (
    <View style={[styles.container, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.title, { color: dark ? COLORS.textDark : COLORS.textLight }]}>
        Charge vs. pH
      </Text>
      <Text style={[styles.sub, { color: muted }]}>pI = {pI.toFixed(2)}</Text>

      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="posGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={COLORS.primary} stopOpacity="0.3" />
            <Stop offset="1" stopColor={COLORS.primary} stopOpacity="0.02" />
          </LinearGradient>
          <LinearGradient id="negGrad" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={COLORS.danger} stopOpacity="0.3" />
            <Stop offset="1" stopColor={COLORS.danger} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        <Svg x={PAD.left} y={PAD.top} width={CW} height={CH}>
          {/* Grid lines */}
          {yTicks.map(v => (
            <Line key={v} x1={0} y1={toY(v)} x2={CW} y2={toY(v)} stroke={gridColor} strokeWidth={0.8} />
          ))}
          {ticks.map(t => (
            <Line key={t} x1={toX(t)} y1={0} x2={toX(t)} y2={CH} stroke={gridColor} strokeWidth={0.8} />
          ))}

          {/* Fill areas */}
          <Path d={posArea} fill="url(#posGrad)" />
          <Path d={negArea} fill="url(#negGrad)" />

          {/* Zero line */}
          <Line x1={0} y1={y0} x2={CW} y2={y0} stroke={gridColor} strokeWidth={1.5} strokeDasharray="4,3" />

          {/* pI line */}
          <Line x1={pIx} y1={0} x2={pIx} y2={CH} stroke={COLORS.accent} strokeWidth={1.5} strokeDasharray="4,3" />

          {/* Main line */}
          <Path d={linePath} fill="none" stroke={COLORS.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>

        {/* X-axis labels */}
        {ticks.map(t => (
          <SvgText key={t} x={PAD.left + toX(t)} y={H - 4} textAnchor="middle"
            fontSize={9} fill={muted}>{t}</SvgText>
        ))}

        {/* Y-axis labels */}
        {yTicks.map(v => (
          <SvgText key={v} x={PAD.left - 6} y={PAD.top + toY(v) + 4} textAnchor="end"
            fontSize={9} fill={muted}>{v}</SvgText>
        ))}

        {/* Axis label */}
        <SvgText x={W / 2} y={H - 2} textAnchor="middle" fontSize={9} fill={muted}>pH</SvgText>

        {/* pI label */}
        <SvgText x={PAD.left + pIx + 4} y={PAD.top + 10} textAnchor="start"
          fontSize={9} fill={COLORS.accent} fontWeight="bold">pI</SvgText>
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
