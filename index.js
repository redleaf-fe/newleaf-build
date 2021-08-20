const Koa = require("koa");
const Router = require("koa-router");
const Logger = require("koa-logger");
const BodyParser = require("koa-body");
const redis = require("redis");
const axios = require("axios");

const redisKey = require("./redisKey");
const config = require("./env.json");
const { getBusy } = require("./const");

function getIPAddress() {
  const interfaces = os.networkInterfaces();
  let address;
  Object.keys(interfaces).some((v) => {
    const iface = interfaces[v];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (
        alias.family === "IPv4" &&
        alias.address !== "127.0.0.1" &&
        !alias.internal
      ) {
        address = alias.address;
        return true;
      }
    }
    return false;
  });
  return address;
}

const IPAddr = getIPAddress();

async function main() {
  const app = new Koa();
  const router = new Router();

  // 跨域配置
  app.use(async (ctx, next) => {
    ctx.set("Access-Control-Allow-Origin", "*");
    ctx.set("Access-Control-Allow-Headers", "content-type");
    await next();
  });

  if (config.dev) {
    app.use(Logger());
  }

  app.use(BodyParser());

  require("./routes")(router);

  app.use(router.routes());
  app.use(router.allowedMethods());

  const port = config.serverPort || 3000;
  app.listen(port);

  const client = redis.createClient({
    host: config.redisHost,
    port: config.redisPort,
  });

  client.subscribe(redisKey.buildChannel);

  client.on("message", function (channel, value) {
    if (channel !== redisKey.buildChannel) {
      return;
    }
    const val = JSON.parse(value);
    const { id, appId, commit, appName } = val || {};

    // 判断打包结果是否已存在
    const zipPath = path.resolve(basePath, `${appName}-${commit}-dist.zip`);
    if (fs.existsSync(zipPath) || !getBusy()) {
      axios({
        url: `${config.centerServer}/publish/buildServer`,
        method: "post",
        headers: { "Content-Type": "application/json" },
        data: {
          id,
          appId,
          commit,
          appName,
          addr: `http://${IPAddr}:${config.serverPort}`,
        },
      });
    }
  });
}

main();
