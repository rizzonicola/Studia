// Sostituto minimo di react-router-dom per la prova di useAIProcessor (nessuna navigazione reale).
export const useNavigate = () => (to: string) => { ((window as any).__nav ??= []).push(to); };
