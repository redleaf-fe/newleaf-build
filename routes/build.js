const Router = require("koa-router");
const simpleGit = require("simple-git");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios");
const AdmZip = require("adm-zip");

const config = require("../env.json");

const router = new Router();

function buildRes({ id, result }) {
  axios({
    url: `${config.centerServer}/publish/buildResult`,
    method: "post",
    headers: { "Content-Type": "application/json" },
    data: {
      id,
      result,
    },
  });
}

router.post("/build", async (ctx) => {
  const { appName, gitPath, commit, id, scpPath } = ctx.request.body;

  const basePath = path.resolve(config.appDir);
  const appPath = path.resolve(config.appDir, appName);
  const logPath = path.resolve(basePath, `${appName}-${commit}.log`);
  const appDistPath = path.resolve(appPath, "dist");
  // const appZipPath = path.resolve(appPath, `${appName}-${commit}-dist.zip`);
  const baseZipPath = path.resolve(basePath, `${appName}-${commit}-dist.zip`);

  function transfer() {
    exec(`scp -r ${baseZipPath} ${scpPath}`, (err2) => {
      if (err2) {
        buildRes({ id, result: "fail" });
        fs.writeFileSync(logPath, JSON.stringify(err2), { flag: "a" });
      } else {
        buildRes({ id, result: "success" });
      }
    });
  }

  if (fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }

  // 已有打包目录，认为打包过，直接读取
  if (fs.existsSync(baseZipPath)) {
    ctx.body = { id, cached: true };
    transfer();
    return;
  }

  try {
    // 已存在工程目录，直接拉取
    if (fs.existsSync(appPath)) {
      const git = simpleGit({ baseDir: appPath, binary: "git" });
      await git.checkout("master");
      await git.pull();
      await git.checkout(commit);
    } else {
      // 工程目录不存在，clone
      const git = simpleGit({ baseDir: basePath, binary: "git" });
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
    `yarn && yarn build > ${logPath}`,
    {
      cwd: appPath,
    },
    (err) => {
      if (err) {
        buildRes({ id, result: "fail" });
        fs.writeFileSync(logPath, JSON.stringify(err), { flag: "a" });
      } else {
        // TODO：压缩文件可改为异步
        const zip = new AdmZip();
        zip.addLocalFolder(appDistPath);
        zip.writeZip(baseZipPath);

        transfer();
      }
    }
  );
});

router.get("/output", async (ctx) => {
  const { appName, commit } = ctx.request.query;
  const logPath = path.resolve(config.appDir, `${appName}-${commit}.log`);

  if (fs.existsSync(logPath)) {
    ctx.body = fs.createReadStream(logPath);
  } else {
    ctx.body = "";
  }
});

module.exports = router.routes();
