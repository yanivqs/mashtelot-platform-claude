/** שלט צמח: כל מה שמופיע על השלט. נשמר כ-Snapshot בהזמנה (print_plant_signs.data). */

export type SignSocial = 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'YOUTUBE' | 'WHATSAPP';

export interface SignData {
  hebrewName: string;
  latinName: string | null;
  description: string;
  imageUrl: string | null;
  logoUrl: string | null;
  nurseryName: string;
  light: { range: [number, number] | null; title: string; note: string };
  water: { amount: number; title: string; note: string };
  plantType: string | null;
  notes: string | null;
  socials: SignSocial[];
  /** כשאין רשתות — כתובת האתר */
  website: string | null;
  /** הכתובת שה-QR מפנה אליה: דף הצמח בחנות */
  qrUrl: string;
}

/** מה שבעל המשתלה ערך בשלט (nursery_products.sign_settings) */
export interface SignSettings {
  description?: string | null;
  notes?: string | null;
  plantType?: string | null;
  light?: { range?: [number, number] | null; note?: string | null } | null;
  water?: { amount?: number | null; note?: string | null } | null;
}
