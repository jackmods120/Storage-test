// api/upload-multipart.js
// ستریمی ڕاستەوخۆ بۆ Telegram — فایل لە RAM نانرێت

module.exports.config = {
  api: { bodyParser: false, responseLimit: false },
};

const https = require('https');
const http  = require('http');

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

  const contentType = req.headers['content-type'] || '';
  const bMatch = contentType.match(/boundary=([^\s;]+)/);
  if (!bMatch) return res.status(400).json({ error: 'No boundary' });
  const boundary = bMatch[1];

  // ── بخوێنە بۆ RAM — بەڵام بە chunk بچووک ────────────────
  const chunks = [];
  let totalSize = 0;
  const MAX = 350 * 1024 * 1024; // 350MB سنوور

  req.on('data', chunk => {
    totalSize += chunk.length;
    if (totalSize > MAX) {
      req.destroy();
      return res.status(413).json({ error: 'File too large (max 350MB)' });
    }
    chunks.push(chunk);
  });

  req.on('error', err => res.status(500).json({ error: err.message }));

  req.on('end', () => {
    try {
      const raw = Buffer.concat(chunks);
      chunks.length = 0; // بەیاری GC

      // ── Parse multipart ──────────────────────────────────
      const delim     = Buffer.from('\r\n--' + boundary);
      const firstLine = Buffer.from('--' + boundary + '\r\n');

      let fileBuffer = null;
      let fileName   = 'upload_' + Date.now();
      let mimeType   = 'application/octet-stream';
      let fileType   = 'image';

      let pos = indexOf(raw, firstLine, 0);
      if (pos === -1) return res.status(400).json({ error: 'Bad multipart' });
      pos += firstLine.length;

      while (pos < raw.length) {
        const headerEnd = indexOf(raw, Buffer.from('\r\n\r\n'), pos);
        if (headerEnd === -1) break;
        const header    = raw.slice(pos, headerEnd).toString('utf8');
        const bodyStart = headerEnd + 4;
        const bodyEnd   = indexOf(raw, delim, bodyStart);
        const body      = bodyEnd === -1 ? raw.slice(bodyStart) : raw.slice(bodyStart, bodyEnd);

        const nameM = header.match(/name="([^"]+)"/i);
        if (nameM) {
          if (nameM[1] === 'type') {
            fileType = body.toString('utf8').trim();
          } else if (nameM[1] === 'file') {
            const fnM = header.match(/filename="([^"]+)"/i);
            if (fnM) fileName = fnM[1];
            const ctM = header.match(/Content-Type:\s*([^\r\n]+)/i);
            if (ctM) mimeType = ctM[1].trim();
            fileBuffer = Buffer.from(body); // کۆپی دەکات
          }
        }
        if (bodyEnd === -1) break;
        pos = bodyEnd + delim.length;
        if (raw[pos] === 0x0d) pos += 2;
        if (raw[pos] === 0x2d && raw[pos+1] === 0x2d) break;
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: 'No file data' });
      }

      // ── ناردن بۆ Telegram بە Node https ─────────────────
      const tgBoundary = '----TGBoundary' + Date.now();
      const endpoint   = fileType === 'video' ? 'sendVideo' : 'sendDocument';
      const fieldName  = fileType === 'video' ? 'video'    : 'document';

      const headerPart = Buffer.from(
        '--' + tgBoundary + '\r\n' +
        'Content-Disposition: form-data; name="chat_id"\r\n\r\n' +
        CHANNEL_ID + '\r\n' +
        '--' + tgBoundary + '\r\n' +
        (fileType === 'video' ? '--' + tgBoundary + '\r\nContent-Disposition: form-data; name="supports_streaming"\r\n\r\ntrue\r\n' : '') +
        '--' + tgBoundary + '\r\n' +
        'Content-Disposition: form-data; name="' + fieldName + '"; filename="' + fileName + '"\r\n' +
        'Content-Type: ' + mimeType + '\r\n\r\n'
      );
      const footerPart = Buffer.from('\r\n--' + tgBoundary + '--\r\n');
      const totalLen   = headerPart.length + fileBuffer.length + footerPart.length;

      const tgOptions = {
        hostname: 'api.telegram.org',
        path    : '/bot' + BOT_TOKEN + '/' + endpoint,
        method  : 'POST',
        headers : {
          'Content-Type'  : 'multipart/form-data; boundary=' + tgBoundary,
          'Content-Length': totalLen,
        },
      };

      const tgReq = https.request(tgOptions, tgRes => {
        let body = '';
        tgRes.on('data', d => body += d);
        tgRes.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (!data.ok) {
              return res.status(500).json({ error: data.description || 'Telegram error' });
            }
            const msg     = data.result;
            const fileId  = fileType === 'video' ? msg.video?.file_id  : msg.document?.file_id;
            const thumbId = fileType === 'video'
              ? (msg.video?.thumbnail?.file_id || msg.video?.thumb?.file_id || '') : '';
            return res.status(200).json({
              success: true, file_id: fileId, thumb_id: thumbId,
              type: fileType, message_id: msg.message_id,
            });
          } catch(e) {
            return res.status(500).json({ error: 'Parse TG response: ' + e.message });
          }
        });
      });

      tgReq.on('error', e => res.status(500).json({ error: 'TG request: ' + e.message }));
      tgReq.write(headerPart);
      tgReq.write(fileBuffer);
      tgReq.write(footerPart);
      tgReq.end();

    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  });
};

function indexOf(buf, search, offset) {
  for (let i = offset||0; i <= buf.length - search.length; i++) {
    let ok = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i+j] !== search[j]) { ok=false; break; }
    }
    if (ok) return i;
  }
  return -1;
}
