// 保護者向けガイド用のスクリーンショット（架空のサンプルデータ）
const path=require('path'),fs=require('fs'),http=require('http'),crypto=require('crypto');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const REPO='/home/user/tennis-renraku-note';
const rq=require('module').createRequire(REPO+'/functions/index.js');
rq('firebase-admin/app').initializeApp({projectId:'demo-tennis'});const adb=rq('firebase-admin/firestore').getFirestore();
const SITE=path.join(__dirname,'site');fs.rmSync(SITE,{recursive:true,force:true});fs.cpSync(REPO+'/web',SITE,{recursive:true});
fs.writeFileSync(SITE+'/firebase-config.js',`self.FIREBASE_CONFIG={apiKey:'fake-key',authDomain:'demo-tennis.firebaseapp.com',projectId:'demo-tennis',storageBucket:'demo-tennis.appspot.com',messagingSenderId:'1',appId:'1:1:web:1'};self.VAPID_KEY='x';self.USE_EMULATOR=true;`);
const FONT=path.join(__dirname,'node_modules/@fontsource/zen-kaku-gothic-new');
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);let f=u.startsWith('/__font/')?path.join(FONT,u.slice(8)):path.join(SITE,u);if(f.endsWith('/'))f+='index.html';
  fs.readFile(f,(e,b)=>{if(e){r.writeHead(404);return r.end()}const t=f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':f.endsWith('.woff2')?'font/woff2':'application/octet-stream';r.writeHead(200,{'content-type':t});r.end(b)})}).listen(5050);
const SDK=path.join(__dirname,'node_modules/firebase');
const hashOf=(salt,pw)=>crypto.pbkdf2Sync(String(pw),salt,150000,32,'sha256').toString('hex');
const sec=pw=>{const salt=crypto.randomBytes(16).toString('hex');return {salt,hash:hashOf(salt,pw),setAt:Date.now()}};
const OUT=path.join(__dirname,'shots');
(async()=>{
 // ---- 架空のサンプルデータ ----
 const M={t:['テニス 太郎','テニス'],r:['ラケット 花子','ラケット'],b:['ボール 一郎','ボール'],c:['コート 次郎','コート'],n:['ネット 三郎','ネット']};
 let i=1;for(const [id,[name,parent]] of Object.entries(M))await adb.doc('members/'+id).set({name,parent,family:id,createdAt:i++});
 await adb.doc('secrets/auth_t').set(sec('tennis123'));
 await adb.doc('secrets/invite_r').set({...sec('123456'),createdAt:Date.now()});
 await adb.doc('secrets/admin').set(sec('adminpass1'));
 const P={date:'2026-10-24',start:'09:00',end:'12:00',place:'市営テニスコート',court:'A',fee:4000,meetTime:'08:45',meetPlace:'駐車場',bring:'ラケット、水筒、タオル、帽子',deadline:'2026-10-22T21:00',note:'雨の場合は当日7:00に判断します',status:'scheduled',history:[],createdBy:'',createdAt:Date.now()-86400000};
 await adb.doc('practices/p1').set(P);
 await adb.doc('practices/p2').set({...P,date:'2026-10-31',start:'13:00',end:'16:00',place:'中央公園テニスコート',court:'3',fee:0,meetTime:'12:45',meetPlace:'管理棟前',note:''});
 await adb.doc('practices/p0').set({...P,date:'2026-10-17',fee:3000,court:'B',note:''});
 const R=(p,m,x)=>adb.doc(`responses/${p}__${m}`).set({practiceId:p,memberId:m,attend:'yes',transport:null,seats:0,route:'',pickup:'',updatedAt:Date.now(),...x});
 await R('p1','r',{transport:'can',seats:3,route:'8:20 さくら小学校前 → コート'});await R('p1','b',{transport:'cannot',pickup:'みどり公園前'});await R('p1','c',{transport:'self'});await R('p1','n',{transport:'can',seats:2,route:'8:15 駅前ロータリー → コート'});
 await R('p0','t',{});await R('p0','r',{});await R('p0','b',{});
 await adb.doc('payments/x1').set({memberId:'b',to:'',practiceId:'p0',costId:'',settle:false,month:'2026-10',date:'2026-10-17',amount:3000,note:'',createdAt:Date.now()});
 await adb.doc('posts/q1').set({title:'10/24 雨天時の対応について',body:'天気予報が雨の場合は、当日7:00に判断してこのアプリでお知らせします。',level:'important',pinned:true,practiceId:'',authorId:'c',createdAt:Date.now()-3600000});
 await adb.doc('settings/app').set({round:10,leader:'保護者代表 コート',procedure:'',contact:''});

 const b=await chromium.launch();
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,locale:'ja-JP',timezoneId:'Asia/Tokyo'});
 await ctx.route('https://www.gstatic.com/firebasejs/12.19.0/**',r=>r.fulfill({path:path.join(SDK,r.request().url().split('/').pop()),contentType:'text/javascript'}));
 await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:[400,500,700,900].map(w=>`@font-face{font-family:'Zen Kaku Gothic New';font-weight:${w};font-display:block;src:url(http://127.0.0.1:5050/__font/files/zen-kaku-gothic-new-japanese-${w}-normal.woff2) format('woff2')}@font-face{font-family:'Zen Kaku Gothic New';font-weight:${w};font-display:block;src:url(http://127.0.0.1:5050/__font/files/zen-kaku-gothic-new-latin-${w}-normal.woff2) format('woff2');unicode-range:U+0000-00FF}`).join('\n')}));
 await ctx.addInitScript(()=>{try{Object.defineProperty(Notification,'permission',{get:()=>'default'})}catch(_){}});
 const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 const BOX={};
 const SEL={'01-login-pick':['#lp-m','form[data-form=login-pick] button'],'02-login-first':['#ls-code','#ls-1','form[data-form=login-set] button'],
  '03-login-enter':['#le-pw','form[data-form=login-enter] button'],'04-home':['button.a.yes','[data-act=pushOn]','[data-act=bell]'],
  '05-home-joined':['button.a.yes'],'06-ride-drivers':['[data-g=dtab][data-k=ride]','[data-act=sheet][data-k=driver]'],'07-ride-riders':['[data-g=ride][data-k=riders]','[data-act=sheet][data-k=rider]'],
  '10-money':['.bill','.lines'],'12-mypage-push':['[data-act=pushOn]'],'09-plan':['.cal','[data-act=newPractice]'],'11-board':['.tabs','.post']};
 const shot=async(n)=>{await pg.waitForTimeout(500);await pg.screenshot({path:path.join(OUT,n+'.png')});
   BOX[n]=[];for(const q of SEL[n]||[]){const bb=await pg.locator(q).first().boundingBox().catch(()=>null);BOX[n].push(bb)}
   fs.writeFileSync(path.join(OUT,'boxes.json'),JSON.stringify(BOX,null,1));console.log('shot',n)};
 await pg.goto('http://127.0.0.1:5050/');await pg.waitForSelector('#lp-m',{timeout:30000});await pg.evaluate(()=>document.fonts.ready);
 await pg.selectOption('#lp-m','t');await shot('01-login-pick');
 // はじめてのログイン（ラケット 花子：登録コード）
 await pg.selectOption('#lp-m','r');await pg.click('text=つぎへ');await pg.waitForSelector('#ls-code');
 await pg.fill('#ls-code','123456');await pg.fill('#ls-1','hanako1');await pg.fill('#ls-2','hanako1');await shot('02-login-first');
 await pg.click('text=最初の画面にもどる');
 // 2回目からのログイン（テニス 太郎）
 await pg.selectOption('#lp-m','t');await pg.click('text=つぎへ');await pg.waitForSelector('#le-pw');await pg.fill('#le-pw','tennis123');await shot('03-login-enter');
 await pg.click('form[data-form=login-enter] button');await pg.waitForSelector('nav.bottom button',{timeout:30000});await pg.waitForTimeout(800);
 await shot('04-home');
 await pg.click('button.a.yes');await pg.waitForTimeout(800);await shot('05-home-joined');
 await pg.click('text=詳細・参加者を見る');await pg.click('[data-g=dtab][data-k=ride]');await shot('06-ride-drivers');
 await pg.click('[data-g=ride][data-k=riders]');await shot('07-ride-riders');
 await pg.click('[data-g=dtab][data-k=attend]');await shot('08-attend');
 await pg.click('[data-act=back]');await pg.click('nav.bottom button:has-text("予定")');await shot('09-plan');
 await pg.click('nav.bottom button:has-text("費用")');await shot('10-money');
 await pg.click('nav.bottom button:has-text("連絡")');await shot('11-board');
 await pg.click('[data-act=drawer]');await pg.click('.navitem:has-text("マイページ")');await pg.evaluate(()=>document.getElementById('push')?.scrollIntoView({block:'center'}));await shot('12-mypage-push');
 console.log('ERRORS',errs);await b.close();srv.close();process.exit(0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});
