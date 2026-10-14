'use strict';
/* ===================== DATA ===================== */
const PLAYERS = [
  // id, name, team, role, selection %, captain %, vice-captain %
  ['bhatia','Arjun Bhatia','NAG','WK',68,3,5],
  ['deshmukh','Rohan Deshmukh','NAG','BAT',86,16,15],
  ['sethi','Kabir Sethi','NAG','BAT',26,0,0.5],
  ['rathore','Vikram Rathore','NAG','AR',79,12,14],
  ['iyer','Siddharth Iyer','NAG','BAT',38,1,0.5],
  ['gill','Manav Gill','NAG','AR',38,1,1.5],
  ['parmar','Yash Parmar','NAG','BAT',9,0,0.2],
  ['qureshi','Tanveer Qureshi','NAG','BOWL',61,3,5],
  ['kulkarni','Pranav Kulkarni','NAG','BOWL',33,0.5,0.5],
  ['malhotra','Dev Malhotra','NAG','BOWL',55,2,4],
  ['chauhan','Ishaan Chauhan','NAG','BOWL',41,1,1.5],
  ['krishnan','Aarav Krishnan','KOC','BAT',88,30,16],
  ['thomas','Jai Thomas','KOC','WK',63,3,6],
  ['rao','Nikhil Rao','KOC','BAT',82,18,18],
  ['vardhan','Harsh Vardhan','KOC','BAT',34,0.5,0.5],
  ['nair','Rahul Nair','KOC','AR',58,4,7],
  ['varma','Kunal Varma','KOC','AR',42,1,1],
  ['menon','Aditya Menon','KOC','BOWL',66,3,5],
  ['ahmed','Faiz Ahmed','KOC','BOWL',39,0,0.5],
  ['joshi','Sameer Joshi','KOC','BOWL',55,1,1],
  ['pillai','Neel Pillai','KOC','BOWL',18,0,0.2],
  ['prakash','Om Prakash','KOC','BOWL',9,0,0.1],
].map(([id,name,team,role,sel,c,vc],i)=>({i,id,name,team,role,sel,c,vc,short:name.split(' ').slice(-1)[0]}));
const NP = PLAYERS.length;
const PI = Object.fromEntries(PLAYERS.map(p=>[p.id,p.i]));
const TARGET = 185, CONTEST = 250000, PRIZE_ZONE = 60000, N_RIVALS = 2500, SCALE = CONTEST/N_RIVALS;
const ORDER = ['krishnan','thomas','rao','vardhan','nair','varma','menon','ahmed','joshi','pillai','prakash'];
const OVER_BOWLER = ['qureshi','chauhan','qureshi','chauhan','kulkarni','malhotra','kulkarni','malhotra','rathore','malhotra','rathore','malhotra','gill','kulkarni','rathore','chauhan','qureshi','kulkarni','chauhan','qureshi'];
// Scripted dismissals, keyed "over.ball" (over counted from 0, ball 1-6)
const WICKETS = {
  '1.4':{who:'krishnan',kind:'c',f:'bhatia'},
  '6.2':{who:'thomas',kind:'b'},
  '11.5':{who:'vardhan',kind:'lbw'},
  '15.1':{who:'nair',kind:'c',f:'deshmukh'},
  '17.3':{who:'varma',kind:'c',f:'gill'},
  '19.2':{who:'menon',kind:'c',f:'bhatia'},
};
const POWER = {krishnan:1.15,thomas:1.0,rao:1.3,vardhan:0.85,nair:1.2,varma:1.05,menon:0.75,ahmed:0.55,joshi:0.5,pillai:0.4,prakash:0.35};
// Six entries in the same mega contest, the way multi-team players actually play
const TEAM_DEFS = [
  {ids:['rao','deshmukh','bhatia','thomas','rathore','nair','gill','menon','malhotra','chauhan','joshi'],c:'rao',vc:'deshmukh'},
  {ids:['krishnan','deshmukh','rao','rathore','bhatia','menon','thomas','qureshi','nair','malhotra','joshi'],c:'krishnan',vc:'rao'},
  {ids:['bhatia','deshmukh','krishnan','rao','rathore','qureshi','kulkarni','malhotra','chauhan','menon','ahmed'],c:'qureshi',vc:'menon'},
  {ids:['bhatia','deshmukh','iyer','krishnan','rao','rathore','gill','nair','qureshi','menon','joshi'],c:'rathore',vc:'krishnan'},
  {ids:['thomas','krishnan','rao','vardhan','nair','varma','deshmukh','rathore','menon','qureshi','malhotra'],c:'nair',vc:'rao'},
  {ids:['thomas','sethi','iyer','rao','varma','gill','rathore','kulkarni','chauhan','ahmed','pillai'],c:'thomas',vc:'varma'},
];
const DEFAULT_TEAM = TEAM_DEFS[0];
const SEED = 62;

/* ===================== ENGINE ===================== */
function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function blank(){return {r:0,b:0,f4:0,f6:0,out:false,batted:false,w:0,bl:0,rc:0,bb:0,md:0,ct:0};}
function fantasyPts(s){
  let p=4;
  if(s.batted){
    p+=s.r+4*s.f4+6*s.f6;
    p+= s.r>=100?16 : s.r>=75?12 : s.r>=50?8 : s.r>=25?4 : 0;
    if(s.out&&s.r===0)p-=2;
  }
  p+=30*s.w+8*s.bl+(s.w>=5?16:s.w>=4?8:s.w>=3?4:0)+12*s.md;
  p+=8*s.ct+(s.ct>=3?4:0);
  return p;
}
function oversTxt(balls){return Math.floor(balls/6)+'.'+(balls%6);}
function summary(s,p){
  const parts=[];
  if(s.batted) parts.push(`${s.r}${s.out?'':'*'} (${s.b})`);
  else if(p.team==='KOC'&&['BAT','WK','AR'].includes(p.role)) parts.push('yet to bat');
  if(s.bb>0) parts.push(`${s.w}/${s.rc} (${oversTxt(s.bb)})`);
  if(s.ct) parts.push(`${s.ct} ct`);
  return parts.join(' · ')||'—';
}
function firstInnings(st){
  const bat=(id,r,b,f4,f6,out)=>Object.assign(st[id],{r,b,f4,f6,out,batted:true});
  bat('bhatia',12,9,1,0,true);bat('deshmukh',67,41,6,3,true);bat('sethi',8,7,1,0,true);
  bat('rathore',41,22,2,3,true);bat('iyer',23,17,2,0,true);bat('gill',18,14,1,1,false);bat('parmar',5,3,0,0,false);
  const bowl=(id,bb,rc,w,bl)=>Object.assign(st[id],{bb,rc,w,bl});
  bowl('menon',24,34,2,1);bowl('ahmed',24,41,1,0);bowl('nair',18,29,1,0);bowl('joshi',24,28,1,1);bowl('varma',18,30,0,0);bowl('pillai',12,17,0,0);
  st.thomas.ct=2;st.nair.ct=1;
}
function pickRuns(R,id,over){
  const pw=POWER[id]||0.6, ph=over<6?1.05:over<15?0.9:1.4;
  const w=[[0,30/pw],[1,36],[2,9],[3,1.2],[4,11*pw*ph],[6,5.5*pw*ph*ph]];
  let tot=w.reduce((a,x)=>a+x[1],0),x=R()*tot;
  for(const [r,wt] of w){if((x-=wt)<=0)return r;}
  return 1;
}
function simulate(seed){
  const R=rng(seed), st={};
  PLAYERS.forEach(p=>st[p.id]=blank()); firstInnings(st);
  const frames=[];
  let score=0,wk=0,balls=0,striker='krishnan',non='thomas',next=2,ended=false,result=null;
  st.krishnan.batted=st.thomas.batted=true;
  const snap=(ev)=>{
    const bw=ev.bowler||OVER_BOWLER[Math.min(19,Math.floor(balls/6))];
    frames.push({ev,score,wk,balls,striker,non,
      sS:{r:st[striker].r,b:st[striker].b},nS:{r:st[non].r,b:st[non].b},
      bowler:bw,bowlFig:`${oversTxt(st[bw].bb)}-${st[bw].md}-${st[bw].rc}-${st[bw].w}`,
      nextBowler:OVER_BOWLER[Math.min(19,Math.floor(balls/6))],
      pts:PLAYERS.map(p=>fantasyPts(st[p.id])),
      summ:PLAYERS.map(p=>summary(st[p.id],p)),
      out:PLAYERS.map(p=>st[p.id].out),
      bowledBalls:PLAYERS.map(p=>p.team==='NAG'?st[p.id].bb:0)});
  };
  snap({type:'start'});
  for(let over=0;over<20&&!ended;over++){
    const bw=OVER_BOWLER[over]; let overRuns=0;
    for(let ball=1;ball<=6;ball++){
      const spec=WICKETS[over+'.'+ball], ev={over,ball,bowler:bw};
      if(spec&&(spec.who===striker||spec.who===non)){
        if(spec.who!==striker)[striker,non]=[non,striker];
        const s=st[striker]; s.b++; s.out=true; st[bw].bb++; st[bw].w++;
        if(spec.kind==='b'||spec.kind==='lbw')st[bw].bl++;
        if(spec.kind==='c')st[spec.f].ct++;
        wk++; Object.assign(ev,{type:'W',batter:striker,kind:spec.kind,fielder:spec.f,runs:0,batR:s.r,batB:s.b});
        if(wk>=10)ended=true; else {striker=ORDER[next++];st[striker].batted=true;ev.newBatter=striker;}
      } else {
        const r=pickRuns(R,striker,over), s=st[striker], before=s.r;
        s.b++;s.r+=r;if(r===4)s.f4++;if(r===6)s.f6++;st[bw].bb++;st[bw].rc+=r;overRuns+=r;score+=r;
        Object.assign(ev,{type:'R',batter:striker,runs:r});
        for(const m of [25,50,75,100]) if(before<m&&s.r>=m) ev.milestone=m;
        if(r%2===1)[striker,non]=[non,striker];
      }
      balls++;
      if(score>=TARGET){ended=true;result=`Kochi Comets win by ${10-wk} wicket${10-wk===1?'':'s'} with ${120-balls} ball${120-balls===1?'':'s'} to spare`;}
      if(ball===6){ev.overEnd=true;if(overRuns===0)st[bw].md++;if(!ended)[striker,non]=[non,striker];}
      snap(ev);
      if(ended)break;
    }
  }
  if(!result){const d=TARGET-1-score;result=d===0?'Match tied':`Nagpur Nomads win by ${d} run${d===1?'':'s'}`;}
  return {frames,result};
}
function makeRivals(N,seed){
  const R=rng(seed), M=new Float32Array(N*NP);
  const wpick=(cands,wf)=>{let t=cands.reduce((a,i)=>a+wf(i),0),x=R()*t;for(const i of cands){if((x-=wf(i))<=0)return i;}return cands[cands.length-1];};
  for(let r=0;r<N;r++){
    let picks=PLAYERS.filter(p=>R()<p.sel/100).map(p=>p.i);
    while(picks.length>11){const k=wpick(picks,i=>101-PLAYERS[i].sel);picks=picks.filter(i=>i!==k);}
    while(picks.length<11){const rest=PLAYERS.map(p=>p.i).filter(i=>!picks.includes(i));picks.push(wpick(rest,i=>PLAYERS[i].sel));}
    const c=wpick(picks,i=>PLAYERS[i].c+0.05);
    const vc=wpick(picks.filter(i=>i!==c),i=>PLAYERS[i].vc+0.05);
    for(const i of picks)M[r*NP+i]=i===c?2:i===vc?1.5:1;
  }
  return M;
}

