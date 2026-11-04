'use client';

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import {
  Accessibility,
  ALargeSmall,
  AlignRight,
  Baseline,
  Contrast,
  Eye,
  EyeOff,
  FileText,
  Focus,
  Heading,
  Image as ImageIcon,
  Link as LinkIcon,
  ListTree,
  Moon,
  MousePointer2,
  MousePointerClick,
  Palette,
  Pause,
  RotateCcw,
  Rows3,
  Ruler,
  ScanLine,
  Space,
  Sun,
  Type,
  Volume2,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  A11Y_DEFAULTS,
  A11Y_LEVEL_LABELS,
  A11Y_PROFILES,
  A11Y_STORAGE_KEY,
  A11Y_TEXT_LABELS,
  a11yAttributes,
  changeA11ySetting,
  isA11yDefault,
  sanitizeA11ySettings,
  toggleA11yProfile,
  type A11yProfile,
  type A11ySettings,
} from '@/lib/a11y-settings';
import './a11y.css';

/* ---------- מצב: נקרא פעם אחת מהדפדפן ומשותף בין התפריט לכלים שפועלים בדף ---------- */
let current: A11ySettings = A11Y_DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function loadOnce() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    current = sanitizeA11ySettings(JSON.parse(localStorage.getItem(A11Y_STORAGE_KEY) || '{}'));
  } catch {
    /* אחסון חסום: התפריט עובד עד סוף הביקור */
  }
}

function applyAttributes(settings: A11ySettings) {
  const root = document.documentElement;
  for (const name of root.getAttributeNames()) if (name.startsWith('data-a11y-')) root.removeAttribute(name);
  for (const [name, value] of Object.entries(a11yAttributes(settings))) root.setAttribute(name, value);
}

function save(next: A11ySettings) {
  current = next;
  applyAttributes(next);
  try {
    if (isA11yDefault(next)) localStorage.removeItem(A11Y_STORAGE_KEY);
    else localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* אחסון חסום */
  }
  listeners.forEach((fn) => fn());
}

function useA11ySettings(): A11ySettings {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => {
      loadOnce();
      return current;
    },
    () => A11Y_DEFAULTS,
  );
}

/* ---------- קריינות ---------- */
function hebrewVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('he') || v.lang.toLowerCase().startsWith('iw')) ?? null;
}

function useHebrewVoice(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const check = () => setAvailable(Boolean(hebrewVoice()));
    const t = window.setTimeout(check, 0);
    window.speechSynthesis.addEventListener('voiceschanged', check);
    return () => {
      window.clearTimeout(t);
      window.speechSynthesis.removeEventListener('voiceschanged', check);
    };
  }, []);
  return available;
}

const READABLE = 'p, li, h1, h2, h3, h4, h5, h6, td, th, dd, dt, label, figcaption, blockquote, a, button, summary';

