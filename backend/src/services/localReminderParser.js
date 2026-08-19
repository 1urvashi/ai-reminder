// Free, fully local fallback used when the Anthropic API is unavailable (out
// of credits, misconfigured, rate-limited) — no AI cost. Understands English
// (+ romanized Hindi/Gujarati) and native Gujarati/Hindi script for the most
// common reminder phrasing. Good-enough guess; the user can edit the created
// reminder afterwards, so it doesn't need to be perfect.

const WEEKDAYS_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAYS_GU = ['રવિવાર', 'સોમવાર', 'મંગળવાર', 'બુધવાર', 'ગુરુવાર', 'શુક્રવાર', 'શનિવાર'];
const WEEKDAYS_HI = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];

const FILLER_PREFIX =
  /^(please|kripya|jara)\s+|^(remind me to|remind me|set a reminder to|set reminder to|i need to|i have to|don'?t forget to|note to self to)\s*/i;

// Romanized Hindi/Gujarati number words, for "das baje" / "chhe vage" style
// times where the number is spoken/typed as a word, not a digit.
const NUMBER_WORDS = {
  ek: 1, do: 2, be: 2, teen: 3, tran: 3, char: 4, chaar: 4, panch: 5, paanch: 5,
  chhe: 6, chha: 6, che: 6, saat: 7, aath: 8, ath: 8, nau: 9, nav: 9, das: 10,
  gyarah: 11, agiyar: 11, baarah: 12, barah: 12, baar: 12,
};
const NUMBER_WORD_PATTERN = Object.keys(NUMBER_WORDS)
  .sort((a, b) => b.length - a.length)
  .join('|');

function stripAll(text, regex) {
  return text.replace(regex, ' ');
}

function findWeekday(text) {
  for (const [list, isNext] of [
    [WEEKDAYS_EN.map((w) => `next ${w}`), true],
    [WEEKDAYS_GU.map((w) => `આવતા ${w}`), true],
    [WEEKDAYS_HI.map((w) => `अगले ${w}`), true],
    [WEEKDAYS_EN, false],
    [WEEKDAYS_GU, false],
    [WEEKDAYS_HI, false],
  ]) {
    for (const phrase of list) {
      const idx = text.indexOf(phrase);
      if (idx !== -1) {
        const bareName = phrase.replace(/^(next |આવતા |अगले )/, '');
        const target =
          WEEKDAYS_EN.indexOf(bareName) !== -1
            ? WEEKDAYS_EN.indexOf(bareName)
            : WEEKDAYS_GU.indexOf(bareName) !== -1
              ? WEEKDAYS_GU.indexOf(bareName)
              : WEEKDAYS_HI.indexOf(bareName);
        return { phrase, target, isNext };
      }
    }
  }
  return null;
}

export function parseReminderText(rawText, now = new Date()) {
  let text = ` ${rawText.trim().toLowerCase()} `;
  let recurrence = 'none';
  let priority = 'normal';
  let dateSet = false;
  let timeSet = false;
  const result = new Date(now);

  // --- Recurrence ---
  if (/\b(every ?day|daily|roz|hamesha|hammesha)\b|રોજ|દરરોજ|હંમેશા|रोज़?ाना?|हमेशा/.test(text)) {
    recurrence = 'daily';
    text = stripAll(text, /\b(every ?day|daily|roz|hamesha|hammesha)\b/g);
    text = stripAll(text, /રોજ|દરરોજ|હંમેશા|रोज़?ाना?|हमेशा/g);
  } else if (/\bevery (morning|afternoon|evening|night)\b/.test(text)) {
    recurrence = 'daily';
    text = text.replace(/\bevery (?=(morning|afternoon|evening|night)\b)/, ' ');
  } else if (/\b(every week|weekly)\b|દર\s*અઠવાડિયે|हर\s*हफ्ते/.test(text)) {
    recurrence = 'weekly';
    text = stripAll(text, /\b(every week|weekly)\b/g);
    text = stripAll(text, /દર\s*અઠવાડિયે|हर\s*हफ्ते/g);
  } else if (/\b(every month|monthly)\b|દર\s*મહિને|हर\s*महीने/.test(text)) {
    recurrence = 'monthly';
    text = stripAll(text, /\b(every month|monthly)\b/g);
    text = stripAll(text, /દર\s*મહિને|हर\s*महीने/g);
  } else if (/\b(every year|yearly|annually)\b|દર\s*વર્ષે|हर\s*साल/.test(text)) {
    recurrence = 'yearly';
    text = stripAll(text, /\b(every year|yearly|annually)\b/g);
    text = stripAll(text, /દર\s*વર્ષે|हर\s*साल/g);
  }

  // --- Priority ---
  if (/\b(urgent|important|high priority|asap|zaroori)\b|જરૂરી|અગત્યનું|जरूरी|महत्वपूर्ण|अर्जेंट/.test(text)) {
    priority = 'high';
    text = stripAll(text, /\b(urgent|important|high priority|asap|zaroori)\b/g);
    text = stripAll(text, /જરૂરી|અગત્યનું|जरूरी|महत्वपूर्ण|अर्जेंट/g);
  } else if (/\b(low priority|not urgent|whenever)\b/.test(text)) {
    priority = 'low';
    text = stripAll(text, /\b(low priority|not urgent|whenever)\b/g);
  }

  // --- Relative "in N minutes/hours/days" ---
  const relMatch = text.match(/\bin\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)\b/);
  if (relMatch) {
    const n = parseInt(relMatch[1], 10);
    const unit = relMatch[2];
    if (unit.startsWith('min')) result.setMinutes(result.getMinutes() + n);
    else if (unit.startsWith('h')) result.setHours(result.getHours() + n);
    else result.setDate(result.getDate() + n);
    text = text.replace(relMatch[0], ' ');
    dateSet = true;
    timeSet = true;
  }

  // --- Date words ---
  if (!dateSet) {
    if (/\bday after tomorrow\b|પરમ\s*દિવસે|परसों/.test(text)) {
      result.setDate(result.getDate() + 2);
      text = stripAll(text, /\bday after tomorrow\b|પરમ\s*દિવસે|परसों/g);
      dateSet = true;
    } else if (/\b(tomorrow|tmrw|kal|kaal)\b|કાલે|આવતીકાલે|कल/.test(text)) {
      result.setDate(result.getDate() + 1);
      text = stripAll(text, /\b(tomorrow|tmrw|kal|kaal)\b|કાલે|આવતીકાલે|कल/g);
      dateSet = true;
    } else if (/\b(today|aaj)\b|આજે|आज/.test(text)) {
      text = stripAll(text, /\b(today|aaj)\b|આજે|आज/g);
      dateSet = true;
    } else {
      const wd = findWeekday(text);
      if (wd) {
        let diff = (wd.target - result.getDay() + 7) % 7;
        if (diff === 0 && wd.isNext) diff = 7;
        result.setDate(result.getDate() + diff);
        text = text.replace(wd.phrase, ' ');
        dateSet = true;
      }
    }
  }

  // --- Time of day ---
  if (/\bnoon\b/.test(text)) {
    result.setHours(12, 0, 0, 0);
    text = text.replace(/\bnoon\b/, ' ');
    timeSet = true;
  } else if (/\bmidnight\b/.test(text)) {
    result.setHours(0, 0, 0, 0);
    text = text.replace(/\bmidnight\b/, ' ');
    timeSet = true;
  }

  if (!timeSet) {
    let hour = null;
    let minute = 0;
    let tm = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (!tm) tm = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (!tm) tm = text.match(/(\d{1,2})(?::(\d{2}))?\s*(?:વાગે|વાગ્યે|बजे|baje|vage|vagye|vaage)\b/i);
    if (tm) {
      hour = parseInt(tm[1], 10);
      minute = tm[2] ? parseInt(tm[2], 10) : 0;
      const meridiem = tm[3] && /^(am|pm)$/i.test(tm[3]) ? tm[3].toLowerCase() : null;
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;
      if (!meridiem && hour >= 1 && hour <= 7) hour += 12; // e.g. "at 6" usually means evening
      text = text.replace(tm[0], ' ');
      timeSet = true;
    } else {
      const oClock = text.match(/\b(\d{1,2})\s*o'?clock\b/i);
      const wordTime = text.match(new RegExp(`\\b(${NUMBER_WORD_PATTERN})\\s+(baje|vage|vagye|vaage)\\b`, 'i'));
      if (oClock) {
        hour = parseInt(oClock[1], 10);
        if (hour >= 1 && hour <= 7) hour += 12;
        text = text.replace(oClock[0], ' ');
        timeSet = true;
      } else if (wordTime) {
        hour = NUMBER_WORDS[wordTime[1].toLowerCase()];
        if (hour >= 1 && hour <= 7) hour += 12;
        text = text.replace(wordTime[0], ' ');
        timeSet = true;
      } else if (/\b(morning|subah)\b|સવારે|सुबह/.test(text)) {
        hour = 9;
        text = stripAll(text, /\b(morning|subah)\b|સવારે|सुबह/g);
        timeSet = true;
      } else if (/\bafternoon\b|બપોરે|दोपहर/.test(text)) {
        hour = 14;
        text = stripAll(text, /\bafternoon\b|બપોરે|दोपहर/g);
        timeSet = true;
      } else if (/\b(evening|sham|saanjhe)\b|સાંજે|शाम/.test(text)) {
        hour = 18;
        text = stripAll(text, /\b(evening|sham|saanjhe)\b|સાંજે|शाम/g);
        timeSet = true;
      } else if (/\b(night|raat)\b|રાત્રે|रात/.test(text)) {
        hour = 21;
        text = stripAll(text, /\b(night|raat)\b|રાત્રે|रात/g);
        timeSet = true;
      }
    }
    if (timeSet) {
      result.setHours(hour, minute, 0, 0);
    }
  }

  if (!timeSet) {
    result.setHours(9, 0, 0, 0);
  }
  if (!dateSet && result.getTime() <= now.getTime()) {
    result.setDate(result.getDate() + 1);
  }

  // --- Title cleanup ---
  let title = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(FILLER_PREFIX, '')
    .replace(/\b(at|on|this)\b/g, ' ')
    .replace(/મને\s+|મારે\s+|યાદ\s+અપાવજે|યાદ\s+અપાવજો|યાદ\s+કરાવજે|યાદ\s+કરાવજો|યાદ\s+રાખજે/g, ' ')
    .replace(/मुझे\s+|मुझको\s+|याद\s+दिला(ओ|ना|एं)|याद\s+रखना/g, ' ')
    .replace(/છે/g, ' ')
    .replace(/है|हैं/g, ' ')
    .replace(/\b(hain|hai|che|chhe)\b/gi, ' ')
    .replace(/[.]+/g, ' ')
    .replace(/\s*,\s*/g, ' ')
    .replace(/[,]+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!title) {
    title = rawText.trim();
  }
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return { title, datetime: result, recurrence, priority };
}
