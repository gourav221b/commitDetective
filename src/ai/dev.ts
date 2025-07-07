import { config } from 'dotenv';
config();

import '@/ai/flows/analyze-commit-lineage.ts';
import '@/ai/flows/calculate-ltc.ts';
import '@/ai/flows/extract-github-data.ts';