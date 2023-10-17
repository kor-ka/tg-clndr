import { getItem, reqestWriteAccess, setItem, showConfirm } from "../view/utils/webapp";
import { SessionModel } from "./SessionModel";

export class NotificationsModule {
    constructor(private model: SessionModel) {
        model.ready.promise.then(this.reqestEnableNotificationsOnce).catch(e => console.error(e))
    }

    reqestEnableNotificationsOnce = async () => {
        await new Promise<void>(resolve => {
            this.model.eventsModule.events.subscribe(e => {
                if (e.size > 0) {
                    resolve()
                }
            })
        })
        if (!this.model.userSettings.val.enableNotifications) {
            const notificationsRequested = await getItem('notifications_enable_requested')
            if (!notificationsRequested) {
                showConfirm("This bot can notify you about upcoming events by sending you a message. Enable notifications?", async confirmed => {
                    if (confirmed) {
                        const granted = await reqestWriteAccess()
                        if (granted) {
                            await this.model.updateUserSettings({ enableNotifications: true, notifyBefore: '1h' })
                        }
                    }
                    await setItem('notifications_enable_requested', 'true')
                })
            }
        }
    }
}