/* ---------- כלים שפועלים בדף עצמו ---------- */
function PageTools({ settings }: { settings: A11ySettings }) {
  const pathname = usePathname();
  const lineRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  // סרגל ומסיכת קריאה עוקבים אחרי העכבר או המגע, ובמקלדת אחרי הפוקוס
  useEffect(() => {
    if (settings.guide === 'none') return;
    const place = (y: number) => {
      if (lineRef.current) lineRef.current.style.transform = `translateY(${Math.max(0, y - 3)}px)`;
      if (topRef.current) topRef.current.style.height = `${Math.max(0, y - 40)}px`;
      if (bottomRef.current) bottomRef.current.style.height = `${Math.max(0, window.innerHeight - y - 40)}px`;
    };
    const onPointer = (e: PointerEvent) => place(e.clientY);
    const onFocus = (e: FocusEvent) => {
      const r = (e.target as HTMLElement).getBoundingClientRect?.();
      if (r) place(r.top + r.height / 2);
    };
    place(window.innerHeight / 2);
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('focusin', onFocus);
    return () => {
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('focusin', onFocus);
    };
  }, [settings.guide]);

  // תיאור התמונה מוצג במעבר עכבר ובפוקוס
  useEffect(() => {
    if (!settings.alttips) return;
    const hide = () => {
      if (tipRef.current) tipRef.current.hidden = true;
    };
    const show = (e: Event) => {
      const tip = tipRef.current;
      const target = e.target as HTMLElement;
      const img = target.closest?.('.a11y-ui') ? null : target.tagName === 'IMG' ? (target as HTMLImageElement) : target.querySelector?.('img');
      if (!tip || !img?.alt) return hide();
      const r = img.getBoundingClientRect();
      tip.textContent = img.alt;
      tip.hidden = false;
      tip.style.top = `${Math.max(4, Math.min(window.innerHeight - 60, r.top + 4))}px`;
      tip.style.left = `${Math.max(4, Math.min(window.innerWidth - 240, r.left + 4))}px`;
    };
    document.addEventListener('mouseover', show);
    document.addEventListener('focusin', show);
    document.addEventListener('scroll', hide, { passive: true });
    return () => {
      document.removeEventListener('mouseover', show);
      document.removeEventListener('focusin', show);
      document.removeEventListener('scroll', hide);
      hide();
    };
  }, [settings.alttips]);

  // הקראה: לחיצה על טקסט או מעבר אליו במקלדת. קישור וכפתור ממשיכים לפעול כרגיל
  useEffect(() => {
    if (!settings.speak || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    let marked: Element | null = null;
    const clear = () => {
      marked?.classList.remove('a11y-speaking');
      marked = null;
    };
    const read = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest?.('.a11y-ui')) return;
      const el = target.closest?.(READABLE);
      const text = (el?.textContent ?? '').replace(/\s+/g, ' ').trim() || (el?.getAttribute('aria-label') ?? '');
      if (!el || !text) return;
      synth.cancel();
      clear();
      const say = new SpeechSynthesisUtterance(text.slice(0, 1500));
      const voice = hebrewVoice();
      if (voice) say.voice = voice;
      say.lang = voice?.lang ?? 'he-IL';
      say.onend = clear;
      el.classList.add('a11y-speaking');
      marked = el;
      synth.speak(say);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        synth.cancel();
        clear();
      }
    };
    document.addEventListener('click', read);
    document.addEventListener('focusin', read);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', read);
      document.removeEventListener('focusin', read);
      document.removeEventListener('keydown', onKey);
      synth.cancel();
      clear();
    };
  }, [settings.speak]);

  // עצירת תנועה: CSS לא עוצר סרטון או GIF, אז עושים את זה כאן וגם בתוכן שנטען אחר כך
  useEffect(() => {
    if (!settings.motion) return;
    const freeze = () => {
      document.querySelectorAll('video').forEach((v) => {
        if (!v.paused) v.pause();
      });
      document.querySelectorAll<HTMLImageElement>('img:not([data-a11y-gif])').forEach((img) => {
        if (!/\.gif($|\?)/i.test(img.currentSrc || img.src) || !img.complete || !img.naturalWidth) return;
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.className = `${img.className} a11y-frozen-gif`;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', img.alt);
        canvas.getContext('2d')?.drawImage(img, 0, 0);
        img.setAttribute('data-a11y-gif', '1');
        img.style.display = 'none';
        img.after(canvas);
      });
    };
    freeze();
    const observer = new MutationObserver(freeze);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.querySelectorAll<HTMLImageElement>('img[data-a11y-gif]').forEach((img) => {
        img.removeAttribute('data-a11y-gif');
        img.style.display = '';
        if (img.nextElementSibling?.classList.contains('a11y-frozen-gif')) img.nextElementSibling.remove();
      });
    };
  }, [settings.motion, pathname]);

  return (
    <div className="a11y-ui" aria-hidden="true">
      {settings.guide === 'line' && <div ref={lineRef} className="a11y-guide-line" />}
      {settings.guide === 'mask' && (
        <>
          <div ref={topRef} className="a11y-mask" data-part="top" />
          <div ref={bottomRef} className="a11y-mask" data-part="bottom" />
        </>
      )}
      {settings.alttips && <div ref={tipRef} className="a11y-tip" hidden />}
    </div>
  );
}

