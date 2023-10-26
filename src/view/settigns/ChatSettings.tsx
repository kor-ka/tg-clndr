import { Cell, Section, Switch } from "@twa-dev/mark42";
import React, { ChangeEvent } from "react";
import { SessionModel } from "../../model/SessionModel";
import { ChatSettings as ChatSettingsEntity } from "../../shared/entity";
import { useVMvalue } from "../../utils/vm/useVM";
import { VM } from "../../utils/vm/VM";
import { useHandleOperation } from "../useHandleOperation";
import { WithModel } from "../utils/withModelHOC";

export const ChatSettings = WithModel(React.memo((({ model }: { model: SessionModel }) => {
    const context = useVMvalue(model.context)

    // apply change optimistically, then override with response result 
    const settingsProxy = React.useMemo(() => new VM<ChatSettingsEntity>(model.chatSettings.val), [])
    React.useEffect(() => {
        model.chatSettings.subscribe(settingsProxy.next)
    }, [settingsProxy])
    const settings = useVMvalue(settingsProxy)

    const [handleOperation, loading] = useHandleOperation()

    const switchPublicEdit = React.useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const val = e.target.checked;
        handleOperation(() => model.updateChatSettings({ allowPublicEdit: val }))
        settingsProxy.next({ ...settingsProxy.val, allowPublicEdit: val })
    }, [settings, settingsProxy])

    const switchSendMessage = React.useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const val = e.target.checked;
        handleOperation(() => model.updateChatSettings({ enableEventMessages: val }))
        settingsProxy.next({ ...settingsProxy.val, enableEventMessages: val })
    }, [settings, settingsProxy])

    return (context.isAdmin) ?
        <Section header="Chat settings">
            {!context.isPrivate &&
                <Cell
                    description="Enable to allow non-admin users to create/edit/delete events"
                    after={<Switch disabled={loading} checked={settings.allowPublicEdit} onChange={switchPublicEdit} />}
                >
                    Allow public access
                </Cell>
            }
            <Cell
                description="Enable to send message to the chat when a new event is created"
                after={<Switch disabled={loading} checked={settings.enableEventMessages} onChange={switchSendMessage} />}
            >
                Send events messages
            </Cell>
        </Section>
        : null
})))


