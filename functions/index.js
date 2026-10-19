// テニス部連絡ノート - サーバー側の処理
// ログイン（お子さん＋家庭のパスワード）、登録コード、管理者パスワード、プッシュ通知。
// パスワードと登録コードは secrets コレクションにだけ保存し、画面からは読めない（firestore.rules）。
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {onDocumentWritten} = require('firebase-functions/v2/firestore');
const {setGlobalOptions} = require('firebase-functions/v2');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {getAuth} = require('firebase-admin/auth');
const {getMessaging} = require('firebase-admin/messaging');
const crypto = require('crypto');

initializeApp();
setGlobalOptions({region: 'asia-northeast1', maxInstances: 5});
const db = getFirestore();
const secrets = (id) => db.collection('secrets').doc(id);

const ITER = 150000;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

function hashOf(salt, pw) {
  return crypto.pbkdf2Sync(String(pw), salt, ITER, 32, 'sha256').toString('hex');
}
function makeSecret(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return {salt, hash: hashOf(salt, pw)};
}
function matches(rec, pw) {
  if (!rec || !rec.hash) return false;
  const a = Buffer.from(hashOf(rec.salt, pw), 'hex');
  const b = Buffer.from(rec.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// 5回まちがえると15分ロック（サーバー側で数えるので画面を開き直しても回避できない）
async function guard(key) {
  const d = (await secrets('attempt_' + key).get()).data() || {};
  if (d.until && d.until > Date.now()) {
    const min = Math.ceil((d.until - Date.now()) / 60000);
    throw new HttpsError('resource-exhausted', `入力の間違いが続いたため、${min}分ほど待ってからもう一度入力してください。`);
  }
}
async function failed(key) {
  const ref = secrets('attempt_' + key);
  await db.runTransaction(async (t) => {
    const d = (await t.get(ref)).data() || {};
    const count = (d.count || 0) + 1;
    t.set(ref, count >= MAX_FAILS ? {count: 0, until: Date.now() + LOCK_MS} : {count, until: 0});
  });
}
async function cleared(key) { await secrets('attempt_' + key).delete(); }

async function familyOf(memberId) {
  if (typeof memberId !== 'string' || !memberId || memberId.includes('/')) throw new HttpsError('invalid-argument', 'お子さんを選んでください。');
  const m = await db.collection('members').doc(memberId).get();
  if (!m.exists) throw new HttpsError('not-found', 'お子さんが見つかりません。');
  return m.data().family || memberId;
}
function requireAdmin(req) {
  if (!req.auth || req.auth.token.admin !== true) throw new HttpsError('permission-denied', '管理者としてログインしてください。');
}
async function tokenFor(fam, isAdmin) {
  const uid = fam ? 'fam_' + fam : 'admin';
  const claims = {};
  if (fam) claims.fam = fam;
  if (isAdmin) claims.admin = true;
  return getAuth().createCustomToken(uid, claims);
}

// ログイン画面のお子さん一覧（名前と、登録済みかどうかだけ）
exports.loginList = onCall(async () => {
  const [ms, ss] = await Promise.all([db.collection('members').get(), db.collection('secrets').get()]);
  const has = new Set(ss.docs.map((d) => d.id));
  return {
    members: ms.docs.map((d) => {
      const fam = d.data().family || d.id;
      return {id: d.id, name: d.data().name || '', createdAt: d.data().createdAt || 0, registered: has.has('auth_' + fam), invited: has.has('invite_' + fam)};
    }).sort((a, b) => a.createdAt - b.createdAt),
    adminReady: has.has('admin'),
  };
});

// 家庭のパスワードでログイン
exports.login = onCall(async (req) => {
  const fam = await familyOf(req.data && req.data.memberId);
  await guard(fam);
  const rec = (await secrets('auth_' + fam).get()).data();
  if (!matches(rec, (req.data && req.data.password) || '')) {
    await failed(fam);
    throw new HttpsError('unauthenticated', 'パスワードが違います。');
  }
  await cleared(fam);
  return {token: await tokenFor(fam, false)};
});

// はじめてのログイン：登録コード＋新しいパスワード
exports.register = onCall(async (req) => {
  const {memberId, code, password} = req.data || {};
  const fam = await familyOf(memberId);
  if (typeof password !== 'string' || password.length < 6) throw new HttpsError('invalid-argument', 'パスワードは6文字以上にしてください。');
  await guard(fam);
  const inviteRef = secrets('invite_' + fam);
  const authRef = secrets('auth_' + fam);
  const ok = await db.runTransaction(async (t) => {
    const [inv, cur] = await Promise.all([t.get(inviteRef), t.get(authRef)]);
    if (cur.exists) throw new HttpsError('already-exists', 'この家庭のパスワードはすでに設定されています。');
    if (!inv.exists) throw new HttpsError('failed-precondition', '登録コードがまだ発行されていません。管理担当の方に頼んでください。');
    if (!matches(inv.data(), String(code || '').trim())) return false;
    t.set(authRef, {...makeSecret(password), setAt: Date.now()});
    t.delete(inviteRef);
    return true;
  });
  if (!ok) {
    await failed(fam);
    throw new HttpsError('unauthenticated', '登録コードが違います。管理担当の方に確認してください。');
  }
  await cleared(fam);
  return {token: await tokenFor(fam, false)};
});

// 管理者パスワード（家庭としてログイン中なら、その家庭のまま管理者権限を足す）
exports.adminLogin = onCall(async (req) => {
  await guard('admin');
  const rec = (await secrets('admin').get()).data();
  if (!rec) throw new HttpsError('failed-precondition', '管理者パスワードがまだ設定されていません。');
  if (!matches(rec, (req.data && req.data.password) || '')) {
    await failed('admin');
    throw new HttpsError('unauthenticated', '管理者パスワードが違います。');
  }
  await cleared('admin');
  const fam = req.auth && req.auth.token.fam;
  return {token: await tokenFor(fam || null, true)};
});

// 最初の管理者パスワード：デプロイ時に決めたセットアップキーを知っている人だけ
exports.setupAdmin = onCall(async (req) => {
  const key = process.env.SETUP_KEY || '';
  const {setupKey, password} = req.data || {};
  if (!key || String(setupKey || '') !== key) throw new HttpsError('permission-denied', 'セットアップキーが違います。');
  if (typeof password !== 'string' || password.length < 8) throw new HttpsError('invalid-argument', '管理者パスワードは8文字以上にしてください。');
  const ref = secrets('admin');
  await db.runTransaction(async (t) => {
    if ((await t.get(ref)).exists) throw new HttpsError('already-exists', '管理者パスワードはすでに設定されています。');
    t.set(ref, {...makeSecret(password), setAt: Date.now()});
  });
  return {token: await tokenFor((req.auth && req.auth.token.fam) || null, true)};
});

exports.changeAdminPassword = onCall(async (req) => {
  requireAdmin(req);
  const pw = req.data && req.data.password;
  if (typeof pw !== 'string' || pw.length < 8) throw new HttpsError('invalid-argument', '管理者パスワードは8文字以上にしてください。');
  await secrets('admin').set({...makeSecret(pw), setAt: Date.now()});
  return {ok: true};
});

// 管理者：家庭ごとの登録状況
exports.authStatus = onCall(async (req) => {
  requireAdmin(req);
  const ss = await db.collection('secrets').get();
  const out = {};
  for (const d of ss.docs) {
    const m = d.id.match(/^(auth|invite)_(.+)$/);
    if (!m) continue;
    out[m[2]] = out[m[2]] || {};
    if (m[1] === 'auth') out[m[2]].setAt = d.data().setAt || 1;
    else out[m[2]].invitedAt = d.data().createdAt || 1;
  }
  return {families: out};
});

// 管理者：登録コードの発行（6けた・1回限り）。コードそのものは保存せず、発行した画面にだけ返す
exports.issueCode = onCall(async (req) => {
  requireAdmin(req);
  const fam = String((req.data && req.data.fam) || '');
  if (!fam || fam.includes('/')) throw new HttpsError('invalid-argument', '家庭を選んでください。');
  if ((await secrets('auth_' + fam).get()).exists) throw new HttpsError('already-exists', 'この家庭はパスワード設定済みです。先にリセットしてください。');
  const code = String(crypto.randomInt(100000, 1000000));
  await secrets('invite_' + fam).set({...makeSecret(code), createdAt: Date.now()});
  await cleared(fam);
  return {code};
});

exports.resetPassword = onCall(async (req) => {
  requireAdmin(req);
  const fam = String((req.data && req.data.fam) || '');
  if (!fam || fam.includes('/')) throw new HttpsError('invalid-argument', '家庭を選んでください。');
  await secrets('auth_' + fam).delete();
  await cleared(fam);
  return {ok: true};
});

/* ---------- プッシュ通知 ---------- */
const APP_URL = process.env.APP_URL || '/';

async function famOfMember(id) {
  if (!id) return null;
  const m = await db.collection('members').doc(id).get();
  return m.exists ? (m.data().family || id) : null;
}
async function nameOf(id) {
  const m = await db.collection('members').doc(id).get();
  return m.exists ? m.data().name : '';
}
function jdate(s) {
  const [y, m, d] = s.split('-').map(Number);
  const w = '日月火水木金土'[new Date(y, m - 1, d).getDay()];
  return `${m}/${d}(${w})`;
}
// to: {only: fam} または {except: fam}
async function push(to, title, body, link) {
  const snap = await db.collection('pushTokens').get();
  const targets = snap.docs.filter((d) => {
    const f = d.data().fam;
    if (to.only) return f === to.only;
    return !to.except || f !== to.except;
  });
  if (!targets.length) return 0;
  const tokens = targets.map((d) => d.id);
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    // エミュレーターでは送らずに記録だけ残す（テスト用）
    await db.collection('pushLog').add({to, title, body, link, tokens: tokens.length, at: Date.now()});
    return tokens.length;
  }
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification: {title, body},
    webpush: {fcmOptions: {link: APP_URL + (link || '')}, notification: {icon: APP_URL + 'icon-192.png', badge: APP_URL + 'icon-192.png'}},
  });
  // 使えなくなった端末の登録を消す
  await Promise.all(res.responses.map((r, i) => {
    const code = r.error && r.error.code;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') return db.collection('pushTokens').doc(tokens[i]).delete();
    return null;
  }));
  return res.successCount;
}

