export type RedesignDb = {
  $transaction<T>(fn: (tx: RedesignTx) => Promise<T>, options?: unknown): Promise<T>;
};

export type RedesignTx = Record<string, any>;

export type VersionState = {
  id: string;
  revision: number;
  publishedAt: Date | null;
};

export type TopicSnapshotInput = {
  topicVersionId: string;
  sequence: number;
};

export type LearningModuleVersionDraft = {
  title: string;
  description?: string | null;
  studentDescription?: string | null;
  learningObjectives?: string[];
  notes?: string | null;
  defaultSequence?: number | null;
  changeSummary?: string | null;
  topics?: TopicSnapshotInput[];
};

export type TopicVersionDraft = {
  title: string;
  category?: string | null;
  description?: string | null;
  changeSummary?: string | null;
};
