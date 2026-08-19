import { Command } from 'commander';
import { readFile } from 'fs/promises';
import YAML from 'yaml';
import { runEvolution } from './orchestrator/rounds.js';
import { ensureStateDir } from './state.js';

const program = new Command();

program
  .name('idea-evolver')
  .description('進化的マルチエージェント審査システム for ハッカソンアイデア')
  .version('0.1.0')
  .requiredOption('-i, --input <file>', '入力YAML/JSONファイル')
  .option('-a, --auto', '全ラウンドを自動で進行する', false)
  .option('--resume', 'state/ の既存進捗から再開する', false)
  .option('--reset', 'state/ を削除して最初から実行する', false)
  .option('--dry-run', '入力のパース確認のみ行い、APIは呼ばない')
  .action(async (options) => {
    await ensureStateDir();

    const raw = await readFile(options.input, 'utf-8');
    const inputText = raw.trim().startsWith('{')
      ? raw
      : JSON.stringify(YAML.parse(raw), null, 2);

    if (options.dryRun) {
      console.log('Dry run: parsed input preview');
      console.log(inputText.slice(0, 2000));
      return;
    }

    console.log('Starting idea evolution...');
    const { finalIdeas } = await runEvolution(inputText, {
      auto: options.auto,
      resume: options.resume,
      reset: options.reset,
    });

    console.log('\n🏆 Final ideas:');
    for (const idea of finalIdeas) {
      console.log(`\n  ${idea.name}`);
      console.log(`  ${idea.one_liner}`);
      if (idea.evaluations) {
        console.log(
          `  official=${idea.evaluations.official.total}/50 ` +
            `anti-agent=${idea.evaluations.anti_agent.agent_replaceability}/10 ` +
            `demo=${(idea.evaluations.demo.memorable_30min + idea.evaluations.demo.demo_clarity) / 2}`
        );
      }
    }
  });

program.parse();
