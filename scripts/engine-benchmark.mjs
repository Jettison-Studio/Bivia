/** Local-only, billed integration benchmark. Never approves or publishes content. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const execute = process.argv.includes('--run');
const resume = process.argv.includes('--resume');
const output = resolve(root, 'docs/engine-evidence/benchmark.json');
const briefs = [
  {kind:'category',categoryIds:['fitness'],count:10,difficulty:'easy',translation:'NIV',sourceMode:'references',notes:'Benchmark A: accessible but genuine fitness trivia. Vary subtopics. A hint should narrow choices without naming the answer. Avoid medical advice or disputed exercise recommendations.'},
  {kind:'category',categoryIds:['science'],count:10,difficulty:'medium',translation:'NIV',sourceMode:'references',notes:'Benchmark B: varied science trivia with fair property or relationship clues. Do not imply scripture scientifically proves a modern fact. Avoid forced analogies and motivational filler.'},
  {kind:'progressive',categoryIds:['fitness','science','geography'],count:10,difficulty:'rising',translation:'NIV',sourceMode:'references',notes:'Benchmark C: mixed-category challenge rising from easy to hard. Vary scripture connections and category order. Increase reasoning complexity, not obscure wording. Never sacrifice fairness to fill a slot.'},
];
if (!execute) {
  console.log('This benchmark performs billed OpenAI calls through the local admin-only engine.');
  console.log('Set BIVIA_BENCHMARK_CREDENTIALS_FILE to a private JSON file containing local admin email/password.');
  console.log('Run: node scripts/engine-benchmark.mjs --run [--resume]');
  console.log(JSON.stringify(briefs,null,2));
  process.exit(0);
}
const credentialFile = process.env.BIVIA_BENCHMARK_CREDENTIALS_FILE;
if (!credentialFile) throw new Error('BIVIA_BENCHMARK_CREDENTIALS_FILE is required; do not put credentials in command arguments.');
const credentials = JSON.parse(await readFile(credentialFile,'utf8'));
const envText = await readFile(resolve(root,'apps/admin/.env.local'),'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(line=>/^[A-Z_]+=/.test(line)).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1).trim().replace(/^['"]|['"]$/g,'')];}));
const base = env.VITE_SUPABASE_URL;
if (!base || !['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('This benchmark is restricted to a local Supabase instance.');
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
let token;
async function request(path, body) {
  const response = await fetch(`${base}${path}`, {method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});
  const data = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${data.message || data.error || 'Request failed'}`);
  return data;
}
const login = await request('/auth/v1/token?grant_type=password',{email:credentials.email,password:credentials.password});
token=login.access_token;
const rpc = (action,payload={})=>request('/rest/v1/rpc/bivia_engine_v1',{p_action:action,p_payload:payload});
const report = resume ? JSON.parse(await readFile(output,'utf8')) : {createdAt:new Date().toISOString(),purpose:'Unapproved editorial benchmark; no NIV text, no publication',runs:[]};
await mkdir(resolve(root,'docs/engine-evidence'),{recursive:true});
const save = ()=>writeFile(output,JSON.stringify(report,null,2)+'\n');
let calls=0;
let polls=0;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
for (let i=0;i<briefs.length;i++) {
  let record=report.runs[i];
  if (!record) {
    record={requestId:crypto.randomUUID(),brief:briefs[i],id:null,status:'not_started'};
    report.runs[i]=record;await save();
  }
  let run=record.id ? await rpc('get',{id:record.id}) : await rpc('create',{requestId:record.requestId,brief:record.brief});
  record.id=run.id;record.status=run.status;record.state=run.state;record.calls=run.calls;record.config=run.config;record.lastError=run.lastError;await save();
  if (run.status === "uncertain" && process.argv.includes(`--recover-uncertain=${run.id}`)) {
    run=await rpc("resolve_uncertain",{id:run.id,reason:"Explicit development recovery after a diagnosed foreground timeout or local reload interruption. Original possible cost remains reserved; approved benchmark continues through durable background processing.",acknowledgePotentialDuplicateCost:true});
    record.recoveredAt=new Date().toISOString();await save();
  }
  if (run.status === "failed" && process.argv.includes(`--retry-stage=${run.id}`)) {
    run=await rpc("retry_stage",{id:run.id,reason:"Explicit benchmark retry after fixing structured review findings length and durable background execution. Prior billed call remains recorded."});
    record.retriedAt=new Date().toISOString();await save();
  }
  const repairArg=process.argv.find(arg=>arg.startsWith(`--repair-candidates=${run.id}:`));
  if (repairArg && run.status==='review') {
    const reasonArg=process.argv.find(arg=>arg.startsWith('--repair-reason='));
    if (!reasonArg) throw new Error('Explicit repair reason is required.');
    const candidateIds=repairArg.split(':')[1].split(',');
    record.previousAssemblies=[...(record.previousAssemblies??[]),run.state.assembly];
    run=await rpc('retry',{id:run.id,candidateIds,reason:reasonArg.slice('--repair-reason='.length)});
    record.repairRequestedAt=new Date().toISOString();await save();
  }
  while(run.state?.nextStage && run.status!=='uncertain' && run.status!=='failed') {
    if (run.status==='running') {
      if (++polls>1500) throw new Error('Benchmark polling cap reached; saved jobs can be resumed.');
      await sleep(3000);
    } else {
      if (++calls>24) throw new Error('Benchmark stage cap reached; inspect saved runs before continuing.');
      console.log(JSON.stringify({round:i+1,id:run.id,stage:run.state.nextStage,status:run.status}));
    }
    try {run=await request('/functions/v1/trivia-engine',{runId:run.id,expectedVersion:run.version});}
    catch(error) {record.error=error.message;await save();throw error;}
    record.status=run.status;record.state=run.state;record.calls=run.calls;record.config=run.config;record.lastError=run.lastError;await save();
  }
  record.status=run.status;record.state=run.state;record.calls=run.calls;record.decisions=run.decisions;record.exportedQuizId=run.exportedQuizId;await save();
  console.log(JSON.stringify({round:i+1,status:run.status,candidates:run.state?.candidates?.length,selected:run.state?.assembly?.selectedIds?.length,shortfall:run.state?.assembly?.shortfall}));
}
console.log(`Saved unapproved benchmark: ${output}`);
