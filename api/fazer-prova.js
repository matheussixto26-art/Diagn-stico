const axios = require('axios');

// Função auxiliar para chamar a API da Moonscripts
async function callMoonProvasAPI(payload) {
    const API_URL = "https://api.moonscripts.cloud/provas";
    try {
        console.log("Enviando para a API de Provas da Moonscripts:", payload.type);
        const response = await axios.post(API_URL, payload);
        console.log("Resposta recebida com sucesso de:", payload.type);
        return response.data;
    } catch (error) {
        console.error(`Erro ao chamar a API de Provas com o tipo [${payload.type}]`);
        throw error; // Lança o erro para ser apanhado pelo bloco catch principal
    }
}

module.exports = async (req, res) => {
    console.log("--- INICIANDO /api/fazer-prova via Moonscripts ---");
    try {
        if (req.method !== 'POST') { return res.status(405).json({ error: 'Método não permitido.' }); }
        
        const { taskId, tokenB, room, targetScoreRatio, duration } = req.body;
        if (!taskId || !tokenB) { return res.status(400).json({ error: 'Parâmetros taskId e tokenB são obrigatórios.' }); }

        // ETAPA 1: Carregar os dados da prova para obter as questões
        const proofData = await callMoonProvasAPI({
            type: "loadProof",
            taskId: taskId,
            key_frame: tokenB,
            room: room
        });
        
        // ***** PONTO CRÍTICO 1: A estrutura de 'proofData' é uma suposição.
        // Precisamos da RESPOSTA desta chamada para saber como extrair as questões.
        // Exemplo suposto: const questions = proofData.questions;
        // Por agora, vamos retornar um erro informativo.
        if (!proofData.questions || !Array.isArray(proofData.questions)) {
             return res.status(500).json({ 
                error: "Estrutura de resposta do 'loadProof' desconhecida.",
                message: "Preciso que me envies a RESPOSTA JSON da requisição 'loadProof' para continuar."
            });
        }
        const questions = proofData.questions;

        // ETAPA 2: Iniciar a tentativa da prova
        await callMoonProvasAPI({
            type: "startProva",
            taskId: taskId,
            key_frame: tokenB
        });

        // ETAPA 3: Obter a resposta de cada questão usando a IA
        let solvedAnswers = {};
        for (const question of questions) {
            // Monta a mensagem para a IA como vimos na tua captura
            const userMessage = `Questão: ${question.text}\n\nImagens: ${question.images.join('\n')}\n\nAlternativas:\n${question.alternatives.join('\n')}`;
            
            const iaResponse = await callMoonProvasAPI({
                type: "ia",
                userMessage: userMessage
            });

            // ***** PONTO CRÍTICO 2: A estrutura de 'iaResponse' é uma suposição.
            // Precisamos da RESPOSTA desta chamada para saber como extrair a resposta correta.
            // Exemplo suposto: solvedAnswers[question.id] = { answer: iaResponse.correct_answer_id };
        }

        // ETAPA 4: Submeter a prova com todas as respostas resolvidas
        // ***** PONTO CRÍTICO 3: O PAYLOAD desta chamada é desconhecido.
        // Precisamos que captures a última requisição feita ao clicar em "Entregar Prova".
        const submissionPayload = {
            type: "submitProof", // Suposição!
            taskId: taskId,
            key_frame: tokenB,
            answers: solvedAnswers,
            time: duration,
            scorePercent: targetScoreRatio * 100
        };

        const finalResponse = await callMoonProvasAPI(submissionPayload);

        res.status(200).json(finalResponse);

    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha no processo de fazer a prova.`, details: errorDetails });
    }
};
