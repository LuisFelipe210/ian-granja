import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    MCP_TOOLS,
    RevisionalServerDb,
    handleMcpJsonRpc,
    normalizarDataAgenda,
    normalizarHoraAgenda,
    type RevisionalDbAdapter,
} from "../src/lib/mcp/revisional-mcp-core.ts";
import {
    dataHojeLocalISO,
    fichaSemCalculoParaPayload,
    sanitizarTarefaPayload,
    normalizarTarefaRow,
    somarDiasISO,
    type CalculoPayload,
    type CalculoSalvo,
    type Categoria,
    type Tarefa,
    type TarefaPayload,
} from "../src/lib/revisional-db.ts";

class AgendaMemoryDb implements RevisionalDbAdapter {
    calculos: CalculoSalvo[] = [];
    tarefas: Tarefa[] = [];
    private seq = 1;

    async listarCategorias(): Promise<Categoria[]> {
        return [];
    }
    async criarCategoria(nome: string): Promise<Categoria> {
        return { id: `cat-${this.seq++}`, nome, cor: "gold", ordem: 1, created_at: "" };
    }
    async listarCalculos(): Promise<CalculoSalvo[]> {
        return [...this.calculos];
    }
    async criarCalculo(payload: CalculoPayload): Promise<CalculoSalvo> {
        const now = new Date().toISOString();
        const salvo: CalculoSalvo = {
            ...payload,
            id: `calc-${this.seq++}`,
            created_by_email: "teste@exemplo.com",
            created_at: now,
            updated_at: now,
        };
        this.calculos.push(salvo);
        return salvo;
    }
    async atualizarCalculo(id: string, payload: Partial<CalculoPayload>): Promise<CalculoSalvo> {
        const idx = this.calculos.findIndex((c) => c.id === id);
        this.calculos[idx] = { ...this.calculos[idx], ...payload };
        return this.calculos[idx];
    }
    async listarTarefas(): Promise<Tarefa[]> {
        return [...this.tarefas].sort((a, b) => a.data.localeCompare(b.data));
    }
    async criarTarefa(payload: TarefaPayload): Promise<Tarefa> {
        const t = normalizarTarefaRow({
            ...sanitizarTarefaPayload(payload),
            id: `tar-${this.seq++}`,
            created_by_email: "teste@exemplo.com",
        });
        this.tarefas.push(t);
        return t;
    }
    async atualizarTarefa(id: string, patch: Partial<TarefaPayload>): Promise<Tarefa> {
        const idx = this.tarefas.findIndex((t) => t.id === id);
        if (idx < 0) throw new Error("não encontrada");
        this.tarefas[idx] = normalizarTarefaRow({ ...this.tarefas[idx], ...sanitizarTarefaPayload(patch) });
        return this.tarefas[idx];
    }
    async excluirTarefa(id: string): Promise<void> {
        this.tarefas = this.tarefas.filter((t) => t.id !== id);
    }
}

