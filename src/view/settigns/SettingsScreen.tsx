import React from "react";
import { ChatSettings } from "./ChatSettings";
import { BackButtonController } from "../uikit/tg/BackButtonController";
import { MainButtonController } from "../uikit/tg/MainButtonController";
import { UserSettings } from "./UserSettings";
import { WebApp } from "../utils/webapp";

const SettingsScreen = () => {
    const onClickStub = React.useCallback(() => { }, []);
    console.log(WebApp?.platform)
    return <>
        <BackButtonController />
        <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 0px' }}>
            <UserSettings />
            <ChatSettings />
        </div>
        <MainButtonController onClick={onClickStub} isVisible={false} />
    </>
}

export default SettingsScreen