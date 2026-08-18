export type Mode = "image" | "video" | "audio";

export type ModelRow = {
  id: string;
  label: string;
  mode?: string;
  modality?: string;
  notes?: string;
  endpoint?: string;
  cost_estimate_usd?: number;
  cost?: string;
};

export type GenerateResponse = {
  ok: boolean;
  result_paths?: string[];
  cost?: string;
  duration_sec?: number;
  error?: string | null;
  status?: string;
  job_kind?: string;
};

export type PromptNodeData = {
  onGenerated: (result: GenerateResponse) => void;
};

export type ResultNodeData = {
  result: GenerateResponse;
};
