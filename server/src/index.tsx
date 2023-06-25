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
import { MainScreenView, SplitAvailable, Timezone, UserContext, UsersProvider } from "../../src/view/MainScreen";
import { Event } from "../../src/shared/entity";
import { EventsModule } from "./modules/eventsModule/EventsModule";
import { savedOpsToApi, savedUserToApi } from "./api/ClientAPI";
import { UsersModule as UsersClientModule } from "../../src/model/UsersModule";
import { UserModule } from "./modules/userModule/UserModule";
import { VM } from "../../src/utils/vm/VM";
import { ChatMetaModule } from "./modules/chatMetaModule/ChatMetaModule";
import { ICSModule } from "./modules/icsModule/ICSModule";
import { checkChatToken } from "./api/Auth";
import cors from "cors";

var path = require("path");
const PORT = process.env.PORT || 5001;

const SPLIT_DOMAIN = 'https://tg-split.herokuapp.com';

export const appRoot = path.resolve(__dirname);

const indexFilePath = path.resolve(__dirname + "/../../../../build/index.html");

const getIndexStrPromise = () => {
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
let _indexFileStr: Promise<string> | undefined;

const getIndexStr = () => {
  if (!_indexFileStr) {
    _indexFileStr = getIndexStrPromise().catch((e) => {
      _indexFileStr = undefined;
      throw e;
    });
  }
  return _indexFileStr;
};

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

    .get("/ics/:key/cal.ics", async (req, res) => {
      try {
        const chatMetaModule = container.resolve(ChatMetaModule)
        const icsModule = container.resolve(ICSModule)

        const [chat_descriptor, token] = (req.params.key as string).split('T') ?? [];
        const [chatId, threadId] = chat_descriptor.split('_').map(Number) ?? [];
        const [data, chatMeta] = await Promise.all([icsModule.getIcs(chatId, threadId), chatMetaModule.getChatMeta(chatId)]);

        try {
          checkChatToken(token, chatId);
        } catch (e) {
          if ((chatMeta?.token ?? undefined) !== token) {
            throw new Error("unauthorized")
          }
        }

        res.set('Content-disposition', 'attachment; filename=cal.ics');
        res.set('Content-Type', 'text/calendar');

        res.send(data)
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
    const chatMetaModule = container.resolve(ChatMetaModule);
    const chatId = Number.parseInt(req.params.chatId as string);
    res.send(!!await chatMetaModule.getChatMeta(chatId))
  });

  app.use(compression()).get("/tg/", async (req, res) => {
    try {
      const eventsModule = container.resolve(EventsModule);
      const chatMetaModule = container.resolve(ChatMetaModule)

      const [chat_descriptor, token] = (req.query.tgWebAppStartParam as string).split('T') ?? [];
      const [chatId, threadId] = chat_descriptor.split('_').map(Number) ?? [];

      const userIdString = req.cookies.user_id;
      const userId = userIdString ? Number.parseInt(userIdString, 10) : undefined
      if (userId !== undefined) {
        res.cookie('ssr_user_id', userId, { sameSite: 'none', secure: true })
      }

      const timeZone = req.cookies.time_zone
      if (timeZone !== undefined) {
        res.cookie('ssr_time_zone', timeZone, { sameSite: 'none', secure: true })
      }

      const [{ events }, chatMeta] = await Promise.all([eventsModule.getEventsCached(chatId, threadId), chatMetaModule.getChatMeta(chatId)])

      try {
        checkChatToken(token, chatId);
      } catch (e) {
        if ((chatMeta?.token ?? undefined) !== token) {
          throw new Error("unauthorized")
        }
      }

      const eventsMap = new Map<string, VM<Event>>()
      savedOpsToApi(events).forEach(o => eventsMap.set(o.id, new VM(o)))

      const users = await container.resolve(UserModule).getUsersCached(chatId)
      const usersProvider = new UsersClientModule(userId)
      savedUserToApi(users, chatId).forEach(usersProvider.updateUser)



      // const app = ''
      const app = ReactDOMServer.renderToString(
        <Timezone.Provider value={timeZone}>
          <SplitAvailable.Provider value={!!req.cookies.split_available}>
            <UserContext.Provider
              value={userId}
            >
              <UsersProvider.Provider value={usersProvider}>
                <MainScreenView eventsVM={new VM(eventsMap)} />
              </UsersProvider.Provider>
            </UserContext.Provider>
          </SplitAvailable.Provider>
        </Timezone.Provider>
      );
      const data = await getIndexStr();
      res.send(
        data.replace('<div id="root"></div>', `<div id="root">${app}</div>`)
      );
    } catch (e) {
      console.error("Something went wrong:", e);
      if (e instanceof Error) {
        return res.status(500).send(e.message);
      } else {
        return res.status(500).send("Oops 🤷‍♂️");
      }
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
  new TelegramBot().init();
  container.resolve(ICSModule).init();

  server.listen(PORT, () => console.log(`lll- on ${PORT}`));
}).catch(e => console.error(e));
