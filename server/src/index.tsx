import "./instrument";
// lig bug workaround
import * as TB from "node-telegram-bot-api";
import "dotenv/config"
import "reflect-metadata";
import cookieParser from "cookie-parser";
import compression from "compression";
import express from "express";
import { Server } from "socket.io";
import * as ReactDOMServer from "react-dom/server";
import { createServer } from "http";
import { TelegramBot } from "./api/tg/tg";
import { SocketApi } from "./api/socket";
import { container } from "tsyringe";
import * as fs from "fs";
import { initMDB } from "./utils/MDB";
import { SplitAvailableContext, TimezoneContext, UserContext, UsersProviderContext } from "../../src/view/App";
import { MainScreenView } from "../../src/view/MainScreen";
import { Event } from "../../src/shared/entity";
import { EventsModule } from "./modules/eventsModule/EventsModule";
import { savedEventsToApiLight, savedUsersToApi } from "./api/ClientAPI";
import { UsersModule as UsersClientModule } from "../../src/model/UsersModule";
import { UserModule } from "./modules/userModule/UserModule";
import { VM } from "../../src/utils/vm/VM";
import { ChatMetaModule } from "./modules/chatMetaModule/ChatMetaModule";
import { ICSModule } from "./modules/icsModule/ICSModule";
import { checkChatToken } from "./api/Auth";
import cors from "cors";
import { SW } from "./utils/stopwatch";
import { mesure } from "./utils/mesure";
import { SavedUser } from "./modules/userModule/userStore";

var path = require("path");
const PORT = process.env.PORT || 5001;

const SPLIT_DOMAIN = 'https://tg-split.herokuapp.com';

export const appRoot = path.resolve(__dirname);

const indexFilePath = path.resolve(__dirname + "/../../../../build/index.html");

const getIndexStr = () => {
  return new Promise<string>((resolve, reject) => {
    fs.readFile(indexFilePath, "utf8", (err, data) => {
      if (err) {
        reject(data);
      } else {
        resolve(data);
      }
    });
  });
};
// index file for SSR
let _indexFileStrPromise: Promise<string> | undefined;
let _indexFileStr: string | undefined;

const getIndexStrCachedPromise = () => {
  if (!_indexFileStrPromise) {
    _indexFileStrPromise = getIndexStr()
      .then(s => {
        _indexFileStr = s;
        return s;
      })
      .catch((e) => {
        _indexFileStrPromise = undefined;
        throw e;
      });
  }
  return _indexFileStrPromise;
};

// init early - would be needed anyway
getIndexStrCachedPromise().catch(e => console.error(e));

