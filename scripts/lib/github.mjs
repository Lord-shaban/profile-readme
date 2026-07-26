/**
 * Minimal GitHub API client — no dependencies, just fetch.
 *
 * Reads GITHUB_TOKEN from the environment. Inside Actions that is the
 * automatic token; locally, `gh auth token` will produce one.
 */

export const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

/**
 * Callers that need authentication ask for it explicitly. Exiting at import
 * time instead would take down the checks that are perfectly able to run
 * without a token.
 */
export function requireToken() {
  if (TOKEN) return TOKEN;
  console.error('GITHUB_TOKEN is not set. Locally: $env:GITHUB_TOKEN = (gh auth token)');
  process.exit(1);
}

const headers = {
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  Accept: 'application/vnd.github+json',
  'User-Agent': 'profile-readme-builder',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A transport-level failure — worth retrying, unlike a 4xx. */
const isTransportError = (error) =>
  error.retryable || error.name === 'TimeoutError' || error.name === 'AbortError' || Boolean(error.cause);

/**
 * `fetch` with exponential backoff on transport failures and 5xx/429.
 *
 * Scheduled builds are unattended, and api.github.com refusing a single
 * connection is not a reason to fail the run or leave assets half-written.
 */
export async function request(url, { attempts = 4, timeout = 20_000, ...init } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(url, { ...init, headers: { ...headers, ...init.headers }, signal: AbortSignal.timeout(timeout) });
      if (res.status >= 500 || res.status === 429) {
        throw Object.assign(new Error(`HTTP ${res.status}`), { retryable: true });
      }
      return res;
    } catch (error) {
      lastError = error;
      if (!isTransportError(error) || attempt === attempts) break;

      const backoff = 2 ** (attempt - 1) * 1000;
      console.warn(`  ${new URL(url).host}: ${error.message} — retrying in ${backoff / 1000}s (${attempt}/${attempts - 1})`);
      await sleep(backoff);
    }
  }

  throw lastError;
}

/** POST a GraphQL query and return `data`, throwing on any GraphQL error. */
export async function graphql(query, variables = {}) {
  requireToken();

  const res = await request('https://api.github.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);

  const payload = await res.json();
  if (payload.errors?.length) {
    throw new Error(`GraphQL: ${payload.errors.map((e) => e.message).join('; ')}`);
  }
  return payload.data;
}

/**
 * Everything the generators need about a user, in one round trip:
 * profile counts, this year's contributions, and every source repository.
 */
export async function fetchProfile(login) {
  const data = await graphql(
    `query($login: String!) {
      user(login: $login) {
        name
        followers { totalCount }
        contributionsCollection {
          totalCommitContributions
          restrictedContributionsCount
          totalPullRequestContributions
          totalIssueContributions
          contributionCalendar { totalContributions }
        }
        repositories(
          first: 100
          ownerAffiliations: OWNER
          isFork: false
          orderBy: { field: STARGAZERS, direction: DESC }
        ) {
          totalCount
          nodes {
            name
            description
            stargazerCount
            forkCount
            url
            primaryLanguage { name }
            languages(first: 8, orderBy: { field: SIZE, direction: DESC }) {
              edges { size node { name } }
            }
          }
        }
      }
    }`,
    { login },
  );

  const user = data.user;
  if (!user) throw new Error(`No such GitHub user: ${login}`);

  const repos = user.repositories.nodes;
  const contrib = user.contributionsCollection;

  // Aggregate bytes-per-language across every source repo, so the language
  // split reflects what was actually written rather than repo count.
  const bytes = new Map();
  for (const repo of repos) {
    for (const edge of repo.languages.edges) {
      bytes.set(edge.node.name, (bytes.get(edge.node.name) ?? 0) + edge.size);
    }
  }
  const totalBytes = [...bytes.values()].reduce((a, b) => a + b, 0);
  const languages = [...bytes.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, size]) => ({ name, share: totalBytes ? size / totalBytes : 0 }));

  return {
    login,
    name: user.name ?? login,
    followers: user.followers.totalCount,
    repoCount: user.repositories.totalCount,
    stars: repos.reduce((sum, r) => sum + r.stargazerCount, 0),
    forks: repos.reduce((sum, r) => sum + r.forkCount, 0),
    commits: contrib.totalCommitContributions + contrib.restrictedContributionsCount,
    pullRequests: contrib.totalPullRequestContributions,
    issues: contrib.totalIssueContributions,
    contributions: contrib.contributionCalendar.totalContributions,
    repos,
    languages,
  };
}

/** Index repositories by lowercased name for easy lookup by the card builder. */
export function indexRepos(repos) {
  return new Map(repos.map((r) => [r.name.toLowerCase(), r]));
}
