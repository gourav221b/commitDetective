# **App Name**: CommitDetective

## Core Features:

- Input Form: Input fields for GitHub token, repository (owner/repo), and pull request number.
- GitHub Data Retrieval: Fetch commit data from GitHub using the Octokit SDK. Handle pagination to retrieve all commits. Use AI tool to reason and extract key events such as squashes, rebases, and force pushes.
- Commit Lineage Analysis: Analyze commit history to identify the lineage of the commits that landed in the pull request using a generative AI tool to reason over the output. Trace back squashed commits, rebased commits and force pushed commits using git history and Github API .
- LTC Calculation: Calculates Lead Time for Changes (LTC) DORA metric. Uses AI reasoning to find the moment when code was 'code complete'.
- Visualization of Commits path: Display the full traceability path of the commits in a visualized format to illustrate commit lineage (the relationships between a base commit and all other commits leading to a pull request) in an interactive graph.
- Display of LTC: Display calculated Lead Time for Changes (LTC) clearly.

## Style Guidelines:

- Primary color: Deep Indigo (#4B0082) to represent technical precision and insight.
- Background color: Very light gray (#F5F5F5) to provide a clean and neutral backdrop.
- Accent color: Teal (#008080) to highlight important data points and interactive elements.
- Font pairing: 'Space Grotesk' (sans-serif) for headings, 'Inter' (sans-serif) for body text.
- Code Font: 'Source Code Pro' (monospace) to represent code
- Use simple, clear icons to represent different commit actions (squash, rebase, merge).
- A clean, modular layout with a focus on readability and clear information hierarchy.