// TODO: ref mdb access to async (how to resolve async chains?)
// MDB is accessed statically
initMDB().then(() => {
  let app = express();
  app
    .use((req, res, next) => {
      if (
        req.get("X-Forwarded-Proto") === "https" ||
        req.hostname === "localhost"
      ) {
        next();
      } else if (
        req.get("X-Forwarded-Proto") !== "https" &&
        req.get("X-Forwarded-Port") !== "443"
      ) {
        //Redirect if not HTTP with original request URL
        res.redirect("https://" + req.hostname + req.url);
      }
    })
    .get("/favicon.ico", async (_, res) => {
      res.sendFile(path.resolve(__dirname + "/../../../../public/favicon.ico"));
    })

    .get("/tgFile/:id", async (req, res) => {
      try {
        const p = await container.resolve(UserModule).getFile(req.params.id);
        if (p) {
          res.set('Cache-control', `public, max-age=${60 * 60 * 24 * 7}`)
          res.sendFile(path.resolve(p));
        } else {
          res.status(404).send('file not found');
        }
      } catch (e) {
        console.error(e)
        res.status(500).send("unknown error");
      }

    })

    .get("/ics/:key/cal.ics", async (req, res) => {
      try {
        const [chat_descriptor, token] = (req.params.key as string)?.split('T') ?? [];
        const [chatId, threadId] = chat_descriptor?.split('_').map(Number) ?? [];
        checkChatToken(token, chatId);

        const icsModule = container.resolve(ICSModule);
        const data = await icsModule.getIcs(chatId, threadId);

        res.set('Content-disposition', 'attachment; filename=cal.ics');
        res.set('Content-Type', 'text/calendar; method="PUBLISH"');

        res.send(data);
      } catch (e) {
        console.error("Something went wrong:", e);
        if (e instanceof Error) {
          return res.status(500).send(e.message);
        } else {
          return res.status(500).send("Oops 🤷‍♂️");
        }
      }

    })

    .use(express.json({ limit: "500kb" }))
    .use(cookieParser());

  app.get("/enabledInChat/:chatId", cors({ origin: SPLIT_DOMAIN }), async (req, res) => {
    try {
      const chatMetaModule = container.resolve(ChatMetaModule);
      const chatId = Number.parseInt(req.params.chatId as string);
      res.send(!!await chatMetaModule.getChatMeta(chatId));
    } catch (e) {
      return res.status(500).send("Oops 🤷‍♂️")
    }
  });

  app.use(compression()).get("/tg/", async (req, res) => {
    const sw = new SW("get root page");
    sw.lap();
    try {
      const key = req.query.tgWebAppStartParam ?? req.cookies['pm_key'];
      const [chat_descriptor, token] = (key as string)?.split('T') ?? [];
      const [chatId, threadId] = chat_descriptor?.split('_').map(Number) ?? [];
      try {
        checkChatToken(token, chatId);
      } catch (e) {
        return res.send(_indexFileStr ?? await getIndexStrCachedPromise());
      } finally {
        sw.lap('auth');
      }

      const eventsModule = container.resolve(EventsModule);
      const userModule = container.resolve(UserModule);

      const userIdString = req.cookies.user_id;
      const userId = userIdString ? Number.parseInt(userIdString, 10) : undefined;
      if (userId !== undefined) {
        res.cookie('ssr_user_id', userId, { sameSite: 'none', secure: true });
      }

      const timeZone = req.cookies.time_zone;
      if (timeZone !== undefined) {
        res.cookie('ssr_time_zone', timeZone, { sameSite: 'none', secure: true });
      }
      sw.lap('check cookies');

      const { events } = await mesure(() => eventsModule.getEventsCached(chatId, threadId), 'getEventsCached')
      const users = events.reduce((users, event) => {
        const attendees = [...event.attendees.yes, ...event.attendees.maybe, ...event.attendees.no]
        attendees.map(userModule.getUserCached).filter(Boolean).map(u => users.add(u as SavedUser))
        return users
      }, new Set<SavedUser>)

      const eventsMap = new Map<string, VM<Event>>();
      savedEventsToApiLight(events).forEach(o => eventsMap.set(o.id, new VM(o)));

      const usersProvider = new UsersClientModule(userId);
      savedUsersToApi([...users], chatId, threadId).forEach(usersProvider.updateUser);
      sw.lap('get data');


      // const app = ''
      const app = ReactDOMServer.renderToString(
        <TimezoneContext.Provider value={timeZone}>
          <SplitAvailableContext.Provider value={req.cookies[`split_available_${chatId}`] === 'true'}>
            <UserContext.Provider
              value={userId}
            >
              <UsersProviderContext.Provider value={usersProvider}>
                <MainScreenView eventsVM={new VM(eventsMap)} />
              </UsersProviderContext.Provider>
            </UserContext.Provider>
          </SplitAvailableContext.Provider>
        </TimezoneContext.Provider>
      );
      sw.lap('render');

      const data = _indexFileStr ?? await getIndexStrCachedPromise();
      sw.lap('get index');

      const result = data.replace('<div id="root"></div>', `<div id="root">${app}</div>`);
      sw.lap('replace');

      res.send(result);
      sw.lap('send');

    } catch (e) {
      console.error("Something went wrong:", e);
      if (e instanceof Error) {
        return res.status(500).send(e.message);
      } else {
        return res.status(500).send("Oops 🤷‍♂️");
      }
    } finally {
      sw.report();
    }
  });
  app
    .use(function (_, res, next) {
      res.set("Cache-control", "public, max-age=86400000");
      next();
    })
    .use(express.static(path.resolve(__dirname + "/../../../../build")))
    .get("*", async (_, res) => {
      res.sendFile(path.resolve(__dirname + "/../../../../build/index.html"));
    });

  const server = createServer(app);
  let io = new Server(server, {
    transports: ["websocket"],
  });

  new SocketApi(io).init();
  container.resolve(TelegramBot).init();
  container.resolve(ICSModule).init();

  server.listen(PORT, () => console.log(`lll- on ${PORT}`));
}).catch(e => console.error(e));
