// api/like.js — Like/Unlike (native fetch, Node 24)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const DB_URL = process.env.FIREBASE_DB_URL || 'https://jack-9a034-default-rtdb.firebaseio.com';

  try {
    const { postId, userId, action } = req.body;
    if (!postId || !userId) return res.status(400).json({ error: 'postId and userId required' });

    const likeRef  = `${DB_URL}/likes/${postId}/${userId}.json`;
    const likesRef = `${DB_URL}/posts/${postId}/likes.json`;

    const currentRes = await fetch(likesRef);
    const current    = await currentRes.json();

    if (action === 'like') {
      await fetch(likeRef, {
        method : 'PUT',
        body   : JSON.stringify(true),
        headers: { 'Content-Type': 'application/json' },
      });
      const newCount = (current || 0) + 1;
      await fetch(likesRef, {
        method : 'PUT',
        body   : JSON.stringify(newCount),
        headers: { 'Content-Type': 'application/json' },
      });
      return res.status(200).json({ success: true, likes: newCount, liked: true });
    } else {
      await fetch(likeRef, { method: 'DELETE' });
      const newCount = Math.max((current || 1) - 1, 0);
      await fetch(likesRef, {
        method : 'PUT',
        body   : JSON.stringify(newCount),
        headers: { 'Content-Type': 'application/json' },
      });
      return res.status(200).json({ success: true, likes: newCount, liked: false });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
