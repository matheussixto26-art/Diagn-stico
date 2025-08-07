const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    
    // Esta função espera receber o payload completo para submissão
    const submitPayload = req.body;
    if (!submitPayload || !submitPayload.taskId || !submitPayload.token || !submitPayload.answers) {
        return res.status(400).json({ error: 'Payload de submissão inválido ou incompleto.' });
    }

    const API_URL = "https://api.moonscripts.cloud/edusp";

    try {
        const submitResponse = await axios.post(API_URL, submitPayload);
        
        // Devolve apenas a resposta da API de submissão
        res.status(200).json(submitResponse.data);

    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha ao submeter a tarefa. Detalhes: ${errorDetails}` });
    }
};
