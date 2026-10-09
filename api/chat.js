const axios = require('axios');

module.exports = async function (req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method Not Allowed'
    });
  }

  const { message, conversation_id, user_id } = req.body || {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      error: '消息不能为空'
    });
  }

  const botId = process.env.COZE_BOT_ID;
  const token = process.env.COZE_API_TOKEN;

  if (!botId || !token) {
    return res.status(500).json({
      error: '环境变量缺失'
    });
  }

  const client = axios.create({
    baseURL: 'https://api.coze.cn',
    timeout: 30000,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  try {
    const response = await client.post('/v3/chat', {
      bot_id: botId,
      user_id: user_id || 'web_user',
      stream: false,
      additional_messages: [
        {
          role: 'user',
          content: message.trim(),
          content_type: 'text'
        }
      ],
      ...(conversation_id ? { conversation_id } : {})
    });

    const result = response.data;
    const chat = result?.data;

    if (result?.code !== 0 || !chat) {
      console.error('COZE CREATE ERROR:', JSON.stringify(result));

      return res.status(502).json({
        error: 'Coze创建任务失败',
        detail: result?.msg || 'Coze未返回有效任务'
      });
    }

    const chatId =
  chat.id ||
  chat.chat_id ||
  result?.chat_id;
    const newConversationId =
  chat.conversation_id ||
  result?.conversation_id ||
  conversation_id;

    if (!chatId || !newConversationId) {
      return res.status(502).json({
        error: 'Coze没有返回必要的任务标识'
      });
    }

    // 立即返回任务标识，不在这里等待最终回答
    return res.status(200).json({
      status: 'created',
      chat_id: chatId,
      conversation_id: newConversationId
    });
  } catch (error) {
    console.error(
      'COZE CREATE ERROR:',
      error.response?.data || error.message
    );

    return res.status(502).json({
      error: 'Coze请求失败',
      detail: error.response?.data?.msg || error.message
    });
  }
};
