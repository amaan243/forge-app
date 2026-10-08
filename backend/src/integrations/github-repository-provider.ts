import axios, { type AxiosInstance } from "axios";
import { ConflictError } from "../errors/app-error.js";
import type { RepositoryConnectInput, RepositoryProvider } from "./repository-provider.js";
import type { RepositoryFile, RepositoryRecord, RepositorySnapshot } from "../types/repository-intelligence.js";

const githubUrl = /^https:\/\/github\.com\/([^/]+)\/([^/#]+?)(?:\.git)?(?:#(.+))?\/?$/i;
export class GitHubRepositoryProvider implements RepositoryProvider {
  readonly name = "github" as const;
  constructor(private readonly client: AxiosInstance = axios.create({ baseURL: "https://api.github.com", timeout: 15000 }), private readonly resolveCredential: (reference: string) => Promise<string | undefined> = async () => undefined) {}
  async connect(input: RepositoryConnectInput): Promise<RepositoryRecord> {
    const match = githubUrl.exec(input.url); if (!match) throw new ConflictError("Only valid GitHub repository URLs are supported");
    const owner = match[1]; const repositoryName = match[2]; const response = await this.client.get(`/repos/${owner}/${repositoryName}`, { headers: { ...(input.tokenReference ? { "x-archforge-token-reference": input.tokenReference } : {}) } });
    const data = response.data as { id: number; name: string; full_name: string; default_branch: string; private: boolean; html_url: string };
    return { id: "", project_id: "", provider: "github", repository_url: data.html_url, repository_name: data.name, owner, default_branch: input.branch ?? data.default_branch, access_type: data.private ? "private" : "public", external_repository_id: String(data.id), credential_reference: input.tokenReference, connected_by: "" , created_at: "", updated_at: "" };
  }
  async fetchSnapshot(repository: RepositoryRecord): Promise<RepositorySnapshot> {
    const match = githubUrl.exec(repository.repository_url); if (!match) throw new ConflictError("Invalid GitHub repository URL");
    const owner = match[1]; const name = match[2]; const token = repository.credential_reference ? await this.resolveCredential(repository.credential_reference) : undefined; if (repository.access_type === "private" && !token) throw new ConflictError("A server-side GitHub credential resolver is required for private repositories"); const headers = token ? { Authorization: `Bearer ${token}` } : undefined; const tree = await this.client.get(`/repos/${owner}/${name}/git/trees/${repository.default_branch}`, { params: { recursive: 1 }, headers });
    const entries = (tree.data.tree as Array<{ path: string; type: string; sha: string }>).filter((entry) => entry.type === "blob");
    const files: RepositoryFile[] = [];
    for (const entry of entries) { if (isIgnoredPath(entry.path)) continue; const file = await this.client.get(`/repos/${owner}/${name}/contents/${entry.path}`, { params: { ref: repository.default_branch }, headers }); const content = Buffer.from(String(file.data.content ?? ""), "base64").toString("utf8"); files.push({ path: entry.path, content }); }
    return { repository, commitSha: String(tree.data.sha), files };
  }
}
export function isIgnoredPath(path: string): boolean { return /(^|\/)(\.git|node_modules|dist|build|coverage)(\/|$)|(^|\/)(\.env|\.env\.[^/]+)$|\.(pem|key|crt)$/i.test(path); }