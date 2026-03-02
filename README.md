# PayAgent - AI 決済アシスタント

Base Sepolia テストネット上で動作する AI 決済アシスタント。自然言語でウォレット作成・残高確認・送金・テストネット資金の取得を行える。

**デプロイ先:** https://agent-payment-demo.vercel.app

## 目次

- [概要](#概要)
- [Coinbase Agent Wallet とは](#coinbase-agent-wallet-とは)
- [アーキテクチャ](#アーキテクチャ)
- [技術スタック](#技術スタック)
- [セットアップ](#セットアップ)
- [環境変数](#環境変数)
- [API エンドポイント](#api-エンドポイント)
- [AI チャット機能](#ai-チャット機能)
- [CDP SDK の使用箇所](#cdp-sdk-の使用箇所)
- [テスト](#テスト)
- [ディレクトリ構成](#ディレクトリ構成)

---

## 概要

PayAgent は、AI エージェントがブロックチェーンウォレットを自律的に操作するデモアプリケーション。ユーザーはチャットで「ウォレットを作って」「ETH を送って」と話しかけるだけで、裏側では Coinbase CDP SDK を通じて実際のブロックチェーントランザクションが実行される。

### 主な機能

| 機能 | 説明 |
|------|------|
| ウォレット作成 | AI がエージェントウォレットを作成・管理 |
| 残高確認 | ETH / USDC の残高をリアルタイム取得 |
| Faucet | テストネット ETH / USDC を取得 |
| 送金 | エージェントウォレットから任意のアドレスへ送金 |
| ブラウザウォレット接続 | MetaMask 等で接続し、送金先として指定可能 |

### 2つのインターフェース

- **Chat タブ**: AI との自然言語チャットで全操作を実行
- **Wallet タブ**: GUI でウォレット作成・残高確認・Faucet を直接操作

---

## Coinbase Agent Wallet とは

### 概要

[Coinbase Developer Platform (CDP)](https://docs.cdp.coinbase.com/) が提供する **Agent Wallet** は、AI エージェントがプログラム的にブロックチェーン操作を行うためのウォレットソリューション。従来のウォレット（MetaMask 等）はユーザーが手動で操作するのに対し、Agent Wallet は **サーバーサイドの AI エージェントが自律的にトランザクションを署名・送信** できる。

### 従来のウォレットとの違い

```
┌──────────────────────┐    ┌──────────────────────┐
│   従来のウォレット      │    │   Agent Wallet        │
│  (MetaMask 等)        │    │  (CDP SDK)            │
├──────────────────────┤    ├──────────────────────┤
│ ユーザーが手動操作     │    │ AI が自律的に操作      │
│ ブラウザ拡張が秘密鍵管理│    │ CDP サーバーが秘密鍵管理│
│ 署名にユーザー承認必要  │    │ API 呼び出しで即座に署名│
│ クライアントサイド      │    │ サーバーサイド          │
└──────────────────────┘    └──────────────────────┘
```

### CDP SDK の主要な特徴

1. **名前ベースのウォレット管理**
   - `getOrCreateAccount({ name: "MyAgent" })` のように名前で作成・取得
   - 同じ名前で呼び出すと同じウォレットが返る（冪等性）
   - 複数のウォレットを名前で区別して管理可能

2. **秘密鍵の安全な管理**
   - 秘密鍵は CDP サーバー上で暗号化保存
   - `CDP_WALLET_SECRET` で暗号化（アプリ側に秘密鍵が露出しない）
   - API キー認証 (`CDP_API_KEY_ID` + `CDP_API_KEY_SECRET`) でアクセス制御

3. **マルチネットワーク対応**
   - `sender.useNetwork("base-sepolia")` でネットワークを切り替え
   - 本アプリでは Base Sepolia (テストネット) を使用
   - CDP SDK の対応ネットワーク一覧 ([公式ドキュメント](https://docs.cdp.coinbase.com/get-started/supported-networks)):

   **EVM ネットワーク**

   | ネットワーク | Chain ID | SDK 識別子 | 種別 |
   |------------|----------|-----------|------|
   | Arbitrum Mainnet | 42161 | `arbitrum-mainnet` | メインネット |
   | Base Mainnet | 8453 | `base-mainnet` | メインネット |
   | Base Sepolia | 84532 | `base-sepolia` | テストネット |
   | Ethereum Mainnet | 1 | `ethereum-mainnet` | メインネット |
   | Ethereum Hoodi | 560048 | `ethereum-hoodi` | テストネット |
   | Ethereum Sepolia | — | `ethereum-sepolia` | テストネット |
   | Optimism Mainnet | 10 | `optimism-mainnet` | メインネット |
   | Polygon Mainnet | 137 | `polygon-mainnet` | メインネット |

   **非 EVM ネットワーク**

   | ネットワーク | SDK 識別子 | 種別 |
   |------------|-----------|------|
   | Bitcoin Mainnet | `bitcoin-mainnet` | メインネット |
   | Solana Mainnet | `solana-mainnet` | メインネット |
   | Solana Devnet | `solana-devnet` | テストネット |

4. **ビルトイン Faucet**
   - `cdp.evm.requestFaucet()` でテストネット資金を直接リクエスト
   - ETH / USDC に対応
   - 開発・テスト用途で即座にテスト資金を取得可能

5. **高レベル送金 API**
   - ETH: `sendTransaction()` でネイティブトークン送金
   - ERC-20: `transfer()` で USDC 等のトークン送金
   - トランザクションハッシュとレシートを返却

### Agent Wallet が解決する課題

| 課題 | 従来の方法 | Agent Wallet |
|------|-----------|-------------|
| AI がトランザクション署名 | 秘密鍵を直接扱う（リスク大） | CDP API 経由で安全に署名 |
| ウォレット管理 | アドレス/秘密鍵のペアを自前管理 | 名前ベースで CDP が一元管理 |
| テスト資金取得 | 外部 Faucet サイトを手動操作 | SDK の `requestFaucet()` で自動化 |
| マルチチェーン | チェーンごとに異なるライブラリ | 統一 API でマルチチェーン対応 |

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                      ブラウザ                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │
│  │  ChatView   │  │ WalletView │  │ RainbowKit         │ │
│  │  (useChat)  │  │  (GUI)     │  │ (MetaMask接続)     │ │
│  └──────┬─────┘  └──────┬─────┘  └────────────────────┘ │
└─────────┼───────────────┼───────────────────────────────┘
          │               │
          ▼               ▼
┌─────────────────────────────────────────────────────────┐
│                Next.js API Routes                        │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐ │
│  │/api/chat │ │/api/wallet│ │/api/   │ │/api/transfer │ │
│  │(SSE)     │ │          │ │balance │ │              │ │
│  │          │ │          │ │faucet  │ │              │ │
│  └────┬─────┘ └────┬─────┘ └───┬────┘ └──────┬───────┘ │
│       │            │           │              │         │
│       ▼            ▼           │              ▼         │
│  ┌─────────┐  ┌─────────┐     │      ┌─────────────┐   │
│  │Anthropic│  │CDP SDK  │     │      │  CDP SDK    │   │
│  │Proxy    │  │(wallet) │     │      │  (transfer) │   │
│  └────┬────┘  └─────────┘     │      └─────────────┘   │
│       │                       │                         │
│       ▼                       ▼                         │
│  ┌─────────┐           ┌──────────┐                     │
│  │Claude   │           │viem      │                     │
│  │Sonnet 4 │           │(RPC直接) │                     │
│  └─────────┘           └──────────┘                     │
└─────────────────────────────────────────────────────────┘
          │                     │
          ▼                     ▼
   ┌─────────────┐    ┌──────────────────┐
   │ Coinbase    │    │ Base Sepolia     │
   │ CDP Server  │    │ Blockchain (RPC) │
   └─────────────┘    └──────────────────┘
```

### データフロー

1. **ウォレット作成**: ユーザー → Chat/Wallet UI → `/api/wallet` or `/api/chat` → CDP SDK → CDP Server
2. **残高確認**: ユーザー → UI → `/api/balance` → viem → Base Sepolia RPC (ブロックチェーン直接読み取り)
3. **Faucet**: ユーザー → UI → `/api/faucet` or `/api/chat` → CDP SDK → テストネット Faucet
4. **送金**: ユーザー → Chat UI → `/api/chat` (AI がツール呼び出し) → CDP SDK → ブロックチェーンへトランザクション送信

---

## 技術スタック

| カテゴリ | 技術 | 用途 |
|---------|------|------|
| フレームワーク | Next.js 16 (App Router) | フルスタック Web アプリ |
| 言語 | TypeScript | 型安全なコード |
| AI | Vercel AI SDK v6 + Claude Sonnet 4 | ストリーミングチャット + ツール呼び出し |
| ブロックチェーン | Coinbase CDP SDK | Agent Wallet 管理 |
| RPC クライアント | viem | ブロックチェーン読み取り (残高等) |
| ウォレット接続 | RainbowKit + wagmi | ブラウザウォレット (MetaMask 等) |
| スタイル | Tailwind CSS | ダークテーマ UI |
| テスト | Playwright | E2E ブラウザテスト |
| デプロイ | Vercel | サーバーレスデプロイ |
| パッケージ管理 | pnpm | 高速・効率的な依存関係管理 |

---

## セットアップ

### 前提条件

- Node.js 18+
- pnpm 10+
- [Coinbase CDP API キー](https://portal.cdp.coinbase.com/)
- Anthropic API キー (または互換プロキシ)

### インストール

```bash
git clone https://github.com/Masashi-Ono0611/agent-payment.git
cd agent-payment-demo
pnpm install
```

### 環境変数の設定

```bash
cp .env.local.example .env.local
# .env.local を編集して各キーを設定
```

### 開発サーバー起動

```bash
pnpm dev
# http://localhost:3000 でアクセス
```

---

## 環境変数

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `CDP_API_KEY_ID` | Yes | Coinbase CDP API キー ID |
| `CDP_API_KEY_SECRET` | Yes | Coinbase CDP API シークレット |
| `CDP_WALLET_SECRET` | Yes | ウォレット暗号化シークレット (EC 秘密鍵、Base64 エンコード) |
| `ANTHROPIC_BASE_URL` | Yes | Anthropic API のベース URL (プロキシ URL) |
| `ANTHROPIC_AUTH_TOKEN` | Yes | Anthropic API の認証トークン |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | No | WalletConnect プロジェクト ID (ブラウザウォレット接続用) |

### CDP クレデンシャルの取得方法

1. [Coinbase Developer Platform](https://portal.cdp.coinbase.com/) にアクセス
2. プロジェクトを作成
3. API キーを生成 → `CDP_API_KEY_ID` と `CDP_API_KEY_SECRET`
4. Wallet Secret を生成 → `CDP_WALLET_SECRET`

---

## API エンドポイント

### POST `/api/chat`

AI チャットのストリーミングエンドポイント。SSE (Server-Sent Events) で UIMessageStream 形式のレスポンスを返す。

```typescript
// リクエスト
{
  messages: UIMessage[],
  wallets: { name: string; address: string }[],
  connectedAddress?: string
}

// レスポンス: SSE ストリーム (text/event-stream)
data: {"type":"text-delta","id":"0","delta":"こんにちは"}
data: {"type":"tool-input-available","toolCallId":"...","toolName":"create_wallet","input":{...}}
data: {"type":"tool-output-available","toolCallId":"...","output":{...}}
```

### POST `/api/wallet`

ウォレットの直接作成。

```typescript
// リクエスト
{ name: "MyAgent" }

// レスポンス
{ success: true, data: { name: "MyAgent", address: "0x..." } }
```

### GET `/api/balance?address=0x...`

ETH と USDC の残高を取得。viem 経由でブロックチェーンから直接読み取り。

```typescript
// レスポンス
{ success: true, data: { eth: "0.001", usdc: "10.00" } }
```

### POST `/api/faucet`

テストネット Faucet からトークンをリクエスト。

```typescript
// リクエスト
{ address: "0x...", token: "eth" | "usdc" }

// レスポンス
{ success: true, data: { transactionHash: "0x...", explorerUrl: "https://sepolia.basescan.org/tx/..." } }
```

### POST `/api/transfer`

ウォレット間の送金を実行。

```typescript
// リクエスト
{ fromName: "MyAgent", to: "0x...", amount: "0.001", token: "eth" | "usdc" }

// レスポンス
{ success: true, data: { transactionHash: "0x...", from: "0x...", to: "0x...", explorerUrl: "..." } }
```

---

## AI チャット機能

### ツール定義

Claude に対して以下の 4 つのツールが定義されており、チャットの文脈に応じて自動的に呼び出される:

| ツール名 | 入力 | 動作 |
|---------|------|------|
| `create_wallet` | `{ name: string }` | CDP でウォレットを作成し、アドレスを返す |
| `check_balance` | `{ address: string }` | viem で ETH/USDC 残高を取得 |
| `request_faucet` | `{ address, token }` | CDP Faucet からテストネット資金を取得 |
| `send_payment` | `{ fromWalletName, toAddress, amount, token }` | CDP でトランザクションを送信 |

### ストリーミングフロー

```
ユーザー: 「ETH の Faucet をリクエストして」
    ↓
1. Claude がメッセージを解析
2. request_faucet ツールを呼び出し (UI にスピナー表示)
3. CDP SDK が Faucet API を呼び出し
4. トランザクション完了を待機
5. Claude が結果をテキストで要約 (UI にチェックマーク表示)
6. BaseScan リンク付きで結果表示
```

### プロキシ対応

本アプリは Anthropic API を OpenAI 互換プロキシ経由で使用しており、以下のプロキシ固有の問題に対応:

1. **ツール名の変換**: プロキシが `create_wallet` → `CreateWallet_tool` に変換するため、レスポンスストリームで逆変換
2. **並列ツール呼び出し**: プロキシが複数ツール結果を正しく変換できないため、リクエストを個別ペアに分割
3. **インデックス修正**: プロキシが `tool_calls` の `index:1` を返すため `index:0` に修正

---

## CDP SDK の使用箇所

### 1. クライアント初期化 (`src/lib/cdp.ts`)

```typescript
import { CdpClient } from "@coinbase/cdp-sdk";

// シングルトンパターンで CDP クライアントを初期化
const cdpClient = new CdpClient({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
  walletSecret: process.env.CDP_WALLET_SECRET,
});
```

### 2. ウォレット作成 (`/api/wallet`, `/api/chat` の create_wallet ツール)

```typescript
// 名前ベースで作成 (同じ名前なら同じウォレットを返す)
const account = await cdp.evm.getOrCreateAccount({ name: "MyAgent" });
// account.address → "0x4De34526aE228c26110298ca40708B4604B4558b"
```

### 3. Faucet リクエスト (`/api/faucet`, `/api/chat` の request_faucet ツール)

```typescript
const { transactionHash } = await cdp.evm.requestFaucet({
  address: walletAddress,
  network: "base-sepolia",
  token: "usdc",  // "eth" or "usdc"
});
// トランザクション完了を待機
await publicClient.waitForTransactionReceipt({ hash: transactionHash });
```

### 4. ETH 送金 (`/api/transfer`, `/api/chat` の send_payment ツール)

```typescript
const sender = await cdp.evm.getOrCreateAccount({ name: "MyAgent" });
const baseAccount = await sender.useNetwork("base-sepolia");
const { transactionHash } = await baseAccount.sendTransaction({
  transaction: {
    to: recipientAddress,
    value: parseEther("0.001"),
  },
});
```

### 5. USDC 送金 (`/api/transfer`, `/api/chat` の send_payment ツール)

```typescript
const sender = await cdp.evm.getOrCreateAccount({ name: "MyAgent" });
const { transactionHash } = await sender.transfer({
  to: recipientAddress,
  amount: parseUsdcUnits("5.0"),  // 6 decimal places
  token: "usdc",
  network: "base-sepolia",
});
```

### 残高確認について

残高確認は CDP SDK を使用せず、**viem の publicClient** でブロックチェーン RPC に直接問い合わせる:

```typescript
// ETH 残高
const ethBalance = await publicClient.getBalance({ address });

// USDC 残高 (ERC-20 コントラクト読み取り)
const usdcBalance = await publicClient.readContract({
  address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",  // Base Sepolia USDC
  abi: ERC20_ABI,
  functionName: "balanceOf",
  args: [address],
});
```

---

## テスト

### E2E テスト (Playwright)

API をモックし、ブラウザ操作を自動化した 24 のテストケース:

```bash
# ヘッドレス実行
pnpm test:e2e

# UI モード (ブラウザ表示 + デバッグ)
pnpm test:e2e:ui

# ブラウザ表示して実行
pnpm test:e2e -- --headed
```

### テストカバレッジ

| テストファイル | 内容 | テスト数 |
|--------------|------|---------|
| `00-initial-load` | 初期表示・ヘッダー・タブ | 5 |
| `01-tab-navigation` | タブ切り替え | 2 |
| `02-chat-wallet-create` | チャットでウォレット作成 | 2 |
| `03-chat-balance` | チャットで残高確認 | 1 |
| `04-chat-faucet` | チャットで Faucet (ETH/USDC) | 2 |
| `05-chat-transfer` | チャットで送金 (ETH/USDC) | 2 |
| `06-wallet-tab` | Wallet タブの GUI 操作 | 5 |
| `07-edge-cases` | エッジケース・バリデーション | 4 |
| `08-cross-tab-sync` | タブ間同期 | 1 |
| **合計** | | **24** |

### モック戦略

- **API モック** (`e2e/fixtures/api-mocks.ts`): `page.route()` で REST API をインターセプト
- **チャットモック** (`e2e/fixtures/chat-mock.ts`): UIMessageStream SSE 形式でチャットレスポンスをシミュレート
- プロダクションコードの変更なし

---

## ディレクトリ構成

```
agent-payment-demo/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts       # AI チャット (SSE ストリーミング)
│   │   │   ├── wallet/route.ts     # ウォレット作成
│   │   │   ├── balance/route.ts    # 残高取得
│   │   │   ├── faucet/route.ts     # Faucet リクエスト
│   │   │   └── transfer/route.ts   # 送金実行
│   │   ├── page.tsx                # メインページ (状態管理)
│   │   ├── layout.tsx              # レイアウト (Providers ラップ)
│   │   └── globals.css             # グローバルスタイル (CSS 変数)
│   ├── components/
│   │   ├── Providers.tsx           # wagmi + RainbowKit プロバイダー
│   │   ├── ChatView.tsx            # チャット UI (useChat)
│   │   ├── WalletView.tsx          # ウォレット管理 UI
│   │   └── BottomNav.tsx           # タブナビゲーション
│   └── lib/
│       ├── cdp.ts                  # CDP クライアント (シングルトン)
│       ├── viem.ts                 # RPC クライアント + USDC 定義
│       └── wagmi.ts                # RainbowKit + wagmi 設定
├── e2e/
│   ├── fixtures/
│   │   ├── api-mocks.ts           # REST API モック
│   │   └── chat-mock.ts           # SSE チャットモック
│   └── tests/                     # 24 テストケース
├── package.json
├── playwright.config.ts
├── tsconfig.json
└── next.config.ts
```

---

## データ永続性について

| データ | 保存先 | 永続性 |
|--------|--------|--------|
| エージェントウォレット (秘密鍵) | Coinbase CDP サーバー | 永続 (同じ CDP クレデンシャルでアクセス可能) |
| ウォレット一覧 (UI 状態) | ブラウザメモリ (React state) | リロードで消失 |
| チャット履歴 | ブラウザメモリ (useChat 内部状態) | リロードで消失 |
| 残高データ | ブロックチェーンから都度取得 | ブロックチェーン上に永続 |
| ブラウザウォレット | MetaMask 等の拡張機能 | 拡張機能が管理 |

> **注意**: UI 上のウォレット一覧とチャット履歴はページリロードで消えますが、CDP 上のウォレット自体は永続的に存在し、同じ名前で再度 `getOrCreateAccount()` を呼べば同じウォレットにアクセスできます。

---

## ライセンス

Private
