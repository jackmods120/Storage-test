// api/posts.js — Firebase RTDB (native fetch, Node 24)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const DB_URL = process.env.FIREBASE_DB_URL || 'https://jack-9a034-default-rtdb.firebaseio.com';

  try {
    if (req.method === 'GET') {
      const fbRes  = await fetch(`${DB_URL}/posts.json`);
      const fbData = await fbRes.json();

      if (!fbData) return res.status(200).json({ success: true, posts: [] });

      const posts = Object.entries(fbData)
        .map(([id, post]) => ({ id, ...post }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);

      return res.status(200).json({ success: true, posts });
    }

    if (req.method === 'POST') {
      const { text, fileId, thumbId, mediaType, userId, username, userAvatar } = req.body;

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

      return res.status(200).json({ success: true, id: fbData.name, post });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Posts error:', err);
    return res.status(500).json({ error: err.message });
  }
};
