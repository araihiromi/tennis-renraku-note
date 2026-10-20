# 公開（リリース）の手順

テニス部連絡ノートを Firebase で公開する手順です。最初の1回は 30 分ほどかかります。

## 1. Firebase のプロジェクトを作る（ブラウザだけでできます）

1. https://console.firebase.google.com を開き、「プロジェクトを追加」。名前は `tennis-renraku-note` など。Google アナリティクスはオフで大丈夫です。
2. 左下の「アップグレード」から **Blaze（従量課金）プラン** にする（Cloud Functions に必要）。
   - 「予算とアラート」で月 500 円などのアラートを設定しておくと安心です。この規模なら無料枠に収まる見込みです。
3. 「構築」から次の3つを有効にする。
   - **Authentication**：「始める」を押すだけ（ログイン方法の設定は不要）
   - **Firestore Database**：「データベースの作成」→ 場所 `asia-northeast1（東京）` → 本番モード
   - **Storage**：「始める」→ 場所は東京
4. ⚙「プロジェクトの設定」→「マイアプリ」→「</>（ウェブ）」でアプリを登録する。
   - 表示される `npm install firebase` は**実行しなくて大丈夫**です（このアプリは使いません）。
   - その下の `firebaseConfig = { ... }` の中身を `web/firebase-config.js` に貼る。
5. 同じ設定画面の「Cloud Messaging」タブ →「ウェブプッシュ証明書」→「鍵ペアを生成」。出てきた公開鍵を `web/firebase-config.js` の `VAPID_KEY` に貼る。

## 2. サーバーに上げる（Google Cloud Shell を使う）

自分のパソコンに何も入れずにできます。

1. Firebase と同じ Google アカウントで https://shell.cloud.google.com を開く。
2. 次を 1 行ずつ貼り付けて実行する。

```sh
git clone https://github.com/araihiromi/tennis-renraku-note.git
cd tennis-renraku-note
# セットアップキー（最初の管理者パスワードを決めるときに1回だけ使う）を作って表示する。メモしておく
echo "SETUP_KEY=$(openssl rand -hex 12)" > functions/.env
echo "APP_URL=https://tennis-renraku-note.web.app/" >> functions/.env
cat functions/.env
npm --prefix functions ci
npx firebase-tools@15.32.1 login --no-localhost
npx firebase-tools@15.32.1 deploy --project tennis-renraku-note
```

- `git clone` でユーザー名とパスワードを聞かれたら、GitHub のユーザー名と「Personal access token」（GitHub の Settings → Developer settings で作成）を入れます。
- `login` で表示される URL を開いて許可し、出てきたコードを貼り付けます。
- 終わると `https://tennis-renraku-note.web.app` で開けるようになります。

## 3. 使いはじめ

1. アプリを開き「管理者としてひらく」→ セットアップキーと管理者パスワード（8文字以上）を設定。
2. 管理者画面の「メンバー管理」で児童を全員登録（兄弟は「家庭」で同じ家庭を選ぶ）。
3. 「ログインとパスワード」で家庭ごとに登録コードを発行し、保護者に**個別に**伝える（URL も一緒に）。
4. 保護者は、お子さんを選び、登録コードと自分で決めたパスワードでログイン。「この端末で通知を受け取る」を押すとプッシュ通知が届きます。
   - iPhone は Safari の共有ボタン →「ホーム画面に追加」で追加したアプリから開いて、通知をオンにします（iOS 16.4 以降）。

## 更新するとき

Cloud Shell で `cd tennis-renraku-note && git pull && npx firebase-tools@15.32.1 deploy --project tennis-renraku-note`。

## テスト

`npm install && npm test`（Java 11 以上が必要）。Firebase エミュレーターで、ログイン・登録コード・ほかの家庭への書き込みの拒否・通知の宛先などを確認します。
