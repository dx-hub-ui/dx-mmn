const path = require("path");
const fs = require("fs");

const DEFAULT_RELEASE = "local";

function getRelease() {
  return (
    process.env.SENTRY_RELEASE ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    readGitHeadSha() ||
    DEFAULT_RELEASE
  );
}

function readGitHeadSha() {
  try {
    const gitDir = path.join(__dirname, "../../.git");
    const headPath = path.join(gitDir, "HEAD");
    const head = fs.readFileSync(headPath, "utf8").trim();

    if (head.startsWith("ref:")) {
      const refPath = head.split(" ")[1];
      const refFullPath = path.join(gitDir, refPath);
      return fs.readFileSync(refFullPath, "utf8").trim();
    }

    return head;
  } catch (error) {
    return null;
  }
}

module.exports = {
  getRelease,
};
