import React from "react";
import { ChatSettings } from "./ChatSettings";
import { BackButtonController } from "../uikit/tg/BackButtonController";
import { MainButtonController } from "../uikit/tg/MainButtonController";
import { UserSettings } from "./UserSettings";
import { WebApp } from "../utils/webapp";
import { AppearanceProvider } from "@twa-dev/mark42";
import { resolveThemeByPlatform } from "../uikit/matk42";

const SettingsScreen = () => {
    const onClickStub = React.useCallback(() => { }, []);
    console.log(WebApp?.platform)
    return <>
        <AppearanceProvider platform={WebApp.platform} theme={resolveThemeByPlatform(WebApp.platform)} colorScheme={WebApp.colorScheme}>
            <BackButtonController />
            <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 0px' }}>
                <UserSettings />
                <ChatSettings />
            </div>
            <MainButtonController onClick={onClickStub} isVisible={false} />
        </AppearanceProvider>
    </>
}

export default SettingsScreen