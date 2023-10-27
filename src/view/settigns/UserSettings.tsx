import React, { ChangeEvent } from "react";
import { SessionModel } from "../../model/SessionModel";
import { DurationDscrpitor as NotifyBeforeTime, NotifyBeforeOptions, UserSettings as UserSettingsEntity } from "../../shared/entity";
import { useVMvalue } from "../../utils/vm/useVM";
import { VM } from "../../utils/vm/VM";
import { ListItem, Card, CardLight } from "../uikit/kit";
import { Switch } from "../uikit/mark42/Switch";
import { useHandleOperation } from "../useHandleOperation";
import { reqestWriteAccess } from "../utils/webapp";
import { WithModel } from "../utils/withModelHOC";



export const UserSettings = WithModel(React.memo((({ model }: { model: SessionModel }) => {
    // apply change optimistically, then override with response result 
    const settingsProxy = React.useMemo(() => new VM<UserSettingsEntity>(model.userSettings.val), [])
    React.useEffect(() => {
        model.userSettings.subscribe(settingsProxy.next)
    }, [settingsProxy])
    const settings = useVMvalue(settingsProxy)


    const [handleOperation, loading] = useHandleOperation()
    const revert = React.useCallback(() => settingsProxy.next(model.userSettings.val), [settingsProxy, model])

    const saveNotifyBefore = React.useCallback((notifyBefore: NotifyBeforeTime | null) => {
        settingsProxy.next({ ...settingsProxy.val, notifyBefore })
        handleOperation(() => model.updateUserSettings({ notifyBefore })).catch(revert)
    }, [settings, revert])

    const onAlertChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        saveNotifyBefore(e.target.value === 'none' ? null : e.target.value as any)
    }, [])

    const switchEnabledNotification = React.useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
        const val = e.target.checked;
        if (val && !settings.enableNotifications) {
            if (!(await reqestWriteAccess())) {
                return;
            }
        }
        settingsProxy.next({ ...settingsProxy.val, enableNotifications: val })
        await handleOperation(() => model.updateUserSettings({ enableNotifications: val })).catch(revert)
    }, [settings, revert])
    console.log(settings.enableNotifications)

    return <>
        <CardLight><ListItem subtitle="Global settings" /></CardLight>
        <Card >
            <ListItem
                titile="Enable notifications"
                subtitle="Enable to allow bot to send you notifications about upcoming events"
                right={<>
                    <Switch onChange={switchEnabledNotification} checked={settings.enableNotifications} type="checkbox" disabled={loading} />
                </>}
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


