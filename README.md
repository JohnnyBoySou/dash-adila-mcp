<div align="center">

# 🚀 adila-mcp

**Servidor [MCP](https://modelcontextprotocol.io) da Adila — faça deploy por linguagem natural.**

Conecte Claude, Cursor ou qualquer cliente de IA ao seu control plane e dispare
builds e deploys conversando: _"faz deploy da branch main do acme/api"_.

[![npm](https://img.shields.io/npm/v/adila-mcp?color=8b5cf6)](https://www.npmjs.com/package/adila-mcp)
[![node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-stdio-000000)](https://modelcontextprotocol.io)
[![license](https://img.shields.io/badge/license-MIT-blue)](#-licença)

</div>

---

## ✨ Visão geral

`adila-mcp` é um **sidecar fino** (stdio, JSON-RPC 2.0) que expõe o tool `deploy`
para clientes de IA. Ele não contém lógica de negócio: apenas traduz o protocolo
MCP em uma chamada HTTP autenticada ao control plane da Adila (`POST /api/deploy`).

- 🪶 **Zero dependências de runtime** — bundle único, roda em Node 18+ ou Bun.
- 🔐 **Autorização ao vivo** — a chave resolve usuário/org a cada chamada; revogar tem efeito imediato.
- ⚡ **Sem instalação manual** — `npx` baixa e executa sob demanda.
- 🤖 **Plug-and-play** — funciona com Claude Desktop, Claude Code, Cursor e afins.

## 🧭 Arquitetura

```
┌──────────────┐   stdio (JSON-RPC)   ┌───────────┐   HTTPS (Bearer)   ┌──────────────────┐
│ Cliente de IA│ ───────────────────▶ │ adila-mcp │ ─────────────────▶ │ POST /api/deploy │
│  (Claude…)   │ ◀─────────────────── │ (sidecar) │ ◀───────────────── │  (control plane) │
└──────────────┘    resultado MCP     └───────────┘   build + deploy   └──────────────────┘
```

A chave de API resolve o usuário/organização **ao vivo** a cada chamada no
control plane: revogar a chave ou remover o usuário da org desativa o acesso
imediatamente, e a chave nunca concede mais que o papel atual do usuário.

## 🚀 Início rápido

### 1. Gere uma chave

No dashboard, vá em **Integrações → Servidor MCP → Gerar chave**. A chave
(`adila_sk_...`) é exibida **uma única vez** — copie e guarde com segurança.

### 2. Configure o cliente

Adicione ao arquivo de MCP servers do seu cliente (ex.: `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "adila": {
      "command": "npx",
      "args": ["-y", "adila-mcp"],
      "env": {
        "ADILA_API_URL": "https://api.adila.co",
        "ADILA_API_KEY": "adila_sk_xxxxxxxx"
      }
    }
  }
}
```

> 💡 Quem usa Bun pode trocar por `"command": "bunx"`, `"args": ["adila-mcp"]`.

### 3. Converse

Reinicie o cliente e peça um deploy em linguagem natural. Pronto. 🎉

## ⚙️ Variáveis de ambiente

| Variável         | Obrigatória | Descrição                                            |
| ---------------- | :---------: | ---------------------------------------------------- |
| `ADILA_API_URL`  |     ✅      | URL base do control plane (ex.: `https://api.adila.co`). |
| `ADILA_API_KEY`  |     ✅      | Chave de API no formato `adila_sk_...`.              |

## 🛠️ Tool: `deploy`

Dispara um deploy (build do repositório + deploy automático) de um service.

| Campo       | Tipo   |       Obrigatório        | Descrição                                       |
| ----------- | ------ | ------------------------ | ----------------------------------------------- |
| `serviceId` | string | um de `serviceId`/`repo` | ID do service a deployar.                       |
| `repo`      | string | um de `serviceId`/`repo` | Repositório `owner/name` (resolve o service).   |
| `branch`    | string |           não            | Branch a buildar. Padrão: branch default.       |
| `commitSha` | string |           não            | Commit específico (opcional).                   |

Informe **exatamente um** entre `serviceId` e `repo`. Quando `repo` mapeia para
mais de um service, o control plane responde pedindo o `serviceId` específico.

```jsonc
{ "serviceId": "svc_abc123" }
{ "repo": "acme/api", "branch": "main" }
```

## 🔐 Segurança

- A chave de API só trafega no header `Authorization: Bearer ...` — **nunca é logada**.
- O stdout é reservado ao protocolo MCP; todo log vai para o stderr.
- `.env` está no `.gitignore`; **não versione a chave**.
- Revogue chaves comprometidas no dashboard — o efeito é **imediato**.

## 💻 Desenvolvimento

```bash
bun install

# Execução direta (debug)
ADILA_API_URL=... ADILA_API_KEY=... bun run src/index.ts

bunx tsc --noEmit   # type-check
bun run build       # gera dist/index.js (bundle Node)
```

## 📦 Publicação (npm)

O `bin` aponta para `dist/index.js`; `prepublishOnly` roda o build automaticamente.

```bash
npm login
npm publish --access public   # ou --dry-run para ensaiar
```

Depois de publicado, `npx -y adila-mcp` passa a funcionar em qualquer máquina.

## 📄 Licença

[MIT](LICENSE) © Adila
