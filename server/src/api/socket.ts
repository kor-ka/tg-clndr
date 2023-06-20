import * as socketIo from "socket.io";
import { ClientAPI } from "./ClientAPI";
export class SocketApi {
  clientAPI: ClientAPI;
  constructor(socket: socketIo.Server) {
    this.clientAPI = new ClientAPI(socket);
  }

  init = () => {
    try {
      this.clientAPI.init();
    } catch (e) {
      console.warn("cant init swocket api:")
      console.error(e)
    }

  };
}
