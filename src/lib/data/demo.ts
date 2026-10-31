import { dataset, hash, type Observation, type DataProvider } from './model';
const tags = [
  'MoonGarden',
  'QuietInternet',
  'OceanLetters',
  'WildTomorrow',
  'SlowSunday',
  'PixelForest',
  'NightBicycle',
  'CloudClub',
  'LittleOrbits',
  'SolarStories',
  'VelvetSky',
  'PaperPlanet',
  'KindCode',
  'ForestRadio',
  'BlueHour',
  'DreamArchive',
  'SoftRobots',
  'EarthNotes',
  'NeonMeadow',
  'TinyRebellion',
  'FutureFolk',
  'MossMode',
  'CosmicKitchen',
  'OpenWindows',
  'RiverSongs',
  'AnalogDays',
  'GoldenNoise',
  'StarLibrary',
  'UrbanBloom',
  'WinterWaves',
  'AfterRain',
  'LunarPicnic',
  'SecretSignals',
  'DawnPatrol',
  'PetalPower',
  'ElectricNest',
  'WanderingLight',
  'GentleChaos',
  'MidnightTea',
  'NewHorizons',
  'SilverSeeds',
  'WonderWalk',
];
export function createDemo() {
  const observations: Observation[] = [];
  for (const [index, tag] of tags.entries()) {
    const seed = hash(tag),
      kind = index % 6;
    const birthMonth =
      index === 0 ? 0 : Math.floor((index / (tags.length - 1)) * 213);
    const bornAt = new Date(Date.UTC(2008, birthMonth, 1)).toISOString();
    for (let m = 0; m < 228; m++) {
      const age = m - birthMonth;
      const peak = 4 + (seed % 8);
      const pulse = Math.exp(-Math.pow((age - peak) / 3, 2));
      let v = 0;
      if (age > 0) {
        if (kind === 0) v = 900000 * pulse;
        if (kind === 1) v = 320000 * (1 - Math.exp(-age / 20));
        if (kind === 2)
          v =
            420000 * (1 - Math.exp(-age / 4)) * (0.8 + 0.2 * Math.sin(age / 9));
        if (kind === 3)
          v = 480000 * Math.pow(Math.max(0, Math.sin(age / 7)), 6);
        if (kind === 4)
          v = 750000 * (1 - Math.exp(-age / 2)) * Math.exp(-age / 9);
        if (kind === 5)
          v = 620000 * pulse + 850000 * Math.exp(-Math.pow((age - 54) / 5, 2));
      }
      v *= 0.92 + 0.08 * Math.sin(m * 0.8 + (seed % 20));
      observations.push({
        hashtag: '#' + tag,
        date: new Date(Date.UTC(2008, m, 1)).toISOString(),
        value: Math.round(Math.max(0, v)),
        bornAt,
        source: 'Zeitgeist lifecycle demo v2',
        platform: 'Fictional social network',
        granularity: 'month',
        measurement: 'count',
        status: 'simulated',
      });
    }
  }
  return dataset('The imagined internet', observations);
}
export const demoProvider: DataProvider = { load: async () => createDemo() };
