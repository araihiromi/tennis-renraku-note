#!/usr/bin/env bash
# テニス部連絡ノートを Firebase に公開する（Google Cloud Shell で実行）
#   bash ~/tennis-renraku-note/deploy.sh
# 何度実行しても大丈夫。セットアップキーは最初の1回だけ作り、2回目以降は同じものを使う。
set -e
cd "$(dirname "$0")"
PROJECT=tennis-renraku-note
FB="npx --yes firebase-tools@15.32.1"

echo
echo "=== 1/4 準備しています（1分ほど） ==="
npm --prefix functions install --no-audit --no-fund --loglevel=error

echo
echo "=== 2/4 セットアップキー ==="
if [ ! -f functions/.env ] || ! grep -q '^SETUP_KEY=' functions/.env; then
  printf 'SETUP_KEY=%s\nAPP_URL=https://%s.web.app/\n' "$(openssl rand -hex 12)" "$PROJECT" > functions/.env
fi
echo
echo "   セットアップキー： $(grep '^SETUP_KEY=' functions/.env | cut -d= -f2)"
echo
echo "   ↑ 紙にメモしてください。最初の管理者パスワードを決めるときに使います。"
echo "     （ほかの人に見せたり、チャットに貼ったりしないでください）"
read -r -p "   メモしたら Enter を押してください " _

echo
echo "=== 3/4 Firebase にログイン ==="
if $FB projects:list >/dev/null 2>&1; then
  echo "   ログイン済みです。"
else
  echo "   1. 「Allow Firebase to collect ...」と聞かれたら n を押して Enter"
  echo "   2. 出てくる長い URL を Ctrl を押しながらクリックして開く"
  echo "   3. ページの案内どおりに進めて「許可」を押し、最後に出るコードをここに貼って Enter"
  echo
  $FB login --no-localhost
fi

echo
echo "=== ログイン用の権限を設定しています ==="
# サーバーがログイン用のトークン（カスタムトークン）に署名できるようにする
NUM=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
SA="$NUM-compute@developer.gserviceaccount.com"
gcloud services enable iamcredentials.googleapis.com --project "$PROJECT" --quiet
gcloud iam service-accounts add-iam-policy-binding "$SA" --member="serviceAccount:$SA" \
  --role=roles/iam.serviceAccountTokenCreator --project "$PROJECT" --quiet >/dev/null && echo "   設定しました。" || echo "   （あとで設定してください：DEPLOY.md を参照）"

echo
echo "=== 4/4 公開しています（5〜10分。そのまま待ってください） ==="
CORE="hosting,firestore,storage"
for f in loginList login register adminLogin setupAdmin changeAdminPassword authStatus issueCode resetPassword; do CORE="$CORE,functions:$f"; done
NOTIFY="functions:notifyPractice,functions:notifyRide,functions:notifyPost,functions:notifyComment,functions:notifyWalkIn"

echo "   (1) アプリ本体（画面・ログイン・データ）"
$FB deploy --project "$PROJECT" --only "$CORE" --force

echo
echo "   (2) プッシュ通知（はじめての公開では準備に時間がかかるので、失敗したら待ってやり直します）"
ok=""
for i in 1 2 3 4; do
  if $FB deploy --project "$PROJECT" --only "$NOTIFY" --force; then ok=1; break; fi
  if [ "$i" -lt 4 ]; then echo; echo "   通知の準備がまだのようです。2分待ってもう一度試します（$i/3）…"; sleep 120; fi
done
if [ -z "$ok" ]; then
  echo
  echo "   アプリ本体は公開できましたが、プッシュ通知の公開に失敗しました。"
  echo "   10分ほど待ってから、もう一度 bash ~/tennis-renraku-note/deploy.sh を実行してください。"
  echo "   何度やっても失敗する場合は、Firestore Database の場所が asia-northeast1（Tokyo）か確認してください。"
fi

echo
echo "=================================================="
echo " 公開できました： https://$PROJECT.web.app"
echo " 開いて「管理者としてひらく」から、メモしたセットアップキーで"
echo " 管理者パスワードを設定してください。"
echo "=================================================="