/* ===================== MODEL ===================== */
const SIM = simulate(SEED);
const FRAMES = SIM.frames;
const RIVAL_M = makeRivals(N_RIVALS, 7);
const RIVAL_SCORES = FRAMES.map(f=>{const out=new Float64Array(N_RIVALS);for(let r=0;r<N_RIVALS;r++){let s=0;const o=r*NP;for(let i=0;i<NP;i++){const m=RIVAL_M[o+i];if(m)s+=m*f.pts[i];}out[r]=s;}return out;});
const AVG_M=new Float64Array(NP), OWN=new Float64Array(NP), CAP=new Float64Array(NP);
for(let r=0;r<N_RIVALS;r++)for(let i=0;i<NP;i++){const m=RIVAL_M[r*NP+i];AVG_M[i]+=m;if(m)OWN[i]++;if(m===2)CAP[i]++;}
for(let i=0;i<NP;i++){AVG_M[i]/=N_RIVALS;OWN[i]=Math.round(OWN[i]/N_RIVALS*100);CAP[i]=Math.round(CAP[i]/N_RIVALS*100);}

const AVG=RIVAL_SCORES.map(s=>s.reduce((a,b)=>a+b,0)/N_RIVALS);
let TEAMS=[], act=0, team=null, MY_M=null, YOU=[], RANK=[], MOMENTS=[];
function rankFor(you,scores,boostI,boost){
  let above=0,tie=0;
  for(let r=0;r<N_RIVALS;r++){
    const s=boost?scores[r]+boost*RIVAL_M[r*NP+boostI]:scores[r];
    if(s>you+1e-9)above++;else if(s>you-1e-9)tie++;
  }
  return Math.max(1,Math.round(1+(above+tie*0.5)*SCALE));
}
function scoreAtRank(f,K){const s=Array.from(RIVAL_SCORES[f]).sort((a,b)=>b-a);return s[Math.min(N_RIVALS-1,Math.max(0,Math.floor((K-1)/SCALE)))];}
function computeTeam(t,k){
  const M=new Float64Array(NP);
  for(const id of t.ids)M[PI[id]]=id===t.c?2:id===t.vc?1.5:1;
  const you=FRAMES.map(f=>f.pts.reduce((a,p,i)=>a+p*M[i],0));
  const rank=FRAMES.map((f,j)=>rankFor(you[j],RIVAL_SCORES[j]));
  return {name:'Team '+(k+1),ids:[...t.ids],c:t.c,vc:t.vc,M,YOU:you,RANK:rank};
}
function focus(k){
  act=k; const T=TEAMS[k]; team=T; MY_M=T.M; YOU=T.YOU; RANK=T.RANK; MOMENTS=buildMoments();
}
function setTeam(t){ // replace the focused team
  TEAMS[act]=computeTeam(t,act); focus(act);
}
function initTeams(){TEAMS=TEAM_DEFS.map((t,k)=>computeTeam(t,k));focus(0);}
function boostRank(f,i,add){return rankFor(YOU[f]+add*MY_M[i],RIVAL_SCORES[f],i,add);}
function teamBoost(T,f,i,add){return rankFor(T.YOU[f]+add*T.M[i],RIVAL_SCORES[f],i,add)-T.RANK[f];}
// How many of your teams a given event helps / hurts
function helps(f,i,add){let up=0,down=0;for(const T of TEAMS){const d=teamBoost(T,f,i,add);if(d<=-SCALE)up++;else if(d>=SCALE)down++;}return {up,down};}
function teamLabel(T){return `${sh(T.c)} (C) · ${sh(T.vc)} (VC)`;}

/* ===================== LANGUAGE HELPERS ===================== */
const fmt=n=>Math.round(n).toLocaleString('en-IN');
const P1=n=>(Math.round(n*10)/10).toLocaleString('en-IN');
const nm=id=>PLAYERS[PI[id]].name;
const sh=id=>PLAYERS[PI[id]].short;
// L = 'English' | 'Hinglish' | 'Hindi'. tx picks the phrase for the chosen language.
const tx=(L,en,hg,hi)=>L==='Hinglish'?hg:L==='Hindi'?hi:en;
let LG='English';
const tr=(en,hg,hi)=>tx(LG,en,hg,hi);
// Fixed page text in all three languages, keyed by data-i on the element
const STATIC={
  tagline:['Your fantasy rank, explained ball by ball.','Aapka fantasy rank, har ball ke saath samjhaaya.','आपकी फ़ैंटेसी रैंक, हर गेंद पर समझाई गई।'],
  langlbl:['Language','Bhasha','भाषा'],
  demo:['Demo · replayed T20 chase · fictional players','Demo · replay T20 chase · kaalpanik players','डेमो · दोबारा चलाया गया T20 चेज़ · काल्पनिक खिलाड़ी'],
  p1q:['"My rank fell 20,000. Why?"','"Mera rank 20,000 gira. Kyun?"','"मेरी रैंक 20,000 गिरी। क्यों?"'],
  p1a:['Every swing, explained.','Har badlaav ki wajah.','हर बदलाव की वजह।'],
  p2q:['"I missed 5 overs on the metro."','"Metro mein 5 overs miss ho gaye."','"मेट्रो में 5 ओवर छूट गए।"'],
  p2a:['A 15-second recap.','15 second mein poora haal.','15 सेकंड में पूरा हाल।'],
  p3q:['"I have 6 teams. Which are still alive?"','"Meri 6 teams hain. Kaunsi abhi race mein hain?"','"मेरी 6 टीमें हैं। कौन-सी अब भी दौड़ में हैं?"'],
  p3a:['All teams, one view.','Saari teams, ek jagah.','सारी टीमें, एक जगह।'],
  chasing:['chasing','chase kar rahe','का पीछा कर रहे'],
  restart:['Restart','Restart','शुरू से'],
  nextball:['Next ball','Agli ball','अगली गेंद'],
  myteams:['My teams','Meri teams','मेरी टीमें'],
  contest:['2,50,000 teams · top 60,000 win','2,50,000 teams · top 60,000 jeetenge','2,50,000 टीमें · टॉप 60,000 जीतेंगी'],
  yourpts:['Your points','Aapke points','आपके अंक'],
  avgriv:['Avg rival','Average rival','औसत विरोधी'],
  pzone:['Prize zone','Prize zone','प्राइज़ ज़ोन'],
  feedh:['Why your rank moved','Rank kyun hila','रैंक क्यों बदली'],
  nowh:['Right now','Abhi','अभी'],
  nowaside:['next ball','agli ball','अगली गेंद'],
  askh:['Ask Rank Radar','Rank Radar se poocho','Rank Radar से पूछें'],
  askbtn:['Ask','Poocho','पूछें'],
  ansq:['Try a question above','Upar koi sawaal chuno','ऊपर कोई सवाल चुनें'],
  ansa:['Tap a question. Every answer uses your teams, the live score and the other 2,50,000 teams.','Koi sawaal chuno. Har jawab aapki teams, live score aur baaki 2,50,000 teams par based hai.','कोई सवाल चुनें। हर जवाब आपकी टीमों, लाइव स्कोर और बाकी 2,50,000 टीमों पर आधारित है।'],
  editbtn:['Edit team','Team badlo','टीम बदलें'],
  foot:['Demo: a fictional T20 chase replayed against 2,500 simulated rival teams, scaled to a 2,50,000-team contest. Ranks are computed every ball; Claude only explains them. In production, a live ball-by-ball feed and real contest ownership would replace the simulation.',
    'Demo: ek kaalpanik T20 chase, 2,500 simulated rival teams ke against, 2,50,000-team contest tak scale kiya. Rank har ball par calculate hota hai; Claude sirf use samjhaata hai. Production mein live ball-by-ball feed aur asli contest data simulation ki jagah lenge.',
    'डेमो: एक काल्पनिक T20 चेज़, 2,500 सिम्युलेटेड विरोधी टीमों के खिलाफ़, 2,50,000 टीमों के कॉन्टेस्ट तक बढ़ाया गया। रैंक हर गेंद पर गिनी जाती है; Claude सिर्फ़ उसे समझाता है। असली प्रोडक्ट में लाइव बॉल-बाय-बॉल फ़ीड और असली कॉन्टेस्ट डेटा सिम्युलेशन की जगह लेंगे।'],
  pmine:['Differential team','Alag team','अलग टीम'],
  pcrowd:['Most-picked team','Sabse popular team','सबसे लोकप्रिय टीम'],
  cancel:['Cancel','Cancel','रद्द करें'],
  save:['Save team','Team save karo','टीम सेव करें'],
};
function applyStatic(){
  const k=LG==='Hinglish'?1:LG==='Hindi'?2:0;
  document.querySelectorAll('[data-i]').forEach(el=>{const v=STATIC[el.dataset.i];if(v)el.textContent=v[k];});
  document.documentElement.lang=LG==='Hindi'?'hi':'en';
}

