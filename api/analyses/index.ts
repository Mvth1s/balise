// POST /api/analyses — validates, answers 202, then runs the analysis (maxDuration 300 s in vercel.json).
import { handle } from '../_handler.ts';

export const POST = handle;
