// POST /api/analyses/:id/report — report written back by the isolated worker (single-use signed token).
import { handle } from '../../_handler.ts';

export const POST = handle;
