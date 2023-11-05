import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { SessionModel } from "../model/SessionModel";
import { UsersModule } from "../model/UsersModule";
import { MainScreen } from "./MainScreen";
import { ModelContext } from "./ModelContext";
import { Block, Card, Page } from "./uikit/kit";
import { BackButtonController } from "./uikit/tg/BackButtonController";
import { lazyPreload } from "./utils/lazyPreload";
import { HomeLoc, homeLoc } from "./utils/navigation/useGoHome";
import { useSSRReadyLocation } from "./utils/navigation/useSSRReadyLocation";
import { __DEV__ } from "./utils/webapp";
import { webAppReady } from "./utils/webAppReady";

export const UserContext = React.createContext<number | undefined>(undefined);
export const UsersProviderContext = React.createContext<UsersModule>(new UsersModule());
export const SplitAvailableContext = React.createContext(false);
export const TimezoneContext = React.createContext<string | undefined>(undefined);


export const renderApp = (model: SessionModel) => {
    const SettingsScreen = lazyPreload(() => import("./settigns/SettingsScreen"), webAppReady.promise);
    const EventScreen = lazyPreload(() => import("./EventScreen"));

    const router = createBrowserRouter([
        {
            path: "/tg",
            element: <MainScreen />,
        },
        {
            path: "/tg/addEvent",
            element:
                <ErrorBoundry>
                    <React.Suspense fallback={null}>
                        <EventScreen />
                    </React.Suspense>
                </ErrorBoundry>,
        },
        {
            path: "/tg/editEvent",
            element: <ErrorBoundry>
                <React.Suspense fallback={null}>
                    <EventScreen />
                </React.Suspense>
            </ErrorBoundry>,
        },
        {
            path: "/tg/settings",
            element:
                <ErrorBoundry>
                    <React.Suspense fallback={null}>
                        <SettingsScreen />
                    </React.Suspense>
                </ErrorBoundry>,
        },
    ]);

    return <TimezoneContext.Provider value={Intl.DateTimeFormat().resolvedOptions().timeZone}>
        <SplitAvailableContext.Provider value={model.splitAvailableSync()}>
            <ModelContext.Provider value={model}>
                <UserContext.Provider value={model.tgWebApp.user.id}>
                    <UsersProviderContext.Provider value={model.users}>
                        <HomeLoc.Provider value={homeLoc}>
                            <RouterProvider router={router} />

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

class ErrorBoundry extends React.Component<{ children: React.ReactNode }, { error?: Error }> {
    state: { error?: Error } = {}
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        this.setState({ error })
    }

    render(): React.ReactNode {
        return this.state.error ? <ErrorReturn error={this.state.error} /> : this.props.children
    }
}

const ErrorReturn = ({ error }: { error: Error }) => {
    return <><BackButtonController /><Page><Card><Block>{error.message}</Block></Card></Page></>
}