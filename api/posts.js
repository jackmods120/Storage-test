// ═══════════════════════════════════════════════════════════
//  JACK POSTS — api/posts.js
//  پۆستەکان لە Firebase Realtime Database
//  بە REST API (بێ Admin SDK، بێ Service Account)
//
//  Firebase DB: jack-9a034-default-rtdb.firebaseio.com
// ═══════════════════════════════════════════════════════════

const DB_URL = process.env.FIREBASE_DB_URL || 'https://jack-9a034-default-rtdb.firebaseio.com';

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {

    // ════════════════════════════════════════
    //  GET — وەرگرتنی پۆستەکان
    // ════════════════════════════════════════
    if (req.method === 'GET') {
      const fbRes  = await fetch(`${DB_URL}/posts.json?orderBy="timestamp"&limitToLast=50`);
      const fbData = await fbRes.json();

      if (!fbData) {
        return res.status(200).json({ success: true, posts: [] });
      }

      // تبدیل من object إلى array وترتيب من الأحدث للأقدم
      const posts = Object.entries(fbData)
        .map(([id, post]) => ({ id, ...post }))
        .sort((a, b) => b.timestamp - a.timestamp);

      return res.status(200).json({ success: true, posts });
    }

    // ════════════════════════════════════════
    //  POST — دروستکردنی پۆستی نوێ
    // ════════════════════════════════════════
    if (req.method === 'POST') {
      const {
        text,
        fileId,     // file_id لە Telegram
        thumbId,    // thumbnail file_id (بۆ ڤیدیۆ)
        mediaType,  // "image" | "video" | "none"
        userId,
        username,
        userAvatar,
      } = req.body;

      if (!text && !fileId) {
        return res.status(400).json({ error: 'Post must have text or media' });
      }

      const post = {
        text      : text       || '',
        fileId    : fileId     || '',
        thumbId   : thumbId    || '',
        mediaType : mediaType  || 'none',
        userId    : userId     || 'anon',
        username  : username   || 'User',
        userAvatar: userAvatar || '',
        timestamp : Date.now(),
        likes     : 0,
        comments  : 0,
      };

      const fbRes  = await fetch(`${DB_URL}/posts.json`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(post),
      });
      const fbData = await fbRes.json();
      // Firebase returns { name: "-NxABC123" }

      return res.status(200).json({ success: true, id: fbData.name, post });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Posts error:', err);
    return res.status(500).json({ error: err.message });
  }
}
