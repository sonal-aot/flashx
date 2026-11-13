import { describe, it, expect, vi, beforeEach } from 'vitest';

// Background generation: survives the popup closing, and reopens the popup only on the
// job's own Jira tab, only for an unseen finished result.

vi.mock('../src/features/branch-generator/branchGenerator', () => ({
  BranchGenerator: {
    generate: vi.fn(async () => ({ recommended: 'feat/proj-1-x', alternatives: [], reason: 'r' })),
  },
}));

const session: Record<string, unknown> = {};
const listeners: { message?: Function; activated?: Function } = {};
const state = { activeTabId: 7, popupOpen: false };
const openPopup = vi.fn(async () => {});

const c = (globalThis as any).chrome;
c.storage.session = {
  get: async (key: string | null) => (key === null ? { ...session } : { [key]: session[key] }),
  set: async (items: Record<string, unknown>) => void Object.assign(session, items),
};
c.runtime.onInstalled = { addListener: () => {} };
c.runtime.onMessage = { addListener: (fn: Function) => (listeners.message = fn) };
c.runtime.getPlatformInfo = async () => ({});
c.runtime.ContextType = { POPUP: 'POPUP' };
c.runtime.getContexts = async () => (state.popupOpen ? [{}] : []);
c.tabs.onActivated = { addListener: (fn: Function) => (listeners.activated = fn) };
c.tabs.query = async () => [{ id: state.activeTabId, windowId: 1 }];
c.action = { openPopup };

await import('../src/background/index');
const { getJob } = await import('../src/features/branch-generator/generationJobs');

const issue = { key: 'PROJ-1', title: 't', issueType: 'Task', projectKey: 'PROJ', url: '', detectedAt: 0 };
const generate = async (tabId: number) => {
  listeners.message!({ type: 'FLASHX_GENERATE_BRANCH', issue, tabId }, {}, () => {});
  await vi.waitFor(async () => expect((await getJob('PROJ-1'))?.status).toBe('done'));
};

describe('background generation jobs', () => {
  beforeEach(() => {
    for (const k of Object.keys(session)) delete session[k];
    openPopup.mockClear();
    state.popupOpen = false;
    state.activeTabId = 7;
  });

  it('reopens the popup when the result lands while its Jira tab is active', async () => {
    await generate(7);
    expect(openPopup).toHaveBeenCalledTimes(1);
    expect((await getJob('PROJ-1'))?.result?.recommended).toBe('feat/proj-1-x');
  });

  it('waits on other tabs, then reopens when the user returns to the Jira tab', async () => {
    state.activeTabId = 99; // user moved to an unrelated site
    await generate(7);
    expect(openPopup).not.toHaveBeenCalled();

    await listeners.activated!({ tabId: 99 });
    expect(openPopup).not.toHaveBeenCalled();

    state.activeTabId = 7;
    await listeners.activated!({ tabId: 7 });
    expect(openPopup).toHaveBeenCalledTimes(1);
  });

  it('does not reopen when the popup is already open or the result was seen', async () => {
    state.popupOpen = true;
    await generate(7);
    expect(openPopup).not.toHaveBeenCalled();

    state.popupOpen = false;
    session['job_PROJ-1'] = { ...(session['job_PROJ-1'] as object), seen: true };
    await listeners.activated!({ tabId: 7 });
    expect(openPopup).not.toHaveBeenCalled();
  });
});
