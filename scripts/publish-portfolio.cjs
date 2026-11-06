#!/usr/bin/env node
// Applies the prepared, reviewable English metadata through an authenticated gh
// session. Credentials are handled by gh; this script never reads token values.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const metadata = JSON.parse(
  fs.readFileSync(
    path.join(root, "docs/portfolio/github-metadata.json"),
    "utf8",
  ),
);
function gh(args, input) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    input,
    shell: false,
  });
  if (result.error?.code === "ENOENT")
    throw new Error(
      "Install the official GitHub CLI (gh) and run gh auth login first.",
    );
  if (result.status !== 0)
    throw new Error(result.stderr?.trim() || "GitHub request failed.");
  return result.stdout;
}
try {
  const login = gh(["api", "user", "--jq", ".login"]).trim();
  if (login.toLowerCase() !== metadata.owner.toLowerCase())
    throw new Error(
      "The authenticated account does not match the project owner. No changes were made.",
    );
  gh(
    [
      "api",
      `repos/${metadata.owner}/${metadata.repository}`,
      "--method",
      "PATCH",
      "--input",
      "-",
    ],
    JSON.stringify({ description: metadata.description }),
  );
  gh(
    [
      "api",
      `repos/${metadata.owner}/${metadata.repository}/topics`,
      "--method",
      "PUT",
      "--input",
      "-",
    ],
    JSON.stringify({ names: metadata.topics }),
  );
  gh(
    ["api", "user", "--method", "PATCH", "--input", "-"],
    JSON.stringify({ bio: metadata.profileBio }),
  );
  const profileRepo = `${metadata.owner}/${metadata.owner}`;
  const listed = JSON.parse(
    gh([
      "api",
      "user/repos",
      "--method",
      "GET",
      "-f",
      "affiliation=owner",
      "-f",
      "per_page=100",
      "--paginate",
      "--slurp",
    ]),
  ).flat();
  let created = false;
  if (
    !listed.some(
      (repo) => repo.full_name.toLowerCase() === profileRepo.toLowerCase(),
    )
  ) {
    gh(
      ["api", "user/repos", "--method", "POST", "--input", "-"],
      JSON.stringify({
        name: metadata.owner,
        description:
          "Mobile products, real-world workflows, and AI-assisted product delivery.",
        private: false,
      }),
    );
    created = true;
  }
  // Preserve an existing profile README. An existing file requires a deliberate
  // merge by its owner rather than a blind replacement of their profile.
  let profileFiles = [];
  if (!created) {
    try {
      profileFiles = JSON.parse(gh(["api", `repos/${profileRepo}/contents`]));
    } catch (error) {
      if (!/repository is empty/i.test(error.message)) throw error;
    }
  }
  if (
    Array.isArray(profileFiles) &&
    profileFiles.some((file) => file.name.toLowerCase() === "readme.md")
  ) {
    console.log(
      "Existing profile README preserved. Merge docs/PROFILE-README.md if you want to update it.",
    );
  } else {
    const content = fs
      .readFileSync(path.join(root, "docs/PROFILE-README.md"))
      .toString("base64");
    gh(
      [
        "api",
        `repos/${profileRepo}/contents/README.md`,
        "--method",
        "PUT",
        "--input",
        "-",
      ],
      JSON.stringify({
        message: "Add English product portfolio introduction",
        content,
      }),
    );
  }
  console.log(
    "Repository description, topics, and profile bio updated in English.",
  );
  console.log(
    "Feature the project using Customize your pins on your GitHub profile. Pinning is not automated by this script.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
