/**
 * LongMemEval dataset setup helper
 * 
 * Data is already on the machine at:
 * C:\Users\kisie\Documents\jev-experiments\data\longmemeval_s_cleaned.json (~277MB)
 * 
 * This script helps set up the symlink or provides copy instructions.
 */

import { existsSync } from "fs";
import { symlink, copyFile, mkdir } from "fs/promises";
import { platform } from "os";
import chalk from "chalk";

const SOURCE_PATH_WINDOWS = "C:\\Users\\kisie\\Documents\\jev-experiments\\data\\longmemeval_s_cleaned.json";
const TARGET_PATH = "/workspace/data/longmemeval_s_cleaned.json";
const DATA_DIR = "/workspace/data";

async function main() {
  console.log(chalk.bold("\n📂 LongMemEval Dataset Setup\n"));

  if (existsSync(TARGET_PATH)) {
    console.log(chalk.green(`✅ Dataset already accessible at: ${TARGET_PATH}`));
    console.log(chalk.gray(`   Size: ${(require('fs').statSync(TARGET_PATH).size / 1024 / 1024).toFixed(1)} MB\n`));
    return;
  }

  console.log(chalk.yellow("⚠️  Dataset not found at target path"));
  console.log(chalk.gray(`   Looking for: ${TARGET_PATH}\n`));

  await mkdir(DATA_DIR, { recursive: true });

  if (platform() === "win32" && existsSync(SOURCE_PATH_WINDOWS)) {
    console.log(chalk.blue("🔗 Attempting to create symlink..."));
    
    try {
      await symlink(SOURCE_PATH_WINDOWS, TARGET_PATH, "file");
      console.log(chalk.green(`✅ Symlink created successfully!\n`));
      return;
    } catch (error: any) {
      if (error.code === "EPERM") {
        console.log(chalk.yellow("⚠️  Symlink failed (need admin rights or Developer Mode)"));
        console.log(chalk.gray("   Falling back to copy...\n"));
        
        try {
          await copyFile(SOURCE_PATH_WINDOWS, TARGET_PATH);
          console.log(chalk.green(`✅ File copied successfully!\n`));
          return;
        } catch (copyError) {
          console.error(chalk.red("❌ Copy failed:"), copyError);
        }
      } else {
        console.error(chalk.red("❌ Symlink failed:"), error);
      }
    }
  }

  console.log(chalk.yellow("\n📋 Manual setup required:\n"));
  
  if (platform() === "win32") {
    console.log(chalk.cyan("Option 1: Symlink (recommended, requires admin or Developer Mode)"));
    console.log(chalk.gray("  New-Item -ItemType SymbolicLink -Path \"data\\longmemeval_s_cleaned.json\" -Target \"C:\\Users\\kisie\\Documents\\jev-experiments\\data\\longmemeval_s_cleaned.json\"\n"));
    
    console.log(chalk.cyan("Option 2: Copy (simpler, uses more disk space)"));
    console.log(chalk.gray("  mkdir data"));
    console.log(chalk.gray("  copy \"C:\\Users\\kisie\\Documents\\jev-experiments\\data\\longmemeval_s_cleaned.json\" data\\\n"));
  } else {
    console.log(chalk.cyan("Symlink the file:"));
    console.log(chalk.gray("  mkdir -p data"));
    console.log(chalk.gray("  ln -s ~/path/to/longmemeval_s_cleaned.json data/longmemeval_s_cleaned.json\n"));
  }

  console.log(chalk.yellow("💡 Source path on this machine:"));
  console.log(chalk.gray(`   ${SOURCE_PATH_WINDOWS}\n`));
}

main();
