import { z } from 'zod';

export const ProblemSpecSchema = z.object({
  pains: z.array(z.string()),
  themes: z.array(z.string()),
  existing_ideas: z.array(z.string()),
  seed_ideas: z.array(z.string()).optional(),
  must_have: z.array(z.string()),
  must_not: z.array(z.string()),
  resources: z.object({
    duration_days: z.number(),
    team_size: z.number(),
    models: z.array(z.string()),
  }),
  user_notes: z.string().optional(),
});

export const GeneratedIdeaSchema = z.object({
  name: z.string(),
  one_liner: z.string(),
  pain: z.string(),
  core_insight: z.string(),
  ai_role: z.string(),
  why_not_normal_agent: z.string(),
  persistent_state: z.string(),
  human_ai_interaction: z.string(),
  demo_moment: z.string(),
  mvp_7_days: z.string(),
  risks: z.array(z.string()),
});

export const OfficialScoreSchema = z.object({
  problem_setting: z.number().min(0).max(10),
  novelty: z.number().min(0).max(10),
  implementation: z.number().min(0).max(10),
  ai_usage: z.number().min(0).max(10),
  practicality: z.number().min(0).max(10),
  total: z.number().min(0).max(50),
  award_want: z.number().min(0).max(10),
  memorable: z.number().min(0).max(10),
});

export const AntiAgentScoreSchema = z.object({
  agent_replaceability: z.number().min(0).max(10),
  reason: z.string(),
  minimum_required_product_state: z.string(),
  what_makes_it_more_than_a_prompt: z.string(),
});

export const DemoScoreSchema = z.object({
  memorable_30min: z.number().min(0).max(10),
  one_line_recall: z.string(),
  demo_clarity: z.number().min(0).max(10),
});

export const EvaluationSchema = z.object({
  official: OfficialScoreSchema,
  anti_agent: AntiAgentScoreSchema,
  demo: DemoScoreSchema,
  novelty: z.number(),
});

export const IdeaSchema = GeneratedIdeaSchema.extend({
  id: z.string(),
  parent_ids: z.array(z.string()),
  round: z.number().int(),
  created_by: z.string(),
  mutation_type: z.enum(['strengthen', 'invert', 'escape']).optional(),
  hypothesis: z.string().optional(),
  lineage: z.array(z.string()).optional(),
  killed: z.array(z.object({ gate: z.string(), reason: z.string() })).optional(),
  evaluations: EvaluationSchema.optional(),
});

export const MutationInstructionSchema = z.object({
  weakness_summary: z.string(),
  mutation_goal: z.array(z.string()),
  preserve: z.array(z.string()),
  forbidden_mutations: z.array(z.string()),
});

export const ProblemExtractorOutputSchema = z.object({
  problem_spec: ProblemSpecSchema,
});

export const ExplorerOutputSchema = z.object({
  ideas: z.array(GeneratedIdeaSchema),
});

export const DedupedIdeaSchema = GeneratedIdeaSchema.extend({
  source_input_ids: z.array(z.string()),
  merge_reason: z.string(),
});

export const DeduperOutputSchema = z.object({
  ideas: z.array(DedupedIdeaSchema),
});

export const DeduperSelectOutputSchema = z.object({
  selected: z.array(
    z.object({
      source_input_ids: z.array(z.string()),
      merge_reason: z.string(),
    })
  ),
});

export const MergerOutputSchema = z.object({ idea: GeneratedIdeaSchema });

export const RedTeamKillSchema = z.object({
  gate: z.string(),
  killed: z.boolean(),
  reason: z.string(),
});

export const RedTeamOutputSchema = z.object({
  kills: z.array(RedTeamKillSchema),
});

export const MutationOutputSchema = z.object({
  variants: z.array(
    GeneratedIdeaSchema.extend({
      mutation_type: z.enum(['strengthen', 'invert', 'escape']),
      hypothesis: z.string(),
    })
  ),
});

export const SeedProcessorOutputSchema = z.object({ idea: GeneratedIdeaSchema });

export const FeedbackCompilerOutputSchema = z.object({
  instruction: MutationInstructionSchema,
});

export const JudgeOfficialOutputSchema = z.object({ official: OfficialScoreSchema });
export const JudgeAntiAgentOutputSchema = z.object({ anti_agent: AntiAgentScoreSchema });
export const JudgeDemoOutputSchema = z.object({ demo: DemoScoreSchema });

export const DeepDiverOutputSchema = z.object({ idea: GeneratedIdeaSchema });
