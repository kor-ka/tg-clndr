import React from "react";
import { SessionModel } from "../model/SessionModel";
import { useVMvalue } from "../utils/vm/useVM";
import { ModelContext } from "./MainScreen";
import { ListItem, Card, CardLight } from "./uikit/kit";
import { useHandleOperation } from "./useHandleOperation";


// TODO: extract withModel HOC
export const SettingsComponent = React.memo(() => {
    const model = React.useContext(ModelContext)
    return model ? <SettingsView model={model} /> : null
})

const SettingsView = React.memo(({ model }: { model: SessionModel }) => {
    const settings = useVMvalue(model.settings)
    const context = useVMvalue(model.context)

    const [handleOperation, loading] = useHandleOperation()

    const switchPublicEdit = React.useCallback(() => {
        handleOperation(() => model.updateSettings({ allowPublicEdit: !settings.allowPublicEdit }))
    }, [settings])

    const switchSendMessage = React.useCallback(() => {
        handleOperation(() => model.updateSettings({ enableEventMessages: !settings.enableEventMessages }))
    }, [settings])

    return context.isAdmin ? <>
        <CardLight style={{ marginTop: 24 }}><ListItem subtitle="Admin settings" /></CardLight>
        <Card >
            <ListItem
                onClick={switchPublicEdit}
                titile="Pulic edit enabled"
                subtitle="Enable to allow non-admin users to create/edit/delete events"
                right={<>
                    <input checked={settings.allowPublicEdit} readOnly={true} type="checkbox" disabled={loading} style={{ width: 20, height: 20, accentColor: 'var(--tg-theme-button-color)' }} /></>}
            />
            <ListItem
                onClick={switchSendMessage}
                titile="Send even message"
                subtitle="Enable to send message to the chat each time new event created"
                right={<>
                    <input checked={settings.enableEventMessages} readOnly={true} type="checkbox" disabled={loading} style={{ width: 20, height: 20, accentColor: 'var(--tg-theme-button-color)' }} /></>}
            /></Card>
    </> : null
})

