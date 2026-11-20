import { useSyncExternalStore } from "react";
import { assinarConfigEscritorio, configEscritorioAtual, type ConfigEscritorio } from "./config-escritorio.ts";

/** Dados do escritório (Configurações) sempre atualizados na tela. */
export function useConfigEscritorio(): ConfigEscritorio {
    return useSyncExternalStore(assinarConfigEscritorio, configEscritorioAtual, configEscritorioAtual);
}
