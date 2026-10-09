import zlib from "node:zlib";
import axios, { type AxiosInstance } from "axios";
import { ConflictError, NotFoundError } from "../errors/app-error.js";
import type { RepositoryConnectInput, RepositoryProvider } from "./repository-provider.js";
import type { RepositoryFile, RepositoryRecord, RepositorySnapshot } from "../types/repository-intelligence.js";

const GITHUB_URL_PATTERN = /^https:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?\/?$/i;

export class GitHubRepositoryProvider implements RepositoryProvider {
  readonly name = "github" as const;

  constructor(
    private readonly client: AxiosInstance = axios.create({ baseURL: "https://api.github.com", timeout: 15000 }),
    private readonly resolveCredential: (reference: string) => Promise<string | undefined> = async () => undefined
  ) {}

  private async getToken(repository?: RepositoryRecord | { credential_reference?: string; access_type?: string }): Promise<string | undefined> {
    if (repository?.credential_reference) {
      const resolved = await this.resolveCredential(repository.credential_reference);
      if (resolved) return resolved;
    }
    return process.env.GITHUB_TOKEN || undefined;
  }

  async connect(input: RepositoryConnectInput): Promise<RepositoryRecord> {
    const match = GITHUB_URL_PATTERN.exec(input.url);
    if (!match) {
      throw new ConflictError("Only valid GitHub repository URLs (https://github.com/owner/repo) are supported");
    }

    const owner = match[1];
    const repositoryName = match[2];

    const token = await this.getToken({ credential_reference: input.tokenReference, access_type: input.accessType });
    if (input.accessType === "private" && !token) {
      throw new ConflictError(
        "Private repository access requires GitHub credentials (configure GITHUB_TOKEN on the server or provide valid credentials)."
      );
    }

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(input.tokenReference ? { "x-archforge-token-reference": input.tokenReference } : {}),
    };

