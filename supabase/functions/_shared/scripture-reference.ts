// Full English book names only. The provider validates whether the verse exists.
const names = 'Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|Proverbs|Ecclesiastes|Song of Songs|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation'.split('|');
const codes = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' ');
export function scriptureReference(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 160) return null;
  const match = /^(.+?)\s+(\d{1,3}):(\d{1,3})(?:[-–](\d{1,3}))?$/.exec(value.split(' · ')[0].trim());
  if (!match) return null;
  const book = match[1].toLowerCase().replace(/^psalm$/, 'psalms').replace(/^song of solomon$/, 'song of songs');
  const index = names.findIndex(name => name.toLowerCase() === book);
  const chapter = Number(match[2]), start = Number(match[3]), end = Number(match[4] ?? match[3]);
  if (index < 0 || chapter < 1 || chapter > 150 || start < 1 || end < start || end > 176 || end - start > 9) return null;
  return `${codes[index]}.${chapter}.${start}${end === start ? '' : `-${end}`}`;
}