function roleWord(i,L='English'){const m=MY_M[i];
  return m===2?tx(L,'your captain','aapka captain','आपका कप्तान'):m===1.5?tx(L,'your vice-captain','aapka vice-captain','आपका उप-कप्तान'):m===1?tx(L,'in your team','aapki team mein','आपकी टीम में'):tx(L,'not in your team','aapki team mein nahi','आपकी टीम में नहीं');}
function ownPhrase(i,L='English'){
  const m=MY_M[i],o=OWN[i],c=CAP[i];
  if(m===2)return tx(L,`your captain, and only ${c}% of rivals made him captain`,`aapka captain hai, aur sirf ${c}% rivals ne use captain banaya`,`आपका कप्तान है, और सिर्फ़ ${c}% विरोधियों ने उसे कप्तान बनाया`);
  if(m===1.5)return tx(L,`your vice-captain (${o}% of rivals own him, ${c}% as captain)`,`aapka vice-captain hai (${o}% rivals ke paas hai, ${c}% ne captain banaya)`,`आपका उप-कप्तान है (${o}% विरोधियों के पास है, ${c}% ने कप्तान बनाया)`);
  if(m===1)return c>=10?tx(L,`in your team, but ${c}% of rivals have him as captain, so they gain more`,`aapki team mein hai, par ${c}% rivals ne use captain banaya, toh unhe zyada fayda`,`आपकी टीम में है, लेकिन ${c}% विरोधियों ने उसे कप्तान बनाया, इसलिए उन्हें ज़्यादा फ़ायदा`)
    :tx(L,`in your team (${o}% of rivals have him too)`,`aapki team mein hai (${o}% rivals ke paas bhi)`,`आपकी टीम में है (${o}% विरोधियों के पास भी)`);
  return tx(L,`not in your team, while ${o}% of rivals have him${c>=5?`, ${c}% as captain`:''}`,`aapki team mein nahi, par ${o}% rivals ke paas hai${c>=5?`, ${c}% ne captain banaya`:''}`,`आपकी टीम में नहीं, पर ${o}% विरोधियों के पास है${c>=5?`, ${c}% ने कप्तान बनाया`:''}`);
}
function rankDelta(d){ // d = new rank - old rank (negative is better)
  if(Math.abs(d)<SCALE)return {cls:'flat',txt:tr('no change','koi badlaav nahi','कोई बदलाव नहीं')};
  return d<0?{cls:'up',txt:'▲ '+fmt(-d)}:{cls:'down',txt:'▼ '+fmt(d)};
}
function gains(f0,f1){
  const a=FRAMES[f0].pts,b=FRAMES[f1].pts;let you=0,avg=0;const per=[];
  for(let i=0;i<NP;i++){const d=b[i]-a[i];if(!d)continue;you+=d*MY_M[i];avg+=d*AVG_M[i];per.push({i,d,edge:d*(MY_M[i]-AVG_M[i])});}
  per.sort((x,y)=>Math.abs(y.edge)-Math.abs(x.edge));
  return {you,avg,per};
}
function dismissal(ev){return ev.kind==='c'?`c ${sh(ev.fielder)} b ${sh(ev.bowler)}`:ev.kind==='b'?`b ${sh(ev.bowler)}`:`lbw b ${sh(ev.bowler)}`;}

/* ===================== MOMENTS ===================== */
function buildMoments(){
  const out=[], L=LG;
  { // innings break
    const cont=PLAYERS.map(p=>({i:p.i,edge:FRAMES[0].pts[p.i]*(MY_M[p.i]-AVG_M[p.i])})).sort((a,b)=>Math.abs(b.edge)-Math.abs(a.edge)).slice(0,2);
    const r0=fmt(RANK[0]),y0=P1(YOU[0]),a0=P1(AVG[0]);
    out.push({f:0,ov:tr('Break','Break','ब्रेक'),dir:'flat',
      title:tr(`Innings break: you start the chase at #${r0}`,`Innings break: aap chase #${r0} se shuru kar rahe ho`,`पारी का ब्रेक: आप चेज़ #${r0} से शुरू कर रहे हैं`),
      body:tr(`You have ${y0} points; the average rival has ${a0}. `,`Aapke ${y0} points, average rival ke ${a0}. `,`आपके ${y0} अंक, औसत विरोधी के ${a0}। `)+cont.map(c=>{const n=PLAYERS[c.i].name,pt=FRAMES[0].pts[c.i],own=ownPhrase(c.i,L);
        return tr(`${n} (${pt} pts) is ${own}.`,`${n} (${pt} pts) ${own}.`,`${n} (${pt} अंक) ${own}।`);}).join(' '),delta:null});
  }
  let overStart=0;
  for(let f=1;f<FRAMES.length;f++){
    const ev=FRAMES[f].ev, g=gains(f-1,f), d=RANK[f]-RANK[f-1], rd=rankDelta(d), ov=`${ev.over}.${ev.ball}`;
    const bi=PI[ev.batter], gy=P1(g.you), ga=P1(g.avg);
    if(ev.type==='W'){
      const b=PLAYERS[bi];
      let body=tr(`You gained ${gy} pts, the average rival ${ga}. `,`Aapko ${gy} pts mile, average rival ko ${ga}. `,`आपको ${gy} अंक मिले, औसत विरोधी को ${ga}। `);
      const scorers=g.per.filter(x=>x.i!==bi).map(x=>`${PLAYERS[x.i].short} +${x.d} (${roleWord(x.i,L)})`);
      if(scorers.length){const j=scorers.join(tr(' and ',' aur ',' और '));body+=tr(`Points went to ${j}. `,`Points mile: ${j}. `,`अंक मिले: ${j}। `);}
      const o=OWN[bi],c=CAP[bi],R=ev.batR;
      if(MY_M[bi]===0&&o>=40)body+=tr(`${b.short} is gone for ${R}: ${o}% of rivals own him${c>=5?` and ${c}% made him captain`:''}, and they lose all his future runs.`,
        `${b.short} ${R} par out: ${o}% rivals ke paas tha${c>=5?`, ${c}% ne captain banaya tha`:''}, ab unhe uske aur runs nahi milenge.`,
        `${b.short} ${R} पर आउट: ${o}% विरोधियों के पास था${c>=5?`, ${c}% ने कप्तान बनाया था`:''}, अब उन्हें उसके और रन नहीं मिलेंगे।`);
      else if(MY_M[bi]>0){const role=roleWord(bi,L);body+=tr(`That hurts your future upside: ${b.short} is ${role} and can't score any more.`,`Yeh aapke liye nuksaan: ${b.short} ${role} tha, ab aur score nahi karega.`,`यह आपके लिए नुकसान: ${b.short} ${role} था, अब और स्कोर नहीं करेगा।`);}
      out.push({f,ov,dir:rd.cls,title:`${tr('Wicket','Wicket','विकेट')} · ${b.name} ${dismissal(ev)} ${ev.batR}(${ev.batB})`,body,delta:rd});
    } else if(ev.runs>=4||ev.milestone){
      const lev=MY_M[bi]-AVG_M[bi];
      if(Math.abs(lev)>0.25||ev.milestone){
        const n=PLAYERS[bi].name,m=ev.milestone;
        const what=m?tr(`${m} up for ${n}`,`${n} ke ${m} poore`,`${n} के ${m} पूरे`):`${ev.runs===6?tr('Six','Chhakka','छक्का'):tr('Four','Chauka','चौका')} · ${n}`;
        const own=ownPhrase(bi,L),s=PLAYERS[bi].short;
        const body=tr(`${s} is ${own}. You +${gy} pts, average rival +${ga}.`,`${s} ${own}. Aap +${gy} pts, average rival +${ga}.`,`${s} ${own}। आप +${gy} अंक, औसत विरोधी +${ga}।`);
        out.push({f,ov,dir:rd.cls,title:what,body,delta:rd});
      }
    }
    if(ev.overEnd||f===FRAMES.length-1){
      const go=gains(overStart,f), dd=RANK[f]-RANK[overStart], r2=rankDelta(dd), N=ev.over+1, y=P1(go.you), a=P1(go.avg);
      const top=go.per.slice(0,2).filter(x=>Math.abs(x.edge)>=1).map(x=>`${PLAYERS[x.i].short} ${x.d>0?'+':''}${x.d} ${tr('pts','pts','अंक')} (${roleWord(x.i,L)}${MY_M[x.i]===0?`, ${tr(`${OWN[x.i]}% own`,`${OWN[x.i]}% ke paas`,`${OWN[x.i]}% के पास`)}`:''})`);
      const j=top.join('; ');
      out.push({f,ov:tr(`Ov ${N}`,`Over ${N}`,`ओवर ${N}`),dir:r2.cls,kind:'over',
        title:tr(`End of over ${N}: you +${y}, average rival +${a}`,`Over ${N} khatam: aap +${y}, average rival +${a}`,`ओवर ${N} खत्म: आप +${y}, औसत विरोधी +${a}`),
        body:top.length?tr(`Biggest swing: ${j}.`,`Sabse bada farak: ${j}.`,`सबसे बड़ा फ़र्क: ${j}।`):tr('A quiet over for your team and the field alike.','Aapke aur baaki sab ke liye shaant over.','आपके और बाकी सबके लिए शांत ओवर।'),delta:r2});
      overStart=f;
    }
  }
  return out;
}