    try {
      const response = await this.client.get(`/repos/${owner}/${repositoryName}`, { headers });
      const data = response.data as {
        id: number;
        name: string;
        full_name: string;
        default_branch: string;
        private: boolean;
        html_url: string;
      };

      return {
        id: "",
        project_id: "",
        provider: "github",
        repository_url: data.html_url,
        repository_name: data.name,
        owner,
        default_branch: input.branch ?? data.default_branch,
        access_type: data.private ? "private" : "public",
        external_repository_id: String(data.id),
        credential_reference: input.tokenReference,
        connected_by: "",
        created_at: "",
        updated_at: "",
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new NotFoundError("GitHub repository not found or is inaccessible. Check the URL and repository permissions.");
        }
        if (error.response?.status === 403 || error.response?.status === 429) {
          const message = String(error.response?.data?.message || "");
          // If rate limited on a public repository, verify repository via Git info/refs
          if (input.accessType !== "private") {
            try {
              const refsUrl = `https://github.com/${owner}/${repositoryName}.git/info/refs?service=git-upload-pack`;
              const gitRefsRes = await axios.get(refsUrl, { responseType: "text", timeout: 8000 });
              if (gitRefsRes.status === 200) {
                return {
                  id: "",
                  project_id: "",
                  provider: "github",
                  repository_url: `https://github.com/${owner}/${repositoryName}`,
                  repository_name: repositoryName,
                  owner,
                  default_branch: input.branch || "main",
                  access_type: "public",
                  external_repository_id: `${owner}/${repositoryName}`,
                  credential_reference: input.tokenReference,
                  connected_by: "",
                  created_at: "",
                  updated_at: "",
                };
              }
            } catch {
              // Fall through to throw standard rate limit error
            }
          }
          if (message.toLowerCase().includes("rate limit")) {
            throw new ConflictError("GitHub API rate limit exceeded. Set GITHUB_TOKEN on the server for higher limits.");
          }
          throw new ConflictError(`GitHub API access forbidden: ${message || "Unauthorized"}`);
        }
      }
      throw error;
    }
  }

  async fetchSnapshot(repository: RepositoryRecord): Promise<RepositorySnapshot> {
    const match = GITHUB_URL_PATTERN.exec(repository.repository_url);
    if (!match) throw new ConflictError("Invalid GitHub repository URL");

    const owner = match[1];
    const name = match[2];
    const targetBranch = repository.default_branch || "main";
    const token = await this.getToken(repository);

    if (repository.access_type === "private" && !token) {
      throw new ConflictError("A server-side GitHub credential or GITHUB_TOKEN is required for private repositories");
    }

    // For public repositories, try in-memory codeload zipball first (single request, zero rate limits, all files complete)
    if (repository.access_type === "public") {
      try {
        const codeloadSnapshot = await this.fetchFromCodeload(owner, name, targetBranch);
        if (codeloadSnapshot.files.length > 0) {
          return {
            repository,
            commitSha: codeloadSnapshot.commitSha,
            files: codeloadSnapshot.files,
          };
        }
      } catch {
        // Fall back to standard REST API if codeload zipball is unavailable
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    // Fallback: Fetch recursive git tree
    let treeData: { sha: string; tree: Array<{ path: string; type: string; sha: string; size?: number }> };
    try {
      const treeResponse = await this.client.get(`/repos/${owner}/${name}/git/trees/${targetBranch}`, {
        params: { recursive: 1 },
        headers,
      });
      treeData = treeResponse.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new NotFoundError(`Branch '${targetBranch}' not found on repository ${owner}/${name}`);
        }
        if (error.response?.status === 403 || error.response?.status === 429) {
          const msg = error.response.data?.message;
          if (typeof msg === "string" && msg.toLowerCase().includes("rate limit")) {
            throw new ConflictError("GitHub API rate limit reached. Configure GITHUB_TOKEN on the ArchForge server for up to 5,000 requests/hour, or try again in a few minutes.");
          }
          throw new ConflictError(`GitHub API access forbidden: ${msg || "Unauthorized"}`);
        }
      }
      throw error;
    }

    const rawEntries = (treeData.tree || []).filter((entry) => entry.type === "blob");
    const nonIgnoredEntries = rawEntries.filter((entry) => !isIgnoredPath(entry.path));

    const isHighPriority = (p: string) => {
      const path = p.toLowerCase();
      return (
        path === "package.json" ||
        path.endsWith("/package.json") ||
        path === "package-lock.json" ||
        path.endsWith("/package-lock.json") ||
        path === "requirements.txt" ||
        path.endsWith("/requirements.txt") ||
        path === "pyproject.toml" ||
        path.endsWith("/pyproject.toml") ||
        path === "pom.xml" ||
        path.endsWith("/pom.xml") ||
        path === "build.gradle" ||
        path === "go.mod" ||
        path === "cargo.toml" ||
        path === "dockerfile" ||
        path.startsWith("dockerfile.") ||
        path.endsWith("/dockerfile") ||
        path.includes("docker-compose") ||
        path.includes("tsconfig") ||
        path.includes("vite.config") ||
        path.includes("next.config") ||
        path.includes(".env.example") ||
        path.includes(".env.sample") ||
        path.includes(".env.template") ||
        path.includes("schema.prisma") ||
        path.startsWith(".github/workflows/") ||
        /(^|\/)(server|app|index|main)\.(ts|js|jsx|tsx|py|go)$/i.test(path) ||
        /(^|\/)(routes?|routers?|controllers?|apis?|services?|handlers?)\.[a-z0-9]+$/i.test(path)
      );
    };

    const highPriorityEntries = nonIgnoredEntries.filter((e) => isHighPriority(e.path));
    const MAX_FILES_TO_FETCH = 50;
    const MAX_FILE_SIZE_BYTES = 500 * 1024;

    const filesToFetch = highPriorityEntries.slice(0, MAX_FILES_TO_FETCH);
    const filesToFetchSet = new Set(filesToFetch.map((e) => e.path));
    const files: RepositoryFile[] = [];

    const BATCH_SIZE = 5;
    for (let i = 0; i < filesToFetch.length; i += BATCH_SIZE) {
      const batch = filesToFetch.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (entry) => {
          if (entry.size && entry.size > MAX_FILE_SIZE_BYTES) {
            files.push({ path: entry.path, content: "", size: entry.size });
            return;
          }
          try {
            const fileRes = await this.client.get(`/repos/${owner}/${name}/contents/${entry.path}`, {
              params: { ref: targetBranch },
              headers,
            });
            const content = Buffer.from(String(fileRes.data?.content ?? ""), "base64").toString("utf8");
            files.push({ path: entry.path, content, size: entry.size });
          } catch {
            files.push({ path: entry.path, content: "", size: entry.size });
          }
        })
      );
    }

    for (const entry of nonIgnoredEntries) {
      if (!filesToFetchSet.has(entry.path)) {
        files.push({ path: entry.path, content: "", size: entry.size });
      }
    }

    return {
      repository,
      commitSha: String(treeData.sha || ""),
      files,
    };
  }

  async fetchFromCodeload(
    owner: string,
    name: string,
    branch: string
  ): Promise<{ commitSha: string; files: RepositoryFile[] }> {
    let commitSha = "";
    try {
      const infoRes = await axios.get(`https://github.com/${owner}/${name}.git/info/refs?service=git-upload-pack`, {
        responseType: "text",
        timeout: 10000,
      });
      const lines = String(infoRes.data || "").split("\n");
      for (const line of lines) {
        const match = new RegExp(`([0-9a-f]{40})\\s+(?:HEAD|refs/heads/${branch})`).exec(line);
        if (match) {
          commitSha = match[1];
          break;
        }
      }
    } catch {
      // Ignore if info/refs is unreachable
    }

    const zipRes = await axios.get(`https://codeload.github.com/${owner}/${name}/zip/refs/heads/${branch}`, {
      responseType: "arraybuffer",
      timeout: 45000,
    });

    const buf = Buffer.from(zipRes.data);
    let eocdOffset = -1;
    for (let i = buf.length - 22; i >= 0; i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) {
      throw new Error("Invalid ZIP archive format returned from repository host");
    }

    const cdCount = buf.readUInt16LE(eocdOffset + 10);
    const cdOffset = buf.readUInt32LE(eocdOffset + 16);
    let cur = cdOffset;
    const files: RepositoryFile[] = [];

    for (let i = 0; i < cdCount; i++) {
      if (buf.readUInt32LE(cur) !== 0x02014b50) break;
      const method = buf.readUInt16LE(cur + 10);
      const compSize = buf.readUInt32LE(cur + 20);
      const uncompSize = buf.readUInt32LE(cur + 24);
      const nameLen = buf.readUInt16LE(cur + 28);
      const extraLen = buf.readUInt16LE(cur + 30);
      const commentLen = buf.readUInt16LE(cur + 32);
      const localHdrOffset = buf.readUInt32LE(cur + 42);
      const rawName = buf.toString("utf8", cur + 46, cur + 46 + nameLen);
      cur += 46 + nameLen + extraLen + commentLen;

      if (rawName.endsWith("/")) continue;
      const rootSlash = rawName.indexOf("/");
      if (rootSlash === -1) continue;
      const cleanPath = rawName.slice(rootSlash + 1);

      if (!commitSha) {
        const rootFolder = rawName.slice(0, rootSlash);
        const shaMatch = /-([0-9a-f]{40})$/.exec(rootFolder);
        if (shaMatch) {
          commitSha = shaMatch[1];
        }
      }

      if (isIgnoredPath(cleanPath)) continue;

      let content = "";
      if (uncompSize <= 1024 * 1024) {
        const localNameLen = buf.readUInt16LE(localHdrOffset + 26);
        const localExtraLen = buf.readUInt16LE(localHdrOffset + 28);
        const dataStart = localHdrOffset + 30 + localNameLen + localExtraLen;
        const compressedData = buf.subarray(dataStart, dataStart + compSize);
        try {
          if (method === 8) {
            content = zlib.inflateRawSync(compressedData).toString("utf8");
          } else if (method === 0) {
            content = compressedData.toString("utf8");
          }
        } catch {
          content = "";
        }
      }

      files.push({ path: cleanPath, content, size: uncompSize });
    }

    return { commitSha, files };
  }
}

export function isIgnoredPath(path: string): boolean {
  if (/(^|\/)(\.git|node_modules|dist|build|coverage|\.next|\.nuxt|\.turbo|\.cache|vendor)(\/|$)/i.test(path)) {
    return true;
  }
  // Secrets and credentials: allow .env.example, .env.sample, .env.template, but NEVER real .env files
  if (/(^|\/)\.env(\.[a-zA-Z0-9_-]+)?$/i.test(path)) {
    return !/(^|\/)\.env\.(example|sample|template)$/i.test(path);
  }
  if (/(^|\/)(secrets?|credentials?)\.(json|ya?ml)$/i.test(path)) {
    return true;
  }
  return /\.(pem|key|crt|pfx|p12|id_rsa)$/i.test(path);
}