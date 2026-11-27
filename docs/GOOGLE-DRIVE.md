# Google Drive no sistema revisional

O sistema interno (`/ferramentas/calculadora-revisional`) se conecta ao Google Drive para:

1. **Trazer o contrato do Drive**: botão **Google Drive** no card "Leitura automática com Claude". O PDF ou a foto escolhida entra como anexo, igual a um arquivo do computador.
2. **Salvar o laudo no Drive**: botão **Salvar no Drive** na barra do resultado. Gera o Laudo PDF e envia para a pasta do cliente que você escolher.

A conexão é feita pelo navegador, com o login Google de quem está usando. O sistema pede só a permissão `drive.file`: ele **enxerga apenas os arquivos que você escolher no seletor do Drive ou que ele mesmo criar**. Nunca lista nem lê o resto do seu Drive. O token de acesso fica só na memória da aba (expira em cerca de 1 hora) e não é gravado no navegador nem no banco; apenas o e-mail da conta Google selecionada e o ID/nome da última pasta usada ficam lembrados em `localStorage` para conveniência (e são apagados ao trocar de conta ou desconectar).

Enquanto as chaves abaixo não estiverem configuradas, os botões aparecem e só avisam que falta configurar.

---

## Configuração atual (feita em 18/11/2026)

- Projeto do Google Cloud: **Ian-granja** (`ian-granja`). Google Drive API e Google Picker API ativadas.
- App OAuth "Ian Granja": tipo **Externo**, status **Em produção**, só com o escopo `drive.file` (não confidencial, sem verificação). Página inicial `https://www.iangranja.adv.br`, política de privacidade `https://www.iangranja.adv.br/privacidade`, domínio autorizado `iangranja.adv.br`.
- ID do cliente OAuth: **Sistema revisional (site)**, com origens `https://www.iangranja.adv.br`, `https://iangranja.adv.br` e `http://localhost:8080`, `8081` e `8083`.
- Chave de API: **Seletor do Drive (site)**, restrita à Google Picker API e aos mesmos endereços (`/*`).
- Os valores estão no `.env.local`. **Falta cadastrar as três variáveis na Vercel** antes do deploy que levar o Drive para produção.

Se precisar refazer do zero, siga o passo a passo abaixo.

## Passo a passo no Google Cloud (uma vez só, uns 15 minutos)

Use a conta Google do escritório (de preferência a mesma do Drive onde ficam as pastas dos clientes).

### 1. Criar o projeto
1. Acesse <https://console.cloud.google.com/> e clique em **Selecionar projeto → Novo projeto**.
2. Nome sugerido: `Ian Granja Sistema`. Crie e selecione o projeto.
3. Na página inicial do projeto, anote o **Número do projeto** (só dígitos). Ele é o `VITE_GOOGLE_APP_ID`.

### 2. Ativar as APIs
Em **APIs e serviços → Biblioteca**, ative:
- **Google Drive API**
- **Google Picker API**

### 3. Tela de consentimento (OAuth)
Em **APIs e serviços → Tela de consentimento OAuth** (ou "Google Auth Platform"):
1. Tipo de usuário: **Interno**, se o escritório usa Google Workspace (só contas do domínio entram). Se for Gmail comum, use **Externo**.
2. Nome do app: `Ian Granja Advogados`. E-mail de suporte: o do escritório.
3. Escopos: adicione só `.../auth/drive.file`. É um escopo não sensível, então não precisa de verificação do Google.
4. Se escolheu **Externo**: em **Usuários de teste**, adicione os e-mails que vão usar o sistema (ou publique o app; com `drive.file` a publicação não exige revisão).

### 4. Criar o ID do cliente OAuth
Em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
- Tipo: **Aplicativo da Web**.
- **Origens JavaScript autorizadas** (sem barra no final):
  - `https://www.iangranja.adv.br`
  - `https://iangranja.adv.br`
  - `http://localhost:8080` (desenvolvimento; acrescente outras portas locais se usar, ex.: `http://localhost:8083`)
