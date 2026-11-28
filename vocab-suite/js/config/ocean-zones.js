/**
 * Real-world NOAA Bathymetric Pelagic Zones used by Krillion (0m -> 7,000m+)
 */

export const OCEAN_ZONES = [
  {
    id: 'sunlight',
    name: 'Sunlight Zone',
    scientific: 'Epipelagic',
    minDepth: 0,
    maxDepth: 200,
    colorTop: '#0d4f6b',
    colorBottom: '#0a3652',
    accent: '#4df3ff',
    description: 'Sunlit surface waters teeming with plankton and drifting jellies.',
  },
  {
    id: 'twilight',
    name: 'Twilight Zone',
    scientific: 'Mesopelagic',
    minDepth: 200,
    maxDepth: 1000,
    colorTop: '#0a3652',
    colorBottom: '#07223b',
    accent: '#38bdf8',
    description: 'Fading blue light where bioluminescent squid begin to flicker.',
  },
  {
    id: 'midnight',
    name: 'Midnight Zone',
    scientific: 'Bathypelagic',
    minDepth: 1000,
    maxDepth: 4000,
    colorTop: '#07223b',
    colorBottom: '#041224',
    accent: '#818cf8',
    description: 'Pitch-black waters lit only by anglerfish lures and siphonophores.',
  },
  {
    id: 'abyssal',
    name: 'Abyssal Zone',
    scientific: 'Abyssopelagic',
    minDepth: 4000,
    maxDepth: 6000,
    colorTop: '#041224',
    colorBottom: '#020914',
    accent: '#c084fc',
    description: 'Near-freezing abyssal plains under immense hydrostatic pressure.',
  },
  {
    id: 'hadal',
    name: 'Hadal Trench',
    scientific: 'Hadalpelagic',
    minDepth: 6000,
    maxDepth: Infinity,
    colorTop: '#020914',
    colorBottom: '#01040a',
    accent: '#ffe066',
    description: 'The deepest oceanic trenches on Earth — Challenger Deep territory.',
  },
];

export function getZoneForDepth(depthMeters) {
  const d = Math.max(0, Number(depthMeters) || 0);
  return (
    OCEAN_ZONES.find((z) => d >= z.minDepth && d < z.maxDepth) ||
    OCEAN_ZONES[OCEAN_ZONES.length - 1]
  );
}
