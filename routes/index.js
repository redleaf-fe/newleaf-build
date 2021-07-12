module.exports = (router) => {
  router.use("/build", require("./build"));
  router.use("/publish", require("./publish"));
};
