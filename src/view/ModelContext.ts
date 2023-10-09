import React from "react";
import { SessionModel } from "../model/SessionModel";

export const ModelContext = React.createContext<SessionModel | undefined>(undefined);
