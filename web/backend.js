// Firebase との接続。画面（index.html）からは window.TENNIS と window.claude.use(...) で使う。
// claude.use の形は claude.ai 版と同じにしてあるので、画面のコードはほぼそのまま動く。
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth, signInWithCustomToken, signOut, setPersistence, inMemoryPersistence, connectAuthEmulator} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore, connectFirestoreEmulator, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, onSnapshot} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {getFunctions, httpsCallable, connectFunctionsEmulator} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js';
import {getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject, connectStorageEmulator} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js';
import {getMessaging, getToken, deleteToken, isSupported, onMessage} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js';

const app = initializeApp(self.FIREBASE_CONFIG);
const auth = getAuth(app);
const fs = getFirestore(app);
const fn = getFunctions(app, 'asia-northeast1');
const st = getStorage(app);
if (self.USE_EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
  connectFirestoreEmulator(fs, '127.0.0.1', 8080);
  connectFunctionsEmulator(fn, '127.0.0.1', 5001);
  connectStorageEmulator(st, '127.0.0.1', 9199);
}
// ログインはこのタブの間だけ。閉じたり開き直したりすると、もう一度パスワードが必要
const ready = setPersistence(auth, inMemoryPersistence);

// Firebase のエラーを画面が使う形にそろえる
function mapErr(e) {
  const c = e && e.code || '';
  if (c === 'permission-denied') return {code: 'invalid_argument', message: e.message};
  if (c === 'resource-exhausted') return {code: 'resource_exhausted', message: e.message};
  return {code: 'unavailable', message: e && e.message};
}
const wrapDoc = (d) => ({id: d.id, exists: d.exists(), data: () => d.data(), metadata: d.metadata});
function mkDoc(r) {
  return {
    id: r.id, path: r.path,
    get: async () => wrapDoc(await getDoc(r)),
    set: (d) => setDoc(r, d).catch((e) => { throw mapErr(e); }),
    update: (d) => updateDoc(r, d).catch((e) => { throw mapErr(e); }),
    delete: () => deleteDoc(r).catch((e) => { throw mapErr(e); }),
    onSnapshot: (next, err) => onSnapshot(r, (s) => next(wrapDoc(s)), (e) => err && err(mapErr(e))),
    collection: (p) => mkCol(r.path + '/' + p),
  };
}
function mkCol(path) {
  const c = collection(fs, path);
  const snap = (s) => ({docs: s.docs.map(wrapDoc), size: s.size, empty: s.empty, metadata: s.metadata});
  return {
    path,
    doc: (id) => mkDoc(id ? doc(c, id) : doc(c)),
    add: async (d) => { try { return mkDoc(await addDoc(c, d)); } catch (e) { throw mapErr(e); } },
    get: async () => snap(await getDocs(c)),
    onSnapshot: (next, err) => onSnapshot(c, (s) => next(snap(s)), (e) => err && err(mapErr(e))),
  };
}
const db = {doc: (p) => mkDoc(doc(fs, p)), collection: (p) => mkCol(p)};

// 練習記録の写真
const assets = {
  async upload(blob, opts) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + '.jpg';
    const r = storageRef(st, 'photos/' + id);
    await uploadBytes(r, blob, {contentType: (opts && opts.type) || blob.type || 'image/jpeg', customMetadata: {uploader: auth.currentUser.uid}});
    return {id, url: await getDownloadURL(r)};
  },
  async delete(id) {
    try { await deleteObject(storageRef(st, 'photos/' + id)); return {deleted: true}; } catch (e) {
      if (e.code === 'storage/unauthorized') throw {code: 'not_uploader'};
      if (e.code === 'storage/object-not-found') return {deleted: false};
      throw mapErr(e);
    }
  },
};

const call = (name, data) => httpsCallable(fn, name)(data || {}).then((r) => r.data).catch((e) => { throw {code: e.code, message: e.message}; });

// アプリを開いているあいだに届いた通知も画面に出す（開いているときはブラウザが自動では出さないため）
let listening = false;
async function listenForeground() {
  try {
    if (listening || !(await push.supported()) || Notification.permission !== 'granted') return;
    listening = true;
    const reg = await navigator.serviceWorker.register('firebase-messaging-sw.js');
    onMessage(getMessaging(app), (p) => {
      const n = p.notification || {};
      reg.showNotification(n.title || 'テニス部連絡ノート', {body: n.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: p.messageId});
    });
  } catch (_) { listening = false; }
}

// プッシュ通知（この端末で受け取る）
const push = {
  async supported() { try { return 'Notification' in self && 'serviceWorker' in navigator && await isSupported(); } catch (_) { return false; } },
  permission() { return 'Notification' in self ? Notification.permission : 'unsupported'; },
  token() { try { return localStorage.getItem('tennis.pushToken') || ''; } catch (_) { return ''; } },
  async enable(fam) {
    if (!(await push.supported())) throw {code: 'unsupported'};
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw {code: 'denied'};
    const reg = await navigator.serviceWorker.register('firebase-messaging-sw.js');
    const token = await getToken(getMessaging(app), {vapidKey: self.VAPID_KEY, serviceWorkerRegistration: reg});
    await setDoc(doc(fs, 'pushTokens', token), {fam, uid: auth.currentUser.uid, at: Date.now()});
    try { localStorage.setItem('tennis.pushToken', token); } catch (_) {}
    listenForeground();
    return token;
  },
  // ログインのたびに、この端末の宛先をいまの家庭にそろえる
  async refresh(fam) {
    const t = push.token();
    if (!t || push.permission() !== 'granted' || !fam) return;
    try { await setDoc(doc(fs, 'pushTokens', t), {fam, uid: auth.currentUser.uid, at: Date.now()}); } catch (_) {}
    listenForeground();
  },
  async disable() {
    const t = push.token();
    try { if (t) await deleteDoc(doc(fs, 'pushTokens', t)); } catch (_) {}
    try { await deleteToken(getMessaging(app)); } catch (_) {}
    try { localStorage.removeItem('tennis.pushToken'); } catch (_) {}
  },
};

window.TENNIS = {
  call,
  push,
  async signIn(token) {
    await ready;
    await signInWithCustomToken(auth, token);
    const res = await auth.currentUser.getIdTokenResult(true);
    return {uid: auth.currentUser.uid, fam: res.claims.fam || null, admin: res.claims.admin === true};
  },
  async logout() { try { await signOut(auth); } finally { location.reload(); } },
  uid: () => auth.currentUser && auth.currentUser.uid,
};
window.claude = {use: async (name) => (name === 'db' ? db : name === 'assets' ? (auth.currentUser ? assets : null) : null)};
window.dispatchEvent(new Event('tennis-ready'));
