# ハッカソンアイデア進化マルチエージェントシステム

進化的マルチエージェント審査システムで、ハッカソンで賞を狙えるアイデアを探索します。

## 特徴

- **5系統の発散エージェント**を並列実行（Pain-first / Anti-Agent / Interaction-first / Counterfactual / Demo-first）
- **3系統の審査員エージェント**を並列実行（公式審査 / Anti-Agent審査 / Demo審査）
- **Agent代替不能性**を独立した強力な減点軸として組み込み
- **Pareto frontier** による多目的選択（平均点で単純化しない）
- **変異（Strengthen / Invert / Escape）** による構造的アイデア進化
- **Kill Gate** で「汎用Agentに1プロンプトで再現できる」案を即座に落とす
- すべての中間状態を `state/` に保存し、人間が確認しながら進行可能

### 入力ファイル

YAML または JSON を使います。

```yaml
pains:
  - プロジェクトを何度も途中で捨ててしまう
themes:
  - 自己理解
  - チーム

# existing_ideas: 真似してはいけない既存案（ネガティブサンプル）
existing_ideas:
  - "PROJECT AUTOPSY: 過去のプロジェクト失敗をAIが分析する"

# seed_ideas: 自分が最初から考えている元アイデア。ここから進化させます
seed_ideas:

must_have:
  - AIが本質的に必要
  - 7日以内に実装可能
must_not:
  - 単なるRAG
  - Agentに一回聞けば済むもの

resources:
  duration_days: 7
  team_size: 3
  models:
    - Kimi-K2.6
    - Kimi-K2.7
```

- `existing_ideas` は「コピーしないでほしい参考案」として扱われます。
- `seed_ideas` は「このアイデアを元に進化させてほしい」として扱われ、Round 1 で構造化された案としてプールに入ります。

```bash
npm install
cp .env.example .env
# .env にさくらのAI Engineのエンドポイント・APIキー・モデルIDを入力
```

`.env` 例:

```bash
SAKURA_AI_BASE_URL=https://api.example.com/v1
SAKURA_AI_API_KEY=sk-...
MODEL_KIMI_27=kimi-k2.7
MODEL_KIMI_26=kimi-k2.6
```

## 使い方

### 通常実行（各ラウンド後にEnterで進行）

```bash
npx tsx src/cli.ts -i example_input.yaml
```

### 自動実行

```bash
npx tsx src/cli.ts -i example_input.yaml --auto
```

### Dry run（入力パース確認のみ）

```bash
npx tsx src/cli.ts -i example_input.yaml --dry-run
```

## 出力

実行後、`state/` ディレクトリに以下が保存されます。

- `problem.json` — 正規化された ProblemSpec
- `ideas.jsonl` — 生成された全案（親子関係・変異タイプ付き）
- `evaluations.jsonl` — 全 Judge 評価
- `rounds/round_*.json` — 各ラウンドの進行状況

## 構成

```
src/
├── cli.ts
├── config.ts
├── llm.ts
├── schemas.ts
├── state.ts
├── types.ts
├── agents/
│   ├── problemExtractor.ts
│   ├── explorers.ts
│   ├── deduper.ts
│   ├── judges.ts
│   ├── redTeam.ts
│   ├── selector.ts
│   ├── feedbackCompiler.ts
│   ├── mutator.ts
│   └── deepDiver.ts
└── orchestrator/
    └── rounds.ts
```

## カスタマイズ

- `prompts/*.yaml` を編集して System Prompt / User Prompt / temperature を変更できます。
- `src/config.ts` で Agent→モデル割り当て、各ラウンドの選択数、並列数を変更できます。

## 型チェック

```bash
npm run typecheck
```
