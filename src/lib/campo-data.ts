/**
 * Utilitários do seletor de data da calculadora (CampoData): máscara dd/mm/aaaa, conversão
 * ISO ⇄ BR sem fuso horário e montagem da grade do calendário.
 * O valor trafegado continua sendo ISO "AAAA-MM-DD" ("" = vazio), igual ao <input type="date">.
 */

export const MESES_CAMPO_DATA = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
];

export const DIAS_SEMANA_CAMPO_DATA = ["D", "S", "T", "Q", "Q", "S", "S"];
export const DIAS_SEMANA_LONGOS = [
    "domingo",
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado",
];

const pad = (n: number, t = 2) => String(n).padStart(t, "0");

export function diasNoMes(ano: number, mes1a12: number): number {
    return new Date(ano, mes1a12, 0).getDate();
}

/** Valida e monta "AAAA-MM-DD"; devolve "" se a data não existe (ex.: 31/02). */
export function montarIso(ano: number, mes: number, dia: number): string {
    if (!Number.isInteger(ano) || !Number.isInteger(mes) || !Number.isInteger(dia)) return "";
    if (ano < 1900 || ano > 2199 || mes < 1 || mes > 12 || dia < 1) return "";
    if (dia > diasNoMes(ano, mes)) return "";
    return `${pad(ano, 4)}-${pad(mes)}-${pad(dia)}`;
}

export function partesIso(iso: string): { ano: number; mes: number; dia: number } | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
    if (!m) return null;
    const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return montarIso(ano, mes, dia) ? { ano, mes, dia } : null;
}

/** "2024-03-05" → "05/03/2024" ("" se inválida). */
export function isoParaBr(iso: string): string {
    const p = partesIso(iso);
    return p ? `${pad(p.dia)}/${pad(p.mes)}/${pad(p.ano, 4)}` : "";
}

/** Aplica a máscara dd/mm/aaaa enquanto o usuário digita (só dígitos contam). */
export function mascararDataBr(texto: string): string {
    const d = texto.replace(/\D+/g, "").slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/**
 * Interpreta o que foi digitado ou colado: "05/03/2024", "5/3/2024", "05032024", "05.03.24",
 * "2024-03-05". Ano com 2 dígitos vira 20xx até o ano atual + 30, senão 19xx. "" se incompleto/inválido.
 */
export function interpretarDataDigitada(texto: string, anoReferencia = new Date().getFullYear()): string {
    const t = (texto ?? "").trim();
    if (!t) return "";
    const isoM = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
    if (isoM) return montarIso(Number(isoM[1]), Number(isoM[2]), Number(isoM[3]));

    const sep = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2}|\d{4})$/.exec(t);
    let dia: number;
    let mes: number;
    let anoTxt: string;
    if (sep) {
        [dia, mes, anoTxt] = [Number(sep[1]), Number(sep[2]), sep[3]];
    } else {
        const dig = t.replace(/\D+/g, "");
        if (dig.length !== 8 && dig.length !== 6) return "";
        [dia, mes, anoTxt] = [Number(dig.slice(0, 2)), Number(dig.slice(2, 4)), dig.slice(4)];
    }
    let ano = Number(anoTxt);
    if (anoTxt.length === 2) {
        const limite = (anoReferencia % 100) + 30;
        ano += ano <= limite ? 2000 : 1900;
    }
    return montarIso(ano, mes, dia);
}

export function hojeIsoLocal(agora = new Date()): string {
    return montarIso(agora.getFullYear(), agora.getMonth() + 1, agora.getDate());
}

/** Soma dias a uma data ISO (sem fuso). */
export function somarDiasIso(iso: string, dias: number): string {
    const p = partesIso(iso);
    if (!p) return "";
    const d = new Date(p.ano, p.mes - 1, p.dia + dias);
    return montarIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Soma meses mantendo o dia quando possível (31/01 + 1 mês → 29/02 em ano bissexto). */
export function somarMesesIso(iso: string, meses: number): string {
    const p = partesIso(iso);
    if (!p) return "";
    const total = p.ano * 12 + (p.mes - 1) + meses;
    const ano = Math.floor(total / 12);
    const mes = (total % 12) + 1;
    return montarIso(ano, mes, Math.min(p.dia, diasNoMes(ano, mes)));
}

export interface CelulaCalendario {
    iso: string;
    dia: number;
    noMes: boolean;
}

/** Grade de 6 semanas (42 dias, começando no domingo) do mês informado. */
export function gradeDoMes(ano: number, mes1a12: number): CelulaCalendario[] {
    const primeiro = new Date(ano, mes1a12 - 1, 1);
    const celulas: CelulaCalendario[] = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(ano, mes1a12 - 1, 1 - primeiro.getDay() + i);
        celulas.push({
            iso: montarIso(d.getFullYear(), d.getMonth() + 1, d.getDate()),
            dia: d.getDate(),
            noMes: d.getMonth() === mes1a12 - 1,
        });
    }
    return celulas;
}

/** A data está dentro de [min, max] (strings ISO; vazio = sem limite)? */
export function dentroDoIntervalo(iso: string, min?: string, max?: string): boolean {
    if (!iso) return false;
    if (min && iso < min) return false;
    if (max && iso > max) return false;
    return true;
}

/** "terça-feira, 5 de março de 2024" (leitor de tela). */
export function dataPorExtensoCurta(iso: string): string {
    const p = partesIso(iso);
    if (!p) return "";
    const semana = DIAS_SEMANA_LONGOS[new Date(p.ano, p.mes - 1, p.dia).getDay()];
    return `${semana}, ${p.dia} de ${MESES_CAMPO_DATA[p.mes - 1]} de ${p.ano}`;
}
