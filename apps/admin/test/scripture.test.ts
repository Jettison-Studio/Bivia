import test from 'node:test';
import assert from 'node:assert/strict';
import { scriptureReference } from '../../../supabase/functions/_shared/scripture-reference';
test('Scripture requests accept canonical books and bounded same-chapter ranges', () => {
  assert.equal(scriptureReference('Judges 6:36–40'), 'JDG.6.36-40');
  assert.equal(scriptureReference('1 Corinthians 13:4-7 · NIV'), '1CO.13.4-7');
  assert.equal(scriptureReference('Psalm 23:1'), 'PSA.23.1');
  assert.equal(scriptureReference('Song of Solomon 2:1'), 'SNG.2.1');
  assert.equal(scriptureReference('Proverbs 24:13 · Original clue (not a Bible quotation)'), 'PRO.24.13');
});
test('Scripture requests reject URLs, whole chapters, reversed or oversized ranges', () => {
  for (const value of [null, {}, 'https://example.com', 'Genesis 1', 'Genesis 1:0', 'Genesis 1:20-10', 'Genesis 1:1-20', 'John 3:16; Romans 8:1', 'John 3:16/../../secret']) assert.equal(scriptureReference(value), null);
});

import { isGuestPassage } from '../../../supabase/functions/_shared/guest-passages';
test('anonymous Scripture is restricted to the exact five guest readings', () => {
 for (const ref of ['LEV.2.5','JOB.37.3-4','LUK.3.17','JOS.9.4-6','JDG.9.8-15']) assert.equal(isGuestPassage(ref),true);
 for (const ref of ['JHN.3.16','LEV.2.1-10','JDG.9.8','https://example.com','']) assert.equal(isGuestPassage(ref),false);
});
