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

  if (fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  // 已有打包目录，认为打包过，直接读取
  if (fs.existsSync(path.resolve(baseDir, appName + "-" + commit + "-dist"))) {
    ctx.body = { id, cached: true };
    await axios({
      url: `${config.centerServer}/publish/buildResult`,
      method: "post",
      headers: { "Content-Type": "application/json" },
      data: {
        id,
        result: "success",
      },
    });
    return;
  }

  try {
    // 已存在工程目录，直接拉取
    if (fs.existsSync(appDir)) {
      const git = simpleGit({
        baseDir: appDir,
        binary: "git",
      });
      await git.checkout("master");
      await git.pull();
      await git.checkout(commit);
    } else {
      // 工程目录不存在，clone
      const git = simpleGit({
        baseDir,
        binary: "git",
      });
      await git.clone(gitPath);
      await git.checkout(commit);
    }
  } catch (e) {
    ctx.status = 500;
    ctx.body = { message: e.message };
    return;
  }

  ctx.body = { id };

  // 打包
  exec(
    `npm run install && npm run build > ${path.resolve(
      baseDir,
      appName + "-" + commit
    )}.log`,
    {
      cwd: appDir,
    },
    async (err) => {
      const param = { id };
      if (err) {
        param.result = "fail";
        const ws = fs.createWriteStream(
          path.resolve(baseDir, `${appName}-${commit}.log`)
        );
        ws.write(err.message);
        ws.end();
      } else {
        param.result = "success";
      }

      await axios({
        url: `${config.centerServer}/publish/buildResult`,
        method: "post",
        headers: { "Content-Type": "application/json" },
        data: param,
      });

      // 拷贝结果
      !err &&
        exec(
          `cp -r ${path.resolve(appDir, "dist")} ${path.resolve(
            baseDir
          )} && mv ${path.resolve(baseDir, "dist")} ${path.resolve(
            baseDir,
            appName + "-" + commit + "-dist"
          )}`,
          {
            cwd: baseDir,
          }
        );
    }
  );
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
