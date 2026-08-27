// ═══════════════════════════════════════════════════
// FUNÇÃO SERVERLESS AGENDADA — roda sozinha todo dia às 23:59 (horário de
// São Paulo) e apaga da tabela jogos_agendados os jogos daquele dia (e de
// qualquer data anterior que tenha sobrado). Essa tabela é só a lista de
// "Jogos Agendados" do Dashboard (o organizador monta ela todo dia via
// "Novo Sinal de Entrada") — não é histórico de nada, então não tem
// motivo pra ficar acumulando linha por dia, ano após ano.
//
// Configurado em netlify.toml: schedule = "59 2 * * *" (UTC) = 23:59 em
// São Paulo (Brasil não tem mais horário de verão desde 2019, então essa
// conta fixa de -3h não muda ao longo do ano).
//
// Variáveis de ambiente necessárias (já usadas pelas outras functions):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
// ═══════════════════════════════════════════════════

function hojeSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

export const handler = async function () {
  const supaUrl = process.env.SUPABASE_URL;
  const supaServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supaUrl || !supaServiceKey) {
    console.log('ERRO: faltam variáveis de ambiente (SUPABASE_URL / SUPABASE_SERVICE_KEY)');
    return { statusCode: 500, body: 'Faltam variáveis de ambiente' };
  }

  const hoje = hojeSaoPaulo();
  const url = `${supaUrl.replace(/\/$/, '')}/rest/v1/jogos_agendados?data=lte.${hoje}`;
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        apikey: supaServiceKey,
        Authorization: `Bearer ${supaServiceKey}`,
        Prefer: 'return=representation',
      },
    });
    const apagados = res.ok ? await res.json() : [];
    console.log('Limpeza de jogos_agendados:', { httpStatus: res.status, hoje, qtdApagados: Array.isArray(apagados) ? apagados.length : 0 });
    return { statusCode: 200, body: JSON.stringify({ ok: res.ok, qtdApagados: Array.isArray(apagados) ? apagados.length : 0 }) };
  } catch (e) {
    console.log('Erro ao limpar jogos_agendados:', e.message);
    return { statusCode: 500, body: e.message };
  }
};
