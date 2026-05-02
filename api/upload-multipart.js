// api/upload-multipart.js  — CommonJS (مەیلی فایلەکانی تری پڕۆژە)
// multipart parse بە busboy، ستریم ڕاستەوخۆ بۆ Telegram

module.exports.config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

const Busboy = require('busboy');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
  const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
  if (!BOT_TOKEN || !CHANNEL_ID) {
    return res.status(500).json({ error: 'Bot token or channel not configured' });
  }

  let fileType  = 'image';
  let fileName  = 'upload_' + Date.now();
  let mimeType  = 'application/octet-stream';
  const chunks  = [];

  try {
    const bb = Busboy({ headers: req.headers });

    // فیلدی "type" بخوێنەوە
    bb.on('field', (name, val) => {
      if (name === 'type') fileType = val.trim();
    });

    // فیلدی "file" بخوێنەوە — chunk بە chunk لە RAM دەکوێشین
    bb.on('file', (name, stream, info) => {
      if (info.filename) fileName = info.filename;
      if (info.mimeType) mimeType = info.mimeType;
      stream.on('data', d => chunks.push(d));
      stream.on('error', err => { /* نادیار */ });
    });

    bb.on('finish', async () => {
      try {
        const fileBuffer = Buffer.concat(chunks);
        if (!fileBuffer || fileBuffer.length === 0) {
          return res.status(400).json({ error: 'No file data received' });
        }

        // ── ناردن بۆ Telegram ──────────────────────────────────────────
        const { FormData, Blob, fetch } = globalThis;

        const tgForm = new FormData();
        tgForm.append('chat_id', CHANNEL_ID);
        const blob = new Blob([fileBuffer], { type: mimeType });

        let endpoint;
        if (fileType === 'video') {
          endpoint = 'sendVideo';
          tgForm.append('video', blob, fileName);
          tgForm.append('supports_streaming', 'true');
        } else {
          endpoint = 'sendDocument';
          tgForm.append('document', blob, fileName);
        }

        const tgRes  = await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/${endpoint}`,
          { method: 'POST', body: tgForm }
        );
        const tgData = await tgRes.json();

        if (!tgData.ok) {
          return res.status(500).json({ error: tgData.description || 'Telegram upload failed' });
        }

        const msg     = tgData.result;
        const fileId  = fileType === 'video' ? msg.video?.file_id : msg.document?.file_id;
        const thumbId = fileType === 'video'
          ? (msg.video?.thumbnail?.file_id || msg.video?.thumb?.file_id || '')
          : '';

        return res.status(200).json({
          success   : true,
          file_id   : fileId,
          thumb_id  : thumbId,
          type      : fileType,
          message_id: msg.message_id,
        });

      } catch (err) {
        console.error('Telegram send error:', err);
        return res.status(500).json({ error: err.message });
      }
    });

    bb.on('error', err => {
      console.error('Busboy error:', err);
      return res.status(500).json({ error: 'Parse error: ' + err.message });
    });

    req.pipe(bb);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
};
