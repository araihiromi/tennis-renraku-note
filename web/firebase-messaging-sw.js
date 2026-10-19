// プッシュ通知を受け取るための Service Worker（アプリを閉じていても通知を表示する）
importScripts('firebase-config.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');
firebase.initializeApp(self.FIREBASE_CONFIG);
firebase.messaging();

// 通知を押したらアプリを開く（開いていればそのタブを前に出す）
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.FCM_MSG && e.notification.data.FCM_MSG.notification && e.notification.data.FCM_MSG.notification.click_action) || self.registration.scope;
  e.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true}).then((list) => {
    for (const c of list) if (c.url.startsWith(self.registration.scope) && 'focus' in c) return c.focus();
    return clients.openWindow(link);
  }));
});
