// api/comments.js — کۆمێنتەکان (native fetch, Node 24)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const DB_URL = process.env.FIREBASE_DB_URL || 'https://jack-9a034-default-rtdb.firebaseio.com';

  try {
    // ════ GET — وەرگرتنی کۆمێنتەکانی پۆستێک ═══════════════
    if (req.method === 'GET') {
      const postId = req.query.postId;
      if (!postId) return res.status(400).json({ error: 'postId required' });

      const fbRes  = await fetch(`${DB_URL}/comments/${postId}.json`);
      const fbData = await fbRes.json();

      if (!fbData) return res.status(200).json({ success: true, comments: [] });

      const comments = Object.entries(fbData)
        .map(([id, c]) => ({ id, ...c }))
        .sort((a, b) => a.timestamp - b.timestamp);

      return res.status(200).json({ success: true, comments });
    }

    // ════ POST — ناردنی کۆمێنتی نوێ ════════════════════════
    if (req.method === 'POST') {
      const { postId, text, userId, username } = req.body;

      if (!postId || !text) {
        return res.status(400).json({ error: 'postId and text required' });
      }

      const comment = {
        text     : text,
        userId   : userId   || 'anon',
        username : username || 'User',
        timestamp: Date.now(),
      };

      // زیادکردنی کۆمێنت
      const fbRes  = await fetch(`${DB_URL}/comments/${postId}.json`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(comment),
      });
      const fbData = await fbRes.json();

      // نوێکردنەوەی ژمارەی کۆمێنتەکان لە پۆستەکە
      const countRes = await fetch(`${DB_URL}/posts/${postId}/comments.json`);
      const count    = await countRes.json();
      await fetch(`${DB_URL}/posts/${postId}/comments.json`, {
        method : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify((count || 0) + 1),
      });

      return res.status(200).json({ success: true, id: fbData.name, comment });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Comments error:', err);
    return res.status(500).json({ error: err.message });
  }
};
