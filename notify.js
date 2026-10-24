// 毎朝動いて、「次の旅行まで あと◯日」を登録済みの端末に送る(v16〜)
// アイコンの数字(バッジ)も、通知に入れた日数で変わる
// GitHub Actionsから実行される(画面からは使わない)
const admin = require("firebase-admin");

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.log("FIREBASE_SERVICE_ACCOUNT が設定されていないので、何もしません");
  process.exit(0);
}
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const messaging = admin.messaging();

const APP_URL = "https://fantasticisland21-lgtm.github.io/Trip/";
const WD = ["日", "月", "火", "水", "木", "金", "土"];

// 日本時間の「今日」("2026-10-24" の形)
function todayJST() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}
const toMs = s => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const diffDays = (a, b) => Math.round((toMs(b) - toMs(a)) / 86400000);
const fmtD = s => { const d = new Date(toMs(s)); return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日(${WD[d.getUTCDay()]})`; };
// 「漢字{かんじ}」のふりがなを外す
const rawName = s => String(s || "").replace(/([一-鿿々〆ヶ]+)\{([^{}]+)\}/g, "$1").replace(/[{}]/g, "");

async function main() {
  const td = todayJST();
  const trips = (await db.collection("trips").get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const devSnap = await db.collectionGroup("devices").get();

  // 端末ごとにまとめる(同じ端末が、いくつもの旅行に入っている)
  const devs = new Map();
  for (const d of devSnap.docs) {
    const x = d.data();
    if (!x.token || !x.email) continue;
    const e = devs.get(x.token) || { email: x.email, refs: [] };
    e.refs.push(d.ref);
    devs.set(x.token, e);
  }

  let sent = 0;
  const deadRefs = [];
  for (const [token, dv] of devs) {
    try {
      const email = String(dv.email).toLowerCase();
      const mine = trips.filter(t => [...(t.parents || []), ...(t.viewers || [])].includes(email));
      const next = mine.filter(t => t.start && t.start >= td).sort((a, b) => a.start.localeCompare(b.start))[0];
      if (!next) continue; // 次の旅行がなければ送らない
      const n = diffDays(td, next.start);
      const name = rawName(next.name) || "旅行";
      const data = n > 0
        ? { title: `${name}まで あと${n}日`, body: `${fmtD(next.start)}出発${next.dest ? " / " + rawName(next.dest) : ""}`, badge: String(n) }
        : { title: `きょうから ${name}`, body: "いってらっしゃい!", badge: "0" };
      try {
        await messaging.send({ token, data: { ...data, url: APP_URL } });
        sent++;
      } catch (err) {
        const code = err && err.code;
        if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
          deadRefs.push(...dv.refs); // 使えなくなった端末の登録は消す
        } else {
          console.error("送れませんでした:", code || err);
        }
      }
    } catch (err) {
      console.error("エラー:", err);
    }
  }
  await Promise.all(deadRefs.map(r => r.delete()));
  console.log(`送った通知: ${sent}件 / 消した古い登録: ${deadRefs.length}件`);
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