/* ===================== LOCAL ANALYSIS (used when Claude is not available) ===================== */
function inPlay(f){
  const fr=FRAMES[f]; if(f===FRAMES.length-1)return [];
  const list=[{i:PI[fr.striker],kind:'bat',on:true},{i:PI[fr.non],kind:'bat'}];
  list.push({i:PI[fr.nextBowler],kind:'bowl'});
  return list;
}
function playerNow(f,x){
  const i=x.i,p=PLAYERS[i],add=x.kind==='bat'?8:30;
  const r1=boostRank(f,i,add), d=r1-RANK[f];
  return {i,p,kind:x.kind,on:x.on,d,add,good:d<0};
}
function localWhy(f,L='English'){
  if(f===0){
    if(L==='English')return MOMENTS[0].title+'.\n'+MOMENTS[0].body;
    return tx(L,'',`Innings break: aap #${fmt(RANK[0])} par chase shuru kar rahe ho. Aapke ${P1(YOU[0])} points, average rival ke ${P1(AVG[0])}.`,`पारी का ब्रेक: आप #${fmt(RANK[0])} पर चेज़ शुरू कर रहे हैं। आपके ${P1(YOU[0])} अंक, औसत विरोधी के ${P1(AVG[0])}।`);
  }
  const f0=Math.max(0,f-6), g=gains(f0,f), rd=rankDelta(RANK[f]-RANK[f0]), held=rd.cls==='flat', n=f-f0;
  const span=`(#${fmt(RANK[f0])} → #${fmt(RANK[f])})`;
  let s=tx(L,
    `Last ${n} balls: ${held?'your rank held':`rank ${rd.txt}`} ${span}. You scored ${P1(g.you)}, the average rival ${P1(g.avg)}.`,
    `Pichhli ${n} balls: ${held?'rank wahi raha':`rank ${rd.txt}`} ${span}. Aapko ${P1(g.you)} points mile, average rival ko ${P1(g.avg)}.`,
    `पिछली ${n} गेंदें: ${held?'रैंक वही रही':`रैंक ${rd.txt}`} ${span}। आपको ${P1(g.you)} अंक मिले, औसत विरोधी को ${P1(g.avg)}।`);
  const top=g.per.filter(x=>Math.abs(x.edge)>=0.5).slice(0,3);
  if(top.length){
    s+=tx(L,'\n\nWhat moved you:','\n\nKisne farak dala:','\n\nफ़र्क किसने डाला:');
    for(const x of top){const nmx=PLAYERS[x.i].name,dd=`${x.d>0?'+':''}${x.d}`,own=ownPhrase(x.i,L),good=x.edge>0;
      s+=tx(L,`\n• ${nmx} ${dd} pts. He is ${own}, so this ${good?'helped you':'helped rivals more than you'}.`,
        `\n• ${nmx} ${dd} pts. Woh ${own}, isliye ${good?'aapko fayda hua':'rivals ko aapse zyada fayda hua'}.`,
        `\n• ${nmx} ${dd} अंक। वह ${own}, इसलिए ${good?'आपको फ़ायदा हुआ':'विरोधियों को आपसे ज़्यादा फ़ायदा हुआ'}।`);}
  } else s+=tx(L,'\n\nNobody who separates you from the field scored much, so you mostly held position.',
    '\n\nJo players aapko baaki teams se alag karte hain, unhone zyada score nahi kiya, isliye rank lagbhag wahi raha.',
    '\n\nजो खिलाड़ी आपको बाकी टीमों से अलग करते हैं, उन्होंने ज़्यादा स्कोर नहीं किया, इसलिए रैंक लगभग वही रही।');
  return s;
}
function localNeed(f,L='English'){
  const you=YOU[f], rank=RANK[f];
  const goal=rank>PRIZE_ZONE?PRIZE_ZONE:rank>1000?1000:rank>100?100:1;
  const goalTxt=goal===PRIZE_ZONE?tx(L,'the prize zone (top 60,000)','prize zone (top 60,000)','प्राइज़ ज़ोन (टॉप 60,000)'):goal===1?'#1':tx(L,`the top ${fmt(goal)}`,`top ${fmt(goal)}`,`टॉप ${fmt(goal)}`);
  if(f===FRAMES.length-1){const inside=rank<=PRIZE_ZONE;
    return tx(L,`Match over. You finished #${fmt(rank)} with ${P1(you)} points${inside?', inside the prize zone':''}.`,
      `Match khatam. Aap #${fmt(rank)} par rahe, ${P1(you)} points ke saath${inside?', prize zone ke andar':''}.`,
      `मैच खत्म। आप #${fmt(rank)} पर रहे, ${P1(you)} अंकों के साथ${inside?', प्राइज़ ज़ोन के अंदर':''}।`);}
  const gap=P1(Math.max(scoreAtRank(f,goal)-you,0.5));
  let s=tx(L,`You're #${fmt(rank)}. To reach ${goalTxt} you need about ${gap} more points than the teams there right now.`,
    `Aap #${fmt(rank)} par ho. ${goalTxt} tak pahunchne ke liye wahan ki teams se lagbhag ${gap} points aur chahiye.`,
    `आप #${fmt(rank)} पर हैं। ${goalTxt} तक पहुँचने के लिए वहाँ की टीमों से लगभग ${gap} अंक और चाहिए।`);
  const lev=[];
  for(const x of inPlay(f).concat(ORDER.filter(id=>!FRAMES[f].out[PI[id]]&&!FRAMES[f].summ[PI[id]].includes('(')).slice(0,1).map(id=>({i:PI[id],kind:'bat'})))){
    const unit=x.kind==='bat'?8:30;
    let k=0;for(let n=1;n<=12;n++){if(boostRank(f,x.i,unit*n)<=goal){k=n;break;}}
    lev.push({...x,k,unit});
  }
  const ok=lev.filter(x=>x.k>0).sort((a,b)=>a.k-b.k);
  if(ok.length){
    s+=tx(L,'\n\nFastest routes, with everything else unchanged:','\n\nSabse tez raasta (baaki sab same rahe toh):','\n\nसबसे तेज़ रास्ता (बाकी सब वैसा ही रहे तो):');
    for(const x of ok.slice(0,3)){const p=PLAYERS[x.i],bat=x.kind==='bat',k=x.k,role=roleWord(x.i,L);
      s+=tx(L,`\n• ${k} ${bat?(k===1?'four':'fours'):(k===1?'wicket':'wickets')} from ${p.name} (${role})`,
        `\n• ${p.name} se ${k} ${bat?(k===1?'chauka':'chauke'):'wicket'} (${role})`,
        `\n• ${p.name} से ${k} ${bat?(k===1?'चौका':'चौके'):'विकेट'} (${role})`);}
  } else s+=tx(L,'\n\nNo single player in play can close that gap alone. You need your players to outscore the popular picks over the rest of the chase.',
    '\n\nAbhi khel rahe kisi ek player se yeh gap nahi bharega. Aapke players ko popular players se zyada score karna hoga.',
    '\n\nअभी खेल रहे किसी एक खिलाड़ी से यह अंतर नहीं भरेगा। आपके खिलाड़ियों को लोकप्रिय खिलाड़ियों से ज़्यादा स्कोर करना होगा।');
  const bad=lev.filter(x=>MY_M[x.i]-AVG_M[x.i]<-0.3);
  if(bad.length){const b=bad[0],n=PLAYERS[b.i].name,own=ownPhrase(b.i,L);
    s+=tx(L,`\n\nWatch out for ${n}: ${own}, so his points push rivals past you.`,
      `\n\nDhyan rahe: ${n} ${own}, toh uske points rivals ko aapse aage le jaate hain.`,
      `\n\nध्यान रहे: ${n} ${own}, इसलिए उसके अंक विरोधियों को आपसे आगे ले जाते हैं।`);}
  return s;
}
function localRoot(f,L='English'){
  if(f===FRAMES.length-1)return tx(L,'The match is over, nothing left to cheer for. Check the feed for the moments that decided your rank.',
    'Match khatam ho gaya, ab cheer karne ko kuch nahi. Feed mein dekho kis moment ne aapka rank tay kiya.',
    'मैच खत्म हो गया, अब चीयर करने को कुछ नहीं। फ़ीड में देखें किस पल ने आपकी रैंक तय की।');
  const rows=inPlay(f).map(x=>playerNow(f,x));
  let s=tx(L,'Next ball:','Agli ball:','अगली गेंद:');
  for(const r of rows){
    const bat=r.kind==='bat';
    const where=bat?(r.on?tx(L,'on strike','strike par','स्ट्राइक पर'):tx(L,'non-striker','doosre end par','दूसरे छोर पर')):tx(L,'bowling','bowling','गेंदबाज़ी');
    const act=bat?tx(L,'a four','ek chauka','एक चौका'):tx(L,'a wicket','ek wicket','एक विकेट');
    const mv=r.d<0?'▲ '+fmt(-r.d):r.d>0?'▼ '+fmt(r.d):tx(L,'nowhere','kahin nahi','कहीं नहीं');
    const verdict=r.d<0?tx(L,'Cheer for him.','Iske liye cheer karo.','इसके लिए चीयर करें।'):r.d>0?tx(L,'You want him quiet.','Yeh shaant rahe toh behtar.','यह शांत रहे तो बेहतर।'):'';
    s+=tx(L,`\n• ${r.p.name} (${where}): ${act} moves you ${mv}. ${verdict}`,
      `\n• ${r.p.name} (${where}): ${act} aapko ${mv} le jayega. ${verdict}`,
      `\n• ${r.p.name} (${where}): ${act} आपको ${mv} ले जाएगा। ${verdict}`);
  }
  const c=rows.filter(r=>r.d<0).sort((a,b)=>a.d-b.d)[0];
  if(c){const bat=c.kind==='bat',n=c.p.short;
    s+=tx(L,`\n\nBest outcome for you: ${bat?`${n} keeps hitting`:`${n} takes a wicket`}.`,
      `\n\nAapke liye sabse accha: ${n} ${bat?'chauke maarta rahe':'wicket le'}.`,
      `\n\nआपके लिए सबसे अच्छा: ${n} ${bat?'चौके लगाता रहे':'विकेट ले'}।`);}
  return s;
}

