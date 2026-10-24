// 通知を受け取るための裏方のファイル(リポジトリの一番上に置く。v16〜)

// 届いた通知は、アプリを開いているときも閉じているときも、必ずここで1回だけ表示する
// (iPhoneは、表示しない通知が続くと通知を止めてしまうため)
self.addEventListener("push", event => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch (e) { p = {}; }
  const d = p.data || p.notification || {};
  event.waitUntil(Promise.all([
    self.registration.showNotification(d.title || "Trip", {
      body: d.body || "",
      data: { url: d.url || "./" }
    }),
    setBadge(d.badge)
  ]));
});

// ホーム画面のアイコンの数字(次の旅行まであと何日か)を、通知が届いたときに合わせる。
// アプリを閉じていても数字が変わる。0なら消す。数字が入っていない通知では何もしない
async function setBadge(value) {
  try {
    if (value === undefined || value === null || value === "") return;
    if (!("setAppBadge" in self.navigator)) return;
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    if (n > 0) await self.navigator.setAppBadge(n);
    else await self.navigator.clearAppBadge();
  } catch (e) {
    console.error(e);
  }
}

importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCD_oEF8i01mfxVVg09QCp2xpcIgmCmLMI",
  authDomain: "trip-2b366.firebaseapp.com",
  projectId: "trip-2b366",
  storageBucket: "trip-2b366.firebasestorage.app",
  messagingSenderId: "46588245854",
  appId: "1:46588245854:web:2a485019ac623d11af81cf"
});

// 通知の登録(トークン)のために読み込む。表示は上の push で行うので、ここでは表示しない
firebase.messaging();

// 通知をタップしたら、アプリを開く(開いていれば、その画面に切り替える)
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil((async () => {
    const list = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of list) {
      if ("focus" in c) return c.focus();
    }
    return clients.openWindow(url);
  })());
});
