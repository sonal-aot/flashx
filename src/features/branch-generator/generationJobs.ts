import { BranchGenerationResult } from '../../types/ai';

/**
 * A branch generation runs in the background service worker so it survives the popup
 * closing (Chrome closes action popups on any focus change). State lives in
 * chrome.storage.session: shared by worker and popup, cleared when the browser exits.
 */
export interface GenerationJob {
  issueKey: string;
  tabId?: number;
  status: 'running' | 'done' | 'error';
  result?: BranchGenerationResult;
  error?: string;
  /** False until the popup has shown a finished job; drives the reopen-on-return behavior. */
  seen: boolean;
  updatedAt: number;
}

export const GENERATE_MESSAGE = 'FLASHX_GENERATE_BRANCH';
export const jobStorageKey = (issueKey: string) => `job_${issueKey}`;

export async function getJob(issueKey: string): Promise<GenerationJob | null> {
  const key = jobStorageKey(issueKey);
  const data = await chrome.storage.session.get(key);
  return (data[key] as GenerationJob | undefined) ?? null;
}

export async function saveJob(job: GenerationJob): Promise<void> {
  await chrome.storage.session.set({ [jobStorageKey(job.issueKey)]: job });
}

export async function findUnseenJobForTab(tabId: number): Promise<GenerationJob | null> {
  const all = await chrome.storage.session.get(null);
  const jobs = Object.values(all) as GenerationJob[];
  return jobs.find((j) => j?.tabId === tabId && j.status !== 'running' && !j.seen) ?? null;
}
