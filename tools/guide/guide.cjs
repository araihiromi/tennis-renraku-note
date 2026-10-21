// 保護者向けガイド画像（1080×1620）を作る
const path=require('path'),fs=require('fs');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const SH=path.join(__dirname,'shots'),OUT=process.argv[2];fs.mkdirSync(OUT,{recursive:true});
const BOX=JSON.parse(fs.readFileSync(path.join(SH,'boxes.json')));
const FONT='file://'+path.join(__dirname,'node_modules/@fontsource/zen-kaku-gothic-new/files');
const URL='https://tennis-renraku-note.web.app';
const css=`
@font-face{font-family:Z;font-weight:500;src:url(${FONT}/zen-kaku-gothic-new-japanese-500-normal.woff2)}
@font-face{font-family:Z;font-weight:700;src:url(${FONT}/zen-kaku-gothic-new-japanese-700-normal.woff2)}
@font-face{font-family:Z;font-weight:900;src:url(${FONT}/zen-kaku-gothic-new-japanese-900-normal.woff2)}
@font-face{font-family:Z;font-weight:500;src:url(${FONT}/zen-kaku-gothic-new-latin-500-normal.woff2);unicode-range:U+0000-00FF}
@font-face{font-family:Z;font-weight:700;src:url(${FONT}/zen-kaku-gothic-new-latin-700-normal.woff2);unicode-range:U+0000-00FF}
@font-face{font-family:Z;font-weight:900;src:url(${FONT}/zen-kaku-gothic-new-latin-900-normal.woff2);unicode-range:U+0000-00FF}
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1620px;background:#EFF5F0;font-family:Z,"IPAGothic",sans-serif;color:#1C2A21;font-weight:500;overflow:hidden}
.head{background:#2E8B4F;color:#fff;padding:48px 64px 40px;position:relative;overflow:hidden}
.head::after{content:"";position:absolute;right:-40px;top:24px;bottom:24px;width:330px;border:4px solid rgba(255,255,255,.35);border-right:0}
.step{display:inline-block;background:#D4E63A;color:#1B2410;font-weight:900;font-size:30px;border-radius:999px;padding:6px 24px;letter-spacing:.06em}
h1{font-size:62px;font-weight:900;margin-top:16px;line-height:1.25;position:relative;z-index:1}
.sub{font-size:30px;opacity:.9;margin-top:8px;position:relative;z-index:1}
.body{padding:44px 56px;display:flex;gap:44px}
.phone{position:relative;flex:none;border:12px solid #1C2A21;border-radius:44px;overflow:hidden;background:#fff;box-shadow:0 18px 40px rgba(20,60,30,.22)}
.phone img{display:block;width:100%}
.mk{position:absolute;z-index:2;width:58px;height:58px;border-radius:50%;background:#D9711A;color:#fff;font-weight:900;font-size:34px;display:grid;place-items:center;border:4px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.3);transform:translate(-50%,-50%)}
.ring{position:absolute;border:5px solid #D9711A;border-radius:14px;box-shadow:0 0 0 4px rgba(255,255,255,.8)}
.steps{display:flex;flex-direction:column;gap:30px;font-size:34px;line-height:1.5;min-width:0}
.st{display:flex;gap:18px;align-items:flex-start}
.n{flex:none;width:54px;height:54px;border-radius:50%;background:#D9711A;color:#fff;font-weight:900;font-size:30px;display:grid;place-items:center;margin-top:2px}
b{font-weight:900;color:#2E8B4F}
.box{background:#fff;border-radius:24px;padding:28px 32px;font-size:30px;line-height:1.6;border:3px solid #DCE8DC}
.box h3{font-size:32px;font-weight:900;margin-bottom:10px;color:#D9711A}
.box ul{padding-left:1.1em}
.url{font-family:Z,monospace;font-weight:900;font-size:40px;background:#fff;color:#2E8B4F;border-radius:16px;padding:14px 22px;display:inline-block;margin-top:20px;position:relative;z-index:1}
.foot{position:absolute;left:0;right:0;bottom:0;padding:22px 56px;font-size:24px;color:#66766B;display:flex;justify-content:space-between;border-top:2px solid #DCE8DC;background:#F6FAF5}
.key{display:inline-block;border:3px solid #2E8B4F;border-radius:10px;padding:0 12px;font-weight:900;color:#2E8B4F;background:#fff}
`;
function phone(name,W,marks,crop){
  // markers sit just outside the phone frame so they never cover the screen text
  const s=W/390,B=12;let rings='',mks='';
  for(const [i,n,pos] of marks){const b=BOX[name][i];if(!b)continue;
    rings+=`<div class="ring" style="left:${b.x*s-6}px;top:${b.y*s-6}px;width:${b.width*s+12}px;height:${b.height*s+12}px"></div>`;
    const x=pos==='l'?-6:W+2*B+6,y=B+b.y*s+b.height*s/2;mks+=`<div class="mk" style="left:${x}px;top:${y}px">${n}</div>`}
  return `<div style="position:relative;flex:none;margin:0 30px"><div class="phone" style="width:${W+2*B}px${crop?`;height:${Math.round(crop*s)+2*B}px`:''}"><img src="file://${path.join(SH,name+'.png')}">${rings}</div>${mks}</div>`;
}
const st=(n,t)=>`<div class="st"><span class="n">${n}</span><div>${t}</div></div>`;
const page=(k,step,title,sub,body,total)=>`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="head">${step?`<span class="step">${step}</span>`:''}<h1>${title}</h1>${sub?`<p class="sub">${sub}</p>`:''}</div>${body}
<div class="foot"><span>テニス部連絡ノート　保護者向けガイド</span><span>${k} / ${total}</span></div></body></html>`;
const T=6;
const pages=[
 ['01-hajimeni',page(1,'','テニス部連絡ノート<br>はじめてガイド','自主練習の予定・参加・送迎・テニスコート代金を、このアプリでまとめて連絡します',
  `<div class="body"><div class="steps" style="flex:1">
   <div class="box"><h3>アプリでできること</h3><ul>
   <li>練習の予定を見る・作る</li><li>「参加する」で参加の登録</li><li>送迎の調整</li><li>テニスコート代金の割り勘・精算</li><li>連絡掲示板・練習記録</li><li>新しい予定や連絡の<b>通知</b></li></ul></div>
   <div class="box"><h3>はじめる前に用意するもの</h3><ul><li>管理担当から届く<b>登録コード（6けた）</b></li><li>アプリのURL（インストール不要。Safari・Chrome で開けます）</li></ul>
   <span class="url" style="font-size:34px">${URL.replace('https://','')}</span></div>
  </div>${phone('04-home',380,[],1000)}</div>`,T)],
 ['02-login-first',page(2,'STEP 1','はじめてのログイン','最初の1回だけ、登録コードで家庭のパスワードを決めます',
  `<div class="body" style="flex-direction:column;gap:40px"><div style="display:flex;gap:0;justify-content:center">${phone('01-login-pick',400,[[0,1,'l']],600)}${phone('02-login-first',400,[[0,2,'l'],[1,3,'l'],[2,4,'r']],600)}</div>
  <div class="steps">${st(1,'<b>お子さんの名前</b>を選んで「つぎへ」')}${st(2,'管理担当から届いた<b>登録コード（6けた）</b>を入れる')}${st(3,'家庭の<b>パスワード（6文字以上）</b>を決めて2回入れる')}${st(4,'「パスワードを設定してひらく」を押す')}</div></div>`,T)],
 ['03-login-everytime',page(3,'STEP 2','2回目からのログイン','アプリを開くたびに、家庭のパスワードを入れます',
  `<div class="body">${phone('03-login-enter',420,[[0,1,'l'],[1,2,'r']],520)}<div class="steps">
  ${st(1,'お子さんを選んで「つぎへ」→ <b>家庭のパスワード</b>を入れる')}${st(2,'「ひらく」を押す')}
  <div class="box"><h3>ホーム画面に追加すると便利</h3>
  <b>iPhone</b>：Safari で開き、下の <span class="key">共有</span> →「ホーム画面に追加」<br><br><b>Android</b>：Chrome で開き、右上の <span class="key">︙</span> →「ホーム画面に追加」</div>
  <div class="box" style="font-size:27px">兄弟姉妹は同じパスワードで、まとめて参加登録できます。パスワードを忘れたら管理担当に連絡してください。</div></div></div>`,T)],
 ['04-sanka-sougei',page(4,'STEP 3','練習に参加する・送迎','参加はボタン1つ。送迎は練習ごとに調整できます',
  `<div class="body" style="flex-direction:column;gap:40px"><div style="display:flex;gap:0;justify-content:center">${phone('04-home',400,[[0,1,'l']],600)}${phone('06-ride-drivers',400,[[0,2,'l'],[1,3,'l']],600)}</div>
  <div class="steps">${st(1,'ホームの<b>「参加する」</b>を押す（間違えたら「参加を取り消す」）')}${st(2,'練習の詳細の<b>「送迎」</b>タブを開く')}${st(3,'車を出せる方は<b>「乗せられる」</b>、乗せてほしい方は<b>「乗りたい」</b>から登録。決まると通知が届きます')}</div></div>`,T)],
 ['05-coat-daikin',page(5,'STEP 4','テニスコート代金','その日は誰かが立て替え、月に1回まとめて精算します',
  `<div class="body">${phone('10-money',420,[[1,1,'l'],[0,2,'l']])}<div class="steps">
  ${st(1,'練習ごとの代金を、<b>参加した人で割り勘</b>します（欠席した日は0円）')}
  ${st(2,'月末に<b>「誰にいくら払うか」</b>が出ます。渡したら「未払い」を押して記録')}
  <div class="box" style="font-size:28px"><h3>コートで代金を払った方</h3>練習の詳細で「テニスコート代金を払った」を押してください。</div>
  <div class="box" style="font-size:28px">支払う金額は、<b>その家庭と管理担当だけ</b>に表示されます。</div></div></div>`,T)],
 ['06-tsuchi-onegai',page(6,'STEP 5','通知をオンにする','新しい予定・送迎・連絡がスマートフォンに届きます',
  `<div class="body">${phone('12-mypage-push',420,[[0,1,'l']])}<div class="steps">
  ${st(1,'「☰」→「マイページ」→ <b>「この端末で通知を受け取る」</b>→「許可」')}
  <div class="box" style="font-size:27px">iPhone は「ホーム画面に追加」したアイコンから開いてオンにしてください（iOS 16.4 以降）。自分の家庭が登録したものは、自分には通知されません。</div>
  <div class="box" style="font-size:28px"><h3>みなさまへのお願い</h3><ul>
  <li><b>電話番号・住所・メールアドレス</b>など、氏名以外の個人情報は書かないでください</li>
  <li>パスワードと登録コードは、家族以外に教えないでください</li>
  <li>わからないことは管理担当まで</li></ul></div></div></div>`,T)],
];
(async()=>{
 const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1080,height:1620},deviceScaleFactor:1});
 for(const [n,h] of pages){const f=path.join(OUT,n+'.html');fs.writeFileSync(f,h);await pg.goto('file://'+f);await pg.evaluate(()=>document.fonts.ready);await pg.waitForTimeout(300);
   await pg.screenshot({path:path.join(OUT,n+'.png')});fs.unlinkSync(f);console.log('made',n)}
 await b.close();
})();