/* ---------- רכיבי התפריט ---------- */
function Toggle({ label, icon: Icon, on, onClick, disabled, note }: { label: string; icon: LucideIcon; on: boolean; onClick: () => void; disabled?: boolean; note?: string }) {
  return (
    <button type="button" className="a11y-tile" aria-pressed={on} onClick={onClick} disabled={disabled}>
      <Icon aria-hidden="true" />
      <span>{label}</span>
      {note && <small>{note}</small>}
    </button>
  );
}

/** מעבר בין רמות. השם כולל את הערך הנוכחי, והכרזה חיה מודיעה על השינוי. */
function Stepper({ label, icon: Icon, value, active, onClick }: { label: string; icon: LucideIcon; value: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className="a11y-tile" data-active={active} aria-label={`${label}: ${value}. לחיצה לשינוי`} onClick={onClick}>
      <Icon aria-hidden="true" />
      <span>{label}</span>
      <small>{value}</small>
    </button>
  );
}

interface StructureItem {
  label: string;
  el: HTMLElement;
}

const LANDMARKS: [string, string][] = [
  ['main', 'התוכן הראשי'],
  ['header', 'כותרת האתר'],
  ['nav', 'ניווט'],
  ['[role="search"]', 'חיפוש'],
  ['footer', 'תחתית האתר'],
];

function readStructure(): StructureItem[] {
  const visible = (el: HTMLElement) => !el.closest('.a11y-ui') && el.getClientRects().length > 0;
  const items: StructureItem[] = [];
  for (const [selector, label] of LANDMARKS) {
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      if (visible(el)) items.push({ label: el.getAttribute('aria-label') ? `${label}: ${el.getAttribute('aria-label')}` : label, el });
    });
  }
  document.querySelectorAll<HTMLElement>('h1, h2, h3, h4').forEach((el) => {
    const text = (el.textContent ?? '').trim();
    if (text && visible(el)) items.push({ label: `כותרת רמה ${el.tagName[1]}: ${text}`, el });
  });
  return items;
}

