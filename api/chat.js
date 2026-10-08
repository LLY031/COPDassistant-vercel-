const axios = require('axios');


module.exports = async function(req,res){


  if(req.method !== 'POST'){

    return res.status(405).json({
      error:'Method Not Allowed'
    });

  }



  const {
    message,
    conversation_id,
    user_id
  } = req.body;



  if(!message){

    return res.status(400).json({
      error:'消息不能为空'
    });

  }



  try{

console.log(
  "BOT_ID:",
  process.env.COZE_BOT_ID
);

console.log(
  "TOKEN:",
  process.env.COZE_API_TOKEN ? "EXISTS" : "MISSING"
);

    const response = await axios.post(

      'https://api.coze.cn/v3/chat',

      {

        bot_id:
        process.env.COZE_BOT_ID,


        user_id:
        user_id || 'web_user',


        stream:false,


        additional_messages:[

          {

            role:'user',

            content:message,

            content_type:'text'

          }

        ],


        ...(conversation_id
        ?
        {
          conversation_id
        }
        :
        {})

      },


      {

        headers:{


          Authorization:
          `Bearer ${process.env.COZE_API_TOKEN}`,


          'Content-Type':
          'application/json'


        },


        timeout:15000

      }


    );



    const data = response.data;

console.log(
  "FULL RESPONSE:",
  JSON.stringify(data,null,2)
);

if(!data || !data.data){

  return res.status(500).json({

    error:"Coze返回格式错误",

    detail:data

  });

}

console.log(
  "DATA:",
  JSON.stringify(data.data)
);


const chatId =
data.data?.id ||
data.data?.chat_id;


if(!chatId){

  return res.status(500).json({

    error:"没有获取到chat_id",

    detail:data

  });

}


const newConversationId =
data.data?.conversation_id ||
conversation_id ||
'';


console.log(
"CHAT_ID:",
chatId
);


console.log(
"CONVERSATION_ID:",
newConversationId
);



await new Promise(
 r=>setTimeout(r,5000)
);


let answer='';



    for(let i=0;i<8;i++){


      const params = {

  chat_id: chatId

};


if(newConversationId){

  params.conversation_id = newConversationId;

}


const result =
await axios.get(

'https://api.coze.cn/v3/chat/message/list',

{



params:params,


          headers:{


            Authorization:
            `Bearer ${process.env.COZE_API_TOKEN}`


          },


          timeout:5000


        }

      );


console.log(
  "MESSAGE LIST RESPONSE:",
  JSON.stringify(result.data,null,2)
);


      const messages =
      result.data?.data?.messages || [];



      const ai =
messages.find(

  item =>
  item.role === 'assistant'

);



      if(ai){

        answer=ai.content;

        break;

      }



      await new Promise(
        r=>setTimeout(r,1000)
      );


    }



    return res.json({

      type:'answer',

      content:
      answer || 'AI没有生成回复',


      conversation_id:
      newConversationId

    });



  }


  catch(error){

 console.log(
 "ERROR:",
 error.stack
);


  return res.status(500).json({

    error:'Coze请求失败',

    detail:
    error.response?.data ||
    error.message

  });

}


};
