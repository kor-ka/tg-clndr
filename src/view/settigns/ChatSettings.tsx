import React, { ChangeEvent } from "react";
import { SessionModel } from "../../model/SessionModel";
import { ChatSettings as ChatSettingsEntity } from "../../shared/entity";
import { useVMvalue } from "../../utils/vm/useVM";
import { VM } from "../../utils/vm/VM";
import { ListItem, Card, CardLight } from "../uikit/kit";
import { Switch } from "../uikit/mark42/Switch";
import { useHandleOperation } from "../useHandleOperation";
import { WithModel } from "../utils/withModelHOC";

export const ChatSettings = WithModel(React.memo((({ model }: { model: SessionModel }) => {
    const context = useVMvalue(model.context);
    // apply change optimistically, then override with response result 
    const settingsProxy = React.useMemo(() => new VM<ChatSettingsEntity>(model.chatSettings.val), []);
    React.useEffect(() => {
        model.chatSettings.subscribe(settingsProxy.next);
    }, [settingsProxy]);
    const settings = useVMvalue(settingsProxy);

    const [handleOperation, loading] = useHandleOperation();
    const revert = React.useCallback(() => settingsProxy.next(model.chatSettings.val), [settingsProxy, model]);

    const switchPublicEdit = React.useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const val = e.target.checked;
        settingsProxy.next({ ...settingsProxy.val, allowPublicEdit: val });
        handleOperation(() => model.updateChatSettings({ allowPublicEdit: val })).catch(revert);
    }, [settings, settingsProxy, revert]);

    const switchSendMessage = React.useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const val = e.target.checked;
        settingsProxy.next({ ...settingsProxy.val, enableEventMessages: val });
        handleOperation(() => model.updateChatSettings({ enableEventMessages: val })).catch(revert);
    }, [settings, settingsProxy, revert])

    return (context.isAdmin) ? <>
        <CardLight><ListItem subtitle="Chat settings" /></CardLight>
        <Card >
            {!context.isPrivate && <ListItem
                titile="Allow public access"
                subtitle="Enable to allow non-admin users to create/edit/delete events"
                right={<Switch onChange={switchPublicEdit} checked={settings.allowPublicEdit} type="checkbox" disabled={loading} />}
            />}
            <ListItem
                titile="Send events messages"
                subtitle="Enable to send message to the chat when a new event is created"
                right={<Switch onChange={switchSendMessage} checked={settings.enableEventMessages} readOnly={true} type="checkbox" disabled={loading} />}
            /></Card>
    </> : null
})))