exports.notifyPractice = onDocumentWritten('practices/{id}', async (ev) => {
  const before = ev.data.before.exists ? ev.data.before.data() : null;
  const after = ev.data.after.exists ? ev.data.after.data() : null;
  if (!after) return;
  const where = `${jdate(after.date)} ${after.start || ''} ${after.place} ${after.court}番コート`;
  if (!before) {
    return push({except: await famOfMember(after.createdBy)}, '練習予定が登録されました', where, '#plan');
  }
  const hb = (before.history || []).length, ha = (after.history || []).length;
  if (ha > hb) {
    const last = after.history[ha - 1];
    const cancelled = String(last.text || '').startsWith('中止');
    return push({except: await famOfMember(last.by)}, cancelled ? '練習が中止になりました' : '練習予定が変更されました', `${where}\n${last.text}`, '#plan');
  }
});

exports.notifyRide = onDocumentWritten('rides/{id}', async (ev) => {
  const before = ev.data.before.exists ? ev.data.before.data() : null;
  const after = ev.data.after.exists ? ev.data.after.data() : null;
  if (!after) return;
  const p = (await db.collection('practices').doc(after.practiceId).get()).data();
  if (!p) return;
  const child = await nameOf(after.fromId);
  if (after.status === 'accepted' && (!before || before.status !== 'accepted')) {
    return push({only: await famOfMember(after.fromId)}, '送迎が決まりました', `${jdate(p.date)} ${p.place}：${child}さんの送迎が決まりました`, '#plan');
  }
  if (!before && after.status === 'open') {
    const to = after.toId ? {only: await famOfMember(after.toId)} : {except: await famOfMember(after.fromId)};
    return push(to, '送迎のお願い', `${jdate(p.date)} ${p.place}：${child}さんの送迎をお願いしたいそうです`, '#plan');
  }
});

