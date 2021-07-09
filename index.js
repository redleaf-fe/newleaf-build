const Koa = require('koa');
const Router = require('koa-router');
const Logger = require('koa-logger');
const BodyParser = require('koa-body');

const config = require('./env.json');

async function main() {

  const app = new Koa();
  const router = new Router();

  // 跨域配置
  app.use(async (ctx, next) => {
    ctx.set('Access-Control-Allow-Origin', '*');
    ctx.set('Access-Control-Allow-Headers', 'content-type');
    await next();
  });

  if(config.dev){
    app.use(Logger());
  }
  
  app.use(BodyParser());

  require('./routes')(router);

  app.use(router.routes());
  app.use(router.allowedMethods());

  const port = config.serverPort || 3000;
  app.listen(port);
}

main();
