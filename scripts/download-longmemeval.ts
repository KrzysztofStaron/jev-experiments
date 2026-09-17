/**
 * Download LongMemEval dataset from Hugging Face
 * Repository: https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned
 */

import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import chalk from "chalk";

const HF_BASE = "https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main";
const DATA_DIR = "/workspace/data/longmemeval";

const FILES = {
  s: "longmemeval_s_cleaned.json",
  oracle: "longmemeval_oracle_cleaned.json",
};

async function downloadFile(url: string, destPath: string): Promise<void> {
  console.log(chalk.blue(`📥 Downloading ${url.split("/").pop()}...`));
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.text();
  await writeFile(destPath, data);
  
  const sizeMB = (data.length / 1024 / 1024).toFixed(2);
  console.log(chalk.green(`✅ Saved to ${destPath} (${sizeMB} MB)`));
}

async function main() {
  console.log(chalk.bold("\n🤗 LongMemEval Dataset Downloader\n"));
  console.log(chalk.gray(`Source: ${HF_BASE}\n`));

  await mkdir(DATA_DIR, { recursive: true });

  for (const [split, filename] of Object.entries(FILES)) {
    const destPath = `${DATA_DIR}/${filename}`;
    
    if (existsSync(destPath)) {
      console.log(chalk.yellow(`⏭️  ${filename} already exists, skipping`));
      continue;
    }

    const url = `${HF_BASE}/${filename}`;
    
    try {
      await downloadFile(url, destPath);
    } catch (error) {
      console.error(chalk.red(`❌ Failed to download ${filename}:`), error);
      process.exit(1);
    }
  }

  console.log(chalk.bold.green("\n✅ Download complete!\n"));
  console.log(chalk.gray("Dataset stats:"));
  console.log(chalk.gray("  - longmemeval_s_cleaned.json: ~115k tokens, ~40 sessions per instance"));
  console.log(chalk.gray("  - longmemeval_oracle_cleaned.json: evidence-only sessions (sanity check)"));
  console.log(chalk.gray("\nRun evaluation:"));
  console.log(chalk.cyan("  pnpm exp:memory:longmemeval -- --limit 5"));
}

main();
