// ═══════════════════════════════════════════════════════════
//  JACK POSTS — api/upload.js
//  فایل (وێنە/ڤیدیۆ) دەنێرێتە کەناڵی Telegram تایبەت
//  هەمیشەیی، خۆڕایی، بێ سنووری Storage
// ═══════════════════════════════════════════════════════════

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID; // e.g. -1001234567890

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { file, type } = req.body;
    // file  = "data:image/jpeg;base64,/9j/..."  یان  "data:video/mp4;base64,..."
    // type  = "image"  یان  "video"

    if (!file) return res.status(400).json({ error: 'No file provided' });

    // ── ١. base64 → Buffer ──────────────────────────────────
    const mimeMatch = file.match(/^data:([^;]+);base64,/);
    const mimeType  = mimeMatch ? mimeMatch[1] : (type === 'video' ? 'video/mp4' : 'image/jpeg');
    const base64Data = file.replace(/^data:[^;]+;base64,/, '');
    const buffer    = Buffer.from(base64Data, 'base64');
    const ext       = mimeType.split('/')[1] || 'bin';
    const fileName  = `jack_${Date.now()}.${ext}`;

    // ── ٢. ناردن بۆ Telegram ────────────────────────────────
    const formData = new FormData();
    formData.append('chat_id', CHANNEL_ID);

    const blob = new Blob([buffer], { type: mimeType });

    let endpoint;
    if (type === 'video') {
      endpoint = 'sendVideo';
      formData.append('video', blob, fileName);
      formData.append('supports_streaming', 'true');
    } else {
      // وێنەکان بە sendDocument دەنێرێن تا کوالیتی بچووک نەبێت
      endpoint = 'sendDocument';
      formData.append('document', blob, fileName);
    }

    const tgRes  = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${endpoint}`, {
      method: 'POST',
      body: formData,
    });
    const tgData = await tgRes.json();

    if (!tgData.ok) {
      console.error('Telegram error:', tgData);
      return res.status(500).json({ error: tgData.description || 'Telegram upload failed' });
    }

    // ── ٣. وەرگرتنی file_id ────────────────────────────────
    const msg = tgData.result;
    let fileId, thumbFileId;

    if (type === 'video') {
      fileId      = msg.video?.file_id;
      thumbFileId = msg.video?.thumbnail?.file_id || msg.video?.thumb?.file_id || null;
    } else {
      fileId = msg.document?.file_id;
      // تامبنیل بۆ وێنەکان (ئەگەر لەناو sendPhoto بنێرێت)
      thumbFileId = msg.document?.thumbnail?.file_id || null;
    }

    return res.status(200).json({
      success   : true,
      file_id   : fileId,
      thumb_id  : thumbFileId,
      type      : type,
      message_id: msg.message_id,
    });

  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
}
