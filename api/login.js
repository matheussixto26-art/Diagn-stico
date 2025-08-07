const axios = require('axios');

async function fetchApiData(requestConfig) {
    try {
        const response = await axios(requestConfig);
        return response.data;
    } catch (error) {
        console.error(`Falha controlada em: ${requestConfig.url}. Status: ${error.response?.status}. Detalhes: ${error.message}`);
        return null;
    }
}

module.exports = async (req, res) => {
    try {
        console.log("--- INICIANDO /api/login ---");

        if (req.method !== 'POST') { return res.status(405).json({ error: 'Método não permitido.' }); }
        const { user, senha } = req.body;
        if (!user || !senha) { return res.status(400).json({ error: 'RA e Senha são obrigatórios.' }); }
        
        console.log("Fase 1: Autenticando com a SED...");
        const loginResponse = await axios.post("https://sedintegracoes.educacao.sp.gov.br/credenciais/api/LoginCompletoToken", { user, senha }, { headers: { "Ocp-Apim-Subscription-Key": "2b03c1db3884488795f79c37c069381a" } });
        if (!loginResponse.data || !loginResponse.data.token) { return res.status(401).json({ error: 'Credenciais inválidas ou resposta inesperada da SED.' }); }
        const tokenA = loginResponse.data.token;
        const userInfo = loginResponse.data.DadosUsuario;
        console.log("Fase 1: Token A obtido com sucesso.");

        console.log("Fase 2: Trocando Token A pelo Token B...");
        const exchangeResponse = await axios.post("https://edusp-api.ip.tv/registration/edusp/token", { token: tokenA }, { headers: { "Content-Type": "application/json", "x-api-realm": "edusp", "x-api-platform": "webclient" } });
        if (!exchangeResponse.data || !exchangeResponse.data.auth_token) { return res.status(500).json({ error: 'Falha ao obter o token secundário (Token B).' }); }
        const tokenB = exchangeResponse.data.auth_token;
        console.log("Fase 2: Token B obtido com sucesso.");
        
        console.log("Fase 3: Buscando dados em paralelo (Promise.all)...");
        const roomUserData = await fetchApiData({ method: 'get', url: 'https://edusp-api.ip.tv/room/user?list_all=true', headers: { "x-api-key": tokenB, "Referer": "https://saladofuturo.educacao.sp.gov.br/" } });

        let publicationTargetsQuery = '';
        if (roomUserData && roomUserData.rooms) {
            const targets = roomUserData.rooms.flatMap(room => [room.publication_target, room.name, ...(room.group_categories?.map(g => g.id) || [])]);
            publicationTargetsQuery = [...new Set(targets)].map(target => `publication_target[]=${encodeURIComponent(target)}`).join('&');
        }
        
        // ***** MUDANÇA PRINCIPAL AQUI *****
        // Buscamos tarefas pendentes, rascunhos E expiradas.
        const taskStatusQuery = 'answer_statuses=pending&answer_statuses=draft&answer_statuses=expired';
        const taskUrl = `https://edusp-api.ip.tv/tms/task/todo?${taskStatusQuery}&with_answer=true&limit=150&${publicationTargetsQuery}`;
        console.log("Buscando tarefas com a URL:", taskUrl);

        const [raNumber, raDigit, raUf] = user.match(/^(\d+)(\d)(\w+)$/).slice(1);
        const requests = [
             fetchApiData({ method: 'get', url: `https://sedintegracoes.educacao.sp.gov.br/apiboletim/api/Frequencia/GetFaltasBimestreAtual?codigoAluno=${userInfo.CD_USUARIO}`, headers: { "Authorization": `Bearer ${tokenA}`, "Ocp-Apim-Subscription-Key": "a84380a41b144e0fa3d86cbc25027fe6" } }),
             fetchApiData({ method: 'get', url: taskUrl, headers: { "x-api-key": tokenB, "Referer": "https://saladofuturo.educacao.sp.gov.br/" } }),
             fetchApiData({ method: 'get', url: `https://sedintegracoes.educacao.sp.gov.br/apisalaconquistas/api/salaConquista/conquistaAluno?CodigoAluno=${userInfo.CD_USUARIO}`, headers: { "Authorization": `Bearer ${tokenA}`, "Ocp-Apim-Subscription-Key": "008ada07395f4045bc6e795d63718090" } }),
             fetchApiData({ method: 'get', url: `https://sedintegracoes.educacao.sp.gov.br/cmspwebservice/api/sala-do-futuro-alunos/consulta-notificacao?userId=${userInfo.CD_USUARIO}`, headers: { "Authorization": `Bearer ${tokenA}`, "Ocp-Apim-Subscription-Key": "1a758fd2f6be41448079c9616a861b91" } }),
             fetchApiData({ method: 'get', url: `https://sedintegracoes.educacao.sp.gov.br/alunoapi/api/Aluno/ExibirAluno?inNumRA=${raNumber}&inDigitoRA=${raDigit}&inSiglaUFRA=${raUf}`, headers: { "Authorization": `Bearer ${tokenA}`, "Ocp-Apim-Subscription-Key": "b141f65a88354e078a9d4fdb1df29867" } })
        ];

        const [faltasData, tarefas, conquistas, notificacoes, dadosAluno] = await Promise.all(requests);
        console.log("Fase 3: Dados em paralelo concluídos.");
        
        userInfo.NAME = userInfo.NAME || dadosAluno?.aluno?.nome || 'Aluno';
        if(dadosAluno?.aluno) { userInfo.NOME_ESCOLA = dadosAluno.aluno.nmEscola; userInfo.SALA = `${dadosAluno.aluno.nrAnoSerie}º ${dadosAluno.aluno.nmTurma}`; }

        const dashboardData = { tokenA, tokenB, userInfo, faltas: faltasData?.data || [], tarefas: Array.isArray(tarefas) ? tarefas.map(t => ({...t, answer: t.answer || null})) : [], conquistas: conquistas?.data || [], notificacoes: Array.isArray(notificacoes) ? notificacoes : [] };
        console.log("--- FIM /api/login: Sucesso ---");
        res.status(200).json(dashboardData);
    } catch (error) {
        console.error("--- ERRO FATAL NA FUNÇÃO /api/login ---", error);
        res.status(500).json({ error: 'Ocorreu um erro fatal no servidor ao processar o login.', details: error.message });
    }
};
            