- Não precisa de URI de redirecionamento.
- Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`). Ele é o `VITE_GOOGLE_CLIENT_ID`.

### 5. Criar a chave de API (usada pelo seletor do Drive)
Em **Credenciais → Criar credenciais → Chave de API**, depois **Editar chave**:
- **Restrições de aplicativo**: *Referenciadores HTTP*, com `https://www.iangranja.adv.br/*`, `https://iangranja.adv.br/*` e `http://localhost:*/*`.
- **Restrições de API**: só **Google Picker API**.
- Copie a chave. Ela é o `VITE_GOOGLE_API_KEY`.

> Essas três chaves são públicas por natureza: vão para o navegador e ficam protegidas pelas restrições de origem acima. **Nenhuma senha ou segredo do Google entra no código.**

---

## Onde colocar as chaves

**Desenvolvimento** (arquivo `.env.local` ou `.env.development.local`, que já são ignorados pelo git):

```
VITE_GOOGLE_CLIENT_ID=1234567890-xxxxxxxx.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=AIzaSy...
VITE_GOOGLE_APP_ID=1234567890
```

**Produção (Vercel)**: *Project → Settings → Environment Variables*, com as mesmas três variáveis em **Production** (e **Preview**, se usar). Depois faça um novo deploy, porque as variáveis `VITE_` entram no build.

---

## Política de segurança (CSP)

O `vercel.json` define a política de segurança do site inteiro (`Content-Security-Policy` e cabeçalhos de proteção). Ela já libera exatamente o que o Google Drive precisa:

| Diretiva | Domínios do Google |
|---|---|
| `script-src` | `accounts.google.com` (login), `apis.google.com` (seletor) |
| `connect-src` | `www.googleapis.com`, `content.googleapis.com`, `accounts.google.com` |
| `frame-src` | `docs.google.com`, `drive.google.com`, `accounts.google.com` |

O cabeçalho `Cross-Origin-Opener-Policy: same-origin-allow-popups` é necessário para a janela de login do Google conseguir devolver o token.

Para testar a política localmente antes do deploy, rode a configuração **preview-csp** do `.claude/launch.json`. Ela gera o build e serve com os mesmos cabeçalhos de produção em `http://localhost:4180`, liberando só o Supabase local:

```
npx vite build --mode development --outDir dist-csp --emptyOutDir && CSP_EXTRA_CONNECT=http://127.0.0.1:54321 npx vite preview --outDir dist-csp --port 4180
```

Ao adicionar um serviço externo novo (outra API, fonte, iframe), inclua o domínio na diretiva certa do `vercel.json`. Senão o navegador bloqueia e mostra no console um erro "violates the following Content Security Policy directive".

---

## Arquivos

- `src/lib/google-drive.ts`: login (Google Identity Services), seletor (Google Picker), download e upload (Drive API v3).
- `src/components/juros/IconeGoogleDrive.tsx`: ícone do Drive.
- `src/components/juros/AssistenteClaudeRevisional.tsx`: botão **Google Drive** (anexar contrato).
- `src/pages/CalculadoraAdvogado.tsx`: botão **Salvar no Drive** (laudo).
- `vercel.json` / `vite.config.ts`: política de segurança e `vite preview` com os mesmos cabeçalhos.

## Problemas comuns

- **"O navegador bloqueou a janela do Google"**: permita pop-ups para o site e clique de novo.
- **Erro `origin_mismatch` na janela do Google**: o endereço aberto não está nas *Origens JavaScript autorizadas* (passo 4). Confira `www` e porta.
- **Seletor abre vazio ou com erro de chave**: confira as restrições da chave de API (passo 5) e se a **Google Picker API** está ativada.
- **"O Google Drive não permitiu salvar"**: com `drive.file`, a pasta precisa ser escolhida pelo seletor (é isso que libera o acesso a ela). Escolha a pasta de novo.
