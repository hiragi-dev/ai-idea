import { z } from 'zod';
import {
  ProblemSpecSchema,
  GeneratedIdeaSchema,
  DedupedIdeaSchema,
  IdeaSchema,
  EvaluationSchema,
  MutationInstructionSchema,
} from './schemas.js';

export type ProblemSpec = z.infer<typeof ProblemSpecSchema>;
export type GeneratedIdea = z.infer<typeof GeneratedIdeaSchema>;
export type DedupedIdea = z.infer<typeof DedupedIdeaSchema>;
export type Idea = z.infer<typeof IdeaSchema>;
export type Evaluation = z.infer<typeof EvaluationSchema>;
export type MutationInstruction = z.infer<typeof MutationInstructionSchema>;
export type IdeaWithEval = Idea & { evaluations: Evaluation };
