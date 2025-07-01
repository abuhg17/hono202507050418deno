// app.ts
import { Hono } from "https://deno.land/x/hono@v3.11.5/mod.ts";

// YouTube API key
const youtubeApiKey = "AIzaSyAUD7ipwX-VAIIgbtw4V6sHKOTfyWoPdMo";

// Firestore REST API 設定
const FIREBASE_PROJECT_ID = "myvue3-e45b9";
const FIREBASE_API_KEY = "AIzaSyBperuUWtP36lO_cRyGYSxuiTkhpy54F_Q";
const FIREBASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/myvue3food?key=${FIREBASE_API_KEY}`;

const app = new Hono();
const api = new Hono();

// 測試路由
app.get("/", (ctx) => ctx.text("Hello from Hono + Deno"));

// Hello API
api.get("/hello", (ctx) =>
  ctx.json({
    message: "Hello World.",
    message2: "こんにちは、世界。",
    message3: "世界，你好!",
  })
);

// Firestore via REST API
api.get("/firebasefood", async (ctx) => {
  try {
    const res = await fetch(FIREBASE_URL);
    if (!res.ok) return ctx.json({ error: "Firestore fetch failed" }, 500);

    const data = await res.json();
    const documents = (data.documents || []).map((doc: any) => {
      const id = doc.name.split("/").pop();
      const fields = doc.fields || {};
      const parsed: Record<string, any> = {};
      for (const key in fields) parsed[key] = Object.values(fields[key])[0];
      return { id, ...parsed };
    });

    return ctx.json({ myvue3food: documents });
  } catch (err) {
    return ctx.json({ error: "Firestore error", message: err.message }, 500);
  }
});

// YouTube 頻道資訊
api.get("/youtube/channel/:channelIds", async (ctx) => {
  const channelIds = ctx.req.param("channelIds")?.split(",").map((v) => v.trim()).filter(Boolean);
  if (!channelIds || channelIds.length === 0 || channelIds.length > 50)
    return ctx.json({ error: "頻道 ID 數量需介於 1 到 50 之間" }, 400);

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIds.join(",")}&key=${youtubeApiKey}`
    );
    const data = await res.json();
    if (!data.items || data.items.length === 0)
      return ctx.json({ error: "找不到任何頻道資料" }, 404);

    return ctx.json({ count: data.items.length, items: data.items });
  } catch (err) {
    return ctx.json({ error: "YouTube 錯誤", message: err.message }, 500);
  }
});

// YouTube 影片資訊
api.get("/youtube/videos/:videoIds", async (ctx) => {
  const videoIds = ctx.req.param("videoIds")?.split(",").map((v) => v.trim()).filter(Boolean);
  if (!videoIds || videoIds.length === 0 || videoIds.length > 50)
    return ctx.json({ error: "影片 ID 數量需介於 1 到 50 之間" }, 400);

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds.join(",")}&key=${youtubeApiKey}`
    );
    const data = await res.json();
    if (!data.items || data.items.length === 0)
      return ctx.json({ error: "找不到任何影片資料" }, 404);

    return ctx.json({ count: data.items.length, items: data.items });
  } catch (err) {
    return ctx.json({ error: "YouTube 錯誤", message: err.message }, 500);
  }
});

// 倒數計時
api.get("/countdown/:slug", (ctx) => {
  const slug = ctx.req.param("slug");
  if (!slug || slug.length < 12)
    return ctx.json({ error: "Invalid slug. Format should be: YYYYMMDDHHMM" }, 400);

  const slugISO = `${slug.slice(0, 4)}-${slug.slice(4, 6)}-${slug.slice(6, 8)}T${slug.slice(
    8, 10
  )}:${slug.slice(10, 12)}:00+08:00`;

  const now = new Date();
  const next = new Date(slugISO);
  const diffMs = next.getTime() - now.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  const diffday = Math.floor(diffSec / 86400);
  const diffhour = Math.floor((diffSec % 86400) / 3600);
  const diffminute = Math.floor((diffSec % 3600) / 60);
  const diffsecond = diffSec % 60;

  return ctx.json({ slug, now: now.toISOString(), slugISO, next: next.toISOString(), diffMs, diffday, diffhour, diffminute, diffsecond });
});

// Bilibili 詳細資料
api.get("/bilibili/:bvid", async (ctx) => {
  const bvid = ctx.req.param("bvid");
  if (!bvid) return ctx.json({ error: "請提供 bvid 參數" }, 400);

  try {
    const res = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
    const data = await res.json();
    const { pic, title, owner, stat, pages, ...rest } = data.data;
    const simple = Object.fromEntries(
      Object.entries(rest).filter(([_, v]) => typeof v !== "object")
    );

    return ctx.json({ pic, title, owner, stat, data: simple, pages });
  } catch (err) {
    return ctx.json({ error: "Bilibili 錯誤", message: err.message }, 500);
  }
});

// Bilibili 圖片代理
api.get("/bilibili/proxyimg", async (ctx) => {
  const url = ctx.req.query("url");
  if (!url) return ctx.json({ error: "請提供 url 參數" }, 400);

  try {
    const res = await fetch(url, {
      headers: { Referer: "https://www.bilibili.com/" },
    });

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const data = await res.arrayBuffer();

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    return ctx.json({ error: "圖片代理失敗", message: err.message }, 500);
  }
});

// 掛載 /api 子路由
app.route("/api", api);

// ✅ 提供給 Deno Deploy / main.ts 匯入
export default app;
