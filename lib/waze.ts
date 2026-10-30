/** קישור ניווט ב-Waze לכתובת טקסטואלית (נפתח באפליקציה בנייד, באתר במחשב). */
export function wazeUrl(address: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(address.trim())}&navigate=yes`;
}