async function chamar(db: RevisionalDbAdapter, name: string, args: Record<string, unknown> = {}) {
    const res = await handleMcpJsonRpc(
        { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
        db,
    );
    const result = res?.result as { content: Array<{ text: string }>; isError: boolean };
    const text = result.content[0].text;
    return { isError: result.isError, text, json: result.isError ? null : JSON.parse(text) };
}

async function dbComCliente() {
    const db = new AgendaMemoryDb();
    const caso = await db.criarCalculo(
        fichaSemCalculoParaPayload({
            clienteNome: "Maria Aparecida Souza",
            processoGlobal: "0001234-56.2026.8.17.1130",
            banco: "BANCO PAN S.A.",
            documentoContrato: "",
            categoriaId: null,
            observacoes: "",
        }),
    );
    return { db, caso };
}

describe("Agenda no conector MCP", () => {
    it("expõe as três ferramentas da Agenda em tools/list", async () => {
        const nomes: string[] = MCP_TOOLS.map((t) => t.name);
        for (const n of ["consultar_agenda", "agendar_compromisso", "atualizar_compromisso"]) {
            assert.ok(nomes.includes(n), `${n} ausente`);
        }
    });

    it("agenda audiência vinculada ao cliente pelo CNJ e gera link do Google Agenda", async () => {
        const { db, caso } = await dbComCliente();
        const hoje = dataHojeLocalISO();
        const amanha = somarDiasISO(hoje, 1);
        const r = await chamar(db, "agendar_compromisso", {
            titulo: "Audiência de conciliação",
            tipo: "audiência",
            data: amanha.split("-").reverse().join("/"),
            hora: "9h30",
            processoGlobal: "00012345620268171130",
        });
        assert.equal(r.isError, false, r.text);
        assert.equal(r.json.compromisso.tipo, "audiencia");
        assert.equal(r.json.compromisso.data, amanha);
        assert.equal(r.json.compromisso.hora, "09:30");
        assert.equal(r.json.compromisso.cliente.calculoId, caso.id);
        assert.match(r.json.compromisso.linkGoogleAgenda, /^https:\/\/calendar\.google\.com\//);
        assert.equal(db.tarefas[0].calculo_id, caso.id);
    });

    it("consulta próximos dias, atrasados e filtra por cliente", async () => {
        const { db } = await dbComCliente();
        const hoje = dataHojeLocalISO();
        await chamar(db, "agendar_compromisso", { titulo: "Prazo contestação", tipo: "prazo", data: somarDiasISO(hoje, 3), clienteNome: "Maria" });
        await chamar(db, "agendar_compromisso", { titulo: "Ligar para cliente", data: somarDiasISO(hoje, -2) });
        await chamar(db, "agendar_compromisso", { titulo: "Reunião distante", tipo: "reuniao", data: somarDiasISO(hoje, 40) });

        const semana = await chamar(db, "consultar_agenda", {});
        assert.deepEqual(semana.json.compromissos.map((c: { titulo: string }) => c.titulo), ["Prazo contestação"]);
        assert.equal(semana.json.resumoGeral.pendentesAtrasados, 1);
        assert.equal(semana.json.resumoGeral.prazosNosProximos7Dias, 1);

        const atrasados = await chamar(db, "consultar_agenda", { apenasAtrasados: true });
        assert.deepEqual(atrasados.json.compromissos.map((c: { titulo: string }) => c.titulo), ["Ligar para cliente"]);
        assert.equal(atrasados.json.compromissos[0].atrasado, true);

        const daMaria = await chamar(db, "consultar_agenda", { clienteNome: "maria aparecida", proximosDias: 60 });
        assert.equal(daMaria.json.totalEncontrados, 1);

        const doisMeses = await chamar(db, "consultar_agenda", { proximosDias: 60 });
        assert.equal(doisMeses.json.totalEncontrados, 2);
    });

    it("conclui pelo título, remarca, acrescenta observação e exclui", async () => {
        const { db } = await dbComCliente();
        const hoje = dataHojeLocalISO();
        await chamar(db, "agendar_compromisso", { titulo: "Protocolar réplica", tipo: "prazo", data: hoje, observacoes: "Ver laudo" });

        const remarcado = await chamar(db, "atualizar_compromisso", {
            tituloBusca: "replica",
            novaData: somarDiasISO(hoje, 2),
            novaHora: "14:00",
            observacoesAdicionais: "Cliente pediu adiamento",
        });
        assert.equal(remarcado.isError, false, remarcado.text);
        assert.equal(remarcado.json.compromisso.hora, "14:00");
        assert.equal(remarcado.json.compromisso.observacoes, "Ver laudo\nCliente pediu adiamento");

        const concluido = await chamar(db, "atualizar_compromisso", { tituloBusca: "réplica", concluida: true });
        assert.equal(concluido.json.compromisso.concluida, true);
        const pendentes = await chamar(db, "consultar_agenda", { proximosDias: 30 });
        assert.equal(pendentes.json.totalEncontrados, 0);

        const id = db.tarefas[0].id;
        const excluido = await chamar(db, "atualizar_compromisso", { tarefaId: id, excluir: true });
        assert.equal(excluido.json.excluido, true);
        assert.equal(db.tarefas.length, 0);
    });

    it("rejeita data/hora inválidas, título ambíguo e cliente inexistente com mensagem clara", async () => {
        const { db } = await dbComCliente();
        const hoje = dataHojeLocalISO();
        const dataRuim = await chamar(db, "agendar_compromisso", { titulo: "X", data: "31/02/2027" });
        assert.equal(dataRuim.isError, true);
        assert.match(dataRuim.text, /data inválida/);

        const horaRuim = await chamar(db, "agendar_compromisso", { titulo: "X", data: hoje, hora: "25:00" });
        assert.match(horaRuim.text, /Hora inválida/);

        const semCaso = await chamar(db, "agendar_compromisso", { titulo: "X", data: hoje, processoGlobal: "9999999-99.2026.8.17.0001" });
        assert.match(semCaso.text, /Nenhum caso da carteira/);

        await chamar(db, "agendar_compromisso", { titulo: "Prazo recurso A", data: hoje });
        await chamar(db, "agendar_compromisso", { titulo: "Prazo recurso B", data: hoje });
        const ambiguo = await chamar(db, "atualizar_compromisso", { tituloBusca: "prazo recurso", concluida: true });
        assert.match(ambiguo.text, /Mais de um compromisso/);

        const nada = await chamar(db, "atualizar_compromisso", { tituloBusca: "recurso A" });
        assert.match(nada.text, /Nada para alterar/);
    });

    it("avisa quando o adaptador não tem Agenda", async () => {
        const db = new AgendaMemoryDb();
        const semAgenda: RevisionalDbAdapter = {
            listarCategorias: () => db.listarCategorias(),
            criarCategoria: (n) => db.criarCategoria(n),
            listarCalculos: () => db.listarCalculos(),
            criarCalculo: (p) => db.criarCalculo(p),
            atualizarCalculo: (i, p) => db.atualizarCalculo(i, p),
        };
        const r = await chamar(semAgenda, "consultar_agenda");
        assert.equal(r.isError, true);
        assert.match(r.text, /sem suporte a tarefas/);
    });

    it("RevisionalServerDb traduz tabela ausente em aviso de migração", async () => {
        const fetchFn = (async (input: string | URL | Request) => {
            const url = String(input);
            if (!url.includes("revisional_tarefas")) {
                return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
            }
            return new Response(
                JSON.stringify({
                    code: "PGRST205",
                    message: "Could not find the table 'public.revisional_tarefas' in the schema cache",
                }),
                { status: 404 },
            );
        }) as typeof fetch;
        const db = new RevisionalServerDb({ accessToken: "token-teste", supabaseUrl: "https://exemplo.supabase.co", fetchFn });
        const r = await chamar(db, "consultar_agenda");
        assert.equal(r.isError, true);
        assert.match(r.text, /20261118120000_revisional_tarefas\.sql/);
    });

    it("normaliza formatos de data e hora", () => {
        assert.equal(normalizarDataAgenda("5/3/2027"), "2027-03-05");
        assert.equal(normalizarDataAgenda("2027-03-05"), "2027-03-05");
        assert.equal(normalizarDataAgenda("amanhã"), somarDiasISO(dataHojeLocalISO(), 1));
        assert.throws(() => normalizarDataAgenda("2027-02-30"));
        assert.equal(normalizarHoraAgenda("14h"), "14:00");
        assert.equal(normalizarHoraAgenda("9:05"), "09:05");
        assert.throws(() => normalizarHoraAgenda("12:75"));
    });
});
