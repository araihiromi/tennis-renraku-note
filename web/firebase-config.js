// Firebase の設定（Firebase コンソール →「プロジェクトの設定」→「マイアプリ」の firebaseConfig を貼る）
// この値はブラウザに公開されるもので、秘密の情報ではない。データは firestore.rules で守られる。
self.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDR1G8JLNLpXoWlAs4TZJpgdwmQKpEuXuA",
  authDomain: "tennis-renraku-note.firebaseapp.com",
  projectId: "tennis-renraku-note",
  storageBucket: "tennis-renraku-note.firebasestorage.app",
  messagingSenderId: "827116124008",
  appId: "1:827116124008:web:0cf8103985de014166c8dd"
};
// 「Cloud Messaging」→「ウェブプッシュ証明書」の鍵ペア（公開鍵）
self.VAPID_KEY = "BIE1QUw-Ag_lW9DLjYph8zqaLblFAAN8Fopq5PpZPWIfBie_X7V4usYZpZdUzQrbxJJUbfbT2fEckcYJBb33MV0";
// テスト用：true にするとこのパソコンの Firebase エミュレーターにつなぐ
self.USE_EMULATOR = false;