exports.notifyPost = onDocumentWritten('posts/{id}', async (ev) => {
  if (ev.data.before.exists || !ev.data.after.exists) return;
  const x = ev.data.after.data();
  const head = x.level === 'emergency' ? '【緊急】' : x.level === 'important' ? '【重要】' : '';
  return push({except: await famOfMember(x.authorId)}, head + '連絡：' + x.title, x.body || '', '#talk');
});

exports.notifyComment = onDocumentWritten('comments/{id}', async (ev) => {
  if (ev.data.before.exists || !ev.data.after.exists) return;
  const c = ev.data.after.data();
  const post = (await db.collection('posts').doc(c.postId).get()).data();
  if (!post) return;
  return push({except: await famOfMember(c.authorId)}, '返信：' + post.title, c.body || '', '#talk');
});

// 管理者が参加を記録したとき：その子の家庭だけに知らせる
exports.notifyWalkIn = onDocumentWritten('responses/{id}', async (ev) => {
  const before = ev.data.before.exists ? ev.data.before.data() : null;
  const after = ev.data.after.exists ? ev.data.after.data() : null;
  if (!after || !after.walkIn || after.attend !== 'yes') return;
  if (before && before.walkIn && before.attend === 'yes') return;
  const p = (await db.collection('practices').doc(after.practiceId).get()).data();
  if (!p) return;
  const child = await nameOf(after.memberId);
  return push({only: await famOfMember(after.memberId)}, '参加を記録しました', `${child}さんが${jdate(p.date)} ${p.place}の練習に参加しました（管理者が記録）。テニスコート代金の割り勘に入ります。`, '#money');
});
