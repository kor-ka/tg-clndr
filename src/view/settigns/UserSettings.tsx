import { Cell, Section, Switch } from "@twa-dev/mark42";
import React, { ChangeEvent } from "react";
import { SessionModel } from "../../model/SessionModel";
import { DurationDscrpitor as NotifyBeforeTime, NotifyBeforeOptions, UserSettings as UserSettingsEntity } from "../../shared/entity";
import { useVMvalue } from "../../utils/vm/useVM";
import { VM } from "../../utils/vm/VM";
import { ListItem, Card, CardLight } from "../uikit/kit";
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

    const saveNotifyBefore = React.useCallback((notifyBefore: NotifyBeforeTime | null) => {
        handleOperation(() => model.updateUserSettings({ notifyBefore }))
        settingsProxy.next({ ...settingsProxy.val, notifyBefore })
    }, [settings])

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
        handleOperation(() => model.updateUserSettings({ enableNotifications: val }))
        settingsProxy.next({ ...settingsProxy.val, enableNotifications: val })
    }, [settings])

    return <>
        <Section header="Global settings">
            <Cell
                description="Enable to allow bot to send you notifications about upcoming events"
                after={<Switch disabled={loading} checked={settings.enableNotifications} onChange={switchEnabledNotification} />}
            >
                Enable notifications
            </Cell>

            {settings.enableNotifications && <Cell
                description="Pick default notification time for events you attend"
                after={<select disabled={loading} onChange={onAlertChange} value={settings.notifyBefore || 'none'}>
                    <option value={'none'}>None</option>
                    {NotifyBeforeOptions.map(o => <option>{o}</option>)}
                </select>}
            >
                Default time
            </Cell>}
        </Section>
    </>
})))


