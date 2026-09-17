import { PNG } from 'pngjs';
import * as fs from 'fs';
import * as path from 'path';
import { createJevClient } from '../jev.js';

export type ImageMode = 'score' | 'binary';

export interface ImageGeneratorConfig {
  prompt: string;
  size: number;
  mode: ImageMode;
  apiKey: string;
  mock?: boolean;
  outputDir?: string;
}

interface PixelDecision {
  x: number;
  y: number;
  value: string;
  grayscale: number;
}

const SCORE_LEVELS = ['black', 'dark', 'mid', 'light', 'white'];
const BINARY_CHOICES = ['black', 'white'];

function levelToGrayscale(level: string, mode: ImageMode): number {
  if (mode === 'binary') {
    return level === 'white' ? 255 : 0;
  }
  
  const index = SCORE_LEVELS.indexOf(level);
  if (index === -1) return 128;
  
  return Math.floor((index / (SCORE_LEVELS.length - 1)) * 255);
}

function buildPixelState(
  decisions: PixelDecision[],
  x: number,
  y: number,
  size: number
): string {
  const recent: string[] = [];
  
  if (x > 0) {
    const left = decisions.find(d => d.x === x - 1 && d.y === y);
    if (left) recent.push(`left:${left.value}`);
  }
  
  if (y > 0) {
    const above = decisions.find(d => d.x === x && d.y === y - 1);
    if (above) recent.push(`above:${above.value}`);
  }
  
  if (recent.length > 0) {
    return `Neighbors: ${recent.join(', ')}`;
  }
  
  return '';
}

export async function generateImage(config: ImageGeneratorConfig): Promise<{
  pngPath: string;
  jsonPath: string;
  decisions: PixelDecision[];
}> {
  const { prompt, size, mode, apiKey, mock, outputDir = 'out' } = config;
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const jev = createJevClient(apiKey, { mock });
  const decisions: PixelDecision[] = [];

  console.log(`Generating ${size}x${size} image: "${prompt}"`);
  console.log(`Mode: ${mode}, Mock: ${mock || false}`);

  for (let y = 0; y < size; y++) {
    const rowQueries = [];
    
    for (let x = 0; x < size; x++) {
      const state = buildPixelState(decisions, x, y, size);
      const query = `For an image: "${prompt}" - what should pixel (${x},${y}) be?`;
      
      if (mode === 'score') {
        rowQueries.push({
          query,
          scores: SCORE_LEVELS,
          state,
          x,
          y,
        });
      } else {
        rowQueries.push({
          query,
          choices: BINARY_CHOICES,
          state,
          x,
          y,
        });
      }
    }

    let results: string[];
    if (mode === 'score') {
      results = await jev.batchEvaluateScore(rowQueries);
    } else {
      results = await jev.batchEvaluateChoice(rowQueries);
    }

    for (let i = 0; i < rowQueries.length; i++) {
      const { x, y } = rowQueries[i];
      const value = results[i];
      const grayscale = levelToGrayscale(value, mode);
      decisions.push({ x, y, value, grayscale });
    }

    const progress = Math.round(((y + 1) / size) * 100);
    process.stdout.write(`\rProgress: ${progress}%`);
  }
  
  console.log('\nGenerating PNG...');

  const png = new PNG({ width: size, height: size });

  for (const decision of decisions) {
    const idx = (png.width * decision.y + decision.x) << 2;
    png.data[idx] = decision.grayscale;
    png.data[idx + 1] = decision.grayscale;
    png.data[idx + 2] = decision.grayscale;
    png.data[idx + 3] = 255;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const sanitizedPrompt = prompt.replace(/[^a-z0-9]/gi, '-').slice(0, 30);
  const baseName = `${sanitizedPrompt}-${size}x${size}-${mode}-${timestamp}`;
  
  const pngPath = path.join(outputDir, `${baseName}.png`);
  const jsonPath = path.join(outputDir, `${baseName}.json`);

  await new Promise<void>((resolve, reject) => {
    png.pack()
      .pipe(fs.createWriteStream(pngPath))
      .on('finish', () => resolve())
      .on('error', reject);
  });

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        prompt,
        size,
        mode,
        mock: mock || false,
        timestamp: new Date().toISOString(),
        decisions,
      },
      null,
      2
    )
  );

  console.log(`✓ PNG saved: ${pngPath}`);
  console.log(`✓ JSON saved: ${jsonPath}`);

  return { pngPath, jsonPath, decisions };
}
