import cliProgress from 'cli-progress';

const multibar = new cliProgress.MultiBar(
  {
    clearOnComplete: false,
    hideCursor: true,
    format: '{name} |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s',
    barsize: 30,
  },
  cliProgress.Presets.shades_classic
);

const bars = new Map<string, cliProgress.SingleBar>();

export function registerProgressBar(name: string, total: number): string {
  const key = name;
  if (bars.has(key)) return key;
  const bar = multibar.create(total, 0, { name });
  bars.set(key, bar);
  return key;
}

export function tickProgress(key?: string): void {
  if (!key) return;
  bars.get(key)?.increment();
}

export function setProgressValue(key: string, value: number): void {
  const bar = bars.get(key);
  if (bar) bar.update(value);
}

export function stopProgressBars(): void {
  multibar.stop();
}