function bestCheer(f){
  const rows=inPlay(f).map(x=>{const add=x.kind==='bat'?8:30,h=helps(f,x.i,add);return {...x,add,h,net:h.up-h.down};});
  rows.sort((a,b)=>b.net-a.net);return rows;
}
function localTeams(f,L='English'){
  const n=TEAMS.length, sorted=TEAMS.map(T=>({T,r:T.RANK[f]})).sort((a,b)=>a.r-b.r);
  const inZ=sorted.filter(x=>x.r<=PRIZE_ZONE), outZ=sorted.filter(x=>x.r>PRIZE_ZONE), k=inZ.length;
  let s=tx(L,`${k} of your ${n} teams ${k===1?'is':'are'} in the prize zone right now.`,
    `Abhi aapki ${n} mein se ${k} ${k===1?'team':'teams'} prize zone mein ${k===1?'hai':'hain'}.`,
    `अभी आपकी ${n} में से ${k} ${k===1?'टीम':'टीमें'} प्राइज़ ज़ोन में ${k===1?'है':'हैं'}।`);
  if(k)s+=tx(L,'\n• Winning: ','\n• Jeet rahi: ','\n• जीत रहीं: ')+inZ.map(x=>`${x.T.name} #${fmt(x.r)}`).join(', ');
  if(outZ.length){
    const z=scoreAtRank(f,PRIZE_ZONE);
    s+=tx(L,'\n• Outside: ','\n• Bahar: ','\n• बाहर: ')+outZ.map(x=>{const p=P1(Math.max(0.5,z-x.T.YOU[f]));
      return tx(L,`${x.T.name} needs ${p} pts`,`${x.T.name} ko ${p} pts chahiye`,`${x.T.name} को ${p} अंक चाहिए`);}).join(', ');
  }
  if(f<FRAMES.length-1){
    const b=bestCheer(f)[0];
    if(b&&b.h.up){const nm2=PLAYERS[b.i].short,bat=b.kind==='bat',u=b.h.up,d=b.h.down;
      s+=tx(L,`\n\nBest thing that can happen next: a ${nm2} ${bat?'boundary':'wicket'}. It lifts ${u} of your ${n} teams${d?` and hurts ${d}`:''}.`,
        `\n\nAgli ball pe sabse accha: ${nm2} ka ${bat?'chauka':'wicket'}. Isse aapki ${n} mein se ${u} teams upar jaayengi${d?`, ${d} neeche`:''}.`,
        `\n\nअगली गेंद पर सबसे अच्छा: ${nm2} का ${bat?'चौका':'विकेट'}। इससे आपकी ${n} में से ${u} टीमें ऊपर जाएँगी${d?`, ${d} नीचे`:''}।`);}
  } else s+=tx(L,`\n\nFinal: ${k} winning ${k===1?'team':'teams'}.`,`\n\nFinal: ${k} ${k===1?'team':'teams'} jeeti.`,`\n\nफ़ाइनल: ${k} ${k===1?'टीम':'टीमें'} जीतीं।`);
  return s;
}
function catchData(f,n){
  const f0=Math.max(0,f-n), a=FRAMES[f0], b=FRAMES[f];
  const evs=FRAMES.slice(f0+1,f+1).map(x=>x.ev);
  const wk=evs.filter(e=>e.type==='W'), fours=evs.filter(e=>e.runs===4).length, sixes=evs.filter(e=>e.runs===6).length;
  const teams=TEAMS.map(T=>({name:T.name,from:T.RANK[f0],to:T.RANK[f],inZone:T.RANK[f]<=PRIZE_ZONE,label:teamLabel(T)}));
  const g=gains(f0,f);
  const swing=g.per.filter(x=>Math.abs(x.edge)>=1).slice(0,3).map(x=>({i:x.i,player:PLAYERS[x.i].name,pts:x.d,inFocusedTeam:roleWord(x.i),rivalsOwnPct:OWN[x.i],rivalsCaptainPct:CAP[x.i]}));
  return {f0,f,from:`${a.score}/${a.wk} (${oversTxt(a.balls)})`,to:`${b.score}/${b.wk} (${oversTxt(b.balls)})`,
    runs:b.score-a.score,balls:b.balls-a.balls,wickets:wk.map(e=>`${nm(e.batter)} ${dismissal(e)} ${e.batR}(${e.batB})`),fours,sixes,
    need:TARGET-b.score,ballsLeft:120-b.balls,teams,swing,finished:f===FRAMES.length-1?SIM.result:null,
    milestones:evs.filter(e=>e.milestone).map(e=>`${nm(e.batter)} ${e.milestone}`)};
}
function resultText(L){
  const m=SIM.result.match(/^(.*) win by (\d+) (wicket|run)s?(?: with (\d+) balls? to spare)?/);
  if(L==='English'||!m)return SIM.result;
  const [,t,n,kind,b]=m;
  if(kind==='wicket')return tx(L,'',`${t} ${n} wicket se jeete${b?`, ${b} ball baaki`:''}`,`${t} ${n} विकेट से जीते${b?`, ${b} गेंद बाकी`:''}`);
  return tx(L,'',`${t} ${n} run se jeete`,`${t} ${n} रन से जीते`);
}
function localCatch(d,L='English'){
  if(d.balls===0)return tx(L,'Nothing to catch up on yet. The chase has not started.','Abhi catch up karne ko kuch nahi. Chase shuru nahi hua.','अभी बताने को कुछ नहीं। चेज़ शुरू नहीं हुआ।');
  const w=d.wickets.length;
  let s=tx(L,`While you were away: ${d.runs} runs in ${d.balls} balls, ${w} wicket${w===1?'':'s'}. Score went ${d.from} → ${d.to}.`,
    `Jab aap gaye the: ${d.balls} balls mein ${d.runs} runs, ${w} wicket. Score ${d.from} → ${d.to}.`,
    `जब आप दूर थे: ${d.balls} गेंदों में ${d.runs} रन, ${w} विकेट। स्कोर ${d.from} → ${d.to}।`);
  if(w)s+=tx(L,'\n• Out: ','\n• Out: ','\n• आउट: ')+d.wickets.join('; ');
  if(d.milestones.length)s+=tx(L,'\n• Milestones: ','\n• Milestones: ','\n• माइलस्टोन: ')+d.milestones.join(', ');
  if(d.fours+d.sixes)s+=tx(L,`\n• Boundaries: ${d.fours} four${d.fours===1?'':'s'}, ${d.sixes} six${d.sixes===1?'':'es'}`,
    `\n• Boundaries: ${d.fours} ${d.fours===1?'chauka':'chauke'}, ${d.sixes} ${d.sixes===1?'chhakka':'chhakke'}`,
    `\n• बाउंड्री: ${d.fours} ${d.fours===1?'चौका':'चौके'}, ${d.sixes} ${d.sixes===1?'छक्का':'छक्के'}`);
  const up=d.teams.filter(t=>t.to<t.from-SCALE).length, dn=d.teams.filter(t=>t.to>t.from+SCALE).length;
  s+=tx(L,`\n\nYour teams: ${up} climbed, ${dn} dropped.`,`\n\nAapki teams: ${up} upar gayi, ${dn} neeche.`,`\n\nआपकी टीमें: ${up} ऊपर गईं, ${dn} नीचे।`);
  if(d.swing.length){const x=d.swing[0],pts=`${x.pts>0?'+':''}${x.pts}`,role=roleWord(x.i,L),o=x.rivalsOwnPct;
    s+=tx(L,` Biggest reason for ${team.name}: ${x.player} ${pts} pts (${role}, ${o}% of rivals own him).`,
      ` ${team.name} ki sabse badi wajah: ${x.player} ${pts} pts (${role}, ${o}% rivals ke paas).`,
      ` ${team.name} की सबसे बड़ी वजह: ${x.player} ${pts} अंक (${role}, ${o}% विरोधियों के पास)।`);}
  s+=d.finished?`\n\n${resultText(L)}${L==='Hindi'?'।':'.'}`:tx(L,`\n\nNow: need ${d.need} off ${d.ballsLeft}.`,`\n\nAb: ${d.ballsLeft} balls mein ${d.need} chahiye.`,`\n\nअब: ${d.ballsLeft} गेंदों में ${d.need} रन चाहिए।`);
  return s;
}

