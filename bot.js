const axios = require('axios');
const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const app = express();

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  next();
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
let submissions = {};
const botUrl = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendToAdmin(text, replyMarkup = null) {
  await axios.post(`${botUrl}/sendMessage`, {
    chat_id: ADMIN_CHAT_ID,
    text: text,
    parse_mode: 'HTML',
    reply_markup: replyMarkup
  });
}

// Send photo buffer to Telegram
async function sendPhotoToAdmin(buffer, filename, caption = '') {
  const form = new FormData();
  form.append('chat_id', ADMIN_CHAT_ID);
  form.append('photo', buffer, { filename: filename });
  if (caption) form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  
  await axios.post(`${botUrl}/sendPhoto`, form, {
    headers: form.getHeaders()
  });
}

app.get('/', (req, res) => res.send('KYC Bot is running ✅ - Ready to receive photos'));

app.post('/webhook/kyc-submit', upload.array('photos', 5), async (req, res) => {
  try {
    const { name, email, username } = req.body;
    const files = req.files;

    if (!name || !files || files.length === 0) {
      return res.status(400).json({ error: "Missing data" });
    }

    const submissionId = Date.now().toString();
    submissions[submissionId] = { name, email, username };

    const keyboard = {
      inline_keyboard: [
        [{ text: "✅ Approve", callback_data: `approve_${submissionId}` }],
        [{ text: "❌ Reject", callback_data: `reject_${submissionId}` }]
      ]
    };

    // 1. Tuma info kwanza
    const infoMessage = `🆕 <b>New KYC Request</b>\n\n` +
                        `👤 Name: ${name}\n` +
                        `📧 Email: ${email}\n` +
                        `🔗 TG: ${username || 'N/A'}\n` +
                        `📸 Photos: ${files.length}\n` +
                        `🆔 ID: ${submissionId}`;

    await sendToAdmin(infoMessage);

    // 2. Tuma picha zote kwa Admin
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const caption = i === 0 ? `Photos for ${name} (ID: ${submissionId})` : '';
      await sendPhotoToAdmin(file.buffer, file.originalname, caption);
    }

    // 3. Tuma buttons za Approve/Reject
    await sendToAdmin(`👆 Approve or Reject ${name}?`, keyboard);

    res.json({ success: true, id: submissionId });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to send to Telegram" });
  }
});

app.post('/webhook/callback', async (req, res) => {
  const update = req.body;
  if (update.callback_query) {
    const query = update.callback_query;
    const [action, id] = query.data.split('_');
    const data = submissions[id];
    
    if (data) {
      const status = action === 'approve' ? 'Approved' : 'Rejected';
      await sendToAdmin(`✅ <b>${data.name}</b> has been <b>${status}</b> (ID: ${id})`);
      delete submissions[id];
    }

    await axios.post(`${botUrl}/answerCallbackQuery`, {
      callback_query_id: query.id,
      text: `User ${action}d successfully!`
    });
  }
  res.json({ status: 'ok' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
