import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Circle } from 'react-native-svg';

/**
 * Aurora — a soft, premium mesh-gradient backdrop built from layered radial
 * "blobs". Sits behind screen content (pointerEvents none) and adapts to theme.
 *
 * Keep it subtle: low-opacity color pools that read as depth, not decoration.
 */
interface AuroraProps {
  isDark: boolean;
  intensity?: number; // 0..1 multiplier on blob opacity
  variant?: 'home' | 'record';
}

export const Aurora: React.FC<AuroraProps> = ({ isDark, intensity = 1, variant = 'home' }) => {
  const { width, height } = useWindowDimensions();
  const o = (v: number) => Math.min(1, v * intensity);

  // Blob palette — cohesive blue→violet→cyan family.
  const blobs =
    variant === 'record'
      ? [
          { cx: width * 0.5, cy: height * 0.34, r: width * 0.75, color: '#007AFF', op: o(isDark ? 0.34 : 0.20) },
          { cx: width * 0.12, cy: height * 0.1, r: width * 0.6, color: '#7A5CFF', op: o(isDark ? 0.22 : 0.14) },
          { cx: width * 0.9, cy: height * 0.2, r: width * 0.6, color: '#00D4FF', op: o(isDark ? 0.16 : 0.10) },
        ]
      : [
          { cx: width * 0.85, cy: height * 0.02, r: width * 0.85, color: '#007AFF', op: o(isDark ? 0.30 : 0.18) },
          { cx: width * 0.05, cy: height * 0.12, r: width * 0.7, color: '#7A5CFF', op: o(isDark ? 0.22 : 0.13) },
          { cx: width * 0.5, cy: height * 0.42, r: width * 0.7, color: '#00D4FF', op: o(isDark ? 0.12 : 0.08) },
        ];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          {blobs.map((b, i) => (
            <RadialGradient key={i} id={`aurora-${variant}-${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={b.color} stopOpacity={b.op} />
              <Stop offset="100%" stopColor={b.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={isDark ? '#000000' : '#F2F2F7'} />
        {blobs.map((b, i) => (
          <Circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={`url(#aurora-${variant}-${i})`} />
        ))}
      </Svg>
    </View>
  );
};
