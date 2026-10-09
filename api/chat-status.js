const axios = require('axios');

module.exports = async function (req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method Not Allowed'
    });
  }

  const { chat_id, conversation_id } = req.body || {};

  if (!chat_id || !conversation_id) {
    return res.status(400).json({
      error: '缺少 chat_id 或 conversation_id'
    });
  }

  const token = process.env.COZE_API_TOKEN;

  if (!token) {
    return res.status(500).json({
      error: '缺少 COZE_API_TOKEN'
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
    const response = await client.get('/v3/chat/retrieve', {
      params: {
        conversation_id,
        chat_id
      }
    });

    const result = response.data;
    const task = result?.data;

    if (result?.code !== 0 || !task) {
      return res.status(502).json({
        error: '查询 Coze 任务失败',
        detail: result?.msg || '无有效任务状态'
      });
    }

    const status = task.status;

    // 任务尚未完成：立即返回，让前端稍后再次查询
    if (status === 'created' || status === 'in_progress') {
      return res.status(200).json({
        status,
        chat_id,
        conversation_id
      });
    }

    if (status === 'requires_action') {
      console.error(
        'COZE REQUIRES ACTION:',
        JSON.stringify(task.required_action || null)
      );

      return res.status(200).json({
        status: 'requires_action',
        message: 'Coze任务需要进一步处理工具调用'
      });
    }

    if (status === 'failed' || status === 'canceled') {
      return res.status(200).json({
        status,
        message: 'Coze任务未能完成',
        detail: task.last_error || null
      });
    }

  if (
  status !== 'completed' &&
  status !== 'success'
) {
  return res.status(200).json({
    status,
    message:'Coze返回了未预期的任务状态'
  });
}

await new Promise(resolve => setTimeout(resolve, 3000));


    // 任务完成后，获取消息列表
    const messageResponse = await client.get(
      '/v3/chat/message/list',
      {
        params: {
          conversation_id,
          chat_id
        }
      }
    );

    const messageResult = messageResponse.data;
    const rawData = messageResult?.data;

console.log(
  "COZE RAW MESSAGE:",
  JSON.stringify(messageResult, null, 2)
);


    if (messageResult?.code !== 0) {
      return res.status(502).json({
        error: '获取 Coze 回答失败',
        detail: messageResult?.msg || '消息列表请求失败'
      });
    }

const messages =
  Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.messages)
      ? rawData.messages
      : Array.isArray(rawData?.items)
        ? rawData.items
        : [];

console.log(
  "COZE MESSAGES:",
  JSON.stringify(messages, null, 2)
);


const answerMessages = messages.filter(item => {

  if (
    item.role !== 'assistant' ||
    item.type !== 'answer'
  ) {
    return false;
  }


  if (typeof item.content === 'string') {

    return item.content.trim().length > 0;

  }


  if (
    item.content &&
    typeof item.content === 'object'
  ) {

    return true;

  }


  return false;

});
console.log(
 "ANSWER CANDIDATES:",
 answerMessages.map(item=>({
   created_at:item.created_at,
   bot_id:item.bot_id,
   content:item.content
 }))
);
    const answer =
  answerMessages.length > 0
    ? answerMessages.sort(
        (a,b)=>
          Number(b.created_at || 0)
          -
          Number(a.created_at || 0)
      )[0]
    : null;
console.log(
 "ANSWER SELECTED:",
 JSON.stringify(answer,null,2)
);


if (!answer) {

  console.error(
    'COZE ANSWER NOT FOUND:',
    JSON.stringify(
      messages.map(item => ({
        role:item.role,
        type:item.type
      }))
    )
  );


  return res.status(200).json({
    status:'completed',
    content:'',
    message:'任务完成但没有找到回答'
  });
}



let finalContent='';

if(typeof answer.content === 'string'){

  finalContent = answer.content;

}else if(answer.content?.text){

  finalContent = answer.content.text;

}else if(answer.content?.content){

  finalContent = answer.content.content;

}else if(Array.isArray(answer.content)){

  finalContent = answer.content
    .map(item=>item.text || item.content || '')
    .join('');

}else{

  finalContent = JSON.stringify(answer.content);

}

return res.status(200).json({

  status:'completed',

  type:'answer',

  content:finalContent,

  conversation_id

});
  } catch (error) {
    console.error(
      'COZE STATUS ERROR:',
      error.response?.data || error.message
    );

    return res.status(502).json({
      error: '查询 Coze 回答失败',
      detail: error.response?.data?.msg || error.message
    });
  }
};
