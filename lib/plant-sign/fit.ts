/**
 * התאמת טקסט לתיבה: מקטין את הגופן (במ"מ) עד שהטקסט נכנס לתיבה, בין data-max ל-data-min.
 * רץ בדפדפן (תצוגה מקדימה) ובשרת דרך Chromium (PDF). הפונקציה עצמאית — בלי ייבוא ובלי עזרים —
 * כי היא מועברת ל-Chromium כמחרוזת (fitSignText.toString()).
 */
export function fitSignText(root: ParentNode): number {
  var boxes = root.querySelectorAll('[data-fit]');
  var count = 0;
  for (var i = 0; i < boxes.length; i++) {
    var box = boxes[i] as HTMLElement;
    var inner = box.firstElementChild as HTMLElement | null;
    if (!inner) continue;
    var max = parseFloat(box.getAttribute('data-max') || '3');
    var min = parseFloat(box.getAttribute('data-min') || '2');
    var size = max;
    inner.style.fontSize = size + 'mm';
    var guard = 0;
    while (size > min && guard < 200 && (inner.scrollWidth > box.clientWidth + 0.5 || inner.offsetHeight > box.clientHeight + 0.5)) {
      size = Math.round((size - 0.05) * 100) / 100;
      inner.style.fontSize = size + 'mm';
      guard++;
    }
    count++;
  }
  return count;
}
