javascript
const axios = require('axios');
const express = require('express');
const app = express();

// --- CONFIGURATION ---
const BOT_TOKEN = '8699953525:AAF8g1Z-DSJwx9zm6McNST_6ITrYv0gWpww'; // Paste your token here
const ADMIN_CHAT_ID = '8699953525'; // Paste your numeric ID here
const PORT = process.env.PORT || 3000;

// In-memory storage for pending requests
let submissions = {}; 

// --- TELEGRAM SETUP ---
const botUrl = https://api.telegram.org/bot${8699953525:AAF8g1Z-DSJwx9zm6McNST_6ITrYv0gWpww};

// Helper: Send message to Admin (You)
async function sendToAdmin(text, replyMarkup = null) {
    try {
        await axios.post(${botUrl}/sendMessage, {
            chat_id: ADMIN_CHAT_ID,
            text: text,
            parse_mode: 'HTML',
            reply_markup: replyMarkup
        });
    } catch (err) {
        console.error("Error sending to admin:", err.response ? err.response.data : err.message);
    }
}

// Helper: Send message to User
async function sendToUser(chatIdOrUsername, text) {
    try {
        await axios.post(${botUrl}/sendMessage, {
            chat_id: chatIdOrUsername,
            text: text
        });
    } catch (err) {
        console.log(Could not reach user ${chatIdOrUsername}:, err.response ? err.response.data : err.message);
    }
}

// --- WEBHOOK ENDPOINT (Your Website calls this) ---
app.post('/webhook/kyc-submit', async (req, res) => {
    const { name, email, username, photos, telegramChatId } = req.body;

    if (!name || !photos) {
        return res.status(400).json({ error: "Missing data" });
    }

    const submissionId = Date.now().toString();
    
    // Store the data
    submissions[submissionId] = { name, email, username, photos, telegramChatId };

    // Create Inline Keyboard for Admin
    const keyboard = {
        inline_keyboard: [
            [{ text: "✅ Approve", callback_data: approve_${submissionId} }],
            [{ text: "❌ Reject", callback_data: reject_${submissionId} }]
        ]
    };

    const message = 🆕 <b>New Request</b>\n\n +
                    👤 Name: ${name}\n +
                    📧 Email: ${email}\n +
                    🔗 Photos: ${photos.join('\n')}\n +
                    💬 TG ID: ${telegramChatId || 'N/A'};

    await sendToAdmin(message, keyboard);
    res.json({ success: true });
});

// --- CALLBACK HANDLER (When you click buttons) ---
app.post('/webhook/callback', async (req, res) => {
    const update = req.body;
    
    if (update.callback_query) {
        const query = update.callback_query;
        const action = query.data.split('')[0];
        const id = query.data.split('')[1];
        
        const data = submissions[id];
        if (data) {
            const status = action === 'approve' ? 'Approved' : 'Rejected';
            
            // Notify Admin
            await sendToAdmin(✅ ${data.name} has been ${status}.);

            // Notify User
            if (data.telegramChatId) {
                await sendToUser(data.telegramChatId, Hello ${data.name}, your request has been ${status}.);
            }

            // Clean up
            delete submissions[id];
        }
        res.json({ status: 'ok' });
    } else {

res.json({ status: 'ignored' });
    }
});

app.listen(PORT, () => console.log(Server running on port ${PORT}));
