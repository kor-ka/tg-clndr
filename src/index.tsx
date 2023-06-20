import { createRoot } from "react-dom/client";
import "./index.css";
import { SessionModel } from "./model/SessionModel";
import reportWebVitals from "./reportWebVitals";
import { VM } from "./utils/vm/VM";
import { Event } from "./shared/entity"

const tryInit = () => {
  const wa = (window as any).Telegram?.WebApp
  if (!wa) {
    return false
  }
  let { initData, initDataUnsafe, ready } = wa
  ready();

  wa.MainButton.setParams({ is_active: false, is_visible: true, text: "ADD EVENT" })

  const model = new SessionModel(
    { initData, initDataUnsafe }
  );


  import('./view/MainScreen').then(({ renderApp }) => {

    const onEvents = (e: Map<string, VM<Event>>) => {
      // TODO: fix - detect not loaded yet, not empty sate
      if (e.size != 0) {
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
  if (!tryInit()) {
    const interval = setInterval(() => {
      if (tryInit()) {
        clearInterval(interval)
      }
    }, 10)
  }
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