/* ===================== STATE + RENDER ===================== */
let cur=0, timer=null, speed=1500;
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function render(){
  const fr=FRAMES[cur], last=cur===FRAMES.length-1;
  $('score').innerHTML=`${fr.score}/${fr.wk}<small>${oversTxt(fr.balls)} ${tr('ov','ov','ओवर')}</small>`;
  const need=TARGET-fr.score, bl=120-fr.balls, rr=(need/bl*6).toFixed(2);
  $('chase').textContent=last?tr('Innings complete','Innings khatam','पारी खत्म'):need>0?tr(`Need ${need} off ${bl} · req. rate ${rr}`,`${bl} balls mein ${need} chahiye · req. rate ${rr}`,`${bl} गेंदों में ${need} रन चाहिए · आवश्यक रन रेट ${rr}`):tr('Target reached','Target poora','लक्ष्य पूरा');
  const l6=FRAMES.slice(Math.max(1,cur-5),cur+1).filter(x=>x.ev.type!=='start');
  $('last6').innerHTML=l6.length?l6.map(x=>{const e=x.ev;return e.type==='W'?'<span class="ball bw">W</span>':`<span class="ball ${e.runs===4?'b4':e.runs===6?'b6':''}">${e.runs===0?'·':e.runs}</span>`;}).join(''):`<span class="of">${tr('Innings break. Press Play.','Innings break. Play dabao.','पारी का ब्रेक। चलाएँ दबाएँ।')}</span>`;
  $('crease').innerHTML=last?`<div class="row"><span class="k">${tr('Result','Result','नतीजा')}</span><span>${esc(resultText(LG))}</span></div>`:
    `<div class="row"><span class="strike">${esc(nm(fr.striker))}</span><span class="num">${fr.sS.r} (${fr.sS.b})</span></div>
     <div class="row"><span>${esc(nm(fr.non))}</span><span class="num">${fr.nS.r} (${fr.nS.b})</span></div>
     <div class="row"><span class="k">${tr('Bowling next','Agla bowler','अगला गेंदबाज़')}</span><span>${esc(nm(fr.nextBowler))}</span></div>`;
  $('result').hidden=!last; $('result').textContent=resultText(LG);
  $('scrub').value=cur;
  $('playBtn').textContent=timer?tr('Pause','Pause','रोकें'):(last?tr('Replay','Replay','फिर देखें'):tr('Play','Play','चलाएँ'));

  renderTiles();
  // rank
  $('rankTitle').textContent=tr(`${team.name} rank`,`${team.name} rank`,`${team.name} रैंक`);
  $('rank').textContent='#'+fmt(RANK[cur]);
  const rd=cur?rankDelta(RANK[cur]-RANK[cur-1]):{cls:'flat',txt:''};
  $('delta').className='delta '+rd.cls; $('delta').textContent=cur?(rd.cls==='flat'?rd.txt:rd.txt+tr(' this ball',' is ball',' इस गेंद पर')):tr('innings break','innings break','पारी का ब्रेक');
  const ahead=(100-RANK[cur]/CONTEST*100).toFixed(1);
  $('pct').textContent=tr(`Ahead of ${ahead}% of teams`,`${ahead}% teams se aage`,`${ahead}% टीमों से आगे`);
  $('yourPts').textContent=P1(YOU[cur]); $('avgPts').textContent=P1(AVG[cur]);
  const inZ=RANK[cur]<=PRIZE_ZONE, gapZ=fmt(Math.abs(PRIZE_ZONE-RANK[cur]));
  $('zone').innerHTML=`<span class="zone ${inZ?'in':'out'}">${inZ?tr(`In · ${gapZ} spare`,`Andar · ${gapZ} ka margin`,`अंदर · ${gapZ} का अंतर`):tr(`Out · ${gapZ} to go`,`Bahar · ${gapZ} aur`,`बाहर · ${gapZ} और`)}</span>`;
  drawChart();

  // moments
  const ms=MOMENTS.filter(m=>m.f<=cur).slice(-10).reverse();
  $('feed').innerHTML=ms.map(m=>`<div class="moment ${m.dir}">
    <div class="mh"><div><span class="ov">${esc(m.ov)}</span><span class="t">${esc(m.title)}</span></div>${m.delta?`<span class="delta ${m.delta.cls}">${m.delta.txt}</span>`:''}</div>
    <p class="b">${esc(m.body)}</p></div>`).join('');

  // right now
  const rows=inPlay(cur).map(x=>playerNow(cur,x));
  $('now').innerHTML=rows.length?rows.map(r=>{
    const role=r.kind==='bat'?(r.on?tr('on strike','strike par','स्ट्राइक पर'):tr('at the other end','doosre end par','दूसरे छोर पर')):tr('bowls next over','agla over dalega','अगला ओवर डालेगा');
    const mine=MY_M[r.i]===2?'<span class="tag c">C</span>':MY_M[r.i]===1.5?'<span class="tag c">VC</span>':MY_M[r.i]===1?`<span class="tag">${tr('yours','aapka','आपका')}</span>`:'';
    const eff=r.d<0?`<span class="pos">▲ ${fmt(-r.d)}</span>`:r.d>0?`<span class="neg">▼ ${fmt(r.d)}</span>`:`<span>${tr('no change','koi badlaav nahi','कोई बदलाव नहीं')}</span>`;
    const o=OWN[r.i],c=CAP[r.i];
    const say=r.d<0?tr('Cheer for him.','Iske liye cheer karo.','इसके लिए चीयर करें।')
      :r.d>0?tr(`Bad for you: ${o}% of rivals own him${c>=5?`, ${c}% as captain`:''}.`,`Aapke liye bura: ${o}% rivals ke paas${c>=5?`, ${c}% ne captain banaya`:''}.`,`आपके लिए बुरा: ${o}% विरोधियों के पास${c>=5?`, ${c}% ने कप्तान बनाया`:''}।`)
      :tr('Neutral for you.','Aapke liye neutral.','आपके लिए कोई असर नहीं।');
    return `<div class="np ${r.d<0?'good':r.d>0?'bad':''}"><div class="who">${esc(r.p.name)}${mine}<span>${role}</span></div><div class="num">${eff}</div><div class="say">${esc(say)}</div></div>`;
  }).join(''):`<div class="of">${tr('Match over.','Match khatam.','मैच खत्म।')}</div>`;

  // XI
  $('xiTitle').textContent=`${team.name} XI`;
  const xi=team.ids.map(id=>PI[id]).map(i=>({i,p:PLAYERS[i],pts:fr.pts[i],m:MY_M[i]})).sort((a,b)=>b.pts*b.m-a.pts*a.m);
  const summL=s=>s.replace('yet to bat',tr('yet to bat','batting baaki','बल्लेबाज़ी बाकी')).replace(/(\d+) ct\b/,(_,n)=>`${n} ${tr('ct','catch','कैच')}`);
  $('xi').innerHTML=xi.map(x=>`<div class="pl"><span class="role">${x.p.role}</span>
    <div style="min-width:0"><div class="nm">${esc(x.p.name)}${x.m===2?'<span class="tag c">C</span>':x.m===1.5?'<span class="tag c">VC</span>':''}</div><div class="sm">${x.p.team} · ${esc(summL(fr.summ[x.i]))} · ${tr(`${OWN[x.i]}% own`,`${OWN[x.i]}% ke paas`,`${OWN[x.i]}% के पास`)}</div></div>
    <div class="pts">${P1(x.pts*x.m)}<small>${x.m>1?`${x.pts} × ${x.m}`:tr('pts','pts','अंक')}</small></div></div>`).join('');
}

