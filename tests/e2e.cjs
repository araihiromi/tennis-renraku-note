// エンドツーエンドのテスト（Firebase エミュレーターで、本物のルールとサーバー処理を使って確認する）
// 実行: npm install && npm test   （Java 11 以上が必要）
// 管理者のセットアップ → 選手登録 → 登録コード → 保護者ログイン → ほかの家庭への書き込みが拒否されること など
const path=require('path'),fs=require('fs'),http=require('http');
const {chromium}=require('playwright');
const REPO=path.join(__dirname,'..');
const rq=require('module').createRequire(REPO+'/functions/index.js');rq('firebase-admin/app').initializeApp({projectId:'demo-tennis'});const adb=rq('firebase-admin/firestore').getFirestore();
// test copy of web/ pointing at the emulators
const SITE=path.join(require('os').tmpdir(),'tennis-e2e-site');fs.rmSync(SITE,{recursive:true,force:true});fs.cpSync(REPO+'/web',SITE,{recursive:true});
fs.writeFileSync(SITE+'/firebase-config.js',`self.FIREBASE_CONFIG={apiKey:'fake-key',authDomain:'demo-tennis.firebaseapp.com',projectId:'demo-tennis',storageBucket:'demo-tennis.appspot.com',messagingSenderId:'1',appId:'1:1:web:1'};self.VAPID_KEY='';self.USE_EMULATOR=true;`);
const srv=http.createServer((q,r)=>{let f=path.join(SITE,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';fs.readFile(f,(e,b)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream'});r.end(b)})}).listen(5050);
const SDK=path.dirname(require.resolve('firebase/package.json'));
const log=(...a)=>console.log(...a);let fails=0;const ok=(c,msg)=>{log((c?'PASS ':'FAIL ')+msg);if(!c)fails++};
(async()=>{
 const b=await chromium.launch();
 const open=async()=>{const pg=await b.newPage({viewport:{width:400,height:900}});pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
   await pg.route('https://www.gstatic.com/firebasejs/12.19.0/**',r=>{const f=path.join(SDK,r.request().url().split('/').pop());r.fulfill({path:f,contentType:'text/javascript'})});
   await pg.route('https://fonts.googleapis.com/**',r=>r.abort());
   await pg.goto('http://127.0.0.1:5050/');await pg.waitForSelector('text=ログイン',{timeout:30000});return pg};
 const txt=async pg=>(await pg.textContent('main')).replace(/\s+/g,' ');
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 // ---------- admin setup ----------
 const A=await open();
 await A.click('text=管理者としてひらく');
 await A.fill('#as-key','wrong-key');await A.fill('#as-1','adminpass1');await A.fill('#as-2','adminpass1');await A.click('form[data-form=admin-set] button');await A.waitForSelector('text=セットアップキーが違います');ok(true,'wrong setup key rejected');
 await A.fill('#as-key','test-setup-key');await A.fill('#as-1','adminpass1');await A.fill('#as-2','adminpass1');await A.click('form[data-form=admin-set] button');
 await A.waitForSelector('#a-mem',{timeout:20000});ok(true,'admin set up and opened admin screen');
 const addMember=async(n,p,fam)=>{await A.fill('#ma-name',n);await A.fill('#ma-parent',p);if(fam)await A.selectOption('#ma-fam',{label:fam});await A.click('form[data-form=member-admin] button');await A.waitForFunction(x=>document.querySelector('main').textContent.includes(x),n)};
 await addMember('山田 太郎','山田');await addMember('鈴木 一郎','鈴木');await addMember('山田 次郎','山田','山田 太郎の兄弟姉妹');
 ok(true,'3 children registered by admin');
 await A.waitForSelector('[data-act=issueCode]',{timeout:20000});
 const codes={};
 for(const who of ['山田 太郎・山田 次郎','鈴木 一郎']){
   const row=A.locator('#a-pw .line',{hasText:who});await row.locator('[data-act=issueCode]').click();
   await A.waitForFunction(w=>[...document.querySelectorAll('#a-pw .line')].some(l=>l.textContent.includes(w)&&/登録コード：\d{6}/.test(l.textContent)),who,{timeout:20000});
   codes[who]=(await row.textContent()).match(/登録コード：(\d{6})/)[1];
 }
 ok(Object.keys(codes).length===2,'codes issued: '+JSON.stringify(codes));
 // practice by admin
 await A.click('[data-act=newPractice]');await A.fill('#pf-date','2026-10-25');await A.fill('#pf-place','市営テニスコート');await A.fill('#pf-court','A');await A.fill('#pf-fee','4000');
 // push tokens for the two families (FCM itself cannot run in the emulator)
 const ms=await adb.collection('members').get();const famOf=n=>{const d=ms.docs.find(d=>d.data().name===n);return d.data().family};
 const FY=famOf('山田 太郎'),FS=famOf('鈴木 一郎');
 await adb.collection('pushTokens').doc('tokY').set({fam:FY});await adb.collection('pushTokens').doc('tokS').set({fam:FS});
 await A.click('form[data-form=practice] button.primary');await wait(1500);
 // ---------- parent 山田 ----------
 const Y=await open();
 await Y.selectOption('#lp-m',{label:'山田 太郎'});await Y.click('text=つぎへ');
 await Y.fill('#ls-code','000000');await Y.fill('#ls-1','yamada1');await Y.fill('#ls-2','yamada1');await Y.click('form[data-form=login-set] button');
 await Y.waitForSelector('text=登録コードが違います',{timeout:20000});ok(true,'wrong registration code rejected');
 await Y.fill('#ls-code',codes['山田 太郎・山田 次郎']);await Y.fill('#ls-1','yamada1');await Y.fill('#ls-2','yamada1');await Y.click('form[data-form=login-set] button');
 await Y.waitForSelector('nav.bottom button',{timeout:20000});ok(true,'山田 registered with code and logged in');
 await Y.click('[data-act=drawer]');await Y.click('.navitem:has-text("マイページ")');
 ok((await txt(Y)).includes('山田 次郎'),'family includes sibling 次郎');
 await Y.click('nav.bottom button:has-text("ホーム")');await Y.waitForSelector('button.a.yes');await Y.click('button.a.yes >> nth=0');await wait(800);
 const myResp=await adb.collection('responses').where('attend','==','yes').get();ok(myResp.size===1,'山田 太郎 attendance saved');
 // code is single-use
 const Y2=await open();await Y2.selectOption('#lp-m',{label:'山田 次郎'});await Y2.click('text=つぎへ');ok((await txt(Y2)).includes('パスワード'),'sibling shares family password (enter screen)');
 // ---------- rules: try to break in from 山田's session ----------
 const sid=ms.docs.find(d=>d.data().name==='鈴木 一郎').id,tid=ms.docs.find(d=>d.data().name==='山田 太郎').id;
 const pid=(await adb.collection('practices').get()).docs[0].id;
 const tryW=async(fn)=>Y.evaluate(fn).then(()=>'allowed',e=>'denied');
 const r1=await Y.evaluate(async([pid,sid])=>{const db=await window.claude.use('db');try{await db.collection('responses').doc(pid+'__'+sid).set({practiceId:pid,memberId:sid,attend:'yes'});return 'allowed'}catch(e){return 'denied:'+e.code}},[pid,sid]);
 ok(r1.startsWith('denied'),'cannot register attendance for another family\'s child ('+r1+')');
 const r2=await Y.evaluate(async([pid,tid])=>{const db=await window.claude.use('db');try{await db.collection('responses').doc(pid+'__'+tid).set({practiceId:pid,memberId:tid,attend:'yes',walkIn:true});return 'allowed'}catch(e){return 'denied:'+e.code}},[pid,tid]);
 ok(r2.startsWith('denied'),'parent cannot mark own child as admin-added ('+r2+')');
 const r3=await Y.evaluate(async()=>{const db=await window.claude.use('db');try{const s=await db.collection('secrets').get();return 'read '+s.size}catch(e){return 'denied:'+e.code}});
 ok(r3.startsWith('denied'),'cannot read password store ('+r3+')');
 const r4=await Y.evaluate(async([sid])=>{const db=await window.claude.use('db');try{await db.collection('members').doc(sid).update({family:'x'});return 'allowed'}catch(e){return 'denied:'+e.code}},[sid]);
 ok(r4.startsWith('denied'),'cannot move another child into own family ('+r4+')');
 const r5=await Y.evaluate(async()=>{try{await TENNIS.call('issueCode',{fam:'x'});return 'allowed'}catch(e){return 'denied:'+e.code}});
 ok(r5.startsWith('denied'),'parent cannot issue registration codes ('+r5+')');
 const r6=await Y.evaluate(async()=>{const db=await window.claude.use('db');try{await db.doc('settings/app').set({round:1});return 'allowed'}catch(e){return 'denied:'+e.code}});
 ok(r6.startsWith('denied'),'parent cannot change settings ('+r6+')');
 // ---------- admin screen needs the admin password ----------
 await Y.click('[data-act=drawer]');await Y.click('.navitem:has-text("管理者画面")');await Y.fill('#ar-pw','nope-nope');await Y.click('.sheet button.primary');await wait(1500);
 ok(!(await Y.$('#a-mem')),'wrong admin password keeps admin screen closed');
 // ---------- reload = login again ----------
 await Y.reload();await Y.waitForSelector('text=ログイン',{timeout:30000});ok((await Y.$$('nav.bottom button')).length===0,'reload requires login again');
 // ---------- lockout ----------
 const L=await open();await L.selectOption('#lp-m',{label:'山田 太郎'});await L.click('text=つぎへ');
 for(let i=0;i<5;i++){await L.fill('#le-pw','bad'+i);await L.click('form[data-form=login-enter] button');await L.waitForFunction(()=>/違います|待って/.test(document.querySelector('main').textContent),null,{timeout:20000});}
 await L.fill('#le-pw','yamada1');await L.click('form[data-form=login-enter] button');await L.waitForFunction(()=>/待って/.test(document.querySelector('main').textContent),null,{timeout:20000});
 ok(true,'after 5 wrong passwords even the right one is locked out');
 // ---------- 鈴木 + walk-in by admin ----------
 const S2=await open();await S2.selectOption('#lp-m',{label:'鈴木 一郎'});await S2.click('text=つぎへ');await S2.fill('#ls-code',codes['鈴木 一郎']);await S2.fill('#ls-1','suzuki1');await S2.fill('#ls-2','suzuki1');await S2.click('form[data-form=login-set] button');await S2.waitForSelector('nav.bottom button',{timeout:20000});
 ok(true,'鈴木 registered');
 await A.click('[data-act=sheet][data-k=walkin] >> nth=0').catch(async()=>{await A.click('[data-act=jump][data-k=a-att]')});
 await A.waitForSelector('form[data-form=walkin]');await A.check(`[data-draft-check="wi.${sid}"]`);await A.click('form[data-form=walkin] button.primary');await wait(2500);
 const w=await adb.collection('responses').doc(pid+'__'+sid).get();ok(w.exists&&w.data().walkIn===true,'admin added 鈴木 as walk-in');
 await S2.waitForFunction(()=>document.querySelector('main').textContent.includes('管理者が記録した参加'),null,{timeout:20000});ok(true,'鈴木 family sees the admin-recorded attendance');
 await S2.click('nav.bottom button:has-text("費用")');await wait(500);const mt=await txt(S2);ok(/2名で按分（1人 2,000円）/.test(mt),'court fee split includes walk-in: '+(mt.match(/\d名で按分（1人 [\d,]+円）/)||[''])[0]);
 // ---------- push log ----------
 await wait(4000);
 const pl=(await adb.collection('pushLog').get()).docs.map(d=>d.data());
 const prac=pl.find(x=>x.title==='練習予定が登録されました');ok(prac&&prac.tokens===2,'practice push to both families');
 const wi=pl.find(x=>x.title==='参加を記録しました');ok(wi&&wi.to.only===FS&&wi.tokens===1,'walk-in push only to 鈴木 family');
 for(const pg of [A,Y,Y2,L,S2])if(pg.errs.length)ok(false,'page errors: '+pg.errs.join(' | '));
 log(fails?`\n${fails} FAILED`:'\nALL PASSED');
 await b.close();srv.close();process.exit(fails?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});
