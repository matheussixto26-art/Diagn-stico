// Em /api/submit-task.js
const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') { // A chamada do frontend ainda é POST
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    
    // Agora recebemos também o answerId
    const { taskId, tokenB, payload, answerId } = req.body;
    
    if (!taskId || !tokenB || !payload || !answerId) {
        return res.status(400).json({ error: 'Payload de submissão inválido. Faltam taskId, tokenB, payload ou answerId.' });
    }

    // A URL muda para incluir o ID da resposta (answerId)
    const submitUrl = `https://edusp-api.ip.tv/tms/task/${taskId}/answer/${answerId}`;
    
    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': tokenB,
        'x-api-realm': 'edusp',
        'x-api-platform': 'webclient',
        'origin': 'https://saladofuturo.educacao.sp.gov.br',
        'referer': 'https://saladofuturo.educacao.sp.gov.br/'
    };
    
    try {
        console.log(`Atualizando (PUT) a tarefa ${taskId} com a resposta ${answerId}...`);
        // **MUDANÇA CRÍTICA AQUI:** Usamos axios.put para atualizar o rascunho existente
        const submitResponse = await axios.put(submitUrl, payload, { headers });
        
        console.log(`Tarefa ${taskId} enviada com sucesso!`);
        res.status(200).json(submitResponse.data);

    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`Falha ao submeter a tarefa ${taskId}. Detalhes: ${errorDetails}`);
        res.status(error.response?.status || 500).json({ 
            error: `Falha ao submeter a tarefa.`, 
            details: error.response?.data || error.message
        });
    }
};
