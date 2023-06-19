/*
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
*/

import * as core from "@actions/core";
import * as github from "@actions/github";
import { SemVer, sortSemVer } from "./semver";
import { ConventionalCommitError, ICommit, getCommit, getConventionalCommit } from "@dev-build-deploy/commit-it";

/**
 * Retrieve GitHub Releases, sorted by SemVer
 * @returns List of releases
 */
async function getReleases() {
  const octokit = github.getOctokit(core.getInput("token"));

  const { data: releases } = await octokit.rest.repos.listReleases({ ...github.context.repo });
  return releases.sort((a: any, b: any) => sortSemVer(new SemVer(a.tag_name), new SemVer(b.tag_name)));
}

/**
 * Retrieve the commits since the provided tag
 * @param tag The tag to compare against
 * @returns List of commits
 */
async function getChangesSinceRelease(tag: string): Promise<ICommit[]> {
  const octokit = github.getOctokit(core.getInput("token"));

  const { data: commits } = await octokit.rest.repos.compareCommitsWithBasehead({
    ...github.context.repo,
    basehead: `refs/tags/${tag}...${github.context.sha}`,
  });

  return commits.commits.map(c => getCommit({ hash: c.sha, message: c.commit.message }));
}

/**
 * Determines the bump type based on the provided Conventional Commits
 * @param commits
 * @returns The bump type ("major", "minor", "patch" or undefined)
 * @internal
 */
export function determineBumpType(commits: ICommit[]): "major" | "minor" | "patch" | undefined {
  const typeCount: { [key: string]: number } = { feat: 0, fix: 0 };

  for (const commit of commits) {
    try {
      const conventionalCommit = getConventionalCommit(commit);
      if (conventionalCommit.breaking) return "major";
      typeCount[conventionalCommit.type]++;
    } catch (error) {
      if (!(error instanceof ConventionalCommitError)) throw error;
    }
  }

  if (typeCount.feat > 0) return "minor";
  if (typeCount.fix > 0) return "patch";

  return;
}

function createRelease(version: SemVer) {
  const octokit = github.getOctokit(core.getInput("token"));

  return octokit.rest.repos.createRelease({
    name: version.toString(),
    body: "ReleaseMe",
    draft: false,
    prerelease: version.preRelease !== undefined,
    make_latest: version.preRelease === undefined,
    generate_release_notes: false,
    discussion_category_name: undefined,
    tag_name: version.toString(),
    target_commitish: github.context.ref,
    ...github.context.repo,
  });
}

/**
 * Determines whether the current branch is the default branch.
 * @returns True if the current branch is the default branch, false otherwise
 */
function isDefaultBranch() {
  const currentBranch = github.context.ref.replace("refs/heads/", "");
  return currentBranch === github.context.payload.repository?.default_branch;
}

/**
 * Main entry point for the GitHub Action.
 * @internal
 */
export async function run(): Promise<void> {
  try {
    core.info("📄 ReleaseMe - GitHub Release Management");

    if (!isDefaultBranch()) {
      core.warning(`⚠️ Not on default branch, skipping...`);
      return;
    }

    core.startGroup("🔍 Retrieving GitHub Releases");
    const releases = await getReleases();
    if (releases.length === 0) {
      core.warning("⚠️ No releases found, skipping...");
      core.endGroup();
      return;
    }

    const latestRelease = releases[releases.length - 1];
    core.info(`ℹ️ Latest release: ${latestRelease.tag_name}`);
    const delta = await getChangesSinceRelease(latestRelease.tag_name);
    core.info(`ℹ️ Changes since latest release: ${delta.length} commits`);

    const bump = determineBumpType(delta);
    if (bump === undefined) {
      core.info("⚠️ No bump required, skipping...");
      core.endGroup();
      return;
    }
    core.endGroup();

    core.startGroup("📝 Creating GitHub Release");
    const newVersion = new SemVer(latestRelease.tag_name).bump(bump);
    core.info(`Next version will be: ${newVersion}`);
    await createRelease(newVersion);
    core.setOutput("new-version", newVersion);
    core.endGroup();
  } catch (ex) {
    core.setFailed((ex as Error).message);
  }
}