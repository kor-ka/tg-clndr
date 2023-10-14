import React from "react";
import { ChatSettings } from "./ChatSettings";
import { BackButtonController } from "../uikit/tg/BackButtonController";
import { UserSettings } from "./UserSettings";

export const SettingsScreen = () => {
    return <>
        <BackButtonController />
        <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 0px' }}>
            <UserSettings />
            <ChatSettings />
        </div>
    </>
}