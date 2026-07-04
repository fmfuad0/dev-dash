import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Octokit } from '@octokit/rest';
import { toast } from './uiStore.js';

/**
 * Global GitHub/Git state store — persists across route navigation.
 */
export const useGitStore = create(
  persist(
    (set, get) => ({
      pat: '',
      user: null,
      repos: [],
      loading: false,
      activeTab: 'profile',
      selectedRepo: null,
      repoDetails: null,
      repoBranches: [],
      repoPRs: [],
      repoIssues: [],
      repoContents: [],
      currentRepoBranch: 'main',

      // Local Workspace State
      localIsRepo: false,
      localStaged: [],
      localUnstaged: [],
      localCommits: [],
      localBranches: [],
      localCurrentBranch: '',

      setPat: (pat) => {
        set({ pat });
        localStorage.setItem('github_pat', pat);
      },

      logout: () => {
        localStorage.removeItem('github_pat');
        set({ pat: '', user: null, repos: [], selectedRepo: null, repoDetails: null });
        toast.info('Logged out of GitHub');
      },

      setActiveTab: (tab) => set({ activeTab: tab }),

      loadProfile: async () => {
        const { pat } = get();
        if (!pat) return;
        set({ loading: true });
        try {
          const octokit = new Octokit({ auth: pat });
          const { data: userData } = await octokit.rest.users.getAuthenticated();
          const { data: reposData } = await octokit.rest.repos.listForAuthenticatedUser({
            sort: 'updated',
            per_page: 30,
          });
          set({ user: userData, repos: reposData, loading: false });
        } catch (err) {
          toast.error('GitHub auth failed — check your PAT');
          set({ user: null, loading: false });
        }
      },

      selectRepo: async (repo) => {
        if (!repo) { set({ selectedRepo: null, repoBranches: [], repoPRs: [], repoIssues: [], repoContents: [] }); return; }
        const { pat } = get();
        set({ selectedRepo: repo, loading: true });
        try {
          const octokit = new Octokit({ auth: pat });
          const owner = repo.owner.login;
          const repoName = repo.name;
          const branch = repo.default_branch || 'main';

          const [branches, prs, issues, treeResp] = await Promise.all([
            octokit.rest.repos.listBranches({ owner, repo: repoName }),
            octokit.rest.pulls.list({ owner, repo: repoName, state: 'open', per_page: 10 }).catch(() => ({ data: [] })),
            octokit.rest.issues.listForRepo({ owner, repo: repoName, state: 'open', per_page: 10 }).catch(() => ({ data: [] })),
            octokit.rest.git.getTree({ owner, repo: repoName, tree_sha: branch, recursive: '1' }).catch(() => ({ data: { tree: [] } })),
          ]);

          set({
            repoBranches: branches.data,
            repoPRs: prs.data,
            repoIssues: issues.data,
            repoContents: treeResp.data.tree || [],
            currentRepoBranch: branch,
            loading: false,
          });
        } catch (err) {
          toast.error('Failed to load repo details');
          set({ loading: false });
        }
      },

      openPublicRepo: async (repoInput) => {
        let owner = '';
        let repoName = '';
        
        try {
          // Parse github.com URL or owner/repo format
          let url = repoInput.trim();
          if (url.includes('github.com/')) {
            const parts = url.split('github.com/')[1].split('/');
            owner = parts[0];
            repoName = parts[1]?.replace('.git', '');
          } else if (url.includes('/')) {
            const parts = url.split('/');
            owner = parts[0];
            repoName = parts[1];
          } else {
            toast.error('Invalid format. Use owner/repo or a GitHub URL');
            return false;
          }
          
          if (!owner || !repoName) throw new Error('Missing owner or repo');

          const { pat } = get();
          set({ loading: true });
          const octokit = new Octokit(pat ? { auth: pat } : {});
          
          const { data: repoData } = await octokit.rest.repos.get({ owner, repo: repoName });
          await get().selectRepo(repoData);
          return true;
        } catch (err) {
          toast.error('Repository not found or API rate limit exceeded');
          set({ loading: false });
          return false;
        }
      },

      createIssue: async (title, body) => {
        const { pat, selectedRepo } = get();
        if (!selectedRepo) return;
        try {
          const octokit = new Octokit({ auth: pat });
          await octokit.rest.issues.create({
            owner: selectedRepo.owner.login,
            repo: selectedRepo.name,
            title,
            body,
          });
          toast.success('Issue created');
          get().selectRepo(selectedRepo);
        } catch (err) {
          toast.error('Failed to create issue');
        }
      },

      switchBranch: async (branch) => {
        const { pat, selectedRepo } = get();
        if (!selectedRepo) return;
        set({ loading: true, currentRepoBranch: branch });
        try {
          const octokit = new Octokit({ auth: pat });
          const owner = selectedRepo.owner.login;
          const repoName = selectedRepo.name;
          const treeResp = await octokit.rest.git.getTree({ owner, repo: repoName, tree_sha: branch, recursive: '1' }).catch(() => ({ data: { tree: [] } }));
          set({ repoContents: treeResp.data.tree || [], loading: false });
        } catch (err) {
          toast.error('Failed to switch branch');
          set({ loading: false });
        }
      },

      fetchFileContent: async (path) => {
        const { pat, selectedRepo, currentRepoBranch } = get();
        if (!selectedRepo) return null;
        try {
          const octokit = new Octokit({ auth: pat });
          const res = await octokit.rest.repos.getContent({ owner: selectedRepo.owner.login, repo: selectedRepo.name, path, ref: currentRepoBranch });
          if (res.data && res.data.download_url) {
            const raw = await fetch(res.data.download_url);
            const text = await raw.text();
            return { content: text, name: res.data.name, path: res.data.path, sha: res.data.sha, html_url: res.data.html_url, download_url: res.data.download_url };
          }
          return null;
        } catch (err) {
          toast.error('Failed to load file content');
          return null;
        }
      },

      fetchCommits: async () => {
        const { pat, selectedRepo, currentRepoBranch } = get();
        if (!selectedRepo) return [];
        try {
          const octokit = new Octokit({ auth: pat });
          const res = await octokit.rest.repos.listCommits({ owner: selectedRepo.owner.login, repo: selectedRepo.name, sha: currentRepoBranch, per_page: 20 });
          return res.data;
        } catch (err) {
          toast.error('Failed to load commits');
          return [];
        }
      },

      // ── Remote Operations (GitHub API) ──

      createRemoteBranch: async (newBranchName) => {
        const { pat, selectedRepo, currentRepoBranch } = get();
        if (!selectedRepo) return false;
        
        try {
          const octokit = new Octokit({ auth: pat });
          const owner = selectedRepo.owner.login;
          const repo = selectedRepo.name;

          // Get SHA of current branch
          const { data: refData } = await octokit.rest.git.getRef({
            owner,
            repo,
            ref: `heads/${currentRepoBranch}`
          });

          // Create new branch reference
          await octokit.rest.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${newBranchName}`,
            sha: refData.object.sha
          });

          toast.success(`Branch ${newBranchName} created!`);
          
          // Refresh branches and switch to it
          const { data: branches } = await octokit.rest.repos.listBranches({ owner, repo });
          set({ repoBranches: branches });
          await get().switchBranch(newBranchName);
          return true;
        } catch (err) {
          toast.error(err.response?.data?.message || 'Failed to create branch');
          return false;
        }
      },

      commitRemoteFile: async (path, content, message, sha) => {
        const { pat, selectedRepo, currentRepoBranch } = get();
        if (!selectedRepo) return false;

        try {
          const octokit = new Octokit({ auth: pat });
          
          // btoa requires ascii string, so we must safely encode unicode content to base64
          const utf8Bytes = new TextEncoder().encode(content);
          const base64Content = btoa(String.fromCharCode(...utf8Bytes));

          await octokit.rest.repos.createOrUpdateFileContents({
            owner: selectedRepo.owner.login,
            repo: selectedRepo.name,
            path,
            message,
            content: base64Content,
            sha, // Required if updating, undefined if creating new
            branch: currentRepoBranch
          });

          toast.success('Commit successful!');
          
          // Refresh repo contents to show the new/updated file
          await get().switchBranch(currentRepoBranch);
          return true;
        } catch (err) {
          toast.error(err.response?.data?.message || 'Commit failed');
          return false;
        }
      },

      // ── Local Workspace Actions ──

      loadLocalStatus: async (rootPath) => {
        if (!rootPath) return;
        try {
          const res = await api.get('/git/status', { params: { root: rootPath } });
          set({ localIsRepo: res.data.isRepo, localStaged: res.data.staged || [], localUnstaged: res.data.unstaged || [] });
        } catch { set({ localIsRepo: false }); }
      },

      loadLocalLog: async (rootPath) => {
        if (!rootPath) return;
        try {
          const res = await api.get('/git/log', { params: { root: rootPath } });
          set({ localCommits: res.data.commits || [] });
        } catch { set({ localCommits: [] }); }
      },

      loadLocalBranches: async (rootPath) => {
        if (!rootPath) return;
        try {
          const res = await api.get('/git/branches', { params: { root: rootPath } });
          set({ localBranches: res.data.branches || [], localCurrentBranch: res.data.current || '' });
        } catch { set({ localBranches: [], localCurrentBranch: '' }); }
      },

      localStage: async (rootPath, files) => {
        try {
          await api.post('/git/add', { root: rootPath, files });
          get().loadLocalStatus(rootPath);
        } catch (e) { toast.error(e.response?.data?.error || 'Failed to stage'); }
      },

      localUnstage: async (rootPath, files) => {
        try {
          await api.post('/git/restore', { root: rootPath, files });
          get().loadLocalStatus(rootPath);
        } catch (e) { toast.error(e.response?.data?.error || 'Failed to unstage'); }
      },

      localCommit: async (rootPath, message) => {
        try {
          await api.post('/git/commit', { root: rootPath, message });
          get().loadLocalStatus(rootPath);
          get().loadLocalLog(rootPath);
          toast.success('Committed successfully');
        } catch (e) { toast.error(e.response?.data?.error || 'Commit failed'); }
      },

      localBranchSwitch: async (rootPath, name, create = false) => {
        try {
          await api.post('/git/branch', { root: rootPath, name, create });
          get().loadLocalBranches(rootPath);
          get().loadLocalStatus(rootPath);
          get().loadLocalLog(rootPath);
          toast.success(create ? 'Branch created' : 'Switched branch');
        } catch (e) { toast.error(e.response?.data?.error || 'Branch operation failed'); }
      },

      localSync: async (rootPath, action) => {
        try {
          const res = await api.post(`/git/${action}`, { root: rootPath });
          get().loadLocalStatus(rootPath);
          get().loadLocalLog(rootPath);
          get().loadLocalBranches(rootPath);
          toast.success(res.data.message || `Git ${action} successful`);
        } catch (e) { toast.error(e.response?.data?.error || `Git ${action} failed`); }
      },

      localGetDiff: async (rootPath, file, staged = false) => {
        try {
          const res = await api.get('/git/diff', { params: { root: rootPath, file, staged } });
          return res.data.diff;
        } catch { return ''; }
      }
    }),
    {
      name: 'dcc-git',
      partialize: (s) => ({
        pat: s.pat,
        user: s.user,
        repos: s.repos,
        activeTab: s.activeTab,
        selectedRepo: s.selectedRepo,
      }),
    }
  )
);