function spark(T){
  const W=100,H=26,n=FRAMES.length-1,lo=Math.log10(50),hi=Math.log10(CONTEST);
  const x=k=>W*k/n,y=r=>1+(H-2)*(Math.log10(Math.max(r,50))-lo)/(hi-lo);
  const pts=T.RANK.slice(0,cur+1).map((r,k)=>`${x(k).toFixed(1)},${y(r).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="${W}" y1="${y(PRIZE_ZONE)}" y2="${y(PRIZE_ZONE)}" stroke="var(--up)" stroke-opacity=".35" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/><polyline points="${pts}" fill="none" stroke="${T===team?'var(--led)':'var(--dim)'}" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
}
function renderTiles(){
  const inZ=TEAMS.filter(T=>T.RANK[cur]<=PRIZE_ZONE).length, N=TEAMS.length;
  $('teamsSum').textContent=tr(`${inZ} of ${N} in the prize zone · tap a team to focus`,`${N} mein se ${inZ} prize zone mein · team chuno`,`${N} में से ${inZ} प्राइज़ ज़ोन में · टीम चुनें`);
  $('tiles').innerHTML=TEAMS.map((T,k)=>{
    const r=T.RANK[cur], d=cur?rankDelta(r-T.RANK[Math.max(0,cur-6)]):{cls:'flat',txt:'—'};
    return `<button class="tile" type="button" data-k="${k}" aria-pressed="${k===act}">
      <span class="tn"><b>${T.name}</b><span class="dot ${r<=PRIZE_ZONE?'in':'out'}"></span></span>
      <span class="tr num">#${fmt(r)}</span>
      <span class="td ${d.cls==='up'?'pos':d.cls==='down'?'neg':''}">${d.txt}</span>
      ${spark(T)}</button>`;}).join('');
  if(cur===FRAMES.length-1){$('cheer').innerHTML=`<span class="lbl">${tr('Final','Final','फ़ाइनल')}</span><span>${tr(`${inZ} of your ${N} teams finished in the prize zone.`,`Aapki ${N} mein se ${inZ} teams prize zone mein rahi.`,`आपकी ${N} में से ${inZ} टीमें प्राइज़ ज़ोन में रहीं।`)}</span>`;return;}
  const rows=bestCheer(cur);
  $('cheer').innerHTML=`<span class="lbl">${tr('Next ball','Agli ball','अगली गेंद')}</span>`+rows.map(r=>{
    const s=PLAYERS[r.i].short, bat=r.kind==='bat';
    const what=bat?tr(`${s} boundary`,`${s} ka chauka`,`${s} का चौका`):tr(`${s} wicket`,`${s} ka wicket`,`${s} का विकेट`);
    const u=r.h.up,dn=r.h.down;
    return `<span>${esc(what)}: <b class="${r.net>0?'pos':r.net<0?'neg':''}">${tr(`helps ${u}/${N}`,`${u}/${N} ko fayda`,`${u}/${N} को फ़ायदा`)}</b>${dn?tr(`, hurts ${dn}`,`, ${dn} ko nuksaan`,`, ${dn} को नुकसान`):''}</span>`;}).join('');
}

function drawChart(){
  const W=560,H=150,pl=44,pr=10,pt=10,pb=22,n=FRAMES.length-1;
  const lo=Math.log10(Math.max(50,Math.min(...RANK)*0.6)), hi=Math.log10(CONTEST);
  const x=k=>pl+(W-pl-pr)*k/n, y=r=>pt+(H-pt-pb)*(Math.log10(Math.max(r,1))-lo)/(hi-lo);
  const ticks=[100,1000,10000,100000].filter(v=>Math.log10(v)>=lo);
  let g=ticks.map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-dasharray="2 4"/><text x="${pl-6}" y="${y(v)+4}" text-anchor="end" font-size="10" fill="var(--faint)" font-family="IBM Plex Mono,monospace">${v>=100000?'1L':v>=1000?(v/1000)+'K':v}</text>`).join('');
  g+=`<line x1="${pl}" x2="${W-pr}" y1="${y(PRIZE_ZONE)}" y2="${y(PRIZE_ZONE)}" stroke="var(--up)" stroke-opacity=".5"/><text x="${W-pr}" y="${y(PRIZE_ZONE)-4}" text-anchor="end" font-size="10" fill="var(--up)" fill-opacity=".8">${tr('prize zone','prize zone','प्राइज़ ज़ोन')}</text>`;
  for(const o of [6,12,18])g+=`<text x="${x(FRAMES.findIndex(f=>f.balls>=o*6))}" y="${H-6}" text-anchor="middle" font-size="10" fill="var(--faint)">${tr('ov','ov','ओवर')} ${o}</text>`;
  const pts=RANK.slice(0,cur+1).map((r,k)=>`${x(k).toFixed(1)},${y(r).toFixed(1)}`).join(' ');
  const area=cur?`<polygon points="${x(0)},${H-pb} ${pts} ${x(cur)},${H-pb}" fill="var(--led)" fill-opacity=".08"/>`:'';
  $('chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Rank over the chase">${g}${area}<polyline points="${pts}" fill="none" stroke="var(--led)" stroke-width="2" stroke-linejoin="round"/><circle cx="${x(cur)}" cy="${y(RANK[cur])}" r="4" fill="var(--led)"/></svg>`;
}

function go(k){cur=Math.max(0,Math.min(FRAMES.length-1,k));render();if(cur===FRAMES.length-1)stop();}
function stop(){clearInterval(timer);timer=null;render();}
function play(){if(cur===FRAMES.length-1)cur=0;clearInterval(timer);timer=setInterval(()=>go(cur+1),speed);render();}

/* ===================== COPILOT ===================== */
let sample=null, aiCtl=null;
let aiLive=false;
function setAiState(live){aiLive=live;const el=$('aiState');el.className='aistate'+(live?' live':'');el.textContent=live?tr('Claude live','Claude live','Claude लाइव'):tr('Built-in analysis','Built-in analysis','बिल्ट-इन विश्लेषण');}
(async()=>{
  try{ if(window.claude&&window.claude.use){ sample=await window.claude.use('sample'); } }catch(e){sample=null;}
  setAiState(!!sample);
})();

function stateForAI(f,L='English'){
  const fr=FRAMES[f];
  const players=PLAYERS.map(p=>({name:p.name,team:p.team,role:p.role,fantasyPts:fr.pts[p.i],stats:fr.summ[p.i],
    inYourTeam:MY_M[p.i]===2?'captain (2x)':MY_M[p.i]===1.5?'vice-captain (1.5x)':MY_M[p.i]?'yes':'no',
    rivalsOwnPct:OWN[p.i],rivalsCaptainPct:CAP[p.i],rankChangeIfHeGets10MorePts:-(boostRank(f,p.i,10)-RANK[f])}));
  const recent=MOMENTS.filter(m=>m.f<=f).slice(-6).map(m=>`${m.ov}: ${m.title}. ${m.body}`);
  return {
    match:{chasing:'Kochi Comets',target:TARGET,score:`${fr.score}/${fr.wk}`,overs:oversTxt(fr.balls),runsNeeded:TARGET-fr.score,ballsLeft:120-fr.balls,
      striker:f<FRAMES.length-1?nm(fr.striker):null,nonStriker:f<FRAMES.length-1?nm(fr.non):null,bowlingNext:f<FRAMES.length-1?nm(fr.nextBowler):null,
      finished:f===FRAMES.length-1?SIM.result:null},
    focusedTeam:{name:team.name,points:+YOU[f].toFixed(1),rank:RANK[f],contestSize:CONTEST,prizeZoneTop:PRIZE_ZONE},
    allYourTeams:TEAMS.map(T=>({name:T.name,captain:nm(T.c),viceCaptain:nm(T.vc),rank:T.RANK[f],rankSixBallsAgo:T.RANK[Math.max(0,f-6)],inPrizeZone:T.RANK[f]<=PRIZE_ZONE,pointsShortOfPrizeZone:+Math.max(0,scoreAtRank(f,PRIZE_ZONE)-T.YOU[f]).toFixed(1)})),
    nextBallAcrossYourTeams:f<FRAMES.length-1?bestCheer(f).map(r=>({event:r.kind==='bat'?`boundary by ${nm(PLAYERS[r.i].id)}`:`wicket by ${nm(PLAYERS[r.i].id)}`,teamsHelped:r.h.up,teamsHurt:r.h.down})):null,
    yourRankHistoryLast12Balls:RANK.slice(Math.max(0,f-12),f+1),
    averageRivalPoints:+AVG[f].toFixed(1),
    pointsNeededForTop1000:+(scoreAtRank(f,1000)-YOU[f]).toFixed(1),
    pointsNeededForPrizeZone:+(scoreAtRank(f,PRIZE_ZONE)-YOU[f]).toFixed(1),
    players,recentMoments:recent,
    builtInAnalysis:{why:localWhy(f,L),root:localRoot(f,L),teams:localTeams(f,L)}
  };
}
const CHIP_Q={why:'Why did my rank move?',need:'What do I need to happen to climb?',root:'Who should I root for right now?',teams:'Which of my teams can still win?'};
function localAnswer(kind,q,L='English'){
  if(kind)return kind==='why'?localWhy(cur,L):kind==='need'?localNeed(cur,L):kind==='teams'?localTeams(cur,L):localRoot(cur,L);
  const t=q.toLowerCase();
  if(/teams|all my|which team|multiple|saari|sabhi|टीमें|टीमों/.test(t))return localTeams(cur,L);
  if(/kyu|kyon|kyun|gira|गिर|क्यों/.test(t))return localWhy(cur,L);
  if(/chahiye|kaise|चाहिए|कैसे|ऊपर/.test(t))return localNeed(cur,L);
  if(/why|drop|fell|fall|down|jump|moved|move|lost/.test(t))return localWhy(cur,L);
  if(/need|top|win|prize|target|chance|climb|reach/.test(t))return localNeed(cur,L);
  return localRoot(cur,L)+'\n\n'+localNeed(cur,L).split('\n')[0];
}
let lastAsk=null;
const AI_STOP=['not_granted','sampling_disabled','not_declared','capability_disabled','capability_removed','session_expired'];
const LABELS={
  catch:['I missed 5 overs','5 overs miss ho gaye','मेरे 5 ओवर छूट गए'],
  why:['Why did my rank move?','Mera rank kyun hila?','मेरी रैंक क्यों बदली?'],
  root:['Who should I root for now?','Ab kiske liye cheer karun?','अब किसके लिए चीयर करूँ?'],
  teams:['Which of my teams can still win?','Meri kaunsi teams jeet sakti hain?','मेरी कौन-सी टीमें जीत सकती हैं?'],
};
const lbl=(k,L)=>tx(L,...LABELS[k]);
// The language order goes LAST in every prompt, so the model cannot miss it.
function langOrder(L){
  return L==='Hindi'?'LANGUAGE: Write your entire reply in Hindi using Devanagari script (for example: "आपकी रैंक ऊपर गई क्योंकि…"). Keep only player names, team names and numbers in English letters. Do not reply in English.'
    :L==='Hinglish'?'LANGUAGE: Write your entire reply in Hinglish: Hindi words in Latin script mixed with English, like an Indian cricket fan texting a friend (for example: "Aapka rank upar gaya kyunki Rao ne chauka maara"). Do not reply in pure English or in Devanagari.'
    :'LANGUAGE: Reply in English.';
}
// Does Claude's text match the chosen language well enough to replace the instant answer?
function fitsLang(text,L){
  const dev=/[ऀ-ॿ]/.test(text);
  if(L==='Hindi')return dev;
  if(L==='Hinglish')return !dev&&/\b(hai|hain|ka|ki|ke|aap|aapka|aapki|mein|nahi|kyun|toh|se)\b/i.test(text);
  return !dev;
}
// Show the instant answer, then let Claude replace it only if it answers in the right language.
async function withClaude(out,src,instant,prompt,ctl,doneNote,instantNote){
  out.textContent=instant;
  if(!sample){src.textContent=instantNote;return;}
  src.textContent=tr('Instant answer. Claude is writing a fuller one…','Turant jawab. Claude aur detail likh raha hai…','तुरंत जवाब। Claude और विस्तार से लिख रहा है…');
  let shown=false;
  try{
    const {text}=await sample(prompt,{modelTier:'quick',signal:ctl.signal,onText:({text})=>{
      if(text.length>25&&fitsLang(text,$('lang').value)){out.textContent=text;shown=true;}}});
    if(fitsLang(text,$('lang').value)){out.textContent=text;src.textContent=doneNote;}
    else{out.textContent=instant;src.textContent=tr('Instant answer (built-in).','Turant jawab (built-in).','तुरंत जवाब (बिल्ट-इन)।');}
  }catch(e){
    if(e&&e.code==='cancelled')return;
    if(e&&AI_STOP.includes(e.code)){sample=null;setAiState(false);}
    out.textContent=instant;
    src.textContent=e&&e.code==='rate_limited'?tr('Claude is busy, so this is the instant answer. Try again shortly.','Claude busy hai, isliye turant jawab. Thodi der mein phir try karo.','Claude व्यस्त है, इसलिए तुरंत जवाब। थोड़ी देर में फिर कोशिश करें।'):tr('Instant answer (built-in).','Turant jawab (built-in).','तुरंत जवाब (बिल्ट-इन)।');
  }
}
async function ask(q,kind,extra){
  lastAsk=()=>ask(q,kind,extra);
  const lang=$('lang').value, qShown=kind?lbl(kind,lang):q;
  $('answer').innerHTML=`<div class="q">${esc(qShown)}</div><div class="a" id="aText"></div><div class="src" id="aSrc"></div>`;
  const out=$('aText'), src=$('aSrc');
  const instant=extra||localAnswer(kind,q,lang);
  aiCtl?.abort(); aiCtl=new AbortController();
  const prompt=`You are Rank Radar, a second-screen companion for a fan watching a live T20 match while their ${TEAMS.length} fantasy teams play in a 2,50,000-team contest. "Your team" means the focused team (${team.name}) unless the fan asks about all teams. This is a replayed demo with fictional players.
Answer the fan's question using ONLY the data below. Be concrete: name players and quote the points, ownership % and rank numbers from the data. Never invent stats. No jargon: say it the way a friend watching the match would.
Keep it under 90 words. Use at most 3 short bullet lines starting with "• " if listing. No markdown headings or bold.
Scoring: run 1, four +4 bonus, six +6 bonus, wicket 30, bowled/LBW +8, catch 8, captain 2x, vice-captain 1.5x. A player's points help you relative to rivals only when you own him at a higher multiplier than the average rival does.
DATA:
${JSON.stringify(stateForAI(cur,lang))}

Fan's question: ${qShown}

${langOrder(lang)}`;
  await withClaude(out,src,instant,prompt,aiCtl,tr(`Answered by Claude from the live state at over ${oversTxt(FRAMES[cur].balls)}.`,`Claude ka jawab, over ${oversTxt(FRAMES[cur].balls)} ke live data se.`,`Claude का जवाब, ओवर ${oversTxt(FRAMES[cur].balls)} के लाइव डेटा से।`),tr('Instant answer (built-in). Sign in to Claude to ask your own questions.','Turant jawab (built-in). Apne sawaal poochne ke liye Claude mein sign in karo.','तुरंत जवाब (बिल्ट-इन)। अपने सवाल पूछने के लिए Claude में साइन इन करें।'));
}

let catchCtl=null;
async function catchUp(){
  lastAsk=catchUp;
  stop();
  const n=30, d=catchData(cur,n), lang=$('lang').value, box=$('answer');
  const tchg=d.teams.map(t=>{const dd=rankDelta(t.to-t.from);return `<div><b>${t.name} <span class="dot ${t.inZone?'in':'out'}"></span></b><span class="num">#${fmt(t.from)} → #${fmt(t.to)}</span><br><span class="${dd.cls==='up'?'pos':dd.cls==='down'?'neg':''}">${dd.cls==='flat'?tx(lang,'no change','koi badlaav nahi','कोई बदलाव नहीं'):dd.txt}</span></div>`;}).join('');
  box.innerHTML=`<div class="q">${esc(lbl('catch',lang))}</div><div class="a" id="cText"></div><div class="tchg" style="margin-top:10px">${tchg}</div><div class="src" id="cSrc"></div>`;
  const out=$('cText'), src=$('cSrc'), instant=localCatch(d,lang);
  if(d.balls===0){out.textContent=instant;return;}
  catchCtl?.abort(); catchCtl=new AbortController();
  const prompt=`A fantasy cricket fan looked away from a live T20 chase for ${d.balls} balls and just came back. They have ${TEAMS.length} teams in a 2,50,000-team contest (top 60,000 win). Fictional demo players.
Write a catch-up they can read in 15 seconds: line 1 what happened in the match; line 2 what it did to their teams (name the teams that moved most, with rank numbers); line 3 what to watch for next. Max 70 words, plain text, no headings, no bold. Use ONLY the data; never invent stats.
DATA: ${JSON.stringify(d)}

${langOrder(lang)}`;
  await withClaude(out,src,instant,prompt,catchCtl,tr('Written by Claude. Rank figures are computed, not generated.','Claude ne likha. Rank ke numbers calculate kiye gaye hain, AI ne nahi banaye.','Claude ने लिखा। रैंक के आँकड़े गणना से हैं, AI ने नहीं बनाए।'),tr('Instant recap (built-in).','Turant recap (built-in).','तुरंत सारांश (बिल्ट-इन)।'));
}
function relabel(){
  const L=$('lang').value;
  document.querySelectorAll('.chip').forEach(b=>{b.textContent=lbl(b.dataset.q,L);});
  $('askInput').placeholder=tx(L,'e.g. Is my captain still worth it?','jaise: Kya mera captain abhi bhi sahi hai?','जैसे: क्या मेरा कप्तान अब भी सही है?');
}

/* ===================== TEAM EDITOR ===================== */
let draft=null;
function openEditor(){stop();draft={ids:[...team.ids],c:team.c,vc:team.vc};$('edTitle').textContent=tr(`Edit ${team.name}`,`${team.name} badlo`,`${team.name} बदलें`);renderEditor();$('editor').hidden=false;}
function renderEditor(){
  const col=t=>`<div class="tm"><h4>${t==='NAG'?'Nagpur Nomads':'Kochi Comets'}</h4>`+PLAYERS.filter(p=>p.team===t).map(p=>{
    const on=draft.ids.includes(p.id);
    return `<div class="pick ${on?'on':''}"><label><input type="checkbox" id="pk_${p.id}" data-id="${p.id}" ${on?'checked':''}><span>${esc(p.name)} <span class="of">${p.role}</span></span></label>
    <span class="own">${OWN[p.i]}%</span>
    <span style="display:flex;gap:4px"><button class="cv" type="button" data-c="${p.id}" aria-pressed="${draft.c===p.id}" ${on?'':'disabled'} aria-label="Captain">C</button><button class="cv" type="button" data-vc="${p.id}" aria-pressed="${draft.vc===p.id}" ${on?'':'disabled'} aria-label="Vice-captain">VC</button></span></div>`;}).join('')+'</div>';
  $('edBody').innerHTML=col('NAG')+col('KOC');
  const n=draft.ids.length, ok=n===11&&draft.c&&draft.vc&&draft.ids.includes(draft.c)&&draft.ids.includes(draft.vc);
  const noC=!draft.c||!draft.ids.includes(draft.c), noV=!draft.vc||!draft.ids.includes(draft.vc);
  $('edMsg').textContent=tr(`${n}/11 picked`,`${n}/11 chune`,`${n}/11 चुने`)+(noC?tr(' · choose a captain',' · captain chuno',' · कप्तान चुनें'):'')+(noV?tr(' · choose a vice-captain',' · vice-captain chuno',' · उप-कप्तान चुनें'):'')+tr('. % = share of rivals who picked him.','. % = kitne rivals ne use chuna.','। % = कितने विरोधियों ने उसे चुना।');
  $('edSave').disabled=!ok;
}

/* ===================== WIRE UP ===================== */
if(typeof document!=='undefined'){
  initTeams();
  $('scrub').max=FRAMES.length-1;
  cur=Math.min(72,FRAMES.length-1); // open mid-chase so every panel has something to show
  $('tiles').addEventListener('click',e=>{const b=e.target.closest('.tile');if(!b)return;focus(+b.dataset.k);render();});
  document.querySelectorAll('.prob').forEach(b=>b.onclick=()=>{
    const t=b.dataset.try;
    if(t==='catch'){catchUp();$('aiCard').scrollIntoView({behavior:'smooth',block:'center'});}
    else{ask(CHIP_Q[t],t);$('aiCard').scrollIntoView({behavior:'smooth',block:'center'});}
  });
  $('playBtn').onclick=()=>timer?stop():play();
  $('stepBtn').onclick=()=>{stop();go(cur+1);};
  $('resetBtn').onclick=()=>{stop();go(0);};
  $('scrub').oninput=e=>{stop();go(+e.target.value);};
  document.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{speed=+b.dataset.speed;document.querySelectorAll('.seg button').forEach(x=>x.setAttribute('aria-pressed',x===b));if(timer)play();});
  document.querySelectorAll('.chip').forEach(b=>b.onclick=()=>b.dataset.q==='catch'?catchUp():ask(CHIP_Q[b.dataset.q],b.dataset.q));
  $('askForm').addEventListener('submit',e=>{e.preventDefault();const q=$('askInput').value.trim();if(q){ask(q,null);$('askInput').value='';}});
  $('feed').addEventListener('click',e=>{const b=e.target.closest('.ask');if(!b)return;const m=MOMENTS[+b.dataset.m];
    ask(`What did "${m.title}" (${m.ov}) mean for me?`,null,`${m.ov}: ${m.title}. ${m.body}${m.delta?` Rank change: ${m.delta.txt}.`:''}`);
    $('aiCard').scrollIntoView({behavior:'smooth',block:'nearest'});});
  const setLang=v=>{LG=v;$('lang').value=v;MOMENTS=buildMoments();applyStatic();relabel();setAiState(aiLive);render();if(lastAsk)lastAsk();};
  $('lang').addEventListener('change',()=>{setLang($('lang').value);try{localStorage.setItem('rr-lang',LG);}catch(e){}});
  relabel();
  try{const saved=localStorage.getItem('rr-lang');if(saved&&saved!=='English'&&STATIC.tagline)setLang(saved);}catch(e){}
  $('editBtn').onclick=e=>{e.preventDefault();openEditor();};
  $('edCancel').onclick=()=>{$('editor').hidden=true;};
  $('editor').addEventListener('keydown',e=>{if(e.key==='Escape')$('editor').hidden=true;});
  $('edBody').addEventListener('change',e=>{const id=e.target.dataset.id;if(!id)return;
    if(e.target.checked){if(draft.ids.length>=11){e.target.checked=false;$('edMsg').textContent=tr('You already have 11. Remove someone first.','11 ho gaye. Pehle kisi ko hatao.','11 पूरे हो गए। पहले किसी को हटाएँ।');return;}draft.ids.push(id);}
    else{draft.ids=draft.ids.filter(x=>x!==id);if(draft.c===id)draft.c=null;if(draft.vc===id)draft.vc=null;}
    renderEditor();});
  $('edBody').addEventListener('click',e=>{const b=e.target.closest('.cv');if(!b||b.disabled)return;
    if(b.dataset.c){draft.c=b.dataset.c;if(draft.vc===draft.c)draft.vc=null;}
    if(b.dataset.vc){draft.vc=b.dataset.vc;if(draft.c===draft.vc)draft.c=null;}
    renderEditor();});
  $('presetMine').onclick=()=>{draft={...DEFAULT_TEAM,ids:[...DEFAULT_TEAM.ids]};renderEditor();};
  $('presetCrowd').onclick=()=>{const ids=[...PLAYERS].sort((a,b)=>b.sel-a.sel).slice(0,11).map(p=>p.id);draft={ids,c:'krishnan',vc:'rao'};renderEditor();};
  $('edSave').onclick=()=>{setTeam({ids:[...draft.ids],c:draft.c,vc:draft.vc});$('editor').hidden=true;render();
    $('answer').innerHTML=`<div class="q">${team.name} updated</div><div class="a" style="color:var(--dim)">Ranks are recomputed for the whole chase against the same 2,50,000 rivals. Scrub back or press Restart to watch how this XI would have done.</div>`;};
  render();
}
