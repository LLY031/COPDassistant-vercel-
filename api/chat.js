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



    const data=response.data;



    const chatId=data.data.id;


    const newConversationId =
    data.data.conversation_id ||
    conversation_id;



    let answer='';



    for(let i=0;i<8;i++){


      const result =
      await axios.get(

        'https://api.coze.cn/v3/chat/message/list',


        {


          params:{


            conversation_id:
            newConversationId,


            chat_id:
            chatId


          },


          headers:{


            Authorization:
            `Bearer ${process.env.COZE_API_TOKEN}`


          },


          timeout:5000


        }

      );



      const messages =
      result.data?.data?.messages || [];



      const ai =
      messages.find(

        item =>
        item.role==='assistant'
        &&
        item.content

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


    console.log(error.response?.data || error.message);



    return res.status(500).json({

      error:'Coze请求失败'

    });


  }



};