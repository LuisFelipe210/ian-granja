import { useEffect, useState } from "react";
import { contaDriveSalva, ouvirContaDrive } from "@/lib/google-drive";

/** Conta Google lembrada neste navegador (atualiza quando muda, inclusive em outra aba). */
export function useContaDrive(): string | null {
    const [conta, setConta] = useState<string | null>(() => contaDriveSalva());
    useEffect(() => ouvirContaDrive(setConta), []);
    return conta;
}
