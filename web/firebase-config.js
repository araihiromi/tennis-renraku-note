// Firebase の設定（Firebase コンソール →「プロジェクトの設定」→「マイアプリ」の firebaseConfig を貼る）
// この値はブラウザに公開されるもので、秘密の情報ではない。データは firestore.rules で守られる。
self.FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
// 「Cloud Messaging」→「ウェブプッシュ証明書」の鍵ペア（公開鍵）
self.VAPID_KEY = "";
// テスト用：true にするとこのパソコンの Firebase エミュレーターにつなぐ
self.USE_EMULATOR = false;
