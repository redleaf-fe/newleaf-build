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

  const baseDir = path.resolve(config.appDir);
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
        baseDir,
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
    `npm run build > ${path.resolve(baseDir, appName + "-" + commit)}.log`,
    {
      cwd: appDir,
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

router.get("/output", async (ctx) => {
  const { appName, commit } = ctx.request.query;
  const logDir = path.resolve(config.appDir, `${appName}-${commit}.log`);

  if (fs.existsSync(logDir)) {
    ctx.body = fs.createReadStream(logDir);
  } else {
    ctx.body = "";
  }
});

module.exports = router.routes();
