const { setGlobalDispatcher, ProxyAgent } = require('/opt/node22/lib/node_modules/undici');
if (process.env.https_proxy) {
  setGlobalDispatcher(new ProxyAgent(process.env.https_proxy));
}
