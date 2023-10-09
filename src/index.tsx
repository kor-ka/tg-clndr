import { createRoot } from "react-dom/client";
import "./index.css";
import { SessionModel } from "./model/SessionModel";
import { VM } from "./utils/vm/VM";
import { Event } from "./shared/entity"

const tryInit = () => {
  const wa = (window as any).Telegram?.WebApp
  if (!wa) {
    return false
  }
  let { initData, initDataUnsafe, ready } = wa
  ready();

  const model = new SessionModel(
    { initData, initDataUnsafe }
  );


  import('./view/MainScreen').then(({ renderApp }) => {

    const onEvents = (e: Map<string, VM<Event>>) => {
      if (model.loaded) {
        model.eventsModule.events.unsubscribe(onEvents)
        root.render(renderApp(model))
      }
    }
    model.eventsModule.events.subscribe(onEvents);
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