import React from "react";
import { SessionModel } from "../../model/SessionModel";
import { DurationDscrpitor as NotifyBeforeTime, NotifyBeforeOptions } from "../../shared/entity";
import { useVMvalue } from "../../utils/vm/useVM";
import { ListItem, Card, CardLight } from "../uikit/kit";
import { useHandleOperation } from "../useHandleOperation";
import { reqestWriteAccess } from "../utils/webapp";
import { WithModel } from "../utils/withModelHOC";



export const UserSettings = WithModel(React.memo((({ model }: { model: SessionModel }) => {
    const settings = useVMvalue(model.userSettings)

    const [handleOperation, loading] = useHandleOperation()

    const saveNotifyBefore = React.useCallback((notifyBefore: NotifyBeforeTime | null) => {
        handleOperation(() => model.updateUserSettings({ notifyBefore }))
    }, [settings])

    const onAlertChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        saveNotifyBefore(e.target.value === 'none' ? null : e.target.value as any)
    }, [])

    const switchEnabledNotification = React.useCallback(async () => {
        if (!settings.enableNotifications) {
            if (!(await reqestWriteAccess())) {
                return;
            }
        }
        handleOperation(() => model.updateUserSettings({ enableNotifications: !settings.enableNotifications }))
    }, [settings])

    return <>
        <CardLight><ListItem subtitle="Global settings" /></CardLight>
        <Card >
            <ListItem
                onClick={switchEnabledNotification}
                titile="Enable notifications"
                subtitle="Enable to allow bot send you notificaions about events"
                right={<>
                    <input checked={settings.enableNotifications} readOnly={true} type="checkbox" disabled={loading} style={{ width: 20, height: 20, accentColor: 'var(--tg-theme-button-color)' }} /></>}
            />
            {settings.enableNotifications && <ListItem
                titile="Default time"
                subtitle="Pick default notification time for events you attend"
                right={
                    <select disabled={loading} onChange={onAlertChange} value={settings.notifyBefore || 'none'}>
                        <option value={'none'}>None</option>
                        {NotifyBeforeOptions.map(o => <option>{o}</option>)}
                    </select>
                } />}
        </Card>
    </>
})))


