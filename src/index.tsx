import { createRoot } from "react-dom/client";
import "./index.css";
import { SessionModel } from "./model/SessionModel";
import { PremountController as MainButtonPremountController } from "./view/uikit/tg/MainButtonPreMount";

const tryInit = () => {
  const wa = (window as any).Telegram?.WebApp
  if (!wa) {
    return false
  }
  let { initData, initDataUnsafe, ready } = wa

  MainButtonPremountController.INSTANCE.init()
  wa.MainButton.setParams({ is_active: true, is_visible: true, text: "ADD EVENT" })

  ready();

  const model = new SessionModel(
    { initData, initDataUnsafe }
  );


  import('./view/App').then(({ renderApp }) => {
    model.ready.promise.then(() => {
      root.render(renderApp(model))
    })
  })

  return true
}
const root = createRoot(document.getElementById("root")!);
if (window.location.pathname.startsWith("/tg/")) {
  const interval = setInterval(() => {
    if (tryInit()) {
      clearInterval(interval)
    }
  }, 10)
}