export function AccessibilityWidget({
  statementHref,
  reportHref,
  side = 'left',
}: {
  statementHref: string;
  /** דיווח על בעיה מתוך האתר; בלי זה מוצג רק הקישור להצהרה ובה דרכי הפנייה */
  reportHref?: string;
  side?: 'left' | 'right';
}) {
  const settings = useA11ySettings();
  const hasHebrewVoice = useHebrewVoice();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [structure, setStructure] = useState<StructureItem[] | null>(null);
  const [announce, setAnnounce] = useState('');

  // הגנה: אם הסקריפט המוקדם לא רץ (למשל אחרי ניווט מדף אחר), ההתאמות עדיין מוחלות
  useEffect(() => {
    applyAttributes(settings);
  }, [settings]);

  const open = useCallback(() => {
    setStructure(null);
    dialogRef.current?.showModal();
  }, []);

  // קיצור מקשים, כמו במערכות הנגישות המוכרות בישראל
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'F10') {
        e.preventDefault();
        if (!dialogRef.current?.open) open();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function set<K extends keyof A11ySettings>(key: K, value: A11ySettings[K], message: string) {
    save(changeA11ySetting(settings, key, value));
    setAnnounce(message);
  }
  const flip = (key: 'font' | 'align' | 'links' | 'headings' | 'focus' | 'cursor' | 'targets' | 'motion' | 'hideimages' | 'alttips' | 'speak', label: string) =>
    set(key, !settings[key], `${label}: ${settings[key] ? 'כבוי' : 'פעיל'}`);
  const choose = <K extends 'contrast' | 'color' | 'guide'>(key: K, value: A11ySettings[K], label: string) => {
    const off = settings[key] === value;
    set(key, (off ? 'none' : value) as A11ySettings[K], `${label}: ${off ? 'כבוי' : 'פעיל'}`);
  };

  function goTo(item: StructureItem) {
    dialogRef.current?.close();
    if (!item.el.matches('a, button, input, select, textarea, [tabindex]')) item.el.setAttribute('tabindex', '-1');
    item.el.scrollIntoView({ block: 'center', behavior: settings.motion ? 'auto' : 'smooth' });
    item.el.focus({ preventScroll: true });
  }

  const textNext = (((settings.text + 1) % 4) as A11ySettings['text']);
  const lineNext = (((settings.lineheight + 1) % 3) as A11ySettings['lineheight']);
  const spacingNext = (((settings.spacing + 1) % 3) as A11ySettings['spacing']);

  return (
    <>
      <button
        type="button"
        className="a11y-ui a11y-trigger"
        data-side={side}
        data-testid="a11y-open"
        aria-haspopup="dialog"
        aria-label="פתיחת תפריט נגישות (Ctrl+F10)"
        title="תפריט נגישות (Ctrl+F10)"
        onClick={open}
      >
        <Accessibility aria-hidden="true" />
      </button>

      <PageTools settings={settings} />

      <dialog
        ref={dialogRef}
        className="a11y-ui a11y-panel"
        data-side={side}
        data-testid="a11y-panel"
        aria-labelledby={titleId}
        onClick={(e) => {
          // לחיצה על הרקע סוגרת
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="a11y-panel-head">
          <h2 id={titleId}>תפריט נגישות</h2>
          <button type="button" className="a11y-close" aria-label="סגירת תפריט הנגישות" autoFocus onClick={() => dialogRef.current?.close()}>
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="a11y-panel-body">
          <p role="status" aria-live="polite" className="sr-only">
            {announce}
          </p>

          {structure ? (
            <section className="a11y-section" aria-label="מבנה העמוד">
              <button type="button" className="a11y-action" onClick={() => setStructure(null)}>
                חזרה לתפריט
              </button>
              {structure.length === 0 ? (
                <p className="a11y-note">לא נמצאו כותרות בעמוד הזה.</p>
              ) : (
                <ul className="a11y-structure" data-testid="a11y-structure">
                  {structure.map((item, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => goTo(item)}>
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <>
              <section className="a11y-section">
                <h3>התאמה מהירה</h3>
                <div className="a11y-grid">
                  {(Object.entries(A11Y_PROFILES) as [A11yProfile, (typeof A11Y_PROFILES)[A11yProfile]][]).map(([key, p]) => (
                    <button
                      key={key}
                      type="button"
                      className="a11y-tile"
                      aria-pressed={settings.profile === key}
                      title={p.hint}
                      onClick={() => {
                        const on = settings.profile !== key;
                        save(toggleA11yProfile(settings, key));
                        setAnnounce(`${p.label}: ${on ? 'פעיל' : 'כבוי'}`);
                      }}
                    >
                      <span>{p.label}</span>
                      <small>{p.hint}</small>
                    </button>
                  ))}
                </div>
              </section>

              <section className="a11y-section">
                <h3>טקסט</h3>
                <div className="a11y-grid">
                  <Stepper label="גודל טקסט" icon={ALargeSmall} value={A11Y_TEXT_LABELS[settings.text]} active={settings.text > 0} onClick={() => set('text', textNext, `גודל טקסט: ${A11Y_TEXT_LABELS[textNext]}`)} />
                  <Stepper label="גובה שורה" icon={Rows3} value={A11Y_LEVEL_LABELS[settings.lineheight]} active={settings.lineheight > 0} onClick={() => set('lineheight', lineNext, `גובה שורה: ${A11Y_LEVEL_LABELS[lineNext]}`)} />
                  <Stepper label="מרווח אותיות" icon={Space} value={A11Y_LEVEL_LABELS[settings.spacing]} active={settings.spacing > 0} onClick={() => set('spacing', spacingNext, `מרווח אותיות: ${A11Y_LEVEL_LABELS[spacingNext]}`)} />
                  <Toggle label="גופן קריא" icon={Type} on={settings.font} onClick={() => flip('font', 'גופן קריא')} />
                  <Toggle label="יישור לימין" icon={AlignRight} on={settings.align} onClick={() => flip('align', 'יישור לימין')} />
                </div>
              </section>

              <section className="a11y-section">
                <h3>צבעים</h3>
                <div className="a11y-grid">
                  <Toggle label="ניגודיות כהה" icon={Moon} on={settings.contrast === 'dark'} onClick={() => choose('contrast', 'dark', 'ניגודיות כהה')} />
                  <Toggle label="ניגודיות בהירה" icon={Sun} on={settings.contrast === 'light'} onClick={() => choose('contrast', 'light', 'ניגודיות בהירה')} />
                  <Toggle label="שחור ולבן" icon={Contrast} on={settings.color === 'mono'} onClick={() => choose('color', 'mono', 'שחור ולבן')} />
                  <Toggle label="רוויה נמוכה" icon={Palette} on={settings.color === 'low'} onClick={() => choose('color', 'low', 'רוויה נמוכה')} />
                  <Toggle label="רוויה גבוהה" icon={Baseline} on={settings.color === 'high'} onClick={() => choose('color', 'high', 'רוויה גבוהה')} />
                </div>
              </section>

              <section className="a11y-section">
                <h3>ניווט וקריאה</h3>
                <div className="a11y-grid">
                  <Toggle label="עצירת תנועה" icon={Pause} on={settings.motion} onClick={() => flip('motion', 'עצירת תנועה')} />
                  <Toggle label="הדגשת קישורים" icon={LinkIcon} on={settings.links} onClick={() => flip('links', 'הדגשת קישורים')} />
                  <Toggle label="הדגשת כותרות" icon={Heading} on={settings.headings} onClick={() => flip('headings', 'הדגשת כותרות')} />
                  <Toggle label="סימון פוקוס חזק" icon={Focus} on={settings.focus} onClick={() => flip('focus', 'סימון פוקוס חזק')} />
                  <Toggle label="סמן עכבר גדול" icon={MousePointer2} on={settings.cursor} onClick={() => flip('cursor', 'סמן עכבר גדול')} />
                  <Toggle label="כפתורים גדולים" icon={MousePointerClick} on={settings.targets} onClick={() => flip('targets', 'כפתורים גדולים')} />
                  <Toggle label="סרגל קריאה" icon={Ruler} on={settings.guide === 'line'} onClick={() => choose('guide', 'line', 'סרגל קריאה')} />
                  <Toggle label="מסיכת קריאה" icon={ScanLine} on={settings.guide === 'mask'} onClick={() => choose('guide', 'mask', 'מסיכת קריאה')} />
                  <Toggle label="הסתרת תמונות" icon={EyeOff} on={settings.hideimages} onClick={() => flip('hideimages', 'הסתרת תמונות')} />
                  <Toggle label="תיאור תמונות" icon={ImageIcon} on={settings.alttips} onClick={() => flip('alttips', 'תיאור תמונות')} />
                  <Toggle
                    label="הקראת טקסט"
                    icon={Volume2}
                    on={settings.speak}
                    disabled={!hasHebrewVoice}
                    note={hasHebrewVoice ? undefined : 'אין במכשיר קול בעברית'}
                    onClick={() => flip('speak', 'הקראת טקסט')}
                  />
                  <button type="button" className="a11y-tile" onClick={() => setStructure(readStructure())}>
                    <ListTree aria-hidden="true" />
                    <span>מבנה העמוד</span>
                  </button>
                </div>
              </section>

              <section className="a11y-section">
                <div className="a11y-actions">
                  <button
                    type="button"
                    className="a11y-action"
                    onClick={() => {
                      save({ ...A11Y_DEFAULTS });
                      setAnnounce('כל ההתאמות בוטלו');
                    }}
                  >
                    <RotateCcw aria-hidden="true" /> ביטול כל ההתאמות
                  </button>
                  <a className="a11y-action" href={statementHref}>
                    <FileText aria-hidden="true" /> הצהרת נגישות
                  </a>
                  {reportHref && (
                    <a className="a11y-action" href={reportHref}>
                      <Eye aria-hidden="true" /> דיווח על בעיית נגישות
                    </a>
                  )}
                </div>
                <p className="a11y-note">משתמשים בקורא מסך? אין צורך להפעיל כאן דבר. ההגדרות נשמרות בדפדפן שלכם בלבד. אפשר לפתוח את התפריט גם ב-Ctrl+F10.</p>
              </section>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
