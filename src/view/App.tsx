import { AppearanceProvider } from "@twa-dev/mark42";
import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { SessionModel } from "../model/SessionModel";
import { UsersModule } from "../model/UsersModule";
import { EventScreen } from "./EventScreen";
import { MainScreen } from "./MainScreen";
import { ModelContext } from "./ModelContext";
import { SettingsScreen } from "./settigns/SettingsScreen";
import { HomeLoc, homeLoc } from "./utils/navigation/useGoHome";
import { useSSRReadyLocation } from "./utils/navigation/useSSRReadyLocation";
import { __DEV__ } from "./utils/webapp";

export const UserContext = React.createContext<number | undefined>(undefined);
export const UsersProviderContext = React.createContext<UsersModule>(new UsersModule());
export const SplitAvailableContext = React.createContext(false);
export const TimezoneContext = React.createContext<string | undefined>(undefined);

export const renderApp = (model: SessionModel) => {
    const router = createBrowserRouter([
        {
            path: "/tg",
            element: <MainScreen />,
        },
        {
            path: "/tg/addEvent",
            element: <EventScreen />,
        },
        {
            path: "/tg/editEvent",
            element: <EventScreen />,
        },
        {
            path: "/tg/settings",
            element: <SettingsScreen />,
        },
    ]);

    return <TimezoneContext.Provider value={Intl.DateTimeFormat().resolvedOptions().timeZone}>
        <SplitAvailableContext.Provider value={model.splitAvailableSync()}>
            <ModelContext.Provider value={model}>
                <UserContext.Provider value={model.tgWebApp.user.id}>
                    <UsersProviderContext.Provider value={model.users}>
                        <HomeLoc.Provider value={homeLoc}>
                            <AppearanceProvider platform={__DEV__ ? "ios" : undefined}>
                                <RouterProvider router={router} />
                            </AppearanceProvider>
                        </HomeLoc.Provider>
                    </UsersProviderContext.Provider>
                </UserContext.Provider>
            </ModelContext.Provider>
        </SplitAvailableContext.Provider>
    </TimezoneContext.Provider>
}

export const HomeLocSetup = () => {
    const homeLoc = React.useContext(HomeLoc);
    const loc = useSSRReadyLocation();
    if (!homeLoc.location) {
        homeLoc.location = loc;
    }
    return null
}