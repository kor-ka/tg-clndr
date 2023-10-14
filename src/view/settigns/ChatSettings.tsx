import React from "react";
import { SessionModel } from "../../model/SessionModel";
import { useVMvalue } from "../../utils/vm/useVM";
import { ListItem, Card, CardLight } from "../uikit/kit";
import { useHandleOperation } from "../useHandleOperation";
import { WithModel } from "../utils/withModelHOC";

export const ChatSettings = WithModel(React.memo((({ model }: { model: SessionModel }) => {
    const settings = useVMvalue(model.chatSettings)
    const context = useVMvalue(model.context)

    const [handleOperation, loading] = useHandleOperation()

    const switchPublicEdit = React.useCallback(() => {
        handleOperation(() => model.updateChatSettings({ allowPublicEdit: !settings.allowPublicEdit }))
    }, [settings])

    const switchSendMessage = React.useCallback(() => {
        handleOperation(() => model.updateChatSettings({ enableEventMessages: !settings.enableEventMessages }))
    }, [settings])

    return (context.isAdmin) ? <>
        <CardLight><ListItem subtitle="Chat settings" /></CardLight>
        <Card >
            <ListItem
                onClick={switchPublicEdit}
                titile="Allow public access"
                subtitle="Enable to allow non-admin users to create/edit/delete events"
                right={<>
                    <input checked={settings.allowPublicEdit} readOnly={true} type="checkbox" disabled={loading} style={{ width: 20, height: 20, accentColor: 'var(--tg-theme-button-color)' }} /></>}
            />
            <ListItem
                onClick={switchSendMessage}
                titile="Send even message"
                subtitle="Enable to send message to the chat each time a new event created"
                right={<>
                    <input checked={settings.enableEventMessages} readOnly={true} type="checkbox" disabled={loading} style={{ width: 20, height: 20, accentColor: 'var(--tg-theme-button-color)' }} /></>}
            /></Card>
    </> : null
})))


