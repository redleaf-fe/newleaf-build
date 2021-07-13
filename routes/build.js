const Router = require("koa-router");
const simpleGit = require("simple-git");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios");

const config = require("../env.json");

const router = new Router();

router.post("/build", async (ctx) => {
  const { appName, gitPath, commit, id } = ctx.request.body;

  const appDir = path.resolve(config.appDir, appName);

  try {
    if (fs.existsSync(appDir)) {
      const git = simpleGit({
        baseDir: appDir,
        binary: "git",
      });
      await git.checkout("master");
      await git.pull();
      await git.checkout(commit);
    } else {
      const git = simpleGit({
        baseDir: path.resolve(config.appDir),
        binary: "git",
      });
      await git.clone(gitPath);
      await git.checkout(commit);
    }
  } catch (e) {
    ctx.body = { message: e.message };
    return;
  }

  exec(
    `npm run build > 1.txt`,
    {
      cwd: "/Users/jiaoyu/Documents/test/rc-build", // appDir
    },
    async (err) => {
      const param = { id };
      if (err) {
        param.result = "fail";
      } else {
        param.result = "success";
      }

      await axios({
        url: `${config.centerServer}/publish/buildResult`,
        method: "post",
        headers: { "Content-Type": "application/json" },
        data: param,
      });
    }
  );

  ctx.body = { id };
});

router.post("/output", async (ctx) => {
  const { path, branch, commit } = ctx.request.body;

  ctx.body = 'ok';
});

module.exports = router.routes();
