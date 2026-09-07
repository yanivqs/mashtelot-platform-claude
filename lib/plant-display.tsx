import {
  Droplets,
  Sun,
  CloudSun,
  Cloud,
  Leaf,
  Sprout,
  Ruler,
  Calendar,
  Flower2,
  MoveHorizontal,
  Thermometer,
  type LucideIcon,
} from 'lucide-react';
import type { Plant } from '@prisma/client';

export interface PlantFact {
  key: string;
  label: string;
  value: string;
  Icon: LucideIcon;
}

/** אייקון תאורה לפי תיאור עברי חופשי. */
function lightIcon(value: string): LucideIcon {
  const v = value.trim();
  if (/צל\s*מלא|צל עמוק/.test(v)) return Cloud;
  if (/צל|מוצלל|חלקי|למחצה/.test(v)) return CloudSun;
  return Sun; // "שמש מלאה" / ברירת מחדל
}

/** אייקון השקיה לפי תיאור עברי חופשי. */
function waterIcon(_value: string): LucideIcon {
  return Droplets;
}

const FIELD_ICONS: Record<string, LucideIcon> = {
  family: Leaf,
  plantType: Sprout,
  height: Ruler,
  spacing: MoveHorizontal,
  floweringSeason: Calendar,
  flowerColor: Flower2,
  growthRate: Sprout,
  climateZones: Thermometer,
};

const FIELD_LABELS: Record<string, string> = {
  family: 'משפחה',
  plantType: 'סוג צמח',
  light: 'אור',
  water: 'השקיה',
  height: 'גובה',
  spacing: 'מרווח שתילה',
  floweringSeason: 'עונת פריחה',
  flowerColor: 'צבע פריחה',
  growthRate: 'קצב גדילה',
  climateZones: 'אזורי אקלים',
};

/**
 * המאפיינים הבולטים של צמח, מסודרים לפי חשיבות ויזואלית, מסוננים לפי קיום ערך.
 * מיועד לשורת האייקונים בכרטיס המוצר ולרצועת "מידע עיקרי" בעמוד המוצר.
 */
export function plantKeyFacts(plant: Plant | null | undefined, limit = 4): PlantFact[] {
  if (!plant) return [];

  const order: Array<{ key: keyof Plant; get: (v: string) => LucideIcon }> = [
    { key: 'family', get: () => FIELD_ICONS.family },
    { key: 'light', get: lightIcon },
    { key: 'water', get: waterIcon },
    { key: 'height', get: () => FIELD_ICONS.height },
    { key: 'plantType', get: () => FIELD_ICONS.plantType },
    { key: 'floweringSeason', get: () => FIELD_ICONS.floweringSeason },
    { key: 'growthRate', get: () => FIELD_ICONS.growthRate },
  ];

  const facts: PlantFact[] = [];
  for (const { key, get } of order) {
    const raw = plant[key];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const value = raw.trim();
    facts.push({
      key: String(key),
      label: FIELD_LABELS[key as string] ?? String(key),
      value,
      Icon: get(value),
    });
    if (facts.length >= limit) break;
  }
  return facts;
}

/** כל המאפיינים הבוטניים לטבלה המורחבת בעמוד המוצר. */
export function plantSpecRows(plant: Plant | null | undefined): Array<[string, string]> {
  if (!plant) return [];
  const specs: Array<[string, string | null | undefined]> = [
    ['משפחה', plant.family],
    ['סוג צמח', plant.plantType],
    ['תאורה', plant.light],
    ['השקיה', plant.water],
    ['עונת פריחה', plant.floweringSeason],
    ['צבע פריחה', plant.flowerColor],
    ['עלווה', plant.foliage],
    ['ירוק-עד', plant.evergreen],
    ['גובה', plant.height],
    ['מרווח שתילה', plant.spacing],
    ['קצב גדילה', plant.growthRate],
    ['אזורי אקלים', plant.climateZones],
    ['עמידות', plant.resistance],
    ['חופי', plant.coastal],
    ['מקור', plant.origin],
  ];
  return specs.filter((row): row is [string, string] => Boolean(row[1] && row[1].trim()));
}
