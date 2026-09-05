/** Build a readable, credential-free editorial report from the local benchmark. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const dir=resolve(import.meta.dirname,'../docs/engine-evidence');
const report=JSON.parse(await readFile(resolve(dir,'benchmark.json'),'utf8'));
const lines=['# Live trivia engine benchmark','','These are unapproved development candidates using original scripture-reference clues. They are not NIV quotations. Machine passes require human review; nothing in this report was published.',''];
let total=0,selected=0,cost=0,reserved=0;
for(const [i,run] of report.runs.entries()) {
  const state=run.state;const amount=(run.calls??[]).reduce((sum,c)=>sum+Number(c.estimatedCostUsd??0),0);cost+=amount;reserved+=(run.calls??[]).filter(c=>c.estimatedCostUsd==null).reduce((sum,c)=>sum+Number(c.reservedCostUsd??0),0);
  lines.push(`## Round ${i+1}: ${run.brief.kind} / ${run.brief.difficulty}`, '', `Status: ${run.status}. Categories: ${run.brief.categoryIds.join(', ')}. Estimated recorded cost: $${amount.toFixed(4)}.`, '');
  if(!state)continue;
  total+=state.candidates.length;selected+=state.assembly?.selectedIds.length??0;
  lines.push(`Generated: ${state.candidates.length}. Selected: ${state.assembly?.selectedIds.length??'pending'}/${run.brief.count}. Shortfall: ${state.assembly?.shortfall??'pending'}.`, '');
  for(const c of state.candidates) {
    const r=state.reviews[c.id]??{};
    lines.push(`### ${c.id}: ${c.prompt}`,'',c.answers.map((a,j)=>`${j+1}. ${a}${j===c.correctIndex?' **(answer)**':''}`).join('\n'),'',`**Original clue:** ${c.hint}`,'',`**Reference:** ${c.reference}`,'',`**Connection:** ${c.connectionExplanation}`,'');
    for(const stage of ['accuracy','theology','clues'])if(r[stage])lines.push(`- ${stage}: ${r[stage].verdict}, ${r[stage].score}/100. ${(r[stage].reasons??[]).join(' ')}`);
    if(r.playtest)lines.push(`- Blind playtest: ${r.playtest.answerIndex===c.correctIndex?'correct':'incorrect'}, confidence ${r.playtest.confidence}%, ${r.playtest.estimatedSeconds}s. ${r.playtest.reasoning}`);
    const rejected=state.assembly?.rejected.find(x=>x.candidateId===c.id);
    lines.push(`- Assembly: ${state.assembly?.selectedIds.includes(c.id)?'selected for human review':rejected?.reasons.join('; ')??'pending'}`,'');
    if(c.sources?.length)lines.push('Evidence: '+c.sources.map(s=>`[${s.title.replace(/[\[\]]/g,'')}](${s.url})`).join(', '),'');
  }
}
lines.splice(4,0,`Total: ${total} generated candidates; ${selected} selected for human review; $${cost.toFixed(4)} estimated recorded model/search cost; $${reserved.toFixed(4)} retained allowance for unresolved provider outcomes.`, '');
await writeFile(resolve(dir,'BENCHMARK.md'),lines.join('\n')+'\n');
console.log(JSON.stringify({candidates:total,selected,estimatedCostUsd:cost,reservedCostUsd:reserved,report:resolve(dir,'BENCHMARK.md')}));
