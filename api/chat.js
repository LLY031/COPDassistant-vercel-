
const axios = require('axios');

module.exports = async function (req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method Not Allowed'
    });
  }

  const {
    message,
    conversation_id,
    user_id
  } = req.body || {};

  if (
    typeof message !== 'string' ||
    !message.trim()
  ) {
    return res.status(400).json({
      error: '消息不能为空'
    });
  }

  const botId = process.env.COZE_BOT_ID;
  const token = process.env.COZE_API_TOKEN;

  if (!botId || !token) {
    return res.status(500).json({
      error: '环境变量缺失',
      detail: '请检查 COZE_BOT_ID 和 COZE_API_TOKEN'
    });
  }

  const client = axios.create({
    baseURL: 'https://api.coze.cn',
    timeout: 5000,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  try {
    // 1. 创建对话任务
    const response = await client.post('/v3/chat', {
      bot_id: botId,
      user_id: user_id || 'web_user',
      stream: false,
      additional_messages: [
        {
          role: 'user',
          content: message,
          content_type: 'text'
        }
      ],
      ...(conversation_id ? { conversation_id } : {})
    });

    const data = response.data;
    const chatData = data?.data;

    console.log('COZE CHAT RESPONSE:', JSON.stringify(data));

    if (data?.code !== 0 || !chatData) {
      return res.status(502).json({
        error: 'Coze创建对话失败',
        detail: data
      });
    }

    const chatId = chatData.id || chatData.chat_id;
    const newConversationId =
      chatData.conversation_id || conversation_id || '';

    if (!chatId || !newConversationId) {
      return res.status(502).json({
        error: 'Coze没有返回必要的对话标识',
        detail: data
      });
    }

    // 2. 在有限时间内查询消息
    let answer = '';

    const deadline = Date.now() + 18000;

    while (Date.now() < deadline) {
      const result = await client.get(
        '/v3/chat/message/list',
        {
          params: {
            conversation_id: newConversationId,
            chat_id: chatId
          },
          timeout: Math.min(
            4000,
            Math.max(1000, deadline - Date.now())
          )
        }
      );

      const resultData = result.data;
      const rawData = resultData?.data;

      const messages = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.messages)
          ? rawData.messages
          : [];

      console.log(
        'COZE MESSAGE LIST:',
        JSON.stringify(resultData)
      );

      const ai = messages.find(item =>
        item.type === 'answer' &&
        typeof item.content === 'string' &&
        item.content.trim() !== ''
      );

      if (ai) {
        answer = ai.content;
        break;
      }

      // 留一点时间让 Coze 继续生成
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!answer) {
      return res.status(504).json({
        error: '暂时没有获取到 AI 回复',
        detail: '请检查 Vercel 日志中的 COZE MESSAGE LIST，确认返回的消息类型和内容。',
        conversation_id: newConversationId
      });
    }

    return res.status(200).json({
      type: 'answer',
      content: answer,
      conversation_id: newConversationId
    });

  } catch (error) {
    console.error(
      'COZE ERROR:',
      error.response?.data || error.message
    );

    return res.status(500).json({
      error: 'Coze请求失败',
      detail: error.response?.data || error.message
    });
  }
};
