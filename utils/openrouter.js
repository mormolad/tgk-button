const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const API_KEY = process.env.OPENROUTER_API_KEY;
const HEADERS = {
  Authorization: `Bearer ${API_KEY}`,
  'HTTP-Referer': 'https://openrouter.ai/', // Укажи домен, если есть
  'X-Title': 'Telegram Voice Bot',
};

// 1. Транскрибация (Whisper)
async function transcribeAudio(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('model', 'deepseek/deepseek-r1-0528');

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    form,
    {
      headers: {
        ...form.getHeaders(),
        ...HEADERS,
      },
    }
  );
  console.log(response.data.text);
  return response.data.text;
}

// 2. Запрос к LLM
async function askLLM(prompt, text) {
  const messages = [
    {
      role: 'system',
      content: `Преобразуй текст на основе запроса: "${prompt}"`,
    },
    { role: 'user', content: text },
  ];

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: 'openai/gpt-4o', // или другая модель: см. https://openrouter.ai/docs#models
      messages,
    },
    {
      headers: {
        ...HEADERS,
        'Content-Type': 'application/json',
      },
    }
  );
  console.log(response.data);
  return (
    response.data.choices?.[0]?.message?.content ??
    '❗ Модель не вернула ответ.'
  );
}

module.exports = { transcribeAudio, askLLM };

// const axios = require('axios');
// const FormData = require('form-data');
// const fs = require('fs');

// const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// async function transcribeAudio(filePath) {
//   const form = new FormData();
//   form.append('file', fs.createReadStream(filePath));
//   form.append('model', 'gpt-4o-mini-transcribe'); // это модель Whisper, доступная у OpenAI

//   try {
//     const response = await axios.post(
//       'https://api.openai.com/v1/audio/transcriptions',
//       form,
//       {
//         headers: {
//           Authorization: `Bearer ${OPENAI_API_KEY}`,
//           ...form.getHeaders(),
//         },
//       }
//     );

//     console.log(response.data.text);
//     return response.data.text;
//   } catch (error) {
//     console.error('❌ Ошибка транскрибации:', error.response?.data || error);
//     throw error;
//   }
// }

// module.exports = { transcribeAudio };
