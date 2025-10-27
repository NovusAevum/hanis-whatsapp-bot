const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const { ULTRAMSG_INSTANCE_ID, ULTRAMSG_TOKEN, MISTRAL_API_KEY } = process.env;

if (!ULTRAMSG_INSTANCE_ID || !ULTRAMSG_TOKEN || !MISTRAL_API_KEY) {
  console.error('Missing one or more required environment variables.');
  process.exit(1);
}

const HANIS_PERSONA_PROMPT = `
You are Hanis, a highly intelligent, articulate, and forward-thinking professional with expertise in AI, cybersecurity, digital marketing, and business development.
You're warm, respectful, yet direct. Based on the incoming message, generate a smart auto-reply:
- If it's a recruiter: reply with a short, confident summary and your LinkedIn.
- If it's a business opportunity: reply with enthusiasm and link to your portfolio.
- If unknown: politely probe their intention before sharing more.
Always be impressive and concise.
`;

function classifyIntent(msg) {
  const msgLower = msg.toLowerCase();
  if (msgLower.includes('job') || msgLower.includes('position') || msgLower.includes('role')) {
    return 'recruiter';
  } else if (msgLower.includes('project') || msgLower.includes('proposal') || msgLower.includes('collab')) {
    return 'business';
  } else {
    return 'unknown';
  }
}

async function generateResponse(userMessage) {
  const intent = classifyIntent(userMessage);
  try {
    const response = await axios.post('https://api.mistral.ai/v1/chat/completions', {
      model: 'mistral-tiny',
      messages: [
        { role: 'system', content: HANIS_PERSONA_PROMPT },
        { role: 'user', content: `Incoming message (intent: ${intent}): ${userMessage}` }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${MISTRAL_API_KEY}`
      }
    });
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating response from Mistral AI:', error);
    return 'Sorry, I am unable to respond at the moment.';
  }
}

app.post('/webhook', async (req, res) => {
  const { data } = req.body;
  if (!data || !data.from || !data.body) {
    return res.status(400).json({ status: 'invalid request' });
  }

  const sender = data.from;
  const message = data.body;

  const reply = await generateResponse(message);

  try {
    await axios.post(`https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/chat`, {
      token: ULTRAMSG_TOKEN,
      to: sender,
      body: reply
    });
    res.json({ status: 'success', reply });
  } catch (error) {
    console.error('Error sending message via UltraMsg:', error);
    res.status(500).json({ status: 'error sending message' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
